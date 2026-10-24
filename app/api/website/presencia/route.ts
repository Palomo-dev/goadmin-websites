import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { createAdminClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'
import { rutaPresencia, sesionPresenciaValida } from '@/lib/website/presenciaPagina'
import type { Database } from '@/types/database'

type RpcPresencia = Database['public']['Functions']['website_registrar_presencia']
// El esquema manual del repositorio no satisface todo GenericSchema de supabase-js.
// Acotar exclusivamente esta RPC al contrato verificado, sin degradarla a `any`.
type ClientePresencia = { rpc(nombre: 'website_registrar_presencia', args: RpcPresencia['Args']): PromiseLike<{ data: RpcPresencia['Returns'] | null; error: { code?: string } | null }> }

export const dynamic = 'force-dynamic'

/** Solo devuelve el total; la sesión anónima se guarda como hash ligado a la organización. */
export async function POST(request: NextRequest) {
  if (!checkRateLimit(`presencia:${getClientIP(request)}`, 30, 60_000).allowed) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })
  }
  let body: Record<string, unknown>
  try {
    const json: unknown = await request.json()
    if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('body')
    body = json as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })
  }
  const ruta = rutaPresencia(body.ruta)
  if (!ruta || !sesionPresenciaValida(body.sesion)) return NextResponse.json({ error: 'Presencia inválida' }, { status: 400 })
  const org = await getOrgIdDelHost()
  if (!org) return NextResponse.json({ error: 'Sitio no encontrado' }, { status: 404 })
  if (body.organizationId != null && Number(body.organizationId) !== org) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const cliente = createAdminClient()
  if (!cliente) return NextResponse.json({ error: 'Presencia no disponible' }, { status: 503 })
  const hash = createHash('sha256').update(`${org}:${body.sesion}`).digest('hex')
  const { data, error } = await (cliente as unknown as ClientePresencia).rpc('website_registrar_presencia', { p_organization_id: org, p_session_hash: hash, p_page_path: ruta })
  if (error) {
    console.error('[presencia] No se pudo registrar la sesión', { organizationId: org, code: error.code })
    return NextResponse.json({ error: 'Presencia no disponible' }, { status: 503 })
  }
  return NextResponse.json({ total: data }, { headers: { 'Cache-Control': 'private, no-store' } })
}
