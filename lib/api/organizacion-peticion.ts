import { NextResponse } from 'next/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'

/**
 * Organización de una petición a una ruta pública de lectura: la del HOST, nunca la del query
 * string ni del body. Mismo criterio que `/api/orders`:
 * - El host resuelve una organización y el cliente manda otra → 403, y se registra.
 * - El host no resuelve (p. ej. localhost sin subdominio) → se usa la del cliente, como antes.
 */
export async function organizacionDePeticion(
  valorCliente: string | null | undefined,
  ruta: string,
): Promise<{ ok: true; organizationId: number } | { ok: false; respuesta: NextResponse }> {
  const hostOrgId = await getOrgIdDelHost()
  const tieneValor = valorCliente !== null && valorCliente !== undefined && valorCliente !== ''
  if (hostOrgId !== null) {
    if (tieneValor && Number(valorCliente) !== hostOrgId) {
      console.warn(`[${ruta}] organizationId del cliente distinto al del host`, { hostOrgId, clienteOrgId: valorCliente })
      return {
        ok: false,
        respuesta: NextResponse.json({ error: 'La organización no corresponde a este sitio' }, { status: 403 }),
      }
    }
    return { ok: true, organizationId: hostOrgId }
  }
  const n = tieneValor ? Number(valorCliente) : NaN
  if (!Number.isInteger(n) || n <= 0) {
    return { ok: false, respuesta: NextResponse.json({ error: 'Se requiere organizationId' }, { status: 400 }) }
  }
  return { ok: true, organizationId: n }
}

/**
 * Sede pedida por el cliente, validada contra la organización. `null` = sin sede (el parámetro
 * no vino). `'invalida'` = vino pero no es una sede de esa organización.
 */
export async function sedeDeOrganizacion(
  supabase: any,
  organizationId: number,
  valorCliente: string | null | undefined,
): Promise<number | null | 'invalida'> {
  if (valorCliente === null || valorCliente === undefined || valorCliente === '') return null
  const branchId = Number(valorCliente)
  if (!Number.isInteger(branchId) || branchId <= 0) return 'invalida'
  const { data, error } = await supabase
    .from('branches')
    .select('id')
    .eq('id', branchId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (error || !data) return 'invalida'
  return branchId
}
