import { NextResponse } from 'next/server'
import { getOrgContext } from '@/lib/get-org-context'
import { getMenuCatalogProducts } from '@/lib/supabase/queries'
import { popularesBusqueda } from '@/lib/products/popularesBusqueda'

/** Host y sede verificados; el catálogo y las ventas reutilizan la caché por organización. */
export async function GET() {
  const ctx = await getOrgContext()
  if (!ctx) return NextResponse.json({ suggestions: [] })
  const productos = await getMenuCatalogProducts(ctx.organization.id, ctx.branchId)
  return NextResponse.json({ suggestions: popularesBusqueda(productos) }, { headers: { 'Cache-Control': 'private, max-age=60' } })
}
