/**
 * Sección `events` — agenda del restaurante (Figma Events 147:7360).
 *
 * Variantes: `list` (fecha grande + título + meta + cupo) y `detail` (un
 * evento con imagen, datos e «Incluye»).
 *
 * Datos: NO existe una tabla de eventos públicos en la base (verificado por
 * MCP el 2026-10-05: `calendar_events` es la agenda interna del CRM, con
 * cliente y responsable; no es contenido público). Los eventos se escriben en
 * el editor (repetidor `events`) con fecha y hora LOCALES de la organización;
 * aquí se convierten a instantes con su zona horaria y los que ya terminaron
 * se ocultan solos (EventsView vuelve a filtrar cada minuto en el navegador).
 *
 * Sin 'use client': el manifiesto lee `Events.CONTENT_KEYS`.
 */

import type { OrganizationWithDetails } from '@/types/database'
import { cardVisual, oneOf, parseEvents, safeHref, str, strOr, type Content } from '@/lib/restaurant/secciones'
import { EventsView, type EventsVariant } from './EventsView'

export const CONTENT_KEYS = [
  'eyebrow',
  'title',
  'subtitle',
  'events',
  'detail_url',
  'list_url',
  'reserve_url',
  'reserve_text',
  'empty_text',
] as const

const VARIANTS: readonly EventsVariant[] = ['list', 'detail']

interface EventsProps {
  content: Content
  organization: OrganizationWithDetails
  sectionVariant?: string
  sectionId?: string
}

export function Events({ content, organization, sectionVariant, sectionId }: EventsProps) {
  const variant = oneOf(sectionVariant, VARIANTS, 'list')
  const timeZone = organization.timezone || 'America/Bogota'

  return (
    <EventsView
      variant={variant}
      events={parseEvents(content.events, timeZone)}
      eyebrow={strOr(content, 'eyebrow', variant === 'list' ? 'Agenda' : null)}
      title={strOr(content, 'title', variant === 'list' ? 'Próximos eventos' : null)}
      subtitle={str(content.subtitle)}
      detailUrl={safeHref(content.detail_url)}
      listUrl={safeHref(content.list_url)}
      reserveUrl={safeHref(content.reserve_url)}
      reserveText={str(content.reserve_text) ?? 'Reservar cupo'}
      emptyText={str(content.empty_text)}
      organizationName={organization.name}
      mediaStyle={cardVisual(content).media}
      sectionKey={(sectionId || 'eventos').slice(0, 8)}
    />
  )
}

Events.CONTENT_KEYS = CONTENT_KEYS
