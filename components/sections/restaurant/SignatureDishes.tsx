/**
 * Sección `signature_dishes` — «Platos estrella» (Figma SignatureDishes 147:7359).
 *
 * Variantes: `carousel` (scroll-snap con flechas e indicador) y
 * `scrollytelling` (imagen fija que cambia con el bloque activo).
 *
 * Datos: los platos se eligen en el editor desde la carta (selector de
 * productos) y se leen de `data.products`, que `app/[[...slug]]/page.tsx`
 * precarga con `getOrganizationProducts` — la misma consulta cacheada de
 * `menu_full` / `menu_preview`, filtrada por la organización del contexto y
 * por la carta de la sede. Precio vigente, agotado y foto salen de
 * `pickMenuItems` (lib/menu/menuFull), la misma regla de la carta completa.
 * No existe un «destacado» en la base: la selección vive en el contenido.
 *
 * Sin 'use client': el manifiesto lee `SignatureDishes.CONTENT_KEYS`.
 */

import type { OrganizationWithDetails } from '@/types/database'
import { pickMenuItems, type MenuSourceProduct } from '@/lib/menu/menuFull'
import { bool, cardVisual, items, num, oneOf, str, strOr, type Content } from '@/lib/restaurant/secciones'
import { SignatureDishesView, type SignatureDish, type SignatureDishesVariant } from './SignatureDishesView'
import { EditorHint } from './EditorHint'

export const CONTENT_KEYS = ['eyebrow', 'title', 'subtitle', 'dishes', 'show_price', 'link_to_product'] as const

const VARIANTS: readonly SignatureDishesVariant[] = ['carousel', 'scrollytelling']

interface SignatureDishesProps {
  content: Content
  organization: OrganizationWithDetails
  data?: Record<string, unknown>
  sectionVariant?: string
  sectionId?: string
}

export function SignatureDishes({ content, data, sectionVariant, sectionId }: SignatureDishesProps) {
  const variant = oneOf(sectionVariant, VARIANTS, 'carousel')
  // `signatureProducts`: platos elegidos que no estaban entre los 500 de
  // `products` (cartas grandes); la página los pide por id.
  const products = [
    ...(Array.isArray(data?.products) ? data.products : []),
    ...(Array.isArray(data?.signatureProducts) ? data.signatureProducts : []),
  ] as MenuSourceProduct[]

  const entries = items(content.dishes)
    .map((d) => ({ id: num(d.product_id), story: str(d.story) }))
    .filter((d): d is { id: number; story: string | null } => d.id !== null)
  const stories = new Map(entries.map((e) => [e.id, e.story]))
  const dishes: SignatureDish[] = pickMenuItems(
    products,
    entries.map((e) => e.id),
  ).map((item) => ({ ...item, story: stories.get(item.id) ?? null }))

  if (dishes.length === 0) {
    return (
      <EditorHint title="Platos estrella sin platos">
        {entries.length === 0
          ? 'Elige los platos en «Platos» con el selector de la carta.'
          : 'Los platos elegidos no se pueden mostrar en esta sede: deben estar activos, con precio vigente y en la carta de la sede. Si acabas de añadir la sección, guarda y recarga la vista previa.'}
      </EditorHint>
    )
  }

  return (
    <SignatureDishesView
      variant={variant}
      dishes={dishes}
      eyebrow={strOr(content, 'eyebrow', variant === 'carousel' ? 'De la casa' : 'Platos estrella')}
      title={strOr(content, 'title', variant === 'carousel' ? 'Platos estrella' : null)}
      subtitle={str(content.subtitle)}
      showPrice={bool(content.show_price, true)}
      linkToProduct={bool(content.link_to_product, true)}
      mediaStyle={cardVisual(content).media}
      sectionKey={(sectionId || 'platos').slice(0, 8)}
    />
  )
}

SignatureDishes.CONTENT_KEYS = CONTENT_KEYS
