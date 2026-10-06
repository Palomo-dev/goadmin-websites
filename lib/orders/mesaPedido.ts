/**
 * Mesa de un pedido «Comer aquí», validada en el servidor contra `restaurant_tables`.
 *
 * Única búsqueda de mesa del sitio: la usan `/api/orders` (MESA_INVALIDA) y
 * `GET /api/restaurant-tables/resolve` (banner de la carta). La referencia es el uuid de la mesa
 * (lo que guarda `useMesaQR`) o un nombre: el de un QR impreso antes («MESA-5») o el que escribe el
 * cliente («4»). El nombre se compara con `claveNombreMesa` (lib/orders/nombreMesa.ts), sin la
 * palabra «mesa», mayúsculas, espacios ni ceros a la izquierda: los nombres reales son «Mesa 4» y
 * antes la comparación exacta rechazaba cualquier mesa escrita a mano. La mesa debe ser de la
 * organización del host y de la sede de la carta (`resolverSedeCarta`). El navegador solo dice lo
 * que vio: aquí se decide.
 *
 * Columnas verificadas por MCP el 2026-10-06: id (uuid), organization_id, branch_id (NOT NULL),
 * name, zone (NULL-able). Máximo 30 mesas por organización. Service role: el filtro por
 * `organization_id` es la única barrera.
 */

import { refMesaDeUrl } from '@/lib/restaurant/mesaQR'
import type { RestaurantTable } from '@/types/database'
import { MARCA_COMER_AQUI } from '@/lib/orders/estados-pedido'
import { claveNombreMesa } from '@/lib/orders/nombreMesa'

type ClienteSupabase = { from: (tabla: string) => any }

export type MesaPedido = Pick<RestaurantTable, 'id' | 'name' | 'zone' | 'branch_id'>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Tope de mesas leídas para comparar por nombre (hoy el máximo por organización es 30). */
const MAX_MESAS_POR_NOMBRE = 500

export type ResultadoMesa =
  | { ok: true; mesa: MesaPedido }
  /** La mesa existe pero es de otra sede que la esperada: `resolve` la usa para redirigir. */
  | { ok: false; motivo: 'otra_sede'; mesa: MesaPedido }
  | { ok: false; motivo: 'invalida' | 'error' }

/**
 * Entre varias mesas candidatas: la de la sede esperada si hay exactamente una; si no hay sede
 * esperada (o ninguna es de ella), la única candidata. Dos candidatas sin desempate → ninguna.
 */
function elegirMesa(filas: MesaPedido[], sedeEsperada: number | null): MesaPedido | null {
  const deLaSede = filas.filter((f) => f.branch_id === sedeEsperada)
  if (deLaSede.length === 1) return deLaSede[0]
  if (deLaSede.length > 1) return null
  return filas.length === 1 ? filas[0] : null
}

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
      console.error('[Mesa] Error leyendo la mesa', { organizationId, error: error.message })
      return { ok: false, motivo: 'error' }
    }
    fila = (data as MesaPedido | null) ?? null
  } else {
    const clave = claveNombreMesa(ref)
    if (!clave) return { ok: false, motivo: 'invalida' }
    const { data, error } = await base().order('name', { ascending: true }).limit(MAX_MESAS_POR_NOMBRE)
    if (error) {
      console.error('[Mesa] Error leyendo las mesas', { organizationId, error: error.message })
      return { ok: false, motivo: 'error' }
    }
    const filas = (data || []) as MesaPedido[]
    // Primero el nombre exacto (QR antiguos); si no, el nombre normalizado («4» → «Mesa 4»).
    const exactas = filas.filter((f) => f.name === ref)
    fila = exactas.length > 0
      ? elegirMesa(exactas, sedeEsperada)
      : elegirMesa(filas.filter((f) => claveNombreMesa(f.name || '') === clave), sedeEsperada)
  }
  if (!fila) return { ok: false, motivo: 'invalida' }
  if (sedeEsperada !== null && fila.branch_id !== sedeEsperada) return { ok: false, motivo: 'otra_sede', mesa: fila }
  return { ok: true, mesa: fila }
}

/**
 * «[Comer aquí] Mesa: Mesa 4 (Terraza)»: respaldo en `web_orders.internal_notes`. Es un par
 * clave: valor que el ERP lee (`mesaDelPedido`, go-admin-erp/src/lib/pos/pedidosWeb/tipoEntrega.ts:
 * /Mesa:\s*(...)/), y el valor es el nombre real de la mesa, el mismo que muestra el ERP cuando el
 * pedido trae `restaurant_table_id`. Por eso no se le quita «Mesa»: las dos vías del ERP dan lo mismo.
 */
export function notaMesa(mesa: MesaPedido): string {
  return `${MARCA_COMER_AQUI} Mesa: ${mesa.name}${mesa.zone ? ` (${mesa.zone})` : ''}`
}
