import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/server'
import { SIN_CACHE, cabecerasCatalogo } from '@/lib/locations/cacheCatalogo'

export const dynamic = 'force-dynamic'
// Catálogo leído en cada petición: en un GET, `force-dynamic` solo no evita que Next guarde el
// fetch de Supabase en su Data Cache (así quedó `[]` de cuando la tabla estaba vacía).
export const revalidate = 0
export const fetchCache = 'force-no-store'

/** PostgREST corta cada respuesta en 1.000 filas; Colombia tiene 1.122 municipios. */
const PAGINA = 1000

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
    // Por páginas: con una sola consulta los departamentos del final del orden (los que caen
    // después de la fila 1.000) no salían.
    const data: { state_code: string | null; state_name: string | null }[] = []
    for (let desde = 0; ; desde += PAGINA) {
      const { data: pagina, error } = await (supabase as any)
        .from('municipalities')
        .select('state_code, state_name')
        .eq('country_code', countryCode)
        .order('state_name')
        .order('id')
        .range(desde, desde + PAGINA - 1)

      if (error) {
        console.error('[Locations] states error:', error.message)
        return NextResponse.json(
          { error: 'Error al obtener estados' },
          { status: 500, headers: SIN_CACHE }
        )
      }
      data.push(...(pagina || []))
      if (!pagina || pagina.length < PAGINA) break
    }

    // Distinct por state_code (puede haber múltiples municipios por estado)
    const seen = new Set<string>()
    const states: { state_code: string; state_name: string }[] = []
    for (const row of data) {
      if (row.state_code && !seen.has(row.state_code)) {
        seen.add(row.state_code)
        states.push({ state_code: row.state_code, state_name: row.state_name ?? '' })
      }
    }

    return NextResponse.json(states, { headers: cabecerasCatalogo(states.length) })
  } catch (error: any) {
    console.error('[Locations] states error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500, headers: SIN_CACHE }
    )
  }
}
