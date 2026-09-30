/**
 * Regla única de «producto visible/vendible en el sitio» frente a bajas lógicas.
 *
 * Contexto (ERP, docs/inventario/VARIANTES-HUERFANAS.md): un producto se elimina con
 * `products.status = 'deleted'`. Hasta el 2026-09-30 eliminar un padre no arrastraba a
 * sus variantes, y quedaron variantes `active` bajo padres `deleted` (889 aún hoy en la
 * base). Los listados del sitio solo traen padres activos, pero por id/uuid directo esas
 * variantes seguían resolviéndose y se podían pedir.
 *
 * Regla:
 *  - mismo `organization_id` que el contexto (host), nunca el del body;
 *  - `status` distinto de `'deleted'`;
 *  - si es variante (`parent_product_id`), su padre tampoco está `'deleted'`.
 *
 * Lo demás no cambia: las lecturas del sitio siguen exigiendo `status = 'active'` (ya lo
 * hacían) y `/api/orders` sigue sin mirar `inactive`/`discontinued` (tampoco lo hacía).
 *
 * El estado del padre viaja en la MISMA consulta con el embebido `SELECT_PADRE_ESTADO`
 * (a-uno por `parent_product_id`): no añade consultas por render.
 */

/** Embebido PostgREST del estado del padre. Añadir al `select` de `products`. */
export const SELECT_PADRE_ESTADO = 'padre:products!parent_product_id(status)'

export interface FilaProductoConPadre {
  organization_id?: number | null
  status?: string | null
  parent_product_id?: number | null
  /** Resultado de `SELECT_PADRE_ESTADO`; `null` si no es variante. */
  padre?: { status: string | null } | { status: string | null }[] | null
}

function estadoPadre(fila: FilaProductoConPadre): string | null {
  const p = fila.padre
  if (!p) return null
  return Array.isArray(p) ? (p[0]?.status ?? null) : p.status
}

/** `true` si el producto o, siendo variante, su padre está dado de baja. */
export function productoEliminado(fila: FilaProductoConPadre): boolean {
  if (fila.status === 'deleted') return true
  return fila.parent_product_id != null && estadoPadre(fila) === 'deleted'
}

/**
 * `true` si la fila puede mostrarse o venderse en el sitio de `organizationId`.
 * Una fila ausente (id inexistente) no es visible.
 */
export function esProductoVisibleEnWeb(
  fila: FilaProductoConPadre | null | undefined,
  organizationId: number,
): boolean {
  if (!fila) return false
  if (Number(fila.organization_id) !== Number(organizationId)) return false
  return !productoEliminado(fila)
}
