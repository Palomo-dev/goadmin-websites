/**
 * Sección `products_grid · editorial` («Rejilla editorial», Atelier; PLANO §3).
 *
 * La rejilla de productos de siempre (mismos productos, mismas tarjetas `ProductCard`, mismo
 * carrito interno) con tres cosas más:
 * - encabezado con el conteo real («72 productos», `count_header`);
 * - filtros por categoría en texto o en píldoras (`filters_style`) y orden, sobre lo ya cargado;
 * - tarjetas editoriales del dueño intercaladas (`editorial_cards`: después del producto N,
 *   2 o 3 columnas). Vacío = la rejilla normal.
 *
 * Productos: `data.listados[sectionId]` (el listado del servidor de esta sección, el mismo de
 * `ProductsGrid`) o el listado general precargado, filtrado por `selected_category_ids` con las
 * mismas ayudas que `ProductsGrid`. Sin productos no se pinta (en la vista previa, un aviso).
 *
 * Sin 'use client': el manifiesto lee `RejillaEditorial.CONTENT_KEYS` (las de `products_grid`
 * que lee esta variante + las nuevas del contrato). La interacción vive en `RejillaEditorialVista.tsx`.
 */

import { conPrefijo } from '@/lib/outlet/rutaSitio'
import { CLAVES_SECCION_TIENDA, normalizarRejillaEditorial } from '@/lib/website/v2/contrato/seccionesTienda'
import { RejillaEditorialVista } from './RejillaEditorialVista'
import type { DatosPaginaTienda } from './datosTienda'

export const CONTENT_KEYS = [
  'title',
  'subtitle',
  'columns',
  'max_items',
  'rows',
  'sort_order',
  'selected_category_ids',
  'include_subcategories',
  'exclude_out_of_stock',
  'show_filters',
  'product_card_style',
  'badges',
  'card_buttons',
  'buttons_position',
  'buttons_layout',
  'buttons_full_width',
  'icon_only',
  ...CLAVES_SECCION_TIENDA['products_grid.editorial'],
] as const

/** Referencia estable: `useCatalogoCompleto` reinicia su estado si la lista inicial cambia de identidad. */
const SIN_PRODUCTOS: any[] = []

interface RejillaEditorialProps {
  content: Record<string, any>
  primaryColor?: string
  organization?: { subdomain?: string | null; website_settings?: { show_buy_now_button?: boolean } | null }
  data?: DatosPaginaTienda & { listados?: Record<string, { products: any[]; total: number }> }
  sectionId?: string
}

export function RejillaEditorial({ content, primaryColor = '#111111', organization, data, sectionId }: RejillaEditorialProps) {
  const ajustes = normalizarRejillaEditorial(content)
  const prefijo = typeof data?.prefijoSede === 'string' ? data.prefijoSede : ''
  const tarjetas = ajustes.editorialCards.map((t) => ({ ...t, url: t.url ? conPrefijo(t.url, prefijo) : '' }))
  const listado = sectionId ? data?.listados?.[sectionId] : undefined

  return (
    <RejillaEditorialVista
      content={content}
      ajustes={{ ...ajustes, editorialCards: tarjetas }}
      primaryColor={primaryColor}
      productos={Array.isArray(listado?.products) ? listado.products : Array.isArray(data?.products) ? (data.products as any[]) : SIN_PRODUCTOS}
      desdeServidor={!!listado}
      totalServidor={listado ? listado.total : typeof data?.productsTotal === 'number' ? data.productsTotal : null}
      productosCategoria={Array.isArray(data?.productosCategoria) ? (data.productosCategoria as any[]) : undefined}
      categorias={Array.isArray(data?.categories) ? (data.categories as any[]) : SIN_PRODUCTOS}
      error={data?.productsError === true && !listado}
      subdominio={organization?.subdomain ?? ''}
      branchId={typeof data?.branchId === 'number' ? data.branchId : null}
      mostrarComprarYa={organization?.website_settings?.show_buy_now_button !== false}
    />
  )
}

RejillaEditorial.CONTENT_KEYS = CONTENT_KEYS
