/**
 * Planos de mesas de las sedes para `reservation` · `floor_plan` (plantilla «Café de especialidad»).
 *
 * Solo lo llama `app/[[...slug]]/page.tsx` cuando la página tiene esa variante (ninguna otra
 * organización la usa): una RPC por sede que acepta reservas, cacheada entre peticiones
 * (`cacheStructural`, 60 s) y deduplicada en la petición (`react.cache`).
 *
 * `get_restaurant_floor_plan_public` es solo de service role (`createAdminClient`); la
 * organización sale del host (`getOrgContext`) y la RPC exige que la sede sea suya y esté activa.
 */

import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/server'
import { cacheStructural, CONTENT_TTL } from '@/lib/supabase/cache'
import { leerPlanoPublico, type PlanoSede } from './planoMesas'

/** RPC y parámetros (scripts/verify-cafe.mjs los compara con la migración del ERP). */
export const RPC_PLANO_PUBLICO = 'get_restaurant_floor_plan_public'

async function getPlanosMesasUncached(organizationId: number, branchIds: number[]): Promise<Record<number, PlanoSede>> {
  const supabase = createAdminClient()
  if (!supabase) {
    console.error('[planoMesas] Falta SUPABASE_SERVICE_ROLE_KEY: no se lee el plano de mesas')
    return {}
  }
  const salida: Record<number, PlanoSede> = {}
  await Promise.all(
    branchIds.map(async (branchId) => {
      const { data, error } = await (supabase as any).rpc(RPC_PLANO_PUBLICO, {
        p_organization_id: organizationId,
        p_branch_id: branchId,
      })
      if (error) {
        console.error('[planoMesas] Error leyendo el plano', { organizationId, branchId, error: error.message })
        return
      }
      const plano = leerPlanoPublico(data, branchId)
      if (plano) salida[branchId] = plano
    }),
  )
  return salida
}

const getPlanosMesasCached = cache(cacheStructural('getPlanosMesas', getPlanosMesasUncached, CONTENT_TTL))

/** Planos por sede (`branchId` → plano). Sin sedes, sin consulta. Error = `{}` (la sección cae al stepper). */
export async function getPlanosMesas(organizationId: number, branchIds: number[]): Promise<Record<number, PlanoSede>> {
  const ids = Array.from(new Set(branchIds.filter((n) => Number.isInteger(n) && n > 0))).sort((a, b) => a - b).slice(0, 12)
  if (ids.length === 0) return {}
  try {
    return await getPlanosMesasCached(organizationId, ids)
  } catch (e) {
    console.error('[planoMesas] Error inesperado', e)
    return {}
  }
}
