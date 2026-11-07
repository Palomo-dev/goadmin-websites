/**
 * Portada `hero · split_products` («Dividida con productos», plantilla Hogar; PLANO §3).
 *
 * Es la portada dividida de siempre (HeroSplit, con todas sus claves) más hasta 3 mini tarjetas
 * de productos REALES bajo los botones: foto, nombre y precio, enlazadas a su ficha.
 * - `product_ids` (máx. 3): esos productos, en ese orden (los que existan y estén publicados).
 * - Vacío: los 3 primeros con foto del listado de la tienda.
 * Sin productos, la portada dividida de siempre, sin tarjetas.
 *
 * Datos: `data.productosPortada` (precarga de `lib/queries/tienda/portada.ts`, solo si la sección
 * está) o `data.products` si la página ya cargó el listado.
 *
 * Sin 'use client': el manifiesto lee `HeroSplitProductos.CONTENT_KEYS`. El precio va con `Price`
 * (moneda de la organización), el mismo de las tarjetas de producto.
 */
import Link from 'next/link'
import { Price } from '@/components/site/CurrencyProvider'
import { getProductImageUrl, getProductPrice } from '@/lib/products/datosTarjeta'
import { CLAVES_SECCION_TIENDA, MAX_PRODUCTOS_PORTADA, normalizarProductosPortada } from '@/lib/website/v2/contrato/seccionesTienda'
import { productosDePortada, rutaProducto } from '@/lib/website/portadaTienda'
import { HeroSplit } from '../hero/HeroSplit'
import { rutaSede } from './comunPortada'

/** Las de la portada dividida (las lee HeroSplit) más la nueva. */
export const CONTENT_KEYS = [
  'title', 'subtitle', 'cta_text', 'cta_url', 'cta_secondary_text', 'cta_secondary_url', 'image_url', 'image_url_mobile', 'content_position', 'buttons',
  ...CLAVES_SECCION_TIENDA['hero.split_products'],
] as const

interface Props {
  content: Record<string, unknown>
  organization?: unknown
  primaryColor?: string
  data?: Record<string, unknown>
}

export function HeroSplitProductos({ content, organization, primaryColor, data }: Props) {
  const { productIds } = normalizarProductosPortada(content)
  const lista = productosDePortada(data, productIds, MAX_PRODUCTOS_PORTADA)
  const extra = lista.length > 0 ? (
    <ul className="mt-8 flex flex-wrap gap-3" data-portada-productos="">
      {lista.map((producto) => {
        const foto = getProductImageUrl(producto)
        const precio = getProductPrice(producto)
        const nombre = typeof producto.name === 'string' ? producto.name : ''
        return (
          <li key={producto.id} className="min-w-[200px] max-w-[260px] flex-1">
            <Link
              href={rutaSede(rutaProducto(producto.id, producto), data)}
              className="flex items-center gap-3 border border-black/10 bg-white/80 p-2 pr-4 transition-colors hover:bg-white dark:border-white/15 dark:bg-white/5"
              style={{ borderRadius: 'var(--radio-sitio, 12px)' }}
            >
              <span className="h-14 w-14 shrink-0 overflow-hidden bg-black/5" style={{ borderRadius: 'calc(var(--radio-sitio, 12px) * 0.75)' }}>
                {foto && <img src={foto} alt="" className="h-full w-full object-contain" loading="lazy" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">{nombre}</span>
                {precio !== null && <Price value={precio} className="block text-sm text-gray-600 dark:text-gray-300" />}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  ) : null
  return <HeroSplit content={content} organization={organization} primaryColor={primaryColor} extra={extra} />
}

HeroSplitProductos.CONTENT_KEYS = CONTENT_KEYS
