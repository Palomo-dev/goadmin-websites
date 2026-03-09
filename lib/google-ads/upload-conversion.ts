/**
 * Helper para subir conversiones offline a Google Ads desde los webhooks de pago.
 * Lee credenciales de integration_credentials y llama a la API de Google Ads v23.
 *
 * Variables de entorno requeridas:
 * - GOOGLE_ADS_CLIENT_ID
 * - GOOGLE_ADS_CLIENT_SECRET
 * - GOOGLE_ADS_DEVELOPER_TOKEN
 * - GOOGLE_ADS_LOGIN_CUSTOMER_ID
 */

const GOOGLE_ADS_CONNECTOR_ID = '876a3948-ddd2-4a80-9ffe-ed6d3882aa04'
const GOOGLE_ADS_API_VERSION = 'v23'
const GOOGLE_ADS_BASE_URL = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`

interface ConversionData {
  /** Referencia única de la transacción (order_number, folio, etc.) */
  orderId: string
  /** Valor de la conversión en la moneda base */
  value: number
  /** Código de moneda ISO (COP, USD, etc.) */
  currency: string
  /** Categoría: purchase, booking, lead, membership, ticket, invoice, parking_pass */
  category: string
  /** gclid capturado del usuario (opcional) */
  gclid?: string
  /** Email del cliente para Enhanced Conversions (opcional, ya normalizado) */
  customerEmail?: string
  /** Teléfono del cliente en formato E.164 (opcional) */
  customerPhone?: string
}

/**
 * Intenta subir una conversión offline a Google Ads para una organización.
 * Si no hay integración activa, retorna silenciosamente sin error.
 */
export async function uploadGoogleAdsConversion(
  supabase: any,
  organizationId: number,
  data: ConversionData
): Promise<{ uploaded: boolean; error?: string }> {
  try {
    // 1. Verificar variables de entorno
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID

    if (!clientId || !clientSecret || !developerToken) {
      return { uploaded: false }
    }

    // 2. Buscar conexión activa de Google Ads para la organización
    const { data: connections } = await supabase
      .from('integration_connections')
      .select('id')
      .eq('connector_id', GOOGLE_ADS_CONNECTOR_ID)
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .limit(1)

    if (!connections || connections.length === 0) {
      return { uploaded: false }
    }

    const connectionId = connections[0].id

    // 3. Obtener credenciales: refresh_token, customer_id, conversion_action_id
    const { data: credentials } = await supabase
      .from('integration_credentials')
      .select('purpose, secret_ref')
      .eq('connection_id', connectionId)
      .in('purpose', ['refresh_token', 'customer_id', 'conversion_action_id'])
      .eq('status', 'active')

    if (!credentials || credentials.length === 0) {
      return { uploaded: false }
    }

    const credMap: Record<string, string> = {}
    for (const c of credentials) {
      credMap[c.purpose] = c.secret_ref
    }

    const refreshToken = credMap['refresh_token']
    const customerId = credMap['customer_id']
    const conversionActionId = credMap['conversion_action_id']

    if (!refreshToken || !customerId || !conversionActionId) {
      return { uploaded: false }
    }

    // 4. Obtener access_token via refresh_token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      console.error('[Google Ads] Error obteniendo access_token:', err)
      return { uploaded: false, error: 'Token refresh failed' }
    }

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    // 5. Construir payload de conversión
    const customerIdClean = customerId.replace(/-/g, '')
    const conversionDateTime = new Date().toISOString().replace('T', ' ').replace('Z', '+00:00').slice(0, 25) + '+00:00'

    const conversion: Record<string, any> = {
      conversionAction: `customers/${customerIdClean}/conversionActions/${conversionActionId}`,
      conversionDateTime,
      conversionValue: data.value,
      currencyCode: data.currency,
      orderId: data.orderId,
    }

    // Si hay gclid, usarlo para atribución directa
    if (data.gclid) {
      conversion.gclid = data.gclid
    }

    // Enhanced Conversions: email y/o teléfono hasheados
    const userIdentifiers: any[] = []
    if (data.customerEmail) {
      const normalizedEmail = data.customerEmail.trim().toLowerCase()
      const hashedEmail = await sha256(normalizedEmail)
      userIdentifiers.push({ hashedEmail })
    }
    if (data.customerPhone) {
      const normalizedPhone = data.customerPhone.replace(/[\s\-\(\)]/g, '')
      const hashedPhone = await sha256(normalizedPhone)
      userIdentifiers.push({ hashedPhoneNumber: hashedPhone })
    }
    if (userIdentifiers.length > 0) {
      conversion.userIdentifiers = userIdentifiers
    }

    // 6. Subir conversión
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': developerToken,
    }
    if (loginCustomerId) {
      headers['login-customer-id'] = loginCustomerId.replace(/-/g, '')
    }

    const uploadRes = await fetch(
      `${GOOGLE_ADS_BASE_URL}/customers/${customerIdClean}/conversionActions:uploadClickConversions`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          conversions: [conversion],
          partialFailure: true,
        }),
      }
    )

    if (!uploadRes.ok) {
      const err = await uploadRes.text()
      console.error('[Google Ads] Error subiendo conversión:', err)

      // Registrar evento de error
      await supabase.from('integration_events').insert({
        connection_id: connectionId,
        organization_id: organizationId,
        source: 'google_ads',
        direction: 'outbound',
        event_type: 'conversion_upload',
        payload: { orderId: data.orderId, category: data.category, error: err },
        status: 'failed',
        error_message: `HTTP ${uploadRes.status}: ${err.slice(0, 500)}`,
        event_time: new Date().toISOString(),
      } as any)

      return { uploaded: false, error: `Upload failed: ${uploadRes.status}` }
    }

    // 7. Registrar evento exitoso
    await supabase.from('integration_events').insert({
      connection_id: connectionId,
      organization_id: organizationId,
      source: 'google_ads',
      direction: 'outbound',
      event_type: 'conversion_upload',
      payload: { orderId: data.orderId, category: data.category, value: data.value, currency: data.currency },
      status: 'processed',
      processed_at: new Date().toISOString(),
      event_time: new Date().toISOString(),
    } as any)

    console.log(`[Google Ads] Conversión subida OK: orderId=${data.orderId} category=${data.category} value=${data.value} ${data.currency}`)
    return { uploaded: true }
  } catch (error) {
    console.error('[Google Ads] Error inesperado:', error)
    return { uploaded: false, error: String(error) }
  }
}

/**
 * SHA-256 hash de un string (para Enhanced Conversions)
 */
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
