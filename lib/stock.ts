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
