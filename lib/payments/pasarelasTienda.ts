/**
 * Reglas puras de Bold y Mercado Pago en la tienda: sin base, sin red y sin alias `@/`, para que
 * `scripts/verify-pasarelas-bold-mp.mjs` las importe tal cual.
 *
 * Fuentes (leídas el 2026-11-19):
 *  - Firma del webhook de Bold: https://developers.bold.co/webhook — HMAC-SHA256 con la LLAVE
 *    SECRETA sobre el cuerpo CODIFICADO EN BASE64, salida hexadecimal, en `x-bold-signature`.
 *  - Consulta del Botón de pagos: https://developers.bold.co/pagos-en-linea/boton-de-pagos/consulta-de-transacciones
 *    — `payment_status` NO_TRANSACTION_FOUND | PROCESSING | PENDING | APPROVED | REJECTED | FAILED | VOIDED.
 *  - Estados de un pago de Mercado Pago: approved, authorized, pending, in_process, in_mediation,
 *    rejected, cancelled, refunded, charged_back.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

/** Lo que un aviso o una consulta le dice al pedido web. `pending` = no cambia nada. */
export type EstadoPagoTienda = 'paid' | 'failed' | 'refunded' | 'pending'

/** Tolerancia de redondeo (Bold cobra en pesos enteros: `Math.round(total)` en checkout/init). */
export const TOLERANCIA_MONTO = 1

/**
 * ¿La firma de Bold es de esa llave secreta? Se acepta la forma documentada (HMAC del cuerpo en
 * Base64) y, por compatibilidad, la del cuerpo crudo que se usaba antes. Las dos exigen la llave:
 * aceptar ambas no abre nada. Sin firma o sin llave: falso, nunca un pase libre.
 */
export function firmaBoldValida(
  cuerpo: Uint8Array | string,
  firma: string | null | undefined,
  llaveSecreta: string | null | undefined,
): boolean {
  if (!firma || !llaveSecreta) return false
  const recibida = firma.trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(recibida)) return false
  const bytes = typeof cuerpo === 'string' ? Buffer.from(cuerpo, 'utf8') : Buffer.from(cuerpo)
  const esperada = Buffer.from(recibida, 'hex')
  const candidatas = [
    createHmac('sha256', llaveSecreta).update(bytes.toString('base64')).digest(),
    createHmac('sha256', llaveSecreta).update(bytes).digest(),
  ]
  return candidatas.some((c) => c.length === esperada.length && timingSafeEqual(c, esperada))
}

/**
 * Evento del webhook de Bold → estado del pedido. VOID_REJECTED es una anulación RECHAZADA: la
 * venta sigue aprobada, así que no cambia nada (antes se marcaba el pedido como fallido).
 */
export function estadoEventoBold(tipo: string | null | undefined): EstadoPagoTienda {
  switch (tipo) {
    case 'SALE_APPROVED':
      return 'paid'
    case 'SALE_REJECTED':
      return 'failed'
    case 'VOID_APPROVED':
      return 'refunded'
    default:
      return 'pending'
  }
}

/** `payment_status` de la consulta del Botón de pagos → estado del pedido. */
export function estadoComprobanteBold(estado: string | null | undefined): EstadoPagoTienda {
  switch ((estado ?? '').toUpperCase()) {
    case 'APPROVED':
      return 'paid'
    case 'REJECTED':
    case 'FAILED':
      return 'failed'
    case 'VOIDED':
      return 'refunded'
    default:
      return 'pending'
  }
}

/**
 * Estado de un pago de Mercado Pago → estado del pedido. `authorized` es una reserva sin
 * capturar: todavía no es plata cobrada, así que no marca el pedido como pagado.
 */
export function estadoMercadoPago(estado: string | null | undefined): EstadoPagoTienda {
  switch (estado) {
    case 'approved':
      return 'paid'
    case 'rejected':
    case 'cancelled':
      return 'failed'
    case 'refunded':
    case 'charged_back':
      return 'refunded'
    default:
      return 'pending'
  }
}

/** ¿El monto cobrado cubre el total del pedido? Un monto desconocido no cubre nada. */
export function montoCubreTotal(monto: unknown, total: unknown): boolean {
  const m = Number(monto)
  const t = Number(total)
  if (!Number.isFinite(m) || !Number.isFinite(t) || m <= 0) return false
  return m + TOLERANCIA_MONTO >= t
}

/** Id de organización que viaja en la URL de aviso de Mercado Pago (`?org=`). Solo una pista. */
export function organizacionDeAviso(valor: string | null | undefined): number | null {
  if (!valor || !/^\d{1,10}$/.test(valor)) return null
  const n = Number(valor)
  return n > 0 ? n : null
}

/**
 * URL de aviso que va en cada preferencia de Mercado Pago: la del dominio por el que entró la
 * compra, para que el pago lo confirme la tienda sin depender de lo que el comercio pegue en su
 * panel. Sin host público (localhost, IP, vacío o con caracteres raros): `null` y la preferencia
 * sale sin `notification_url`, como antes (Mercado Pago rechaza las de localhost).
 */
export function urlNotificacionMercadoPago(host: string | null | undefined, organizationId: number): string | null {
  const limpio = (host ?? '').split(',')[0].trim().toLowerCase().replace(/:\d+$/, '')
  if (!limpio || !/^[a-z0-9.-]+$/.test(limpio) || !limpio.includes('.')) return null
  if (limpio === 'localhost' || limpio.endsWith('.localhost') || /^\d+(\.\d+){3}$/.test(limpio)) return null
  if (!Number.isInteger(organizationId) || organizationId <= 0) return null
  return `https://${limpio}/api/webhooks/mercadopago?org=${organizationId}`
}

export interface PagoMercadoPago {
  id?: number | string
  status?: string
  external_reference?: string | null
  date_created?: string | null
  transaction_amount?: number | null
  currency_id?: string | null
  payment_method_id?: string | null
  payment_type_id?: string | null
  status_detail?: string | null
}

/**
 * De la búsqueda por referencia, el pago que manda: solo los de ESA referencia; un aprobado gana;
 * si no hay, el más reciente. Ninguno: `null`.
 */
export function elegirPagoMercadoPago(resultados: readonly PagoMercadoPago[] | null | undefined, referencia: string): PagoMercadoPago | null {
  const deLaReferencia = (resultados ?? []).filter((p) => p && p.external_reference === referencia)
  if (deLaReferencia.length === 0) return null
  const aprobado = deLaReferencia.find((p) => p.status === 'approved')
  if (aprobado) return aprobado
  return [...deLaReferencia].sort((a, b) => String(b.date_created ?? '').localeCompare(String(a.date_created ?? '')))[0]
}
