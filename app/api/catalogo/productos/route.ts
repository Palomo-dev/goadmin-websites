import { NextResponse } from 'next/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { sedeDeLaPeticion } from '@/lib/catalogo/sedeDeLaPeticion'
import { getOrganizationProductsPagina, PRODUCT_LIST_MAX } from '@/lib/supabase/queries'

/**
 * Página siguiente (500) del listado general de productos (paquete 5-nov E, QA 27-oct):
 * la grilla pinta la primera página desde el servidor y pide el resto por partes.
 * La organización y la sede salen del host, nunca del cliente.
 */
export async function GET(request: Request) {
  const orgId = await getOrgIdDelHost()
  if (!orgId) return NextResponse.json({ error: 'sitio no encontrado' }, { status: 404 })
  const desde = Math.max(0, Math.round(Number(new URL(request.url).searchParams.get('desde')) || 0))
  if (desde >= PRODUCT_LIST_MAX * 5) return NextResponse.json({ products: [] })
  const sede = await sedeDeLaPeticion(orgId)
  const r = await getOrganizationProductsPagina(orgId, desde, sede)
  if (r.error) return NextResponse.json({ error: 'consulta', products: [] }, { status: 503 })
  return NextResponse.json({ products: r.products }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } })
}
