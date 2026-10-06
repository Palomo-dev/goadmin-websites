import { NextResponse } from 'next/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { ahoraEnZona, horaDeMinutos } from './horario'

/**
 * Contexto común de `/api/restaurant-reservations/**`.
 *
 * La organización sale del HOST, nunca del body ni del query string
 * (CLAUDE.md, multi-tenancy): estas rutas corren con service role y no hay RLS
 * debajo. Mismo criterio que `/api/orders`: si el host resuelve una
 * organización y la petición trae otra → 403 y se registra; si el host no
 * resuelve (localhost sin subdominio) se conserva el comportamiento anterior.
 */
export async function organizacionDeLaReserva(
  pedida: unknown,
  ruta: string,
): Promise<{ orgId: number } | { respuesta: NextResponse }> {
  const delHost = await getOrgIdDelHost()
  const pedidaNum = pedida === undefined || pedida === null || pedida === '' ? null : Number(pedida)

  if (delHost !== null) {
    if (pedidaNum !== null && pedidaNum !== delHost) {
      console.warn(`[${ruta}] organizationId distinto al del host`, { delHost, pedida: pedidaNum })
      return {
        respuesta: NextResponse.json(
          { error: 'La organización no corresponde a este sitio' },
          { status: 403 },
        ),
      }
    }
    return { orgId: delHost }
  }

  if (pedidaNum === null || !Number.isInteger(pedidaNum) || pedidaNum <= 0) {
    return { respuesta: NextResponse.json({ error: 'Organización no válida' }, { status: 400 }) }
  }
  return { orgId: pedidaNum }
}

/** La sede debe ser de la organización; `null` = sin sede. */
export async function sedeDeLaReserva(
  supabase: any,
  orgId: number,
  pedida: unknown,
): Promise<{ branchId: number | null } | { respuesta: NextResponse }> {
  if (pedida === undefined || pedida === null || pedida === '') return { branchId: null }
  const branchId = Number(pedida)
  if (!Number.isInteger(branchId) || branchId <= 0) {
    return { respuesta: NextResponse.json({ error: 'Sede no válida' }, { status: 400 }) }
  }
  const { data } = await supabase
    .from('branches')
    .select('id')
    .eq('id', branchId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!data) {
    return { respuesta: NextResponse.json({ error: 'La sede no pertenece a este sitio' }, { status: 403 }) }
  }
  return { branchId }
}

/**
 * Fecha (YYYY-MM-DD) y hora (HH:MM) actuales en la zona de la sede u
 * organización (`fn_timezone_for`, la misma que usan las RPC de reservas).
 * Comparar `new Date(\`${date}T${time}\`)` contra `new Date()` en el servidor
 * (UTC) rechazaba reservas válidas de las próximas horas en Colombia.
 */
export async function ahoraEnLaZona(
  supabase: any,
  orgId: number,
  branchId: number | null,
): Promise<{ fecha: string; hora: string }> {
  const { data } = await supabase.rpc('fn_timezone_for', {
    p_organization_id: orgId,
    p_branch_id: branchId,
  })
  // Misma conversión que el resto del sitio (lib/restaurant/horario.ts).
  const ahora = ahoraEnZona(typeof data === 'string' && data ? data : null)
  return { fecha: ahora.fecha, hora: horaDeMinutos(ahora.minutos) }
}

interface ArgsDisponibilidad {
  orgId: number
  branchId: number | null
  date: string
  partySize: number
  zone: string | null
  slotInterval?: number
}

/**
 * Llama a `get_restaurant_availability` con la sede, si la hay.
 *
 * La firma con sede (`p_branch_id`, migración del ERP
 * `20261006200000_disponibilidad_restaurante_por_sede`) filtra configuración,
 * mesas y zona horaria por sede, igual que `create_restaurant_reservation`.
 * Mientras esa migración no esté aplicada, PostgREST responde PGRST202 (no
 * existe la función con esos nombres): se repite la llamada sin sede, que es
 * exactamente el comportamiento anterior. Así este repo nunca depende de algo
 * que aún no esté desplegado en el ERP.
 */
export async function disponibilidadDeLaSede(
  supabase: any,
  { orgId, branchId, date, partySize, zone, slotInterval }: ArgsDisponibilidad,
): Promise<{ data: any; error: any }> {
  const base: Record<string, unknown> = {
    p_organization_id: orgId,
    p_date: date,
    p_party_size: partySize,
    p_zone: zone,
  }
  if (slotInterval !== undefined) base.p_slot_interval = slotInterval

  if (branchId !== null) {
    const conSede = await supabase.rpc('get_restaurant_availability', { ...base, p_branch_id: branchId })
    if (conSede.error?.code !== 'PGRST202') return conSede
  }
  return supabase.rpc('get_restaurant_availability', base)
}

/** «HH:MM» o «HH:MM:SS» → «HH:MM»; `null` si no es una hora válida. */
export function horaNormalizada(valor: unknown): string | null {
  const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(String(valor ?? ''))
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null
  return `${m[1]}:${m[2]}`
}

export function fechaValida(valor: unknown): valor is string {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)
}
