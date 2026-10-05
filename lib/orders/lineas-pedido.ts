/**
 * Filas de `web_order_items` y líneas del correo de confirmación de un pedido web, a partir de
 * las líneas ya resueltas en el servidor (lib/products/precio-servidor.ts).
 *
 * `unit_price` es el precio unitario REAL de la línea: base + extras de modificadores, sumados una
 * sola vez. Antes se volvían a sumar los extras de `newModifiers` sobre un precio que ya los
 * traía. Es el formato que ya esperaban sus lectores, que nunca suman extras por su cuenta:
 * el ERP (`webOrderTotals.ts`: bruto = quantity × unit_price, y las líneas deben cuadrar con
 * `web_orders.total`), `/api/orders/lookup`, `/mi-cuenta/pedidos/[id]` y `ReorderButton`.
 * Verificado por MCP el 2026-10-05: de 11.481 líneas guardadas, ninguna tiene extras con precio,
 * así que el doble cobro nunca llegó a la base y no hay datos que migrar.
 */

import type { LineaResuelta } from '@/lib/products/precio-servidor'

const redondear2 = (n: number): number => Math.round(n * 100) / 100

export function construirFilasPedido(
  lineas: LineaResuelta[],
  webOrderId: string,
  taxRate: number,
): Record<string, unknown>[] {
  return lineas.map((l) => {
    const itemTotal = redondear2(l.precioUnitario * l.cantidad)
    const itemTax = taxRate > 0 ? Math.round(itemTotal * taxRate / 100) : 0
    // Mismo contenido que antes en `modifiers`: los antiguos (sin precio) y los de grupos, estos
    // con nombre y precio tomados de la base.
    const allModifiers = [...l.modificadoresSinPrecio, ...l.modificadores]
    return {
      web_order_id: webOrderId,
      product_id: l.productId,
      product_name: l.nombre,
      product_sku: l.sku,
      quantity: l.cantidad,
      unit_price: l.precioUnitario,
      tax_amount: itemTax,
      total: itemTotal,
      ...(allModifiers.length > 0 && { modifiers: allModifiers }),
      ...(l.notas && { notes: l.notas }),
    }
  })
}

export function lineasCorreoPedido(lineas: LineaResuelta[]): { name: string; quantity: number; unitPrice: number; total: number }[] {
  return lineas.map((l) => ({
    name: l.nombre,
    quantity: l.cantidad,
    unitPrice: l.precioUnitario,
    total: redondear2(l.precioUnitario * l.cantidad),
  }))
}
