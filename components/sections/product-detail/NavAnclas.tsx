/**
 * `product_anchor_nav · tabs` (plantilla de tienda Panorama): pestañas que saltan a los bloques
 * de la ficha (Resumen, Características, Envío, Reseñas…).
 *
 * - Las pestañas salen de `normalizarPestanasAncla` (sin ítems válidos, las cuatro de siempre).
 * - Se quitan las que apuntan a un bloque que la página no pinta (oculto o ausente): el renderer
 *   pasa en `data.destinosAncla` los tipos presentes. Sin ninguna con destino, no se pinta.
 * - El id de cada destino es su tipo (`#product_reviews`), y ProductDetailRenderer solo pone esos
 *   ids cuando la página trae este bloque: sin él, la ficha queda igual que hoy.
 */

import { CLAVES_SECCION_TIENDA, normalizarPestanasAncla } from '@/lib/website/v2/contrato/seccionesTienda'
import { pestanasConDestino } from './fichaTienda'
import { NavAnclasCliente } from './NavAnclasCliente'

export const CONTENT_KEYS = CLAVES_SECCION_TIENDA['product_anchor_nav.tabs']

interface NavAnclasProps {
  content: Record<string, any>
  primaryColor?: string
  data?: { destinosAncla?: string[] }
}

export function NavAnclas({ content, primaryColor = '#111827', data }: NavAnclasProps) {
  const { items, sticky } = normalizarPestanasAncla(content)
  const pestanas = pestanasConDestino(items, data?.destinosAncla ?? [])
  if (pestanas.length === 0) return null
  return <NavAnclasCliente pestanas={pestanas} sticky={sticky} primaryColor={primaryColor} />
}
NavAnclas.CONTENT_KEYS = CONTENT_KEYS
