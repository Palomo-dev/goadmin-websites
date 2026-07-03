import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { getOrganizationByHost } from '@/lib/supabase/queries'

export const dynamic = 'force-dynamic'

// Mapa ISO-2 (header de Vercel) -> ISO-3 (tabla countries)
const ISO2_TO_ISO3: Record<string, string> = {
  CO: 'COL', MX: 'MEX', US: 'USA', AR: 'ARG', CL: 'CHL',
  PE: 'PER', EC: 'ECU', BR: 'BRA', UY: 'URY', PA: 'PAN',
  CR: 'CRI', GT: 'GTM', HN: 'HND', SV: 'SLV', NI: 'NIC',
  DO: 'DOM', BO: 'BOL', PY: 'PRY', VE: 'VEN', ES: 'ESP',
  CA: 'CAN', GB: 'GBR', JP: 'JPN', AU: 'AUS', DE: 'DEU',
  FR: 'FRA', IT: 'ITA', PT: 'PRT', NL: 'NLD',
}

/**
 * GET /api/currency
 * Detecta el país del visitante por IP (header x-vercel-ip-country) y devuelve
 * la moneda destino, tasa de conversión desde la moneda base de la organización,
 * locale y monedas disponibles.
 * Query params:
 *  - currency: código de moneda para selección manual (opcional)
 */
export async function GET(request: NextRequest) {
  try {
    const headersList = await headers()
    const subdomain = headersList.get('x-subdomain')
    const customDomain = headersList.get('x-custom-domain')
    const identifier = customDomain || subdomain
    if (!identifier) {
      return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })
    }

    const organization = await getOrganizationByHost(identifier)
    if (!organization) {
      return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })
    }

    const supabase = createAdminClient() || createPublicClient()
    const manualCurrency = request.nextUrl.searchParams.get('currency')

    // 1. Moneda base de la organización
    const { data: orgCurrency } = await (supabase as any)
      .from('organization_currencies')
      .select('currency_code')
      .eq('organization_id', organization.id)
      .eq('is_base', true)
      .maybeSingle()
    const baseCurrency = (orgCurrency?.currency_code || 'COP').trim()

    // 2. Detectar país del visitante (Vercel geo header ISO-2)
    const countryIso2 = headersList.get('x-vercel-ip-country') || ''
    const countryIso3 = ISO2_TO_ISO3[countryIso2] || null

    // 3. Moneda destino: manual > país del visitante > moneda base
    let targetCurrency = baseCurrency
    let locale = 'es-CO'
    let countryCode: string | null = null

    if (manualCurrency) {
      targetCurrency = manualCurrency.trim().toUpperCase()
      const { data: countryForCurrency } = await (supabase as any)
        .from('countries')
        .select('code, locale')
        .eq('default_currency_code', targetCurrency)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      if (countryForCurrency?.locale) locale = countryForCurrency.locale
    } else if (countryIso3) {
      const { data: country } = await (supabase as any)
        .from('countries')
        .select('code, default_currency_code, locale')
        .eq('code', countryIso3)
        .eq('is_active', true)
        .maybeSingle()
      if (country?.default_currency_code) {
        targetCurrency = country.default_currency_code.trim()
        locale = country.locale || 'es-CO'
        countryCode = country.code
      }
    }

    // 4. Obtener tasas más recientes (base USD) para base y destino
    const { data: rates } = await (supabase as any)
      .from('currency_rates')
      .select('code, rate, rate_date')
      .in('code', [baseCurrency, targetCurrency])
      .order('rate_date', { ascending: false })
      .limit(10)

    const latestRate: Record<string, number> = {}
    for (const r of rates || []) {
      const code = r.code.trim()
      if (!(code in latestRate)) latestRate[code] = Number(r.rate)
    }

    const baseRate = latestRate[baseCurrency]
    const targetRate = latestRate[targetCurrency]

    // Tasa de conversión: precio_destino = precio_base * (targetRate / baseRate)
    let conversionRate = 1
    if (baseRate && targetRate && baseCurrency !== targetCurrency) {
      conversionRate = targetRate / baseRate
    } else if (!baseRate || !targetRate) {
      // Sin tasas disponibles: no convertir
      targetCurrency = baseCurrency
    }

    // 5. Info de la moneda destino (símbolo, decimales)
    const { data: currencyInfo } = await (supabase as any)
      .from('currencies')
      .select('code, symbol, decimals, name')
      .eq('code', targetCurrency)
      .maybeSingle()

    // 6. Monedas disponibles para el selector (activas y con país asociado)
    const { data: availableCountries } = await (supabase as any)
      .from('countries')
      .select('code, name, default_currency_code, locale')
      .eq('is_active', true)

    const seen = new Set<string>()
    const availableCurrencies = (availableCountries || [])
      .filter((c: any) => {
        const code = c.default_currency_code?.trim()
        if (!code || seen.has(code)) return false
        seen.add(code)
        return true
      })
      .map((c: any) => ({
        code: c.default_currency_code.trim(),
        country: c.name,
        locale: c.locale,
      }))

    return NextResponse.json({
      baseCurrency,
      targetCurrency,
      conversionRate,
      locale,
      countryCode,
      detectedCountry: countryIso2 || null,
      symbol: currencyInfo?.symbol || '$',
      decimals: currencyInfo?.decimals ?? (targetCurrency === 'COP' ? 0 : 2),
      availableCurrencies,
    })
  } catch (error: any) {
    console.error('Error en /api/currency:', error)
    return NextResponse.json({ error: 'Error al obtener moneda' }, { status: 500 })
  }
}
