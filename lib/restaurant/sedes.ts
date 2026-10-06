/**
 * Sedes de la organización para las secciones `hours_location` y `reservation`.
 *
 * UNA consulta (PostgREST anida las relaciones en un solo SELECT) desde
 * `organizations`, filtrada por el id que resolvió el HOST, cacheada entre
 * peticiones (`cacheStructural`, 60 s) y deduplicada dentro de la petición
 * (`react.cache`). Las dos secciones comparten el mismo resultado.
 *
 * Columnas verificadas por MCP el 2026-10-05. Las relaciones llevan el nombre
 * de la FK explícito: `restaurant_booking_settings` tiene UNIQUE
 * (organization_id, branch_id) con FK a las dos tablas, y PostgREST podría
 * tomarla como tabla puente organizations↔branches (relación ambigua).
 *
 * Service role: aquí no hay RLS. El filtro `id = organizationId` es la única
 * barrera, y `organizationId` sale siempre de `getOrgContext` (host).
 */

import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/server'
import { cacheStructural, CONTENT_TTL } from '@/lib/supabase/cache'
import { parseSedesRestaurante, type SedesRestaurante } from './sedes-modelo'

const COLUMNAS_AJUSTES =
  'branch_id, is_enabled, min_party_size, max_party_size, max_advance_days, require_phone, require_email, require_confirmation, policy_text, allow_zone_choice, allowed_zones, slot_interval_minutes'

const SELECT_SEDES = [
  'timezone',
  `branches!branches_organization_id_fkey(id, name, address, city, state, phone, latitude, longitude, opening_hours, timezone, website_cover_url, is_main, slug, is_web_published, is_active)`,
  `restaurant_booking_settings!restaurant_booking_settings_organization_id_fkey(${COLUMNAS_AJUSTES})`,
  'restaurant_tables!restaurant_tables_organization_id_fkey(branch_id)',
].join(', ')

async function getSedesRestauranteUncached(organizationId: number): Promise<SedesRestaurante | null> {
  const supabase = createAdminClient()
  if (!supabase) {
    console.error('[sedes] Falta SUPABASE_SERVICE_ROLE_KEY: no se leen las sedes')
    return null
  }
  const { data, error } = await supabase
    .from('organizations')
    .select(SELECT_SEDES)
    .eq('id', organizationId)
    .maybeSingle()
  if (error) {
    console.error('[sedes] Error leyendo sedes', { organizationId, error: error.message })
    return null
  }
  return parseSedesRestaurante(data as unknown)
}

export const getSedesRestaurante = cache(
  cacheStructural('getSedesRestaurante', getSedesRestauranteUncached, CONTENT_TTL),
)
