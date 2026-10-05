/**
 * Filas de `web_order_items` y líneas del correo de confirmación de un pedido web.
 *
 * Extraído tal cual de `app/api/orders/route.ts` (sin cambio de comportamiento) para poder
 * corregir el formato de la línea en un commit aparte.
 */

export function construirFilasPedido(
  items: any[],
  webOrderId: string,
  taxRate: number,
  productIdDe: (item: any) => number,
): Record<string, unknown>[] {
  return items.map((item: any) => {
    const newModsExtraTotal = (item.newModifiers || []).reduce(
      (sum: number, m: any) => sum + (Number(m.extraPrice) || 0), 0
    )
    const effectiveUnitPrice = Number(item.price) + newModsExtraTotal
    const itemTotal = effectiveUnitPrice * item.quantity
    const itemTax = taxRate > 0 ? Math.round(itemTotal * taxRate / 100) : 0
    const allModifiers = [
      ...(item.modifiers || []),
      ...(item.newModifiers || []),
    ]
    return {
      web_order_id: webOrderId,
      product_id: productIdDe(item),
      product_name: item.name,
      product_sku: item.sku || null,
      quantity: item.quantity,
      unit_price: effectiveUnitPrice,
      tax_amount: itemTax,
      total: itemTotal,
      ...(allModifiers.length > 0 && { modifiers: allModifiers }),
      ...(item.notes && { notes: item.notes }),
    }
  })
}

export function lineasCorreoPedido(items: any[]): { name: string; quantity: number; unitPrice: number; total: number }[] {
  return items.map((item: any) => ({
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.price,
    total: item.price * item.quantity,
  }))
}
