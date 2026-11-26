/**
 * «Usar en la tienda para» de una pasarela (`organization_payment_methods.website_usage`, ERP
 * 20261126120000), elegido en Finanzas › Métodos de pago del ERP:
 *
 * - `ambos` (por defecto, y lo de siempre): sale en el checkout y cobra el anticipo de contraentrega.
 * - `solo_anticipo`: NO sale como opción de pago; solo cobra el anticipo de la contraentrega.
 * - `solo_pago_completo`: sale en el checkout; nunca se usa para el anticipo.
 *
 * Sin columna, sin fila o con un valor desconocido = `ambos`: ninguna tienda cambia sola. Los
 * métodos nativos (efectivo, transferencia…) no tienen uso: siempre como hoy.
 */

export const USOS_TIENDA = ['ambos', 'solo_anticipo', 'solo_pago_completo'] as const
export type UsoTienda = (typeof USOS_TIENDA)[number]

export function usoTienda(valor: unknown): UsoTienda {
  return (USOS_TIENDA as readonly string[]).includes(String(valor)) ? (valor as UsoTienda) : 'ambos'
}

interface MetodoConUso {
  type?: string
  uso?: unknown
}

/** ¿Se ofrece como opción de pago (pago completo)? Todo menos una pasarela «solo anticipo». */
export function sirvePagoCompleto(m: MetodoConUso): boolean {
  return !(m.type === 'gateway' && usoTienda(m.uso) === 'solo_anticipo')
}

/** ¿Cobra el anticipo de contraentrega? Todo menos una pasarela «solo pago completo». */
export function sirveAnticipo(m: MetodoConUso): boolean {
  return !(m.type === 'gateway' && usoTienda(m.uso) === 'solo_pago_completo')
}

/** Métodos del checkout (pago completo), en el mismo orden. */
export function metodosPagoCompleto<T extends MetodoConUso>(metodos: T[]): T[] {
  return metodos.filter(sirvePagoCompleto)
}
