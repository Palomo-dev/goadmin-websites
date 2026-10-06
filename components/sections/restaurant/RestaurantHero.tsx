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
 * Pendiente: el estado de la sede («Abierto ahora · Cierra a las 22:00») del
 * diseño se conectará con `estadoApertura` de lib/restaurant/horario.ts, el
 * mismo cálculo de la sección `hours_location`, en vez de duplicarlo aquí.
 */

import type { OrganizationWithDetails } from '@/types/database'
import { cardVisual, items, oneOf, safeHref, str, strOr, type Content } from '@/lib/restaurant/secciones'
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
  sectionVariant?: string
}

export function RestaurantHero({ content, organization, sectionVariant }: RestaurantHeroProps) {
  const variant = oneOf(sectionVariant, VARIANTS, 'typographic')

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
    />
  )
}

function toCta(text: unknown, url: unknown): { text: string; url: string } | null {
  const t = str(text)
  const u = safeHref(url)
  return t && u ? { text: t, url: u } : null
}

RestaurantHero.CONTENT_KEYS = CONTENT_KEYS
