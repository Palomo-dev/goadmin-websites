import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Connector ID de Meta Marketing en integration_connectors
const META_MARKETING_CONNECTOR_ID = '1894a4af-4be2-46a6-b342-ab734d4e0479'

// Graph API
const META_API_VERSION = 'v19.0'
const META_GRAPH_API_URL = `https://graph.facebook.com/${META_API_VERSION}`

/**
 * Hash SHA-256 para datos personales (email, teléfono, nombre).
 * Meta requiere que se hasheen antes de enviar a CAPI.
 */
async function hashSHA256(value: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(value.trim().toLowerCase())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Obtiene credenciales de Meta (access_token + pixel_id) para una organización.
 */
async function getMetaCredentials(
  supabase: any,
  organizationId: number
): Promise<{ accessToken: string; pixelId: string; connectionId: string } | null> {
  // Buscar conexión activa de meta_marketing para esta organización
  const { data: connections } = await supabase
    .from('integration_connections')
    .select('id')
    .eq('connector_id', META_MARKETING_CONNECTOR_ID)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .limit(1)

  if (!connections || connections.length === 0) return null

  const connectionId = connections[0].id

  const { data: credentials } = await supabase
    .from('integration_credentials')
    .select('purpose, secret_ref')
    .eq('connection_id', connectionId)
    .eq('status', 'active')

  if (!credentials || credentials.length === 0) return null

  let accessToken = ''
  let pixelId = ''

  for (const cred of credentials) {
    if (cred.purpose === 'access_token') accessToken = cred.secret_ref || ''
    if (cred.purpose === 'pixel_id') pixelId = cred.secret_ref || ''
  }

  if (!accessToken || !pixelId) return null
  return { accessToken, pixelId, connectionId }
}

/**
 * POST /api/meta/send-event
 *
 * Envía eventos server-side a la Conversions API de Meta (CAPI).
 * Se usa para complementar el Pixel con eventos desde el servidor,
 * especialmente Purchase tras confirmar un pago.
 *
 * Body esperado:
 * {
 *   organization_id: number,
 *   events: [{
 *     event_name: "Purchase" | "Lead" | "Schedule" | ...,
 *     event_id?: string,        // Para deduplicación con Pixel
 *     event_source_url?: string,
 *     user_data: {
 *       email?: string,         // Se hashea automáticamente
 *       phone?: string,         // Se hashea automáticamente
 *       first_name?: string,    // Se hashea automáticamente
 *       last_name?: string,     // Se hashea automáticamente
 *       client_ip_address?: string,
 *       client_user_agent?: string,
 *       fbc?: string,           // Cookie _fbc
 *       fbp?: string,           // Cookie _fbp
 *       external_id?: string,   // Se hashea automáticamente
 *     },
 *     custom_data?: {
 *       value?: number,
 *       currency?: string,
 *       content_ids?: string[],
 *       content_type?: "product" | "product_group",
 *       num_items?: number,
 *     }
 *   }]
 * }
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient() || createPublicClient()

  try {
    const body = await request.json()
    const { organization_id, events } = body

    if (!organization_id || !events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'organization_id y events[] son requeridos' },
        { status: 400 }
      )
    }

    // 1. Obtener credenciales de Meta
    const metaCreds = await getMetaCredentials(supabase, organization_id)

    if (!metaCreds) {
      return NextResponse.json(
        { error: 'No se encontró integración Meta Marketing activa para esta organización' },
        { status: 404 }
      )
    }

    // 2. Transformar eventos: hashear datos personales
    const capiEvents = []

    for (const event of events) {
      const userData: Record<string, any> = {}

      if (event.user_data) {
        // Hashear datos sensibles con SHA-256
        if (event.user_data.email) {
          userData.em = [await hashSHA256(event.user_data.email)]
        }
        if (event.user_data.phone) {
          userData.ph = [await hashSHA256(event.user_data.phone)]
        }
        if (event.user_data.first_name) {
          userData.fn = await hashSHA256(event.user_data.first_name)
        }
        if (event.user_data.last_name) {
          userData.ln = await hashSHA256(event.user_data.last_name)
        }
        if (event.user_data.external_id) {
          userData.external_id = await hashSHA256(event.user_data.external_id)
        }

        // Datos no hasheados
        if (event.user_data.client_ip_address) {
          userData.client_ip_address = event.user_data.client_ip_address
        }
        if (event.user_data.client_user_agent) {
          userData.client_user_agent = event.user_data.client_user_agent
        }
        if (event.user_data.fbc) {
          userData.fbc = event.user_data.fbc
        }
        if (event.user_data.fbp) {
          userData.fbp = event.user_data.fbp
        }
      }

      capiEvents.push({
        event_name: event.event_name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.event_id || undefined,
        event_source_url: event.event_source_url || undefined,
        action_source: 'website',
        user_data: userData,
        custom_data: event.custom_data || undefined,
      })
    }

    // 3. Enviar a Conversions API
    const response = await fetch(
      `${META_GRAPH_API_URL}/${metaCreds.pixelId}/events`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${metaCreds.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: capiEvents }),
      }
    )

    const responseData = await response.json().catch(() => ({}))

    if (!response.ok) {
      console.error('[Meta CAPI] Error:', response.status, responseData)

      // Registrar error en integration_events
      await (supabase as any).from('integration_events').insert({
        connection_id: metaCreds.connectionId,
        organization_id,
        source: 'meta',
        direction: 'outbound',
        event_type: `capi.${capiEvents[0]?.event_name || 'unknown'}`,
        payload: {
          events_count: capiEvents.length,
          error: responseData.error?.message || response.statusText,
        },
        status: 'failed',
        error_message: responseData.error?.message || `HTTP ${response.status}`,
        event_time: new Date().toISOString(),
      })

      return NextResponse.json(
        { error: responseData.error?.message || 'Error al enviar eventos a CAPI' },
        { status: response.status }
      )
    }

    // 4. Registrar éxito en integration_events
    await (supabase as any).from('integration_events').insert({
      connection_id: metaCreds.connectionId,
      organization_id,
      source: 'meta',
      direction: 'outbound',
      event_type: `capi.${capiEvents[0]?.event_name || 'batch'}`,
      payload: {
        events_count: capiEvents.length,
        events_received: responseData.events_received,
        fbtrace_id: responseData.fbtrace_id,
      },
      status: 'processed',
      processed_at: new Date().toISOString(),
      event_time: new Date().toISOString(),
    })

    console.log(
      `[Meta CAPI] Enviados ${capiEvents.length} eventos OK: ${responseData.events_received} recibidos`
    )

    return NextResponse.json({
      success: true,
      events_sent: capiEvents.length,
      events_received: responseData.events_received,
      fbtrace_id: responseData.fbtrace_id,
    })
  } catch (error) {
    console.error('[Meta CAPI] Error inesperado:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}
