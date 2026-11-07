/**
 * Portada `hero · search` («Buscador», plantilla Panorama; PLANO §3).
 *
 * Foto con el título, un chip con la calificación real de la tienda y un buscador con selector de
 * categoría. El buscador manda a `/search?q=…` (alcance global); sin texto y con categoría, a
 * `/categorias/<slug>` (`destinoBuscador` del contrato).
 *
 * Datos (los precarga `lib/queries/tienda/portada.ts` SOLO si la sección está en la página):
 * - `data.categories`: categorías principales reales para el selector. Sin categorías, sin selector.
 * - `data.resumenResenas.product_reviews`: promedio y conteo de reseñas aprobadas. Con 0 reseñas
 *   (o `rating_chip: 'none'`) no hay chip: nunca una cifra inventada.
 * FUERA de esta entrega (PLANO §7): «ciudad de envío» en el buscador y búsquedas populares.
 *
 * Sin 'use client': el manifiesto lee `HeroBuscador.CONTENT_KEYS`. La interacción vive en
 * HeroBuscadorVista.
 */
import { CLAVES_SECCION_TIENDA, normalizarPortadaBuscador } from '@/lib/website/v2/contrato/seccionesTienda'
import { categoriasDePortada, textoResumenDe } from '@/lib/website/portadaTienda'
import { estiloSolapa, prefijoDe } from './comunPortada'
import { HeroBuscadorVista } from './HeroBuscadorVista'

export const CONTENT_KEYS = CLAVES_SECCION_TIENDA['hero.search']

interface Props {
  content: Record<string, unknown>
  organization?: { name?: string; website_settings?: Record<string, unknown> | null } | null
  primaryColor?: string
  data?: Record<string, unknown>
}

export function HeroBuscador({ content, organization, primaryColor, data }: Props) {
  const p = normalizarPortadaBuscador(content)
  const categorias = p.showCategorySelect ? categoriasDePortada(data) : []
  const chip = p.ratingChip === 'auto' ? textoResumenDe(data, 'product_reviews') : null
  return (
    <HeroBuscadorVista
      portada={p}
      titulo={p.title || organization?.name || ''}
      categorias={categorias}
      chip={chip}
      prefijo={prefijoDe(data)}
      primaryColor={primaryColor || '#111111'}
      solapa={estiloSolapa(organization, content)}
    />
  )
}

HeroBuscador.CONTENT_KEYS = CONTENT_KEYS
