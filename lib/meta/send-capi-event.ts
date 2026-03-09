/**
 * Helper para enviar eventos server-side a la Conversions API de Meta (CAPI).
 * Se usa desde los webhooks de pago para enviar Purchase events.
 * Complementa el Meta Pixel (client-side) con deduplicación vía event_id.
 */

const META_MARKETING_CONNECTOR_ID = '1894a4af-4be2-46a6-b342-ab734d4e0479'
const META_API_VERSION = 'v19.0'
const META_GRAPH_API_URL = `https://graph.facebook.com/${META_API_VERSION}`

interface CAPIEventData {
  /** Nombre del evento: Purchase, Lead, Schedule, Subscribe */
  eventName: string
  /** ID único para deduplicación con Pixel (order_number, etc.) */
  eventId: string
  /** Valor monetario */
  value: number
  /** Código de moneda ISO */
  currency: string
  /** Email del cliente (se hashea automáticamente) */
  customerEmail?: string
  /** Teléfono del cliente (se hashea automáticamente) */
  customerPhone?: string
  /** URL de origen del evento */
  sourceUrl?: string
}

/**
 * Envía un evento CAPI a Meta para una organización.
 * Retorna silenciosamente si no hay integración Meta activa.
 */
export async function sendMetaCAPIEvent(
  supabase: any,
  organizationId: number,
  data: CAPIEventData
): Promise<{ sent: boolean; error?: string }> {
  try {
    // 1. Buscar conexión activa de Meta Marketing
    const { data: connections } = await supabase
      .from('integration_connections')
      .select('id')
      .eq('connector_id', META_MARKETING_CONNECTOR_ID)
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .limit(1)

    if (!connections || connections.length === 0) {
      return { sent: false }
    }

    const connectionId = connections[0].id

    // 2. Obtener credenciales: access_token + pixel_id
    const { data: credentials } = await supabase
      .from('integration_credentials')
      .select('purpose, secret_ref')
      .eq('connection_id', connectionId)
      .in('purpose', ['access_token', 'pixel_id'])
      .eq('status', 'active')

    if (!credentials || credentials.length === 0) {
      return { sent: false }
    }

    let accessToken = ''
    let pixelId = ''
    for (const c of credentials) {
      if (c.purpose === 'access_token') accessToken = c.secret_ref || ''
      if (c.purpose === 'pixel_id') pixelId = c.secret_ref || ''
    }

    if (!accessToken || !pixelId) {
      return { sent: false }
    }

    // 3. Construir user_data con hashing SHA-256
    const userData: Record<string, any> = {}
    if (data.customerEmail) {
      userData.em = [await sha256(data.customerEmail.trim().toLowerCase())]
    }
    if (data.customerPhone) {
      const phone = data.customerPhone.replace(/[\s\-\(\)]/g, '')
      userData.ph = [await sha256(phone)]
    }

    // 4. Construir evento CAPI
    const capiEvent = {
      event_name: data.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: data.eventId,
      action_source: 'website' as const,
      event_source_url: data.sourceUrl || undefined,
      user_data: userData,
      custom_data: {
        value: data.value,
        currency: data.currency,
      },
    }

    // 5. Enviar a Conversions API
    const response = await fetch(`${META_GRAPH_API_URL}/${pixelId}/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: [capiEvent] }),
    })

    const responseData = await response.json().catch(() => ({}))

    if (!response.ok) {
      console.error('[Meta CAPI] Error:', response.status, responseData)

      await supabase.from('integration_events').insert({
        connection_id: connectionId,
        organization_id: organizationId,
        source: 'meta',
        direction: 'outbound',
        event_type: `capi.${data.eventName}`,
        payload: { eventId: data.eventId, error: responseData.error?.message },
        status: 'failed',
        error_message: responseData.error?.message || `HTTP ${response.status}`,
        event_time: new Date().toISOString(),
      } as any)

      return { sent: false, error: `CAPI error: ${response.status}` }
    }

    // 6. Registrar éxito
    await supabase.from('integration_events').insert({
      connection_id: connectionId,
      organization_id: organizationId,
      source: 'meta',
      direction: 'outbound',
      event_type: `capi.${data.eventName}`,
      payload: {
        eventId: data.eventId,
        value: data.value,
        currency: data.currency,
        events_received: responseData.events_received,
      },
      status: 'processed',
      processed_at: new Date().toISOString(),
      event_time: new Date().toISOString(),
    } as any)

    console.log(`[Meta CAPI] ${data.eventName} enviado OK: eventId=${data.eventId} value=${data.value} ${data.currency}`)
    return { sent: true }
  } catch (error) {
    console.error('[Meta CAPI] Error inesperado:', error)
    return { sent: false, error: String(error) }
  }
}

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
