import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { organizacionDePeticion, sedeDeOrganizacion } from '@/lib/api/organizacion-peticion'
import { getOrganizationBranches } from '@/lib/supabase/queries'
import { resolverSedeCarta } from '@/lib/products/carta-sede'
import { refMesaDeUrl } from '@/lib/restaurant/mesaQR'
import { getSedesWeb } from '@/lib/restaurant/sedes'

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
 * Regla de sede (la misma que aplica `/api/orders` con MESA_INVALIDA, paquete A): la mesa del
 * pedido debe ser de la sede de la carta, porque el carrito, la carta y el precio son por sede.
 * - En la página de una sede, una mesa de otra sede no se acepta (404).
 * - En el sitio principal, el ERP imprime el QR sin prefijo de sede
 *   (`https://<host>/menu?mesa=<uuid>`, go-admin-erp/src/lib/pos/mesas/qrMesa.ts). Una mesa de
 *   la sede principal se acepta como siempre. Una mesa de OTRA sede publicada no se rechaza: la
 *   respuesta trae `redirigir` (la carta de esa sede con la misma mesa) y la carta navega allí,
 *   donde el carrito y el pedido ya son de la sede de la mesa. Si esa sede no tiene sitio
 *   publicado, no hay carta donde pedir para ella: 404, como antes.
 * Respuesta: `{ ok: true, mesa, redirigir? }` o `{ ok: false }` (404), sin detalles.
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
  let redirigir: string | null = null
  if (sedeEsperada !== null && fila.branch_id !== sedeEsperada) {
    if (sedePagina !== null) {
      // Página de una sede y mesa de otra: sin banner (y sin «comer aquí») en esta página.
      return noEncontrada()
    } else {
      // Sitio principal y mesa de otra sede: se manda a la carta de esa sede, si está publicada.
      redirigir = await cartaDeSede(org.organizationId, fila.branch_id, fila.id)
      if (!redirigir) return noEncontrada()
    }
  }

  const sedes = (await getOrganizationBranches(org.organizationId)) as { id: number; name: string | null }[]
  const nombreSede = sedes.find((s) => Number(s.id) === fila!.branch_id)?.name ?? null

  return NextResponse.json(
    {
      ok: true,
      mesa: { id: fila.id, nombre: fila.name, zona: fila.zone, sede: fila.branch_id, nombreSede },
      ...(redirigir ? { redirigir } : {}),
    },
    { headers: SIN_CACHE },
  )
}

/**
 * Carta de una sede publicada con la mesa del QR: dominio propio → `https://<dominio>/menu?mesa=`;
 * si no, `/<slug>/menu?mesa=` bajo el sitio principal (el mismo `href` del selector de sedes,
 * lib/outlet/sedeLayout.ts). `null` si la sede no tiene sitio publicado.
 */
async function cartaDeSede(organizationId: number, branchId: number, mesaId: string): Promise<string | null> {
  const sede = (await getSedesWeb(organizationId)).find((s) => s.id === branchId)
  if (!sede) return null
  const base = sede.customDomain
    ? `https://${sede.customDomain}`
    : sede.slug
      ? `/${encodeURIComponent(sede.slug)}`
      : null
  return base === null ? null : `${base}/menu?mesa=${encodeURIComponent(mesaId)}`
}
