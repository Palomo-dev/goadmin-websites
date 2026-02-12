import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Connector ID de Meta Marketing en integration_connectors
const META_MARKETING_CONNECTOR_ID = '1894a4af-4be2-46a6-b342-ab734d4e0479'

// Propósitos de credenciales en integration_credentials
const CREDENTIAL_PURPOSES = {
  ACCESS_TOKEN: 'access_token',
  APP_SECRET: 'app_secret',
  PIXEL_ID: 'pixel_id',
  CATALOG_ID: 'catalog_id',
} as const

/**
 * Verifica la firma HMAC-SHA256 del webhook de Meta.
 * Header X-Hub-Signature-256: "sha256=HASH"
 * HMAC-SHA256(rawBody, app_secret)
 */
async function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string,
  appSecret: string
): Promise<boolean> {
  try {
    if (!signatureHeader.startsWith('sha256=')) return false

    const expectedHash = signatureHeader.substring(7)

    const encoder = new TextEncoder()
    const keyData = encoder.encode(appSecret)
    const messageData = encoder.encode(rawBody)

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
    const calculated = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    return calculated === expectedHash
  } catch (error) {
    console.error('[Meta Webhook] Error validating signature:', error)
    return false
  }
}

/**
 * Obtiene el app_secret de Meta para una conexión.
 */
async function getMetaAppSecret(
  supabase: any,
  connectionId: string
): Promise<string | null> {
  const { data: credentials } = await supabase
    .from('integration_credentials')
    .select('purpose, secret_ref')
    .eq('connection_id', connectionId)
    .eq('status', 'active')

  if (!credentials || credentials.length === 0) return null

  const appSecretCred = credentials.find(
    (c: any) => c.purpose === CREDENTIAL_PURPOSES.APP_SECRET
  )

  return appSecretCred?.secret_ref || null
}

/**
 * GET /api/webhooks/meta
 *
 * Verificación del webhook (Facebook envía challenge).
 * Facebook envía:
 *   ?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE
 *
 * Se debe responder con hub.challenge si verify_token coincide.
 * El verify_token se busca en las conexiones activas de Meta Marketing
 * (almacenado en settings.webhook_verify_token o un valor por defecto).
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode !== 'subscribe' || !token || !challenge) {
    return NextResponse.json(
      { status: 'ok', service: 'meta_webhook', timestamp: new Date().toISOString() }
    )
  }

  const supabase = createAdminClient() || createPublicClient()

  // Buscar conexiones activas de Meta Marketing
  const { data: connections } = await (supabase as any)
    .from('integration_connections')
    .select('id, organization_id, settings')
    .eq('connector_id', META_MARKETING_CONNECTOR_ID)
    .eq('status', 'active')

  if (!connections || connections.length === 0) {
    return NextResponse.json({ error: 'No active Meta connections' }, { status: 403 })
  }

  // Verificar el token contra las conexiones
  for (const conn of connections) {
    const settings = conn.settings || {}
    const verifyToken = settings.webhook_verify_token || 'go_admin_meta_verify'

    if (token === verifyToken) {
      // Devolver challenge como texto plano
      return new NextResponse(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    }
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

/**
 * POST /api/webhooks/meta
 *
 * Recibe webhooks de Meta (Facebook/Instagram).
 * Flujo:
 *  1. Lee raw body + header X-Hub-Signature-256
 *  2. Itera conexiones activas de meta_marketing
 *  3. Verifica firma HMAC-SHA256 con app_secret
 *  4. Registra cada entry/change como integration_event
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient() || createPublicClient()

  try {
    const rawBody = await request.text()
    const signatureHeader = request.headers.get('x-hub-signature-256') || ''

    // Parsear body
    let body: Record<string, any>
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const objectType = body.object || ''
    const entries = body.entry || []

    console.log(
      `[Meta Webhook] object=${objectType} entries=${entries.length}`
    )

    // 1. Buscar conexiones activas de Meta Marketing
    const { data: connections } = await (supabase as any)
      .from('integration_connections')
      .select('id, organization_id, settings')
      .eq('connector_id', META_MARKETING_CONNECTOR_ID)
      .eq('status', 'active')

    if (!connections || connections.length === 0) {
      console.warn('[Meta Webhook] No hay conexiones activas de Meta Marketing')
      return NextResponse.json({ received: true, processed: false })
    }

    // 2. Verificar firma iterando conexiones
    let matchedConnection: any = null
    let verified = false

    for (const conn of connections) {
      const appSecret = await getMetaAppSecret(supabase, conn.id)
      if (!appSecret) continue

      const isValid = await verifyMetaSignature(rawBody, signatureHeader, appSecret)
      if (isValid) {
        matchedConnection = conn
        verified = true
        break
      }
    }

    if (!matchedConnection) {
      // Si no hay firma o no se pudo verificar, loguear pero aceptar
      // (en desarrollo Facebook puede enviar sin firma)
      if (signatureHeader) {
        console.warn('[Meta Webhook] Firma no verificada')

        await (supabase as any).from('integration_events').insert({
          connection_id: null,
          source: 'meta',
          direction: 'inbound',
          event_type: `meta.${objectType}`,
          payload: { object: objectType, entries_count: entries.length },
          status: 'rejected',
          error_message: 'Firma de webhook inválida',
          event_time: new Date().toISOString(),
        })

        return NextResponse.json(
          { error: 'Signature verification failed' },
          { status: 401 }
        )
      }

      // Sin firma — usar primera conexión como fallback (solo desarrollo)
      matchedConnection = connections[0]
    }

    const organizationId = matchedConnection.organization_id

    // 3. Registrar cada entry/change como evento
    for (const entry of entries) {
      const changes = entry.changes || []

      if (changes.length === 0) {
        // Entry sin changes (ej: messaging)
        await (supabase as any).from('integration_events').insert({
          connection_id: matchedConnection.id,
          organization_id: organizationId,
          source: 'meta',
          direction: 'inbound',
          event_type: `meta.${objectType}`,
          external_event_id: entry.id ? String(entry.id) : null,
          payload: {
            object: objectType,
            entry_id: entry.id,
            entry_time: entry.time,
            verified,
          },
          status: 'processed',
          processed_at: new Date().toISOString(),
          event_time: entry.time
            ? new Date(entry.time * 1000).toISOString()
            : new Date().toISOString(),
        })
      } else {
        for (const change of changes) {
          await (supabase as any).from('integration_events').insert({
            connection_id: matchedConnection.id,
            organization_id: organizationId,
            source: 'meta',
            direction: 'inbound',
            event_type: `meta.${objectType}.${change.field}`,
            external_event_id: entry.id ? String(entry.id) : null,
            payload: {
              object: objectType,
              entry_id: entry.id,
              entry_time: entry.time,
              field: change.field,
              value: change.value,
              verified,
            },
            status: 'processed',
            processed_at: new Date().toISOString(),
            event_time: entry.time
              ? new Date(entry.time * 1000).toISOString()
              : new Date().toISOString(),
          })
        }
      }
    }

    // 4. Actualizar last_received_at
    await (supabase as any)
      .from('integration_webhooks')
      .update({ last_received_at: new Date().toISOString() })
      .eq('connection_id', matchedConnection.id)
      .eq('direction', 'inbound')

    console.log(
      `[Meta Webhook] Procesado OK: ${entries.length} entries, object=${objectType}`
    )

    // Facebook espera HTTP 200 siempre
    return NextResponse.json({ received: true, verified })
  } catch (error) {
    console.error('[Meta Webhook] Error inesperado:', error)
    return NextResponse.json({ received: true, error: 'Internal error' }, { status: 200 })
  }
}
