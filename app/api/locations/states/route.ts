import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/locations/states?country_code=COL
 * Devuelve los estados/departamentos únicos de un país.
 */
export async function GET(request: NextRequest) {
  try {
    const countryCode = request.nextUrl.searchParams.get('country_code')

    if (!countryCode) {
      return NextResponse.json(
        { error: 'El parámetro country_code es requerido' },
        { status: 400 }
      )
    }

    const supabase = createPublicClient()
    const { data, error } = await (supabase as any)
      .from('municipalities')
      .select('state_code, state_name')
      .eq('country_code', countryCode)
      .order('state_name')

    if (error) {
      console.error('[Locations] states error:', error.message)
      return NextResponse.json(
        { error: 'Error al obtener estados' },
        { status: 500 }
      )
    }

    // Distinct por state_code (puede haber múltiples municipios por estado)
    const seen = new Set<string>()
    const states: { state_code: string; state_name: string }[] = []
    for (const row of data || []) {
      if (row.state_code && !seen.has(row.state_code)) {
        seen.add(row.state_code)
        states.push({ state_code: row.state_code, state_name: row.state_name })
      }
    }

    return NextResponse.json(states)
  } catch (error: any) {
    console.error('[Locations] states error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
