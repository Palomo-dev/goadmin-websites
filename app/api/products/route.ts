import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationProducts } from '@/lib/supabase/queries'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { organizacionDePeticion, sedeDeOrganizacion } from '@/lib/api/organizacion-peticion'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limitParam = searchParams.get('limit')

    // F3-R3: validar NaN en todos los parámetros numéricos
    const limit = limitParam ? parseInt(limitParam, 10) : 12
    if (limitParam && (Number.isNaN(limit) || !Number.isFinite(limit))) {
      return NextResponse.json({ error: 'limit inválido' }, { status: 400 })
    }

    // La organización sale del host; el `organizationId` del query solo se compara (403).
    const org = await organizacionDePeticion(searchParams.get('organizationId'), 'Products API')
    if (!org.ok) return org.respuesta

    // La sede se valida contra esa organización antes de usarla.
    const sede = await sedeDeOrganizacion(
      createAdminClient() || createPublicClient(),
      org.organizationId,
      searchParams.get('branchId'),
    )
    if (sede === 'invalida') {
      return NextResponse.json({ error: 'branchId inválido' }, { status: 400 })
    }

    const products = await getOrganizationProducts(org.organizationId, limit, sede ?? undefined)

    return NextResponse.json({ data: products })
  } catch (error) {
    console.error('Products API error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
