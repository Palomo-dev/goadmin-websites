import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationProducts } from '@/lib/supabase/queries'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId')
    const limit = parseInt(searchParams.get('limit') || '12')
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Se requiere organizationId' },
        { status: 400 }
      )
    }
    
    const products = await getOrganizationProducts(parseInt(organizationId), limit)
    
    return NextResponse.json({ data: products })
  } catch (error) {
    console.error('Products API error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
