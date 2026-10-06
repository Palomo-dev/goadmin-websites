/**
 * Sección `private_events` — eventos privados y catering (Figma
 * PrivateEvents 148:7591).
 *
 * Paquetes y pasos son contenido del editor. El formulario de cotización NO
 * tiene backend propio: envía a POST /api/contact (el mismo de
 * `contact_form`), que resuelve la organización por el host, aplica rate limit
 * y honeypot, y llama a la RPC `web_capture_lead`: el visitante queda en el
 * CRM del ERP como cliente en etapa «lead» con origen «Formulario web», con
 * los datos del evento en la nota y `form = 'private_events'` en
 * `metadata.lead.ultima_captura_web`.
 *
 * Sin 'use client': el manifiesto lee `PrivateEvents.CONTENT_KEYS`.
 */

import type { OrganizationWithDetails } from '@/types/database'
import { cardVisual, items, lines, str, strOr, type Content } from '@/lib/restaurant/secciones'
import { PrivateEventsView, type PrivatePackage } from './PrivateEventsView'
import { esSedesRestaurante } from '@/lib/restaurant/sedes-modelo'

export const CONTENT_KEYS = [
  'eyebrow',
  'title',
  'subtitle',
  'packages',
  'steps',
  'form_title',
  'event_types',
  'budget_options',
  'submit_text',
  'form_note',
] as const

const DEFAULT_EVENT_TYPES = ['Cumpleaños', 'Cena de empresa', 'Matrimonio', 'Aniversario', 'Otro']

interface PrivateEventsProps {
  content: Content
  organization: OrganizationWithDetails
  data?: Record<string, unknown>
  sectionId?: string
}

export function PrivateEvents({ content, organization, data, sectionId }: PrivateEventsProps) {
  // Sede del lead: la de la página de sede (outlet) o, si la página precarga
  // las sedes (`data.sedesRestaurante`), un selector cuando hay más de una.
  const sedePagina = typeof data?.branchId === 'number' ? data.branchId : null
  const datosSedes = esSedesRestaurante(data?.sedesRestaurante) ? data.sedesRestaurante : null
  const sedes = (datosSedes?.sedes ?? [])
    .filter((s) => (sedePagina !== null ? s.id === sedePagina : true))
    .map((s) => ({ id: s.id, nombre: s.nombre }))

  const packages: PrivatePackage[] = items(content.packages)
    .map((p) => ({ name: str(p.name), detail: str(p.detail), price: str(p.price_text) }))
    .filter((p): p is PrivatePackage => p.name !== null)

  const steps = items(content.steps)
    .map((s) => str(s.text))
    .filter((s): s is string => s !== null)
    .slice(0, 4)

  const eventTypes = lines(content.event_types)

  return (
    <PrivateEventsView
      eyebrow={strOr(content, 'eyebrow', 'Eventos privados')}
      title={strOr(content, 'title', 'Celebra con nosotros')}
      subtitle={str(content.subtitle)}
      packages={packages}
      steps={steps}
      formTitle={strOr(content, 'form_title', 'Pide tu cotización')}
      eventTypes={eventTypes.length > 0 ? eventTypes : DEFAULT_EVENT_TYPES}
      budgetOptions={lines(content.budget_options)}
      submitText={str(content.submit_text) ?? 'Solicitar cotización'}
      formNote={strOr(content, 'form_note', 'Te respondemos en máximo 48 horas hábiles.')}
      organizationId={organization.id}
      cardStyle={cardVisual(content).card}
      timeZone={organization.timezone || 'America/Bogota'}
      sedes={sedes}
      sedeInicial={sedePagina ?? sedes[0]?.id ?? null}
      sectionKey={(sectionId || 'eventos-privados').slice(0, 8)}
    />
  )
}

PrivateEvents.CONTENT_KEYS = CONTENT_KEYS
