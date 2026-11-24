/**
 * Referencia con que se cobra el anticipo de un pedido contraentrega en la pasarela: `ANT-<id del
 * pedido>`. El id (uuid) es único entre organizaciones: el webhook resuelve el pedido —y su
 * organización— sin mirar el payload. Puro (lo prueba scripts/verify-contraentrega.mjs).
 */

export const FUENTE_COBRO_ANTICIPO = 'anticipo_pedido'
const PREFIJO_ANTICIPO = 'ANT-'
export const UUID_PEDIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function referenciaAnticipo(orderId: string): string {
  return `${PREFIJO_ANTICIPO}${orderId}`
}

/** Id del pedido de una referencia `ANT-<uuid>`, o `null`. */
export function idDeReferenciaAnticipo(referencia: unknown): string | null {
  if (typeof referencia !== 'string' || !referencia.startsWith(PREFIJO_ANTICIPO)) return null
  const id = referencia.slice(PREFIJO_ANTICIPO.length)
  return UUID_PEDIDO.test(id) ? id.toLowerCase() : null
}

export function esReferenciaAnticipo(referencia: unknown): boolean {
  return idDeReferenciaAnticipo(referencia) !== null
}
