/**
 * Dominios activos de una organización. La URL pública se decide con
 * `hostPublico`; esta lectura no usa `organizations.custom_domain`.
 *
 * `react.cache` evita repetirla dentro de la misma visita. `cacheStructural`
 * la comparte entre visitas durante 300 s: el dominio principal casi no cambia
 * y esta consulta se hacía en cada request.
 */

import { cache } from 'react'
import { cacheStructural, SETTINGS_TTL } from '@/lib/supabase/cache'
import { createAdminClient } from '@/lib/supabase/server'
import type { DominioPublico } from '@/lib/site/urlPublicaOrg'

async function dominiosPublicosSinCache(organizationId: number): Promise<DominioPublico[]> {
  if (!Number.isInteger(organizationId) || organizationId <= 0) return []
  const sb = createAdminClient()
  if (!sb) return []
  // El tipo a mano de esta tabla no trae Insert/Update, y el cliente la infiere
  // como never. La fila se declara aquí, con las columnas que de verdad se leen.
  const { data, error } = await sb
    .from('organization_domains')
    .select('host, domain_type, status, is_primary, is_active, updated_at')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
  if (error || !data) return []
  const filas = data as unknown as Array<{
    host: string
    domain_type: string
    status: string
    is_primary: boolean
    is_active: boolean
    updated_at: string | null
  }>
  return filas.map((d) => ({
    host: d.host,
    domainType: d.domain_type,
    status: d.status,
    isPrimary: d.is_primary === true,
    isActive: d.is_active === true,
    updatedAt: d.updated_at,
  }))
}

/** 300 s entre visitas (SETTINGS_TTL) y una sola vez por request. */
export const dominiosPublicos = cache(
  cacheStructural('dominiosPublicos', dominiosPublicosSinCache, SETTINGS_TTL),
)
