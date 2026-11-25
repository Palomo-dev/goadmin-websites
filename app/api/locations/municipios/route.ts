import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/server'
import { SIN_CACHE, cabecerasCatalogo } from '@/lib/locations/cacheCatalogo'

export const dynamic = 'force-dynamic'
// Catálogo leído en cada petición (igual que /states y /cities): sin la Data Cache de Next.
export const revalidate = 0
export const fetchCache = 'force-no-store'

/** PostgREST corta cada respuesta en 1.000 filas; Colombia tiene 1.122 municipios. */
const PAGINA = 1000

/**
 * GET /api/locations/municipios?country_code=COL
 *
 * Todos los municipios de un país con su departamento, para el campo «Ciudad o municipio» del
 * checkout v2 (lista oficial DANE con buscador, sin mapas ni geolocalización paga). Es el mismo
 * catálogo público de /states y /cities (tabla `municipalities`, columnas verificadas por MCP el
 * 2026-11-24: code, name, state_code, state_name, country_code). Una sola petición por visitante y
 * cacheada en el CDN una hora: el buscador filtra en el navegador.
 */
export async function GET(request: NextRequest) {
  try {
    const countryCode = (request.nextUrl.searchParams.get('country_code') || '').trim().toUpperCase()
    if (!/^[A-Z]{2,3}$/.test(countryCode)) {
      return NextResponse.json({ error: 'El parámetro country_code es requerido' }, { status: 400, headers: SIN_CACHE })
    }

    const supabase = createPublicClient()
    const filas: { code: string | null; name: string | null; state_code: string | null; state_name: string | null }[] = []
    for (let desde = 0; ; desde += PAGINA) {
      const { data, error } = await (supabase as any)
        .from('municipalities')
        .select('code, name, state_code, state_name')
        .eq('country_code', countryCode)
        .order('name')
        .order('code')
        .range(desde, desde + PAGINA - 1)
      if (error) {
        console.error('[Locations] municipios error:', error.message)
        return NextResponse.json({ error: 'Error al obtener municipios' }, { status: 500, headers: SIN_CACHE })
      }
      filas.push(...(data || []))
      if (!data || data.length < PAGINA) break
    }

    const municipios = filas
      .filter((f) => f.name && f.state_code)
      .map((f) => ({ code: f.code ?? '', name: f.name as string, state_code: f.state_code as string, state_name: f.state_name ?? '' }))
    return NextResponse.json(municipios, { headers: cabecerasCatalogo(municipios.length) })
  } catch (error: any) {
    console.error('[Locations] municipios error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500, headers: SIN_CACHE })
  }
}
