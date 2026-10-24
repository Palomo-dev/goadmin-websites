/**
 * Precio, foto y «es padre» de una tarjeta. Sin React: el servidor (la carta)
 * y el cliente (la tarjeta) leen lo mismo.
 */

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

export function getProductImageUrl(product: any): string | null {
  if (!product.product_images || product.product_images.length === 0) return null
  const primary = product.product_images.find((img: any) => img.is_primary)
  const image = primary || product.product_images[0]
  const path = image.storage_path || image.shared_images?.storage_path
  if (!path) return null
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`
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
 * ¿La card debe comportarse como padre con variantes ("Elegir" → detalle)?
 *
 * `variant_count` lo calcula el listado en servidor. Si viene como número se
 * respeta (0 = padre sin variantes activas, se vende como simple). Si NO viene
 * (listado que no lo calcula, o la consulta de variantes falló) se asume que
 * un `is_parent` sí tiene variantes: mandar al detalle a elegir talla es
 * inofensivo; "Agregar" un padre al carrito genera pedidos sin talla.
 */
export function isParentProduct(product: any): boolean {
  if (product?.is_parent !== true && product?.has_variants !== true) return false
  const n = product.variant_count
  return n === undefined || n === null ? true : Number(n) > 0
}

/**
 * ¿La card debe mandar a elegir en vez de «Agregar»? Padre con variantes, o plato con un grupo
 * de modificadores obligatorio (`requires_choice`, calculado por el listado con la regla de
 * lib/products/modificadores.ts). Agregarlo directo deja un pedido que el servidor rechaza.
 */
export function requiereElegir(product: any): boolean {
  return isParentProduct(product) || product?.requires_choice === true
}
