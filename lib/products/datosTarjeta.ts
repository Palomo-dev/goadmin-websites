import { urlPublicaStorage } from '@/lib/storage/urlPublica'
/**
 * Precio, foto y «es padre» de una tarjeta. Sin React: el servidor (la carta)
 * y el cliente (la tarjeta) leen lo mismo.
 */

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://taqjemqjtumhwptchcxk.supabase.co'

export function getProductImageUrl(product: any): string | null {
  if (!product.product_images || product.product_images.length === 0) return null
  const primary = product.product_images.find((img: any) => img.is_primary)
  const image = primary || product.product_images[0]
  const path = image.storage_path || image.shared_images?.storage_path
  if (!path) return null
  return urlPublicaStorage(path, 'product-images', SUPABASE_URL)
}

export function getProductPrice(product: any): number | null {
  if (product.product_prices && product.product_prices.length > 0) {
    return Number(product.product_prices[0].price)
  }
  return null
}

export function getProductComparePrice(product: any): number | null {
  const cp = product.product_prices?.[0]?.compare_price
  return cp ? Number(cp) : null
}

/** Descuento porcentual (0-100) o null si no hay oferta. */
export function getProductDiscount(product: any): number | null {
  const price = getProductPrice(product)
  const compare = getProductComparePrice(product)
  if (!price || !compare || compare <= price) return null
  return Math.round((1 - price / compare) * 100)
}

/**
 * ¿Es un producto padre (agrupa tallas, colores…)? Un padre NUNCA va al carrito: lo que se
 * compra es una de sus variantes. Por eso todo botón de agregar lo manda a elegir.
 *
 * Antes un padre con `variant_count = 0` se vendía como simple («Agregar» directo) y salían
 * pedidos sin talla: el jean CB-FF-72125 (id 106000, org 338) perdió sus 6 tallas en la
 * restauración del 2026-11-03 y la tarjeta lo agregaba tal cual.
 */
export function isParentProduct(product: any): boolean {
  return product?.is_parent === true || product?.has_variants === true
}

/**
 * Padre cuyo listado confirmó que no tiene variantes activas (`variant_count` numérico y 0):
 * no hay nada que comprar, se muestra «No disponible». Si `variant_count` no viene (listado que
 * no lo calcula, o la consulta de variantes falló) no se afirma nada: la tarjeta manda a elegir
 * y la ficha decide con la lista real de variantes.
 */
export function padreSinVariantes(product: any): boolean {
  if (!isParentProduct(product)) return false
  const n = product?.variant_count
  if (n === undefined || n === null || n === '') return false
  const cuenta = Number(n)
  return Number.isFinite(cuenta) && cuenta <= 0
}

/** Texto único para un padre sin variantes que comprar (tarjeta, vista rápida, ficha, carrito). */
export const TEXTO_PADRE_SIN_VARIANTES = 'No disponible'

/**
 * ¿La card debe mandar a elegir en vez de «Agregar»? Padre con variantes, o plato con un grupo
 * de modificadores obligatorio (`requires_choice`, calculado por el listado con la regla de
 * lib/products/modificadores.ts). Agregarlo directo deja un pedido que el servidor rechaza.
 */
export function requiereElegir(product: any): boolean {
  return isParentProduct(product) || product?.requires_choice === true
}
