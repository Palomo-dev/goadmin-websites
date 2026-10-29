/**
 * Métodos de pago por sucursal (ERP, migración 20261028180000):
 * `organization_payment_methods.branch_ids` NULL = todas las sucursales.
 * Mientras la columna no exista, `branchIds` llega ausente y no se filtra nada.
 */
export function metodoPermitidoEnSede(branchIds: unknown, sedeId: number | null | undefined): boolean {
  if (!Array.isArray(branchIds) || branchIds.length === 0) return true
  if (sedeId == null || !Number.isFinite(Number(sedeId))) return true
  return branchIds.map(Number).includes(Number(sedeId))
}

export function filtrarMetodosPorSede<T extends { branchIds?: number[] | null }>(metodos: T[], sedeId: number | null | undefined): T[] {
  return metodos.filter((m) => metodoPermitidoEnSede(m.branchIds, sedeId))
}

/** ¿La BD dice que la columna no existe (migración sin aplicar)? */
export function esColumnaAusente(error: unknown, columna: string): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string; message?: string; details?: string; hint?: string }
  const texto = `${e.message ?? ''} ${e.details ?? ''} ${e.hint ?? ''}`
  return (e.code === '42703' || e.code === 'PGRST204' || /does not exist|could not find/i.test(texto)) && texto.includes(columna)
}

export type ResultadoMetodoSede =
  | { ok: true }
  | { ok: false; code: 'METODO_PAGO_NO_DISPONIBLE_EN_SEDE'; error: string }

/**
 * Validación del servidor (/api/orders): el método elegido debe estar habilitado en la sede del
 * pedido. `filas` son las de organization_payment_methods de la org con ese código. Sin fila
 * (pasarelas, métodos que no vienen del ERP), sin sede o sin restricción (branch_ids NULL o
 * vacío) → se acepta exactamente como antes.
 */
export function validarMetodoEnSede(
  filas: Array<{ branch_ids?: unknown; website_display_name?: string | null; payment_methods?: { name?: string | null } | null }> | null | undefined,
  metodo: unknown,
  sedeId: number | null | undefined,
): ResultadoMetodoSede {
  if (typeof metodo !== 'string' || !metodo.trim() || !filas || filas.length === 0) return { ok: true }
  if (filas.some((f) => metodoPermitidoEnSede(f.branch_ids, sedeId))) return { ok: true }
  const f = filas[0]
  const nombre = (f.website_display_name || f.payment_methods?.name || metodo).toString().trim()
  return {
    ok: false,
    code: 'METODO_PAGO_NO_DISPONIBLE_EN_SEDE',
    error: `El método de pago «${nombre}» no está disponible en esta sede. Elige otro método de pago.`,
  }
}
