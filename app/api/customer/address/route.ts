import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { getCuentaCliente } from '@/lib/cuenta/cuentaCliente'
import { vincularClienteDeSesion } from '@/lib/auth/clienteSesion'
import { codigoDeMunicipio } from '@/lib/shipping/cotizarZonas'

export const dynamic = 'force-dynamic'

/**
 * Direcciones del cliente con sesión (Mi cuenta › Direcciones, Figma G 2977:72598, y el botón
 * «Guardar dirección» del checkout, que sigue mandando lo mismo de siempre).
 *
 * - La organización sale del HOST (el `organizationId` del body se ignora) y la ficha, de la
 *   sesión. Antes el insert no llevaba `organization_id` (NOT NULL) y fallaba siempre.
 * - `customer_addresses` no tiene columna de barrio: va en `address_line2`. Las indicaciones en
 *   `delivery_instructions`. El municipio DANE (`municipality_id`) se busca con la misma regla de
 *   la cotización del domicilio (país, departamento y nombre sin tildes).
 * - Una sola principal: el trigger `trg_single_default_address` apaga las demás y
 *   `trg_sync_address_to_customer` copia la principal a la ficha.
 *
 * POST   { address_line, city, country_code?, department?, state_code?, barrio?, indicaciones?, label?, is_default? }
 * PATCH  { id, is_default?: true }      → la vuelve principal
 * DELETE { id }                          → la oculta (`is_active = false`, sin borrar)
 */

const COLUMNAS = 'id, label, address_line1, address_line2, city, department, country_code, delivery_instructions, is_default, municipality_id'
const ISO3_A_ISO2: Record<string, string> = { COL: 'CO', MEX: 'MX', PER: 'PE', ECU: 'EC', CHL: 'CL', ARG: 'AR', USA: 'US', ESP: 'ES', PAN: 'PA', VEN: 'VE' }
const texto = (v: unknown, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

async function fichaDeSesion(orgId: number, crear: boolean): Promise<string | null> {
  const cuenta = await getCuentaCliente(orgId)
  if (!cuenta) return null
  if (cuenta.cliente) return cuenta.cliente.id
  if (!crear) return null
  // Con sesión y sin ficha en esta tienda (entró en otra): la misma ruta del registro y del código.
  const admin = createAdminClient()
  const { data } = await (await createServerSupabaseClient()).auth.getUser()
  return admin && data?.user ? vincularClienteDeSesion(admin, orgId, data.user, { verificado: cuenta.verificado }) : null
}

export async function POST(request: NextRequest) {
  try {
    const orgId = await getOrgIdDelHost()
    if (orgId === null) return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })
    const body = await request.json().catch(() => ({}))
    const linea = texto(body.address_line)
    const ciudad = texto(body.city, 120)
    if (!linea || !ciudad) return NextResponse.json({ error: 'Escribe la dirección y la ciudad.' }, { status: 400 })

    const clienteId = await fichaDeSesion(orgId, true)
    if (!clienteId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const supabase = createAdminClient() as any
    if (!supabase) return NextResponse.json({ error: 'Error al guardar dirección' }, { status: 503 })

    const paisCrudo = (texto(body.country_code, 3) || 'CO').toUpperCase()
    const pais = ISO3_A_ISO2[paisCrudo] ?? (paisCrudo.length === 2 ? paisCrudo : 'CO')
    const codigoDepto = texto(body.state_code, 10)
    let municipio: string | null = null
    if (paisCrudo === 'COL' || pais === 'CO') {
      if (codigoDepto) {
        const { data: municipios } = await supabase.from('municipalities').select('id, code, name').eq('country_code', 'COL').eq('state_code', codigoDepto)
        const codigo = codigoDeMunicipio(ciudad, (municipios ?? []) as { code: string; name: string }[])
        municipio = codigo ? ((municipios ?? []) as { id: string; code: string }[]).find((m) => m.code === codigo)?.id ?? null : null
      }
    }

    const { count } = await supabase.from('customer_addresses').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('customer_id', clienteId).eq('is_active', true)
    const principal = body.is_default === true || !count

    const { data: address, error } = await supabase
      .from('customer_addresses')
      .insert({
        organization_id: orgId,
        customer_id: clienteId,
        label: texto(body.label, 60) || 'Dirección',
        address_line1: linea,
        address_line2: texto(body.barrio, 120),
        city: ciudad,
        department: texto(body.department, 120) || texto(body.state, 120),
        country_code: pais,
        municipality_id: municipio,
        delivery_instructions: texto(body.indicaciones, 300),
        is_default: principal,
        is_active: true,
      })
      .select(COLUMNAS)
      .single()
    if (error) {
      console.error('[direcciones] No se pudo guardar', { orgId, error: error.message })
      return NextResponse.json({ error: 'Error al guardar dirección' }, { status: 500 })
    }
    return NextResponse.json({ address })
  } catch (err) {
    console.error('[direcciones] Error', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

async function direccionPropia(request: NextRequest) {
  const orgId = await getOrgIdDelHost()
  if (orgId === null) return { error: NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 }) }
  const body = await request.json().catch(() => ({}))
  const id = texto(body.id, 64)
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return { error: NextResponse.json({ error: 'Dirección no válida' }, { status: 400 }) }
  const clienteId = await fichaDeSesion(orgId, false)
  if (!clienteId) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  const supabase = createAdminClient() as any
  if (!supabase) return { error: NextResponse.json({ error: 'No disponible' }, { status: 503 }) }
  return { orgId, clienteId, id, body, supabase }
}

export async function PATCH(request: NextRequest) {
  const r = await direccionPropia(request)
  if ('error' in r) return r.error
  if (r.body.is_default !== true) return NextResponse.json({ error: 'Nada que cambiar' }, { status: 400 })
  const { data, error } = await r.supabase
    .from('customer_addresses')
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('id', r.id)
    .eq('organization_id', r.orgId)
    .eq('customer_id', r.clienteId)
    .eq('is_active', true)
    .select(COLUMNAS)
    .maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'No se pudo cambiar la principal' }, { status: error ? 500 : 404 })
  return NextResponse.json({ address: data })
}

export async function DELETE(request: NextRequest) {
  const r = await direccionPropia(request)
  if ('error' in r) return r.error
  const { data, error } = await r.supabase
    .from('customer_addresses')
    .update({ is_active: false, is_default: false, updated_at: new Date().toISOString() })
    .eq('id', r.id)
    .eq('organization_id', r.orgId)
    .eq('customer_id', r.clienteId)
    .select('id')
    .maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'No se pudo quitar la dirección' }, { status: error ? 500 : 404 })
  return NextResponse.json({ ok: true })
}
