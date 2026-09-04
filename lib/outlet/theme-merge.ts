import { cache } from 'react'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import type { WebsiteSettings } from '@/types/database'

/**
 * Campos de metadatos que NUNCA deben heredarse ni sobrescribirse via merge.
 * Pertenecen a la fila concreta (org o outlet) y mezclarlos causaría que el
 * outlet "robe" el id/branch_id/created_at de la org o viceversa.
 */
const METADATA_KEYS = new Set([
  'id',
  'organization_id',
  'branch_id',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
])

/**
 * Merge shallow de settings global → outlet.
 * El outlet sobrescribe el global SOLO si el valor no es null/undefined.
 * Preserva falsy values válidos (false, 0, '') como overrides intencionales.
 *
 * - Si outletSettings es null → retorna orgSettings (backward compat).
 * - Si orgSettings es null → retorna outletSettings (caso edge).
 * - Si ambos son null → retorna null.
 */
export function mergeSettings(
  global: WebsiteSettings | null,
  outlet: Partial<WebsiteSettings> | null,
): WebsiteSettings | null {
  if (!global) return outlet as WebsiteSettings | null
  if (!outlet) return global
  const merged = { ...global }
  for (const [key, value] of Object.entries(outlet)) {
    if (METADATA_KEYS.has(key)) continue
    if (value === null || value === undefined) continue
    ;(merged as any)[key] = value
  }
  return merged
}

/**
 * Obtiene settings globales (branch_id IS NULL) por organization_id.
 * Query directa (no depende del select anidado organization.website_settings).
 */
export const getOrgSettings = cache(async (organizationId: number): Promise<WebsiteSettings | null> => {
  const supabase = createAdminClient() || createPublicClient()
  const { data } = await supabase
    .from('website_settings')
    .select('*')
    .eq('organization_id', organizationId)
    .is('branch_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data as WebsiteSettings | null
})

/**
 * Obtiene settings del outlet (branch_id = branchId) por organization_id.
 * Retorna null si el outlet no tiene settings propios (fallback a global).
 */
export const getOutletSettings = cache(async (
  organizationId: number,
  branchId: number,
): Promise<WebsiteSettings | null> => {
  const supabase = createAdminClient() || createPublicClient()
  const { data } = await supabase
    .from('website_settings')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('branch_id', branchId)
    .maybeSingle()
  return data as WebsiteSettings | null
})

/**
 * Settings efectivas = merge(global, outlet si existe).
 * Si no hay outlet (branchId null/undefined), retorna global (backward compat).
 * Si no hay global pero sí outlet, retorna outlet directamente.
 * Si no hay ninguno, retorna null.
 */
export async function getEffectiveSettings(
  organizationId: number,
  branchId: number | null | undefined,
): Promise<WebsiteSettings | null> {
  const global = await getOrgSettings(organizationId)
  if (typeof branchId !== 'number') return global
  const outlet = await getOutletSettings(organizationId, branchId)
  if (!outlet) return global
  if (!global) return outlet
  return mergeSettings(global, outlet)
}
