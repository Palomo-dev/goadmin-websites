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
