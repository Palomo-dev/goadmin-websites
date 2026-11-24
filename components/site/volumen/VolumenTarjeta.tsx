'use client'

/**
 * Precio por volumen en las tarjetas de los listados (Figma «16 Sitio web» S3 3007:75524 y S4
 * 3007:75673): insignia «Desde 6: −14 %» sobre la foto y la línea «6 o más: $ 9.500 c/u» bajo el
 * precio. Se resuelve en memoria con las promociones que cargó el layout (una lectura por página,
 * ninguna por producto). Sin precio por volumen, o si la promoción es solo para un grupo de
 * clientes, no pinta nada.
 */
import { useCurrency } from '@/components/site/CurrencyProvider'
import { resumenTarjeta } from '@/lib/promociones/escalonesTienda'
import { useVolumenProducto } from './EscalonesTiendaContext'

interface ProductoTarjeta {
  id?: number | string | null
  parent_product_id?: number | null
  category_id?: number | null
  brand?: string | null
}

/** El listado trae `category_id`, `brand` y `parent_product_id`; si falta alguno, queda desconocido. */
function useResumenVolumen(product: ProductoTarjeta | null | undefined, price: number | null | undefined) {
  const tiene = (k: keyof ProductoTarjeta) => !!product && Object.prototype.hasOwnProperty.call(product, k)
  const volumen = useVolumenProducto(
    product && product.id != null && Number.isFinite(Number(product.id))
      ? {
          id: Number(product.id),
          parent_product_id: tiene('parent_product_id') ? product.parent_product_id ?? null : undefined,
          category_id: tiene('category_id') ? product.category_id ?? null : undefined,
          brand: tiene('brand') ? product.brand ?? null : undefined,
        }
      : null,
  )
  if (!volumen || volumen.requiereCliente || price == null || !(price > 0)) return null
  return resumenTarjeta(volumen.escalones, price)
}

export function InsigniaVolumenTarjeta({ product, price, primaryColor, abajo = false, enLinea = false }: {
  product: ProductoTarjeta | null | undefined
  price: number | null | undefined
  primaryColor: string
  /** Si la esquina superior izquierda ya tiene insignias, va abajo a la izquierda. */
  abajo?: boolean
  /**
   * En el texto de la tarjeta y no sobre la foto (tarjetas sin foto posicionada, como la compacta
   * de favoritos): la misma píldora, en su propia línea.
   */
  enLinea?: boolean
}) {
  const r = useResumenVolumen(product, price)
  if (!r) return null
  return (
    <span
      className={enLinea
        ? 'mb-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold text-white'
        : `pointer-events-none absolute left-2 z-10 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm ${abajo ? 'bottom-2' : 'top-2'}`}
      style={{ backgroundColor: primaryColor }}
      data-insignia-volumen=""
    >
      Desde {r.desde}: −{r.ahorroPct} %
    </span>
  )
}

export function LineaVolumenTarjeta({ product, price, primaryColor }: {
  product: ProductoTarjeta | null | undefined
  price: number | null | undefined
  primaryColor: string
}) {
  const { formatPrice } = useCurrency()
  const r = useResumenVolumen(product, price)
  if (!r) return null
  return (
    <p className="text-xs font-medium" style={{ color: primaryColor }} data-linea-volumen="">
      {r.desde} o más: {formatPrice(r.unitario)} c/u
    </p>
  )
}
