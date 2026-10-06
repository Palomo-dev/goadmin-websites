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
  agregarPlatoAlCarrito(subdomain, branchId, {
    productId: line.id,
    name: line.name,
    unitPrice: line.price,
    quantity: 1,
    sku: line.sku,
    imageUrl: line.imageUrl,
    comparePrice: line.comparePrice,
  })
}

/** Opción de un grupo de modificadores tal como la guarda la línea (la valida el servidor). */
export interface ModificadorLinea {
  groupId: number
  groupName: string
  modifierId: number
  name: string
  extraPrice: number
}

/**
 * Línea con opciones: plato de la carta (hoja del plato), variante con acompañante, ficha de
 * producto. `unitPrice` ya incluye los extras (base + Σ extraPrice), el mismo formato que leen
 * CartDrawer, el checkout y `/api/orders` (que recalcula todo en el servidor).
 */
export interface LineaPlatoInput {
  /** Id real del producto (la variante, si la hay). */
  productId: number
  name: string
  unitPrice: number
  quantity: number
  sku?: string | null
  imageUrl?: string | null
  comparePrice?: number | null
  /** Opciones de grupos (con precio). Se guardan en `newModifiers`, el campo que pintan el
   *  carrito, el drawer y el checkout con nombre y extra. */
  modifiers?: ModificadorLinea[]
  /** Modificadores antiguos sin precio (`variant_types`): campo `modifiers`, como en MenuView. */
  legacyModifiers?: { typeId: number; typeName: string; valueId: number; valueName: string }[]
  /** Nota para la cocina (`web_order_items.notes`, máx. 500 en el servidor). */
  notes?: string | null
  variantAttributes?: Record<string, string> | null
}

/** Máximo de la nota (el mismo que `texto()` de /api/orders). */
export const MAX_NOTA_COCINA = 500

function hashCorto(texto: string): string {
  let h = 5381
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/**
 * Id de la línea en el carrito: el producto solo (número, como siempre) o
 * `<producto>_<ids de opciones>` (formato de MenuView y ProductDetailActions), y `_n<hash>` si
 * lleva nota: el mismo plato con otra nota es otra línea para la cocina.
 */
export function idLineaCarrito(productId: number, modifierIds: number[] = [], notes?: string | null): number | string {
  const modKey = [...modifierIds].sort((a, b) => a - b).join('-')
  const nota = notes?.trim() ? `n${hashCorto(notes.trim())}` : ''
  const partes = [modKey, nota].filter(Boolean)
  return partes.length > 0 ? `${productId}_${partes.join('_')}` : productId
}

/**
 * Suma una línea al carrito del sitio (clave por sede, evento `cart-updated` del píxel). Si la
 * misma línea (producto + opciones + nota) ya está, suma la cantidad.
 */
export function agregarPlatoAlCarrito(
  subdomain: string,
  branchId: number | null | undefined,
  linea: LineaPlatoInput,
  opciones: { reemplazar?: boolean } = {},
): void {
  const cartKey = getCartKey(subdomain, branchId)
  const notes = linea.notes?.trim().slice(0, MAX_NOTA_COCINA) || null
  const modifiers = linea.modifiers && linea.modifiers.length > 0 ? linea.modifiers : null
  const antiguos = linea.legacyModifiers && linea.legacyModifiers.length > 0 ? linea.legacyModifiers : null
  // Los antiguos van en la clave con su valueId (mismo criterio que MenuView).
  const id = idLineaCarrito(
    linea.productId,
    [...(antiguos || []).map((m) => -Math.abs(m.valueId)), ...(modifiers || []).map((m) => m.modifierId)],
    notes,
  )
  const cantidad = Math.max(1, Math.trunc(linea.quantity) || 1)
  const cart = opciones.reemplazar ? [] : JSON.parse(localStorage.getItem(cartKey) || '[]')
  const idx = cart.findIndex((item: { id: number | string }) => item.id === id)
  if (idx >= 0) {
    cart[idx].quantity += cantidad
  } else {
    cart.push({
      id,
      // Con id compuesto, el servidor lee el producto de aquí (productIdDeLinea).
      ...(typeof id === 'string' && { productId: linea.productId }),
      name: linea.name,
      price: linea.unitPrice,
      quantity: cantidad,
      ...(linea.sku && { sku: linea.sku }),
      ...(linea.imageUrl && { imageUrl: linea.imageUrl }),
      ...(linea.comparePrice && { comparePrice: linea.comparePrice }),
      ...(antiguos && { modifiers: antiguos }),
      ...(modifiers && { newModifiers: modifiers }),
      ...(notes && { notes }),
      ...(linea.variantAttributes && { variantAttributes: linea.variantAttributes }),
    })
  }
  localStorage.setItem(cartKey, JSON.stringify(cart))
  window.dispatchEvent(new CustomEvent('cart-updated'))
}
