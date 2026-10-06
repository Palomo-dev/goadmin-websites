/**
 * Mesa de un pedido «Comer aquí», validada en el servidor contra `restaurant_tables`.
 *
 * Misma regla que `GET /api/restaurant-tables/resolve` (paquete B), que pinta el banner de la
 * carta: la referencia es el uuid de la mesa (lo que guarda `useMesaQR`) o, para QR impresos
 * antes, el nombre exacto; la mesa debe ser de la organización del host y de la sede de la carta
 * (`resolverSedeCarta`: la de la página o, en el sitio principal, la principal). El navegador solo
 * dice lo que vio: aquí se decide.
 *
 * Columnas verificadas por MCP el 2026-10-06: id (uuid), organization_id, branch_id (NOT NULL),
 * name, zone (NULL-able). Service role: el filtro por `organization_id` es la única barrera.
 */

import { refMesaDeUrl } from '@/lib/restaurant/mesaQR'
import type { RestaurantTable } from '@/types/database'
import { MARCA_COMER_AQUI } from '@/lib/orders/estados-pedido'

type ClienteSupabase = { from: (tabla: string) => any }

export type MesaPedido = Pick<RestaurantTable, 'id' | 'name' | 'zone' | 'branch_id'>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ResultadoMesa =
  | { ok: true; mesa: MesaPedido }
  | { ok: false; motivo: 'invalida' | 'otra_sede' | 'error' }

export async function buscarMesaDeOrganizacion(
  supabase: ClienteSupabase,
  organizationId: number,
  refCruda: unknown,
  sedeEsperada: number | null,
): Promise<ResultadoMesa> {
  const ref = refMesaDeUrl(typeof refCruda === 'string' ? refCruda : null)
  if (!ref) return { ok: false, motivo: 'invalida' }
  const base = () =>
    supabase
      .from('restaurant_tables')
      .select('id, name, zone, branch_id')
      .eq('organization_id', organizationId)

  let fila: MesaPedido | null = null
  if (UUID_RE.test(ref)) {
    const { data, error } = await base().eq('id', ref).maybeSingle()
    if (error) {
      console.error('[Orders] Error leyendo la mesa', { organizationId, error: error.message })
      return { ok: false, motivo: 'error' }
    }
    fila = (data as MesaPedido | null) ?? null
  } else {
    const { data, error } = await base().eq('name', ref).limit(10)
    if (error) {
      console.error('[Orders] Error leyendo la mesa', { organizationId, error: error.message })
      return { ok: false, motivo: 'error' }
    }
    const filas = (data || []) as MesaPedido[]
    fila = filas.find((f) => f.branch_id === sedeEsperada) ?? (filas.length === 1 ? filas[0] : null)
  }
  if (!fila) return { ok: false, motivo: 'invalida' }
  if (sedeEsperada !== null && fila.branch_id !== sedeEsperada) return { ok: false, motivo: 'otra_sede' }
  return { ok: true, mesa: fila }
}

/** «[Comer aquí] Mesa: 4 (Terraza)»: respaldo legible en `web_orders.internal_notes`. */
export function notaMesa(mesa: MesaPedido): string {
  return `${MARCA_COMER_AQUI} Mesa: ${mesa.name}${mesa.zone ? ` (${mesa.zone})` : ''}`
}
