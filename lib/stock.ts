/**
 * Helpers centralizados para el control de inventario en el sitio público.
 *
 * Reglas:
 * - `track_stock !== true`  -> el producto no rastrea inventario, siempre disponible (`null`).
 * - `track_stock === true`  -> rastrea inventario:
 *     - sin filas en `stock_levels` -> 0 disponible (no hay registro de existencias).
 *     - con filas -> suma de `qty_on_hand - qty_reserved` de todas las filas.
 */

export interface StockLevel {
  qty_on_hand: number
  qty_reserved: number
  branch_id?: number
}

export interface StockTrackable {
  track_stock?: boolean
  stock_levels?: StockLevel[] | null
}

/**
 * Devuelve el stock disponible del producto, o `null` si no rastrea inventario.
 */
export function getAvailableStock(product: StockTrackable): number | null {
  if (product.track_stock !== true) return null
  if (!product.stock_levels || product.stock_levels.length === 0) return 0
  return product.stock_levels.reduce(
    (sum, sl) => sum + (Number(sl.qty_on_hand) - Number(sl.qty_reserved)),
    0
  )
}

/**
 * Indica si el producto está agotado (rastrea inventario y no tiene existencias).
 */
export function isOutOfStock(product: StockTrackable): boolean {
  const stock = getAvailableStock(product)
  return stock !== null && stock <= 0
}

/**
 * Deja en cada producto únicamente los `stock_levels` de las sucursales indicadas.
 *
 * `branchIds = null` significa que la organización no tiene ninguna sucursal marcada
 * como fuente de inventario web; en ese caso se conservan todas las sucursales.
 */
export function filterStockByBranches<T extends { stock_levels?: StockLevel[] | null }>(
  products: T[],
  branchIds: number[] | null
): T[] {
  if (!branchIds || branchIds.length === 0) return products
  const allowed = new Set(branchIds)
  return products.map((p) => ({
    ...p,
    stock_levels: (p.stock_levels || []).filter(
      (sl) => sl.branch_id !== undefined && allowed.has(sl.branch_id)
    ),
  }))
}

/**
 * Estado de stock para comprar desde la ficha (barra fija, selector, botones).
 *
 * - Producto padre con variantes: manda la variante elegida. Sin variante elegida,
 *   solo está agotado si TODAS las variantes lo están. El stock del padre no cuenta
 *   (suele ser 0 porque las existencias viven en los hijos).
 * - Producto sin variantes: exactamente como antes, stock del propio producto.
 *
 * `stock = null` significa sin tope (no rastrea inventario).
 */
export function estadoStockCompra(opts: {
  producto: StockTrackable
  esPadre?: boolean
  variantes?: StockTrackable[] | null
  variante?: StockTrackable | null
}): { stock: number | null; agotado: boolean } {
  const variantes = opts.variantes || []
  if (opts.esPadre && variantes.length > 0) {
    if (opts.variante) {
      const stock = getAvailableStock(opts.variante)
      return { stock, agotado: stock !== null && stock <= 0 }
    }
    return { stock: null, agotado: variantes.every((v) => isOutOfStock(v)) }
  }
  const stock = getAvailableStock(opts.producto)
  return { stock, agotado: stock !== null && stock <= 0 }
}

/** Siguiente cantidad al pulsar «+», sin pasar del stock (`null` = sin tope). */
export function siguienteCantidad(actual: number, stock: number | null): number {
  if (stock === null) return actual + 1
  return Math.max(1, Math.min(actual + 1, stock))
}

/**
 * Variante a preseleccionar: la primera que se puede comprar (con stock o sin control de
 * inventario). Si ninguna, la primera. Misma regla en el selector y en la barra fija.
 */
export function primeraVarianteDisponible<T extends StockTrackable>(variantes: T[]): T | undefined {
  return variantes.find((v) => !isOutOfStock(v)) ?? variantes[0]
}
