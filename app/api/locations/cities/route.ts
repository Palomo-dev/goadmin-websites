import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/locations/cities?country_code=COL&state_code=05
 * Devuelve los municipios/ciudades de un estado.
 */
export async function GET(request: NextRequest) {
  try {
    const countryCode = request.nextUrl.searchParams.get('country_code')
    const stateCode = request.nextUrl.searchParams.get('state_code')

    if (!countryCode || !stateCode) {
      return NextResponse.json(
        { error: 'Los parámetros country_code y state_code son requeridos' },
        { status: 400 }
      )
    }

    const supabase = createPublicClient()
    const { data, error } = await (supabase as any)
      .from('municipalities')
      .select('id, code, name')
      .eq('country_code', countryCode)
      .eq('state_code', stateCode)
      .order('name')

    if (error) {
      console.error('[Locations] cities error:', error.message)
      return NextResponse.json(
        { error: 'Error al obtener ciudades' },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('[Locations] cities error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
