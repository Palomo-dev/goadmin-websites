import { NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Mapa ISO-3 (código en BD) -> ISO-2 (para generar emoji de bandera)
const ISO3_TO_ISO2: Record<string, string> = {
  AUS: 'AU', BRA: 'BR', CAN: 'CA', CHL: 'CL', COL: 'CO',
  ESP: 'ES', USA: 'US', JPN: 'JP', MEX: 'MX', GBR: 'GB',
  ARG: 'AR', PER: 'PE', ECU: 'EC', URY: 'UY', PAN: 'PA',
  CRI: 'CR', GTM: 'GT', HND: 'HN', SLV: 'SV', NIC: 'NI',
  DOM: 'DO', BOL: 'BO', PRY: 'PY', VEN: 'VE',
}

/** Convierte un código ISO-3 en emoji de bandera regional. */
function flagEmoji(iso3: string): string {
  const iso2 = ISO3_TO_ISO2[iso3]
  if (!iso2 || iso2.length !== 2) return ''
  const codePoints = Array.from(iso2.toUpperCase()).map(
    (c) => 0x1f1e6 + (c.charCodeAt(0) - 65)
  )
  return String.fromCodePoint(...codePoints)
}

/**
 * GET /api/locations/countries
 * Devuelve la lista de países activos con su phone_code y bandera.
 */
export async function GET() {
  try {
    const supabase = createPublicClient()
    const { data, error } = await (supabase as any)
      .from('countries')
      .select('code, name, phone_code')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('[Locations] countries error:', error.message)
      return NextResponse.json(
        { error: 'Error al obtener países' },
        { status: 500 }
      )
    }

    const countries = (data || []).map((c: any) => ({
      code: c.code,
      name: c.name,
      phone_code: c.phone_code,
      flag: flagEmoji(c.code),
    }))

    return NextResponse.json(countries)
  } catch (error: any) {
    console.error('[Locations] countries error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
