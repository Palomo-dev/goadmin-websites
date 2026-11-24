import { NextRequest, NextResponse } from 'next/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { getOrganizationBranches, getOrganizationByHost } from '@/lib/supabase/queries'
import { headers } from 'next/headers'
import { getEtiquetasPromoCliente } from '@/lib/promociones/etiquetasPromocion.server'

const SIN_CACHE = { 'Cache-Control': 'private, no-store' }

/**
 * GET /api/promotions/etiquetas?sede=<id>
 *
 * Etiquetas de las promociones «solo para un grupo de clientes» (o con usos por cliente) que le
 * aplican al cliente de la SESIÓN: «2 X 1», «−20 %»… en las tarjetas y la ficha. Las públicas ya
 * vienen en la página (layout, caché del catálogo); esta ruta solo la llama el navegador con
 * sesión y solo si la organización tiene promociones de ese tipo.
 *
 * - Organización: la del host, nunca de la query.
 * - Cliente: `getAuthCustomer` (cookie + organización del host). Sin sesión: `{ promos: [] }`:
 *   sin sesión no se promete.
 * - Grupo y usos: verificados en el servidor (`segment_members`, `promotion_customer_uses`).
 * - Sede: la de la query solo si es de la organización; si no, la del pedido web.
 * Respuesta privada y sin caché (depende de la sesión).
 */
export async function GET(request: NextRequest) {
  try {
    const orgId = await getOrgIdDelHost()
    if (!orgId) return NextResponse.json({ promos: [] }, { headers: SIN_CACHE })
    const cliente = await getAuthCustomer(orgId)
    if (!cliente?.id) return NextResponse.json({ promos: [] }, { headers: SIN_CACHE })

    const pedida = Number(request.nextUrl.searchParams.get('sede'))
    let sede: number | null = null
    if (Number.isInteger(pedida) && pedida > 0) {
      const sedes = (await getOrganizationBranches(orgId)) as Array<{ id: number }>
      if (sedes.some((b) => Number(b.id) === pedida)) sede = pedida
    }

    const h = await headers()
    const identificador = h.get('x-custom-domain') || h.get('x-subdomain')
    const organizacion = identificador ? await getOrganizationByHost(identificador) : null
    const zona = (organizacion as { timezone?: string | null } | null)?.timezone ?? null

    const promos = await getEtiquetasPromoCliente(orgId, String(cliente.id), sede, zona)
    return NextResponse.json({ promos }, { headers: SIN_CACHE })
  } catch (error) {
    console.error('[EtiquetasPromo] Error leyendo las promociones del cliente:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ promos: [] }, { status: 500, headers: SIN_CACHE })
  }
}
