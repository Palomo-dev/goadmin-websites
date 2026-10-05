import { getCartKey } from '@/lib/utils'

/**
 * Línea del carrito tal como la guarda el navegador en localStorage.
 *
 * Es el formato que leen CartDrawer, CartPageClient y CheckoutWizard. `sku`
 * viaja con la línea porque es el retailer_id del catálogo de Meta
 * (content_ids en CartEventTracker).
 */
export interface CartLineInput {
  id: number
  name: string
  price: number
  sku?: string | null
  imageUrl?: string | null
  comparePrice?: number | null
}

/**
 * Suma una unidad de un producto simple al carrito del sitio.
 *
 * Extraído tal cual de `ProductCard` (carrito interno de las tarjetas) para que
 * la carta completa (`menu_full`) escriba exactamente la misma línea, en la
 * misma clave y con el mismo evento `cart-updated` que dispara el píxel.
 *
 * Solo se usa en el navegador.
 */
export function addProductToCart(
  subdomain: string,
  branchId: number | null | undefined,
  line: CartLineInput,
): void {
  const cartKey = getCartKey(subdomain, branchId)
  const cart = JSON.parse(localStorage.getItem(cartKey) || '[]')
  const idx = cart.findIndex((item: { id: number }) => item.id === line.id)
  if (idx >= 0) {
    cart[idx].quantity += 1
  } else {
    cart.push({
      id: line.id,
      name: line.name,
      price: line.price,
      quantity: 1,
      ...(line.sku && { sku: line.sku }),
      ...(line.imageUrl && { imageUrl: line.imageUrl }),
      ...(line.comparePrice && { comparePrice: line.comparePrice }),
    })
  }
  localStorage.setItem(cartKey, JSON.stringify(cart))
  window.dispatchEvent(new CustomEvent('cart-updated'))
}
