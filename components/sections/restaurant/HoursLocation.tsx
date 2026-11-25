/**
 * Sección `hours_location` — «Horario y sedes» (Figma Locations 144:6644).
 *
 * Sin directiva de cliente a propósito: el manifiesto del sitio lee
 * `HoursLocation.CONTENT_KEYS` desde un route handler. Aquí se normaliza el
 * contenido y se arman los datos de cada sede; el estado «Abierto ahora» y la
 * interacción viven en HoursLocationView (cliente).
 *
 * Datos: `data.sedesRestaurante` (una consulta cacheada de `branches`, ver
 * lib/restaurant/sedes.ts), precargado por `app/[[...slug]]/page.tsx`.
 */

import type { OrganizationWithDetails } from '@/types/database'
import { direccionCompleta, sedeAceptaReservas, type SedesRestaurante } from '@/lib/restaurant/sedes-modelo'
import { HoursLocationView, type HoursLocationVariant, type SedeVista } from './HoursLocationView'
import { urlComoLlegar, urlLlamar, urlMapaEmbebido } from '@/lib/maps/comoLlegar'
import { conPrefijo } from '@/lib/outlet/rutaSitio'
import { whatsappDe } from '@/lib/website/menuInferior'
import { datosContactoDe, whatsappDeTienda } from '@/lib/website/v2/contrato/paginaContacto'

/** Claves de `content` que lee la sección (contrato editor ↔ sitio, F0.6). */
export const CONTENT_KEYS = [
  'eyebrow',
  'title',
  'subtitle',
  'branch_ids',
  'show_map',
  'show_photos',
  'show_call',
  'show_directions',
  'show_reserve',
  'reserve_url',
  'show_order',
  'order_url',
  // Contacto v2 (Figma 3112:86965): sede que se abre primero y botón de WhatsApp por sede.
  'featured_branch_id',
  'show_whatsapp',
] as const

const VARIANTS: readonly HoursLocationVariant[] = ['hours_map', 'cards', 'list']

interface HoursLocationProps {
  content: Record<string, unknown>
  organization: OrganizationWithDetails
  data?: Record<string, unknown>
  sectionVariant?: string
  sectionId?: string
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function bool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

function safeUrl(value: unknown): string | null {
  const url = str(value)
  if (!url) return null
  return /^(https?:\/\/|\/|#)/i.test(url) ? url : null
}

function idsDe(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.map(Number).filter((n) => Number.isInteger(n) && n > 0)
}

function esSedesRestaurante(v: unknown): v is SedesRestaurante {
  return typeof v === 'object' && v !== null && Array.isArray((v as { sedes?: unknown }).sedes)
}

/** `?sede=<id>` antes del ancla: «#reservar» → «?sede=3#reservar». */
function conSede(url: string, sedeId: number): string {
  const [ruta, ancla] = url.split('#')
  const sep = ruta.includes('?') ? '&' : '?'
  return `${ruta}${sep}sede=${sedeId}${ancla !== undefined ? `#${ancla}` : ''}`
}

export function HoursLocation({ content, organization, data, sectionVariant, sectionId }: HoursLocationProps) {
  const variant: HoursLocationVariant = VARIANTS.includes(sectionVariant as HoursLocationVariant)
    ? (sectionVariant as HoursLocationVariant)
    : 'hours_map'

  const datos = esSedesRestaurante(data?.sedesRestaurante) ? data.sedesRestaurante : null
  const sedePagina = typeof data?.branchId === 'number' ? data.branchId : null
  const elegidas = idsDe(content.branch_ids)

  const showReserve = bool(content.show_reserve, true)
  const reserveUrl = safeUrl(content.reserve_url) ?? '#reservar'
  // «Pedir»: enlace configurado (WhatsApp/plataforma) o el pedido en línea del sitio.
  const orderUrlConfigurada = safeUrl(content.order_url)
  const pedidoEnLinea = organization.website_settings?.enable_online_ordering === true
  const showOrder = bool(content.show_order, true) && (orderUrlConfigurada !== null || pedidoEnLinea)
  const orderUrl = orderUrlConfigurada ?? '/menu'
  const showCall = bool(content.show_call, true)
  const showDirections = bool(content.show_directions, true)
  // WhatsApp por sede: la sede no tiene número propio en `branches`, así que usa el del sitio
  // (Configuración › WhatsApp o, si no hay, el teléfono de contacto cuando es un celular: la misma
  // regla del canal WhatsApp de Contacto) con un mensaje que nombra la sede. Apagado por defecto: las
  // secciones guardadas antes no cambian.
  const numeroWhatsapp = bool(content.show_whatsapp, false)
    ? whatsappDeTienda(datosContactoDe(organization, organization.website_settings))?.numero ?? null
    : null
  const destacada = Number(content.featured_branch_id)

  const sedes: SedeVista[] = (datos?.sedes ?? [])
    .filter((s) => (sedePagina !== null && elegidas.length === 0 ? s.id === sedePagina : true))
    .filter((s) => elegidas.length === 0 || elegidas.includes(s.id))
    .map((s) => {
      const direccion = direccionCompleta(s)
      const lugar = { lat: s.lat, lng: s.lng, direccion }
      const pedir =
        showOrder
          ? /^\//.test(orderUrl) && !orderUrlConfigurada && s.publicada && s.slug
            ? conPrefijo(orderUrl, `/${s.slug}`)
            : orderUrl
          : null
      return {
        id: s.id,
        nombre: s.nombre,
        direccion,
        telefono: s.telefono,
        telHref: showCall ? urlLlamar(s.telefono) : null,
        comoLlegar: showDirections ? urlComoLlegar(lugar) : null,
        mapaEmbed: urlMapaEmbebido(lugar),
        horario: s.horario,
        zonaHoraria: s.zonaHoraria,
        foto: s.foto,
        lat: s.lat,
        lng: s.lng,
        reservar: showReserve && datos && sedeAceptaReservas(s, datos) ? conSede(reserveUrl, s.id) : null,
        pedir,
        whatsapp: numeroWhatsapp ? whatsappDe(numeroWhatsapp, `Hola, les escribo por la sede ${s.nombre}`) : null,
      }
    })
  // «Sede que se abre primero»: va de primera (y es la que se ve en «Horario y mapa»).
  if (Number.isInteger(destacada) && destacada > 0) {
    const i = sedes.findIndex((s) => s.id === destacada)
    if (i > 0) sedes.unshift(...sedes.splice(i, 1))
  }

  return (
    <HoursLocationView
      variant={variant}
      sedes={sedes}
      sinDatos={datos === null}
      eyebrow={'eyebrow' in content ? str(content.eyebrow) : 'Visítanos'}
      title={str(content.title)}
      subtitle={str(content.subtitle)}
      showMap={bool(content.show_map, true)}
      showPhotos={bool(content.show_photos, true)}
      cardContent={content}
      sectionKey={(sectionId || 'sedes').slice(0, 8)}
    />
  )
}

HoursLocation.CONTENT_KEYS = CONTENT_KEYS
