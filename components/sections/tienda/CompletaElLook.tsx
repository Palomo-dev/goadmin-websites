/**
 * `complete_the_look · default` (plantillas de tienda Atelier y Marea, en la ficha):
 * «Se lleva con» — foto del look y las piezas que lo completan, cada una con la tarjeta de
 * producto de siempre (su propio botón de agregar).
 *
 * - Los productos los consulta la página (`lib/queries/tienda/look.ts`) solo si la plantilla trae
 *   este bloque, y llegan en `data.lookFicha`. Sin productos, no se pinta (nada inventado).
 * - Foto: `image_url` del bloque; vacía, la segunda foto del producto; sin ella, solo las piezas.
 * - «Agregar todo» (`show_add_all`): una llamada al carrito de siempre por cada producto simple
 *   con precio y stock; los padres no entran (se eligen en su ficha). No toca precios ni checkout.
 */

import { ProductCard } from '@/components/sections/products/ProductCard'
import { CLAVES_SECCION_TIENDA, normalizarCompletaElLook } from '@/lib/website/v2/contrato/seccionesTienda'
import { getProductComparePrice, getProductImageUrl, getProductPrice } from '@/lib/products/datosTarjeta'
import { getAvailableStock } from '@/lib/stock'
import { AgregarTodoLook, type PiezaLook } from './AgregarTodoLook'

export const CONTENT_KEYS = CLAVES_SECCION_TIENDA['complete_the_look.default']

interface CompletaElLookProps {
  content: Record<string, any>
  primaryColor?: string
  data?: {
    lookFicha?: any[]
    imageUrls?: string[]
    product?: { name?: string | null } | null
    organizationSubdomain?: string
    branchId?: number | null
  }
}

/** Piezas que «Agregar todo» puede sumar: simples, con precio y con stock. */
function piezasAgregables(productos: any[]): PiezaLook[] {
  const piezas: PiezaLook[] = []
  for (const p of productos) {
    if (p?.is_parent === true) continue
    const precio = getProductPrice(p)
    if (!precio || precio <= 0) continue
    const stock = getAvailableStock(p)
    if (stock !== null && stock <= 0) continue
    piezas.push({
      id: Number(p.id),
      name: String(p.name ?? ''),
      price: precio,
      sku: p.sku ?? null,
      imageUrl: getProductImageUrl(p),
      comparePrice: getProductComparePrice(p),
    })
  }
  return piezas
}

export function CompletaElLook({ content, primaryColor = '#111827', data }: CompletaElLookProps) {
  const productos = data?.lookFicha ?? []
  if (productos.length === 0) return null
  const look = normalizarCompletaElLook(content)
  const foto = look.imageUrl || data?.imageUrls?.[1] || ''
  const agregables = look.showAddAll ? piezasAgregables(productos) : []

  return (
    <section aria-labelledby="titulo-completa-el-look" data-completa-el-look="" className="mt-16">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h2 id="titulo-completa-el-look" className="text-2xl font-bold text-gray-900 dark:text-white">{look.title}</h2>
        {agregables.length > 0 && (
          <AgregarTodoLook
            piezas={agregables}
            primaryColor={primaryColor}
            organizationSubdomain={data?.organizationSubdomain || ''}
            branchId={data?.branchId ?? null}
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {foto && (
          <div className="col-span-2 overflow-hidden rounded-[var(--radio-sitio,0.75rem)]">
            <img
              src={foto}
              alt={data?.product?.name ? `${data.product.name} · look` : 'Look'}
              className="h-full max-h-[560px] w-full object-cover"
              loading="lazy"
            />
          </div>
        )}
        {productos.map((p: any) => (
          <ProductCard
            key={p.id}
            product={p}
            primaryColor={primaryColor}
            variant="grid"
            showBuyNow={false}
            organizationSubdomain={data?.organizationSubdomain || ''}
            branchId={data?.branchId ?? null}
          />
        ))}
      </div>
    </section>
  )
}
CompletaElLook.CONTENT_KEYS = CONTENT_KEYS
