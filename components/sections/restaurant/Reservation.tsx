/**
 * Sección `reservation` — «Reserva de mesa» (Figma TableReservation 141:5796).
 *
 * Sin directiva de cliente a propósito: el manifiesto del sitio
 * (lib/sectionManifest.ts) lee `Reservation.CONTENT_KEYS` desde un route
 * handler. Aquí sólo se normaliza el contenido y se decide qué sedes aceptan
 * reservas; la interacción vive en ReservationView (cliente).
 *
 * Datos: `data.sedesRestaurante` lo precarga `app/[[...slug]]/page.tsx` con
 * `getSedesRestaurante` (una consulta cacheada, filtrada por la organización
 * del host). La reserva usa el flujo existente de `/api/restaurant-reservations`
 * (RPC `create_restaurant_reservation`), igual que `reservation_cta`.
 */

import type { OrganizationWithDetails } from '@/types/database'
import { ajustesDeSede, direccionCompleta, sedeAceptaReservas, type SedesRestaurante } from '@/lib/restaurant/sedes-modelo'
import { ReservationView, type ReservationVariant, type SedeReserva } from './ReservationView'

/** Claves de `content` que lee la sección (contrato editor ↔ sitio, F0.6). */
export const CONTENT_KEYS = [
  'eyebrow',
  'title',
  'subtitle',
  'cta_text',
  'cta_url',
  'image_url',
  'external_url',
  'external_button_text',
  'branch_ids',
  'min_guests',
  'max_guests',
  'max_days',
  'require_email',
  'show_notes',
  'policy_text',
  'success_message',
  'pending_message',
  'anchor_id',
] as const

const VARIANTS: readonly ReservationVariant[] = ['stepper', 'form_image', 'band', 'hero_widget', 'external']

interface ReservationProps {
  content: Record<string, unknown>
  organization: OrganizationWithDetails
  data?: Record<string, unknown>
  sectionVariant?: string
  sectionId?: string
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Enlaces http(s), rutas del propio sitio o anclas. Nada de `javascript:`. */
function safeUrl(value: unknown, { externo = false } = {}): string | null {
  const url = str(value)
  if (!url) return null
  if (externo) return /^https:\/\//i.test(url) ? url : null
  return /^(https?:\/\/|\/|#)/i.test(url) ? url : null
}

function idsDe(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.map(Number).filter((n) => Number.isInteger(n) && n > 0)
}

function anclaValida(value: unknown): string {
  const a = str(value)
  return a && /^[a-z0-9][a-z0-9_-]*$/i.test(a) ? a : 'reservar'
}

function esSedesRestaurante(v: unknown): v is SedesRestaurante {
  return typeof v === 'object' && v !== null && Array.isArray((v as { sedes?: unknown }).sedes)
}

export function Reservation({ content, organization, data, sectionVariant, sectionId }: ReservationProps) {
  const variant: ReservationVariant = VARIANTS.includes(sectionVariant as ReservationVariant)
    ? (sectionVariant as ReservationVariant)
    : 'stepper'

  const datos = esSedesRestaurante(data?.sedesRestaurante) ? data.sedesRestaurante : null
  // Página de una sede (outlet): la reserva es para esa sede.
  const sedePagina = typeof data?.branchId === 'number' ? data.branchId : null
  const elegidas = idsDe(content.branch_ids)

  let sedes: SedeReserva[] = []
  let sinSede: { zonaHoraria: string; ajustes: SedesRestaurante['ajustesOrganizacion'] } | null = null
  let motivo: string | null = null

  if (!datos) {
    // Sin datos de sedes (falló la lectura): mismo comportamiento que
    // `reservation_cta`, reserva a nivel de organización.
    sinSede = { zonaHoraria: organization.timezone || 'America/Bogota', ajustes: null }
  } else {
    sedes = datos.sedes
      .filter((s) => (sedePagina !== null ? s.id === sedePagina : true))
      .filter((s) => elegidas.length === 0 || elegidas.includes(s.id))
      .filter((s) => sedeAceptaReservas(s, datos))
      .map((s) => ({
        id: s.id,
        nombre: s.nombre,
        direccion: direccionCompleta(s),
        telefono: s.telefono,
        zonaHoraria: s.zonaHoraria,
        ajustes: ajustesDeSede(s, datos),
      }))

    if (sedes.length === 0) {
      const orgHabilitada = datos.ajustesOrganizacion ? datos.ajustesOrganizacion.habilitada : true
      if (sedePagina === null && datos.mesasSinSede > 0 && orgHabilitada) {
        sinSede = { zonaHoraria: datos.zonaOrganizacion, ajustes: datos.ajustesOrganizacion }
      } else if (datos.sedes.every((s) => s.mesas === 0) && datos.mesasSinSede === 0) {
        motivo = 'Para recibir reservas, crea las mesas en el ERP (Restaurante › Mesas).'
      } else if (!orgHabilitada && datos.sedes.every((s) => !s.ajustes)) {
        motivo = 'Las reservas en línea están deshabilitadas en la configuración de reservas del ERP.'
      } else {
        motivo = 'Ninguna de las sedes elegidas acepta reservas: revisa sus mesas y la configuración de reservas en el ERP.'
      }
    }
  }

  return (
    <ReservationView
      variant={variant}
      organizationId={organization.id}
      organizationName={organization.name}
      sedes={sedes}
      sinSede={sinSede}
      motivoSinReservas={motivo}
      eyebrow={'eyebrow' in content ? str(content.eyebrow) : 'Reservas'}
      title={str(content.title)}
      subtitle={str(content.subtitle)}
      ctaText={str(content.cta_text)}
      ctaUrl={safeUrl(content.cta_url)}
      imageUrl={safeUrl(content.image_url)}
      externalUrl={safeUrl(content.external_url, { externo: true })}
      externalButtonText={str(content.external_button_text)}
      minGuests={num(content.min_guests)}
      maxGuests={num(content.max_guests)}
      maxDays={num(content.max_days)}
      requireEmail={content.require_email === true}
      showNotes={content.show_notes !== false}
      policyText={str(content.policy_text)}
      successMessage={str(content.success_message)}
      pendingMessage={str(content.pending_message)}
      anchorId={anclaValida(content.anchor_id)}
      sectionKey={(sectionId || 'reserva').slice(0, 8)}
    />
  )
}

Reservation.CONTENT_KEYS = CONTENT_KEYS
