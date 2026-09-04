import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

/**
 * Obtiene los IDs de categorías permitidas para un outlet.
 *
 * Regla de filtro branch_id (F1 §5.0):
 * - branchId === undefined → NO se filtra (backward compat: trae TODO).
 * - branchId === null      → solo categorías globales (branch_id IS NULL).
 * - branchId === X (number)→ categorías del outlet X + globales (branch_id = X OR IS NULL).
 *
 * Filtra solo is_active = true.
 */
export async function getAllowedCategoryIds(
  organizationId: number,
  branchId?: number | null,
): Promise<number[] | null> {
  // undefined → null indica "no filtrar" (la query de productos no aplica .in).
  if (branchId === undefined) return null

  const supabase = createAdminClient() || createPublicClient()
  let query = supabase
    .from('categories')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  if (branchId === null) {
    query = query.is('branch_id', null)
  } else if (Number.isFinite(branchId)) {
    query = query.or(`branch_id.eq.${branchId},branch_id.is.null`)
  }

  const { data, error } = await query
  if (error || !data) return []
  return data.map((c: any) => c.id as number)
}

/**
 * Aplica el filtro de branch_id a una query de Supabase sobre una tabla que
 * tenga la columna `branch_id` (website_pages, categories, spaces, etc.).
 *
 * Retorna la query modificada (encadenable). Si branchId === undefined no
 * añade ningún filtro (backward compat).
 */
export function applyBranchIdFilter<T extends { is: (col: string, val: null) => T; or: (filter: string) => T }>(
  query: T,
  branchId: number | null | undefined,
): T {
  if (branchId === null) {
    return query.is('branch_id', null)
  }
  if (branchId !== undefined) {
    return query.or(`branch_id.eq.${branchId},branch_id.is.null`)
  }
  return query
}
