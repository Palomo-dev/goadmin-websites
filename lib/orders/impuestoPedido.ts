/**
 * Impuesto de un pedido web: una sola regla para el servidor (`/api/orders`) y para lo que ve el
 * cliente (checkout, carrito y drawer).
 *
 * Antes el impuesto se calculaba sobre el subtotal bruto, antes de cupón y promociones, y la vista
 * del cliente y el servidor lo hacían cada uno a su manera. Ahora:
 * - el descuento del pedido (cupón + promociones) se prorratea entre las líneas en proporción a
 *   su bruto, en centavos y con el residuo en la última línea (mismo reparto que
 *   `webOrderTotals.ts` del ERP al facturar el pedido);
 * - el impuesto de cada línea sale de su neto con la regla única del POS
 *   (`go-admin-erp/src/lib/pos/lineaVenta.ts`, `calcularLineaVenta`):
 *     incluido:    neto − neto / (1 + tasa/100)
 *     no incluido: neto × tasa / 100
 *   redondeado a 2 decimales;
 * - el impuesto del pedido es la suma de las líneas, así `Σ web_order_items.tax_amount` cuadra con
 *   `web_orders.tax_total` y la factura del ERP con `web_orders.total`.
 *
 * Esta es una COPIA de la fórmula del ERP (el sitio no puede importar del repo del ERP).
 * `scripts/verify-orders.mjs` la contrasta con casos fijos calculados con la regla del POS.
 *
 * Puro: lo usan servidor y navegador.
 */

const redondear2 = (n: number): number => Math.round(n * 100) / 100
const centavos = (n: number): number => Math.round(n * 100)

/** Regla del POS para una línea ya neta de descuento. */
export function impuestoDeLinea(neto: number, tasa: number, incluido: boolean): number {
  if (!(tasa > 0) || !(neto > 0)) return 0
  const impuesto = incluido ? neto - neto / (1 + tasa / 100) : (neto * tasa) / 100
  return redondear2(impuesto)
}

/** Reparte `monto` (en pesos) entre `pesos` en proporción, en centavos, residuo al final. */
export function prorratear(monto: number, pesos: number[]): number[] {
  const montoCent = Math.max(centavos(monto), 0)
  const pesosCent = pesos.map((p) => Math.max(centavos(p), 0))
  const totalPesos = pesosCent.reduce((s, p) => s + p, 0)
  const partes = pesosCent.map(() => 0)
  if (montoCent <= 0 || totalPesos <= 0) return partes
  let restante = montoCent
  for (let i = 0; i < pesosCent.length; i++) {
    const parte = Math.min(Math.floor((montoCent * pesosCent[i]) / totalPesos), pesosCent[i])
    partes[i] = parte
    restante -= parte
  }
  for (let i = pesosCent.length - 1; i >= 0 && restante > 0; i--) {
    const extra = Math.min(pesosCent[i] - partes[i], restante)
    partes[i] += extra
    restante -= extra
  }
  return partes.map((c) => c / 100)
}

export interface EntradaImpuestoPedido {
  /** Bruto de cada línea (precio unitario × cantidad). */
  brutos: number[]
  /** Descuento total del pedido (cupón + promociones). */
  descuento: number
  tasa: number
  incluido: boolean
}

export interface ImpuestoPedido {
  /** Impuesto de cada línea, en el mismo orden que `brutos`. */
  porLinea: number[]
  /** Suma de las líneas. */
  total: number
  /** Lo que el impuesto suma al total del pedido: 0 si va incluido en el precio. */
  sumaAlTotal: number
}

export function calcularImpuestoPedido({ brutos, descuento, tasa, incluido }: EntradaImpuestoPedido): ImpuestoPedido {
  const descuentoAplicable = Math.min(Math.max(Number(descuento) || 0, 0), brutos.reduce((s, b) => s + Math.max(b, 0), 0))
  const partes = prorratear(descuentoAplicable, brutos)
  const porLinea = brutos.map((b, i) => impuestoDeLinea(redondear2(Math.max(b, 0) - partes[i]), Number(tasa) || 0, incluido))
  const total = redondear2(porLinea.reduce((s, t) => s + t, 0))
  return { porLinea, total, sumaAlTotal: incluido ? 0 : total }
}
