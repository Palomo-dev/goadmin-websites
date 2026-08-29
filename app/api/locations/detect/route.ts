import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Mapa ISO-2 (header de Vercel) -> ISO-3 (código en tabla countries)
const ISO2_TO_ISO3: Record<string, string> = {
  CO: 'COL', MX: 'MEX', US: 'USA', AR: 'ARG', CL: 'CHL',
  PE: 'PER', EC: 'ECU', BR: 'BRA', UY: 'URY', PA: 'PAN',
  CR: 'CRI', GT: 'GTM', HN: 'HND', SV: 'SLV', NI: 'NIC',
  DO: 'DOM', BO: 'BOL', PY: 'PRY', VE: 'VEN', ES: 'ESP',
  CA: 'CAN', GB: 'GBR', JP: 'JPN', AU: 'AUS', DE: 'DEU',
  FR: 'FRA', IT: 'ITA', PT: 'PRT', NL: 'NLD',
}

/**
 * GET /api/locations/detect
 * Auto-detecta el país del cliente por IP usando los headers de Vercel.
 * Devuelve { country_code, country_name, phone_code } o { country_code: null }
 * si no puede detectar (200, no es error).
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Intentar headers de Vercel (ISO-2). x-vercel-ip-country-code o x-vercel-ip-country
    const headerCountry =
      request.headers.get('x-vercel-ip-country-code') ||
      request.headers.get('x-vercel-ip-country') ||
      ''

    const iso3 = ISO2_TO_ISO3[headerCountry.toUpperCase()] || null

    // 2. Si se detectó un código ISO-3, buscar el país en la BD
    if (iso3) {
      const supabase = createPublicClient()
      const { data: country } = await (supabase as any)
        .from('countries')
        .select('code, name, phone_code')
        .eq('code', iso3)
        .eq('is_active', true)
        .maybeSingle()

      if (country) {
        return NextResponse.json({
          country_code: country.code,
          country_name: country.name,
          phone_code: country.phone_code,
        })
      }
    }

    // 3. Fallback por IP: usar x-forwarded-for (no implementado a nivel BD,
    //    se devuelve null para que el cliente use su país por defecto)
    const forwarded = request.headers.get('x-forwarded-for')
    if (forwarded) {
      // Sin servicio de geolocalización por IP disponible, devolvemos null
      return NextResponse.json({ country_code: null })
    }

    // 4. No se pudo detectar
    return NextResponse.json({ country_code: null })
  } catch (error: any) {
    console.error('[Locations] detect error:', error)
    // No es error de negocio: devolver null con 200
    return NextResponse.json({ country_code: null })
  }
}
