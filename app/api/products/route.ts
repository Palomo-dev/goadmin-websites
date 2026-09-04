import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationProducts } from '@/lib/supabase/queries'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const organizationIdParam = searchParams.get('organizationId')
    const limitParam = searchParams.get('limit')
    const branchIdParam = searchParams.get('branchId')

    // F3-R3: validar NaN en todos los parámetros numéricos
    const limit = limitParam ? parseInt(limitParam, 10) : 12
    if (limitParam && (Number.isNaN(limit) || !Number.isFinite(limit))) {
      return NextResponse.json({ error: 'limit inválido' }, { status: 400 })
    }

    const branchId = branchIdParam ? parseInt(branchIdParam, 10) : undefined
    if (branchIdParam && (Number.isNaN(branchId) || !Number.isFinite(branchId))) {
      return NextResponse.json({ error: 'branchId inválido' }, { status: 400 })
    }

    if (!organizationIdParam) {
      return NextResponse.json(
        { error: 'Se requiere organizationId' },
        { status: 400 }
      )
    }
    const organizationIdNum = parseInt(organizationIdParam, 10)
    if (Number.isNaN(organizationIdNum) || !Number.isFinite(organizationIdNum)) {
      return NextResponse.json({ error: 'organizationId inválido' }, { status: 400 })
    }
    
    const products = await getOrganizationProducts(organizationIdNum, limit, branchId)
    
    return NextResponse.json({ data: products })
  } catch (error) {
    console.error('Products API error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
