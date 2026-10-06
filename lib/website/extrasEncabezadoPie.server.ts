/**
 * Datos que piden las opciones nuevas del encabezado y del pie (lib/website/encabezadoPie.ts):
 * enlaces de WhatsApp / «Cómo llegar» / llamar, la sede con su horario para «Abierto ahora»,
 * el mapa, los medios de pago, los cupos libres del parqueadero, las categorías de la carta y
 * las acciones de la barra fija del celular.
 *
 * Coste por render (regla de CLAUDE.md: nada de consultas nuevas sin caché):
 * - Siempre: nada nuevo. `getSedesWeb` y `getAjustesSitio` ya los lee el layout (react.cache +
 *   cacheStructural), la organización ya está en memoria.
 * - Solo si el sitio activó la opción, y cacheado entre peticiones (cacheStructural):
 *   medios de pago (footer_show_payment_methods), cupos libres (topbar_show_availability, solo
 *   parqueaderos), categorías de la carta (header_menu_source = categorias_carta, solo
 *   restaurantes), páginas publicadas (barra móvil con lista o barra de reserva).
 * Con todas las opciones en su default (los 83 sitios de hoy) no se ejecuta ninguna consulta nueva.
 *
 * Cualquier fallo → el dato en vacío y el sitio como antes (se registra).
 */
import { cache } from 'react'
import type { OrganizationWithDetails, WebsiteSettings } from '@/types/database'
import { createAdminClient } from '@/lib/supabase/server'
import { cacheStructural, CONTENT_TTL } from '@/lib/supabase/cache'
import { getBranchesByOrg, getOrganizationCategories } from '@/lib/supabase/queries'
import { getSedesWeb } from '@/lib/restaurant/sedes'
import { DIAS, horarioDeSede, horarioRevisado, parseHorario, normalizarDias, turnosDe, type HorarioSemana, type Tramo } from '@/lib/restaurant/horario'
import { urlComoLlegar, urlLlamar, urlMapaEmbebido } from '@/lib/maps/comoLlegar'
import { getPaginasPublicas, rutaDePaginaCon } from '@/lib/seo/paginasPublicas'
import { getCartasPublicas } from '@/lib/menu/cartasPublicas.server'
import { conPrefijo } from '@/lib/outlet/rutaSitio'
import { enlaceWhatsapp, type AjustesSitio } from './ajustesSitio'
import {
  EXTRAS_VACIOS,
  opcionesEncabezadoPie,
  type AccionBarra,
  type AccionBarraMovil,
  type EnlacesSitio,
  type ExtrasEncabezadoPie,
  type ItemMenuCarta,
} from './encabezadoPie'
import type { DatosSedeLayout } from '@/lib/outlet/sedeLayout'

const DIA_CORTO = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'] as const

/** «18–23 h», «12:30–15 h · 19–23 h». */
function horasCompactas(t: Tramo): string {
  const h = (x: string) => (x.endsWith(':00') ? String(Number(x.slice(0, 2))) : `${Number(x.slice(0, 2))}:${x.slice(3, 5)}`)
  return `${turnosDe(t).map((x) => `${h(x.abre)}–${h(x.cierra)}`).join(' · ')} h`
}

/**
 * Horario compacto para el pie: días seguidos con el mismo horario en un tramo («mar–sáb 18–23 h
 * · dom 13–22 h»). Los cerrados no salen. `null` sin horario.
 */
export function resumenHorario(horario: HorarioSemana | null): string | null {
  if (!horario) return null
  const grupos: { desde: number; hasta: number; horas: string }[] = []
  DIAS.forEach((d, i) => {
    const t = horario[d]
    if (!t) return
    const horas = horasCompactas(t)
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.hasta === i - 1 && ultimo.horas === horas) ultimo.hasta = i
    else grupos.push({ desde: i, hasta: i, horas })
  })
  if (grupos.length === 0) return null
  return grupos
    .map((g) => `${g.desde === g.hasta ? DIA_CORTO[g.desde] : `${DIA_CORTO[g.desde]}–${DIA_CORTO[g.hasta]}`} ${g.horas}`)
    .join(' · ')
}

const TIPO_RESTAURANTE = 1
const TIPO_PARQUEADERO = 7

/** Nombres de los medios de pago visibles en la web, en el orden del ERP. Columnas verificadas por MCP el 2026-10-06. */
async function getMediosPagoUncached(organizationId: number): Promise<string[]> {
  const supabase = createAdminClient()
  if (!supabase) return []
  const { data, error } = await (supabase as any)
    .from('organization_payment_methods')
    .select('payment_method_code, website_display_name, website_display_order, payment_methods (name)')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .eq('show_on_website', true)
    .order('website_display_order', { ascending: true, nullsFirst: false })
  if (error) {
    console.error('[pie] Error leyendo medios de pago', { organizationId, error: error.message })
    return []
  }
  const nombres = ((data ?? []) as any[])
    .map((m) => String(m.website_display_name || m.payment_methods?.name || m.payment_method_code || '').trim())
    .filter(Boolean)
  return Array.from(new Set(nombres)).slice(0, 8)
}
const getMediosPago = cacheStructural('getMediosPagoPie', getMediosPagoUncached, CONTENT_TTL)

/** Espacios `free` de las sedes activas del parqueadero (parking_spaces no lleva organization_id). */
async function getCuposLibresUncached(organizationId: number): Promise<number | null> {
  const supabase = createAdminClient()
  if (!supabase) return null
  const sedes = (await getBranchesByOrg(organizationId)) as { id: number }[]
  if (sedes.length === 0) return null
  const { count, error } = await (supabase as any)
    .from('parking_spaces')
    .select('id', { count: 'exact', head: true })
    .in('branch_id', sedes.map((s) => s.id))
    .eq('state', 'free')
  if (error) {
    console.error('[encabezado] Error contando cupos libres', { organizationId, error: error.message })
    return null
  }
  return typeof count === 'number' ? count : null
}
const getCuposLibres = cacheStructural('getCuposLibresEncabezado', getCuposLibresUncached, CONTENT_TTL)

/** Categorías de la carta vigente (o la primera) con su nombre, enlazadas a la página de la carta. */
async function categoriasDeCarta(organizationId: number, branchId: number | null, rutaCarta: string): Promise<ItemMenuCarta[] | null> {
  const cartas = await getCartasPublicas(organizationId, branchId)
  const carta = cartas?.cartas.find((c) => c.vigente) ?? cartas?.cartas[0] ?? null
  if (!carta) return null
  const categorias = ((await getOrganizationCategories(organizationId)) ?? []) as { id: number; name: string; slug: string }[]
  const porId = new Map(categorias.map((c) => [Number(c.id), c]))
  const items = carta.secciones
    .map((s) => porId.get(s.categoriaId))
    .filter((c): c is { id: number; name: string; slug: string } => !!c && !!c.slug)
    .map((c) => ({ name: c.name, href: `${rutaCarta}#cat-${encodeURIComponent(c.slug)}` }))
  return items.length > 0 ? items.slice(0, 8) : null
}

export const getExtrasEncabezadoPie = cache(async (
  organization: OrganizationWithDetails,
  settings: WebsiteSettings | null,
  datosSede: DatosSedeLayout,
  ajustesSitio: AjustesSitio,
): Promise<ExtrasEncabezadoPie> => {
  try {
    const ajustes = (settings ?? null) as unknown as Record<string, unknown> | null
    const op = opcionesEncabezadoPie(ajustes)
    const prefijo = datosSede.prefijoSede
    const tipo = organization.type_id

    // Sede de la página o la principal (getSedesWeb ya lo leyó el layout: react.cache).
    const sedes = await getSedesWeb(organization.id)
    const sede = (datosSede.sedeActualId !== null ? sedes.find((s) => s.id === datosSede.sedeActualId) : null)
      ?? sedes.find((s) => s.esPrincipal) ?? sedes[0] ?? null
    const zona = sede?.zonaHoraria ?? organization.timezone ?? 'America/Bogota'
    const direccionOrg = [organization.address, organization.city].filter(Boolean).join(', ') || null
    const lugar = sede
      ? { lat: sede.lat, lng: sede.lng, direccion: [sede.direccion, sede.ciudad].filter(Boolean).join(', ') || null }
      : { direccion: direccionOrg }
    const horario = (sede ? horarioDeSede(sede.horarioJson) : null)
      ?? datosSede.horarioPie
      ?? parseHorario(normalizarDias((settings as any)?.business_hours))

    const enlaces: EnlacesSitio = {
      whatsapp: ajustesSitio.whatsapp ? enlaceWhatsapp(ajustesSitio.whatsapp) : null,
      comoLlegar: urlComoLlegar(lugar),
      llamar: urlLlamar(sede?.telefono ?? organization.phone),
    }
    const umbral = Number((settings as any)?.free_shipping_threshold)

    const necesitaPaginas = Array.isArray(op.barraMovil) || op.fuenteMenu === 'categorias_carta'
    const paginas = necesitaPaginas ? await getPaginasPublicas(organization.id, datosSede.sedeActualId) : []
    const rutaCarta = conPrefijo(rutaDePaginaCon(paginas, ['menu_full', 'menu_preview']) ?? '/menu', prefijo)

    const [mediosPago, cuposLibres, categoriasCarta] = await Promise.all([
      op.pie.mediosPago ? getMediosPago(organization.id) : Promise.resolve([] as string[]),
      op.topbar.cupos && tipo === TIPO_PARQUEADERO ? getCuposLibres(organization.id) : Promise.resolve(null),
      op.fuenteMenu === 'categorias_carta' && tipo === TIPO_RESTAURANTE
        ? categoriasDeCarta(organization.id, datosSede.sedeActualId, rutaCarta)
        : Promise.resolve(null),
    ])

    let barraMovil: AccionBarra[] | null = null
    if (Array.isArray(op.barraMovil)) {
      const reservaRestaurante = rutaDePaginaCon(paginas, ['reservation', 'reservation_cta'])
      const destinos: Record<AccionBarraMovil, string | null> = {
        pedir: tipo === TIPO_RESTAURANTE
          ? ((settings as any)?.enable_online_ordering === true ? rutaCarta : null)
          : conPrefijo('/productos', prefijo),
        reservar: tipo === TIPO_RESTAURANTE
          ? (reservaRestaurante ? conPrefijo(reservaRestaurante, prefijo) : null)
          : conPrefijo('/reservas', prefijo),
        agendar: conPrefijo('/agendar', prefijo),
        prueba: conPrefijo('/membresias', prefijo),
        llamar: enlaces.llamar,
        whatsapp: enlaces.whatsapp,
        como_llegar: enlaces.comoLlegar,
      }
      barraMovil = op.barraMovil
        .map((accion) => ({ accion, href: destinos[accion] }))
        .filter((a): a is AccionBarra => !!a.href)
    }

    // Pie «Horario por sede»: una línea por sede publicada con horario revisado; si no hay sedes
    // publicadas, el horario de la página (el de la sede o business_hours) sin nombre.
    const conHorario = sedes
      .map((s) => ({ nombre: s.nombre, resumen: resumenHorario(horarioRevisado(horarioDeSede(s.horarioJson))) }))
      .filter((s): s is { nombre: string; resumen: string } => !!s.resumen)
    const resumenPropio = resumenHorario(horario)
    const horariosSedes = conHorario.length >= 2
      ? conHorario
      : resumenPropio ? [{ nombre: null, resumen: resumenPropio }] : []

    return {
      enlaces,
      horariosSedes,
      sedeEstado: { id: sede?.id ?? 0, nombre: sede?.nombre ?? organization.name, direccion: lugar.direccion ?? null, horario, zonaHoraria: zona },
      mapaEmbebido: urlMapaEmbebido(lugar),
      envioGratisDesde: Number.isFinite(umbral) && umbral > 0 ? umbral : null,
      cuposLibres,
      mediosPago,
      categoriasCarta,
      rutaReservas: conPrefijo('/reservas', prefijo),
      barraMovil,
    }
  } catch (error) {
    console.error('[encabezado-pie] Error armando los datos del encabezado y el pie; se pinta lo de antes', {
      organizationId: organization.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return EXTRAS_VACIOS
  }
})

