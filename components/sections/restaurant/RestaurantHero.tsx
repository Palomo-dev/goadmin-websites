/**
 * Sección `restaurant_hero` (Figma RestaurantHero 146:7063).
 *
 * Variantes:
 *  - `typographic`: titular gigante sin foto + acciones + estado de la sede.
 *  - `split_bento`: panel con imagen a sangre y tarjetas de navegación.
 *
 * Sin 'use client' a propósito: el manifiesto (lib/sectionManifest.ts) lee
 * `RestaurantHero.CONTENT_KEYS` desde un route handler. La interacción vive
 * en RestaurantHeroView.
 *
 * Estado de la sede («Abierto ahora · Cierra a las 22:00»): `estadoApertura`
 * de lib/restaurant/horario.ts, el mismo cálculo y el mismo badge que
 * `hours_location` (EstadoApertura.tsx). La sede es la de la página; si la
 * página no tiene sede, la principal; si no, la primera con horario. Sin
 * horario cargado en ninguna sede no se pinta nada.
 *
 * Datos: `data.sedesRestaurante` (consulta cacheada de lib/restaurant/sedes.ts),
 * precargado por `app/[[...slug]]/page.tsx` cuando la página tiene esta sección.
 */

import type { OrganizationWithDetails } from '@/types/database'
import { cardVisual, items, oneOf, safeHref, str, strOr, type Content } from '@/lib/restaurant/secciones'
import type { SedeSitio, SedesRestaurante } from '@/lib/restaurant/sedes-modelo'
import type { SedeConHorario } from './EstadoApertura'
import { RestaurantHeroView, type HeroCard, type RestaurantHeroVariant } from './RestaurantHeroView'

export const CONTENT_KEYS = [
  'eyebrow',
  'title',
  'subtitle',
  'primary_cta_text',
  'primary_cta_url',
  'secondary_cta_text',
  'secondary_cta_url',
  'image_url',
  'image_alt',
  'cards',
] as const

const VARIANTS: readonly RestaurantHeroVariant[] = ['typographic', 'split_bento']

interface RestaurantHeroProps {
  content: Content
  organization: OrganizationWithDetails
  data?: Record<string, unknown>
  sectionVariant?: string
}

function esSedesRestaurante(v: unknown): v is SedesRestaurante {
  return typeof v === 'object' && v !== null && Array.isArray((v as { sedes?: unknown }).sedes)
}

/** Sede cuyo estado muestra el hero: la de la página, la principal o la primera con horario. */
export function sedeDelHero(datos: SedesRestaurante | null, sedePagina: number | null): SedeConHorario | null {
  const conHorario = (datos?.sedes ?? []).filter((s): s is SedeSitio & { horario: NonNullable<SedeSitio['horario']> } => s.horario !== null)
  const elegida =
    (sedePagina !== null ? conHorario.find((s) => s.id === sedePagina) : undefined) ??
    conHorario.find((s) => s.esPrincipal) ??
    conHorario[0]
  return elegida ? { id: elegida.id, horario: elegida.horario, zonaHoraria: elegida.zonaHoraria } : null
}

export function RestaurantHero({ content, organization, data, sectionVariant }: RestaurantHeroProps) {
  const variant = oneOf(sectionVariant, VARIANTS, 'typographic')
  const datos = esSedesRestaurante(data?.sedesRestaurante) ? data.sedesRestaurante : null
  const sedePagina = typeof data?.branchId === 'number' ? data.branchId : null

  const cards: HeroCard[] = items(content.cards)
    .map((c) => ({ label: str(c.label), url: safeHref(c.url), imageUrl: str(c.image_url) }))
    .filter((c): c is HeroCard => c.label !== null && c.url !== null)
    .slice(0, 4)

  return (
    <RestaurantHeroView
      variant={variant}
      eyebrow={str(content.eyebrow)}
      title={strOr(content, 'title', organization.name) ?? ''}
      subtitle={str(content.subtitle)}
      primaryCta={toCta(content.primary_cta_text, content.primary_cta_url)}
      secondaryCta={toCta(content.secondary_cta_text, content.secondary_cta_url)}
      imageUrl={str(content.image_url)}
      imageAlt={str(content.image_alt) ?? ''}
      cards={cards}
      visual={cardVisual(content)}
      sede={sedeDelHero(datos, sedePagina)}
    />
  )
}

function toCta(text: unknown, url: unknown): { text: string; url: string } | null {
  const t = str(text)
  const u = safeHref(url)
  return t && u ? { text: t, url: u } : null
}

RestaurantHero.CONTENT_KEYS = CONTENT_KEYS
