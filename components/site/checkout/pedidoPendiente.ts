/**
 * Pago rechazado sin perder el pedido (Figma «16 Sitio web» › Checkout v2, C2; lámina D «Pago
 * rechazado»; aprobado por el dueño el 2026-11-24).
 *
 * Antes: el checkout vaciaba el carrito antes de ir a la pasarela y, si el pago no pasaba,
 * «Intentar de nuevo» caía en «Tu carrito está vacío».
 *
 * Ahora, SIN cambiar cuándo se vacía el carrito (sigue vaciándose al ir a la pasarela, como hoy:
 * así un pedido pagado nunca deja el carrito lleno para un segundo pedido), el checkout guarda en
 * el navegador una copia del pedido que fue a pagar: número, pasarela, total, el carrito y la clave
 * del carrito. Al volver de la pasarela con el pago NO aprobado (`/checkout?pedido=WO-…&paso=
 * revisar`), el checkout:
 * - pregunta al SERVIDOR el estado del pedido (`/api/orders/<n>/tracking`): solo con el pedido
 *   pendiente y el pago rechazado o sin pagar se ofrece reintentar (nunca por lo que diga la URL);
 * - devuelve el carrito si está vacío (para «Editar carrito» o pagar con efectivo en otro pedido);
 * - «Intentar de nuevo» y «Pagar con otro método» cobran el MISMO pedido por `/api/checkout/init`
 *   (la ruta de siempre de «Pagar» en la consulta del pedido). El método del pedido lo cambia el
 *   servidor (init escribe `payment_method` tras validar pasarela, organización y estado); el
 *   navegador nunca lo escribe.
 *
 * Puro (sin React): el almacenamiento llega por parámetro. Lo usan el checkout y
 * `scripts/verify-checkout-v2.mjs`.
 */

export interface PedidoPendienteGuardado {
  v: 1
  orderNumber: string
  /** Token de seguimiento del pedido (para la consulta con dirección). */
  trackingToken: string | null
  /** Pasarela con la que se fue a pagar (código del método). */
  gateway: string
  /** Total formateado con que se fue a pagar. */
  total: string
  /** Clave del carrito (por sede) y lo que tenía al ir a pagar. */
  cartKey: string
  carrito: unknown[]
  /** ms desde epoch. */
  guardadoEn: number
}

/** Después de esto la copia ya no sirve (el pedido sin pago vence a los 30 min en el servidor). */
export const VIGENCIA_PEDIDO_PENDIENTE_MS = 6 * 60 * 60 * 1000

export interface Almacen {
  getItem(clave: string): string | null
  setItem(clave: string, valor: string): void
  removeItem(clave: string): void
}

export function clavePedidoPendiente(subdominio: string): string {
  return `checkout_pedido_pendiente_${subdominio}`
}

/** Número de pedido con forma de número de pedido (lo que llega por la URL no se usa tal cual). */
export function numeroPedidoValido(valor: string | null | undefined): string | null {
  const v = (valor || '').trim()
  return /^[A-Za-z0-9][A-Za-z0-9_-]{2,39}$/.test(v) ? v : null
}

export function guardarPedidoPendiente(almacen: Almacen, subdominio: string, p: Omit<PedidoPendienteGuardado, 'v'>): void {
  try {
    almacen.setItem(clavePedidoPendiente(subdominio), JSON.stringify({ v: 1, ...p }))
  } catch {
    // Navegador sin espacio o en modo privado: el pago sigue como hoy, sin copia.
  }
}

/** La copia del pedido `orderNumber`, si es de ese pedido y no ha vencido. */
export function leerPedidoPendiente(almacen: Almacen, subdominio: string, orderNumber: string, ahora: number): PedidoPendienteGuardado | null {
  try {
    const crudo = almacen.getItem(clavePedidoPendiente(subdominio))
    if (!crudo) return null
    const p = JSON.parse(crudo) as Partial<PedidoPendienteGuardado>
    if (p?.v !== 1 || p.orderNumber !== orderNumber) return null
    if (typeof p.guardadoEn !== 'number' || ahora - p.guardadoEn > VIGENCIA_PEDIDO_PENDIENTE_MS || ahora < p.guardadoEn - 60_000) return null
    if (typeof p.gateway !== 'string' || typeof p.cartKey !== 'string' || !Array.isArray(p.carrito)) return null
    return p as PedidoPendienteGuardado
  } catch {
    return null
  }
}

export function borrarPedidoPendiente(almacen: Almacen, subdominio: string): void {
  try {
    almacen.removeItem(clavePedidoPendiente(subdominio))
  } catch {
    // Nada que hacer.
  }
}

/**
 * ¿Se ofrece reintentar el pago? Solo con lo que dice el SERVIDOR del pedido: pendiente (no vencido,
 * cancelado ni entregado) y con el pago rechazado o aún sin pagar. Pagado, parcial (anticipo) o
 * cerrado: no.
 */
export function admiteReintento(estado: { status: string | null | undefined; paymentStatus: string | null | undefined }): boolean {
  return estado.status === 'pending' && (estado.paymentStatus === 'failed' || estado.paymentStatus === 'pending')
}

/**
 * El carrito que debe quedar al volver con el pago no aprobado: si el de ahora está vacío, el de la
 * copia; si el cliente ya armó otro, se respeta el suyo (nunca se pisa ni se mezcla).
 */
export function carritoAlVolver(actual: readonly unknown[] | null, copia: readonly unknown[]): unknown[] | null {
  if (Array.isArray(actual) && actual.length > 0) return null
  return copia.length > 0 ? [...copia] : null
}
