import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { organizacionDePeticion, sedeDeOrganizacion } from '@/lib/api/organizacion-peticion'
import { getOrganizationBranches } from '@/lib/supabase/queries'
import { resolverSedeCarta } from '@/lib/products/carta-sede'
import { refMesaDeUrl } from '@/lib/restaurant/mesaQR'

/**
 * GET /api/restaurant-tables/resolve?ref=<uuid|código>&branchId=<sede de la página>
 *
 * Resuelve la mesa de un QR contra `restaurant_tables` de la organización del HOST (nunca la del
 * query string: `organizacionDePeticion` responde 403 si no coinciden). Lo usa `useMesaQR` para
 * pintar el banner «Mesa 4 · Terraza · Sede Norte» y guardar la mesa; el checkout la vuelve a
 * validar en `/api/orders`.
 *
 * `restaurant_tables` no admite lectura anónima y el sitio no tiene RLS en el servidor: cliente
 * estricto (`createAdminClient`) y filtro explícito por `organization_id`.
 * Columnas verificadas por MCP el 2026-10-06: id (uuid), organization_id, branch_id (NOT NULL),
 * name, zone (NULL-able), state ('free' | 'occupied' | 'reserved').
 *
 * Una mesa de otra sede que la de la página no se acepta: el pedido saldría con el carrito y el
 * precio de una sede y la mesa de otra. En el sitio principal, la sede es la de su carta (la
 * principal). Respuesta: `{ ok: true, mesa }` o `{ ok: false }` (404), sin detalles.
 */

interface FilaMesaRestaurante {
  id: string
  name: string
  zone: string | null
  branch_id: number
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SIN_CACHE = { 'Cache-Control': 'no-store' }

function noEncontrada() {
  return NextResponse.json({ ok: false }, { status: 404, headers: SIN_CACHE })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const ref = refMesaDeUrl(searchParams.get('ref'))
  if (!ref) return noEncontrada()

  const org = await organizacionDePeticion(searchParams.get('organizationId'), 'Mesa QR')
  if (!org.ok) return org.respuesta

  const supabase = createAdminClient()
  if (!supabase) {
    console.error('[Mesa QR] Falta SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.json({ ok: false }, { status: 503, headers: SIN_CACHE })
  }
  const db = supabase as any

  const sedePagina = await sedeDeOrganizacion(db, org.organizationId, searchParams.get('branchId'))
  if (sedePagina === 'invalida') return noEncontrada()
  const sedeEsperada = await resolverSedeCarta(org.organizationId, sedePagina)

  const base = () =>
    db
      .from('restaurant_tables')
      .select('id, name, zone, branch_id')
      .eq('organization_id', org.organizationId)

  let fila: FilaMesaRestaurante | null = null
  if (UUID_RE.test(ref)) {
    const { data, error } = await base().eq('id', ref).maybeSingle()
    if (error) {
      console.error('[Mesa QR] Error leyendo restaurant_tables', { organizationId: org.organizationId, error: error.message })
      return NextResponse.json({ ok: false }, { status: 503, headers: SIN_CACHE })
    }
    fila = data as FilaMesaRestaurante | null
  } else {
    // QR antiguos con el nombre de la mesa («MESA-5»): coincidencia exacta del nombre, sin
    // comodines. Si el nombre se repite en varias sedes, se prefiere la de la página.
    const { data, error } = await base().eq('name', ref).limit(10)
    if (error) {
      console.error('[Mesa QR] Error leyendo restaurant_tables', { organizationId: org.organizationId, error: error.message })
      return NextResponse.json({ ok: false }, { status: 503, headers: SIN_CACHE })
    }
    const filas = (data || []) as FilaMesaRestaurante[]
    fila = filas.find((f) => f.branch_id === sedeEsperada) ?? (filas.length === 1 ? filas[0] : null)
  }

  if (!fila) return noEncontrada()
  if (sedeEsperada !== null && fila.branch_id !== sedeEsperada) {
    // Mesa de otra sede: sin banner (y sin «comer aquí») en esta página.
    return noEncontrada()
  }

  const sedes = (await getOrganizationBranches(org.organizationId)) as { id: number; name: string | null }[]
  const nombreSede = sedes.find((s) => Number(s.id) === fila!.branch_id)?.name ?? null

  return NextResponse.json(
    {
      ok: true,
      mesa: { id: fila.id, nombre: fila.name, zona: fila.zone, sede: fila.branch_id, nombreSede },
    },
    { headers: SIN_CACHE },
  )
}
