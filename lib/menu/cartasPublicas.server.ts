/**
 * Lectura cacheada de las cartas por horario del ERP (`get_public_menu`) para la página.
 *
 * - Una llamada por organización y sede, cacheada CONTENT_TTL (60 s). Nunca por plato ni por
 *   render: la respuesta se reduce a la estructura (lib/menu/cartasPublicas.ts) antes de
 *   cachearla, así el valor cacheado es pequeño aunque la carta tenga cientos de platos.
 * - `vigente` sale de la base al llenar la caché; la pestaña que se abre la decide el cliente
 *   con las franjas de hoy (misma regla que fn_carta_vigente), así que 60 s de caché no
 *   desplazan el cambio de carta.
 * - Degrada sola, sin tocar a nadie:
 *     · firma de 20261010090000 (p_todas) → todas las cartas activas de la sede;
 *     · solo la de 20261008150100 (3 argumentos) → las vigentes;
 *     · sin la función (PGRST202 / 42883) → `null` = la vía actual de la sección.
 *   El «no existe» también se cachea: no hay una llamada fallida por visita.
 *
 * Solo servidor. La organización sale del host (getOrgContext), nunca del cliente.
 */
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/server'
import { cacheStructural, CONTENT_TTL } from '@/lib/supabase/cache'
import { leerCartasPublicas, type CartasPublicas } from './cartasPublicas'

/** Firma nueva (todas las cartas) y firma de 20261008150100 (solo vigentes). */
export const ARGUMENTOS_GET_PUBLIC_MENU = ['p_org', 'p_branch', 'p_at', 'p_todas'] as const

function noExiste(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message || '')
}

async function getCartasPublicasSinCache(organizationId: number, branchId: number | null): Promise<CartasPublicas | null> {
  const supabase = createAdminClient()
  if (!supabase) return null
  const ahora = new Date().toISOString()
  const base = { p_org: organizationId, p_branch: branchId, p_at: ahora }

  let { data, error } = await (supabase as any).rpc('get_public_menu', { ...base, p_todas: true })
  if (noExiste(error)) {
    ;({ data, error } = await (supabase as any).rpc('get_public_menu', base))
  }
  if (noExiste(error)) return null
  // Otro fallo: lanzar para no cachearlo; quien llama cae a la vía actual.
  if (error) throw new Error(`get_public_menu: ${error.message || error.code}`)
  return leerCartasPublicas(data)
}

const getCartasPublicasCacheada = cacheStructural('getCartasPublicas', getCartasPublicasSinCache, CONTENT_TTL)

/**
 * Cartas de la sede (o del principal con `branchId` null). `null` = usar la vía actual
 * (sin la RPC, sin cartas creadas o con un fallo, que queda registrado).
 */
export const getCartasPublicas = cache(async (organizationId: number, branchId: number | null): Promise<CartasPublicas | null> => {
  try {
    const cartas = await getCartasPublicasCacheada(organizationId, branchId)
    return cartas && cartas.cartas.length > 0 ? cartas : null
  } catch (error) {
    console.error('[carta] get_public_menu falló; la carta sale por la vía actual', {
      organizationId, branchId, error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
})
