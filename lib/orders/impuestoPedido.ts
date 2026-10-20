/**
 * Impuesto de un pedido web: una sola regla para el servidor (`/api/orders`) y para lo que ve el
 * cliente (checkout, carrito y drawer).
 *
 * Antes el impuesto se calculaba sobre el subtotal bruto, antes de cupón y promociones, y la vista
 * del cliente y el servidor lo hacían cada uno a su manera. Ahora:
 * - el descuento del pedido (cupón + promociones) se prorratea entre las líneas en proporción a
 *   su bruto, en centavos y con el residuo en la última línea (mismo reparto que
 *   `webOrderTotals.ts` del ERP al facturar el pedido);
 * - cada línea puede traer su propia tarifa (la de su producto). Si no la trae, usa la
 *   tarifa única del pedido;
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

/** Un impuesto de una línea. Varios se suman; cada uno dice si ya va en el precio. */
export interface ComponenteImpuestoLinea {
  tasa: number
  incluido: boolean
}

/**
 * Tarifa de una línea. Sin `componentes`, valen `tasa` e `incluido`.
 * `null` en el arreglo de líneas usa la tarifa única del pedido.
 */
export interface TarifaDeLinea {
  tasa?: number
  incluido?: boolean
  componentes?: ComponenteImpuestoLinea[]
}

export interface EntradaImpuestoPedido {
  /** Bruto de cada línea (precio unitario × cantidad). */
  brutos: number[]
  /** Descuento total del pedido (cupón + promociones). */
  descuento: number
  /** Tarifa del pedido. La usa cada línea que no trae la suya. */
  tasa: number
  incluido: boolean
  /**
   * Tarifa de cada línea, en el mismo orden que `brutos`.
   * Si no viene, todas las líneas usan `tasa` e `incluido`.
   */
  lineas?: Array<TarifaDeLinea | null>
}

export interface ImpuestoPedido {
  /** Impuesto de cada línea, en el mismo orden que `brutos`. */
  porLinea: number[]
  /** Suma de las líneas. */
  total: number
  /** Lo que el impuesto suma al total del pedido: 0 si va incluido en el precio. */
  sumaAlTotal: number
}

function componentesDeLinea(
  especifica: TarifaDeLinea | null | undefined,
  tasa: number,
  incluido: boolean,
): { tasa: number; incluido: boolean }[] {
  if (especifica?.componentes && especifica.componentes.length > 0) {
    return especifica.componentes.map((c) => ({ tasa: Number(c.tasa) || 0, incluido: c.incluido === true }))
  }
  if (especifica) {
    return [{ tasa: Number(especifica.tasa) || 0, incluido: especifica.incluido === true }]
  }
  return [{ tasa: Number(tasa) || 0, incluido: incluido === true }]
}

export function calcularImpuestoPedido({ brutos, descuento, tasa, incluido, lineas }: EntradaImpuestoPedido): ImpuestoPedido {
  const descuentoAplicable = Math.min(Math.max(Number(descuento) || 0, 0), brutos.reduce((s, b) => s + Math.max(b, 0), 0))
  const partes = prorratear(descuentoAplicable, brutos)
  const porLinea: number[] = []
  const sumas: number[] = []
  brutos.forEach((b, i) => {
    const neto = redondear2(Math.max(b, 0) - partes[i])
    let totalLinea = 0
    let sumaLinea = 0
    for (const c of componentesDeLinea(lineas?.[i], tasa, incluido)) {
      const imp = impuestoDeLinea(neto, c.tasa, c.incluido)
      totalLinea += imp
      if (!c.incluido) sumaLinea += imp
    }
    porLinea.push(redondear2(totalLinea))
    sumas.push(redondear2(sumaLinea))
  })
  const total = redondear2(porLinea.reduce((s, t) => s + t, 0))
  const sumaAlTotal = redondear2(sumas.reduce((s, t) => s + t, 0))
  return { porLinea, total, sumaAlTotal }
}
