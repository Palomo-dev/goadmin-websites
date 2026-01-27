import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationByHost } from '@/lib/supabase/queries'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const host = searchParams.get('host')
    const subdomain = searchParams.get('subdomain')
    
    const identifier = host || subdomain
    
    if (!identifier) {
      return NextResponse.json(
        { error: 'Se requiere host o subdomain' },
        { status: 400 }
      )
    }
    
    const organization = await getOrganizationByHost(identifier)
    
    if (!organization) {
      return NextResponse.json(
        { error: 'Organización no encontrada' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ data: organization })
  } catch (error) {
    console.error('Organization API error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
