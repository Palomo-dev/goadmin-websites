/**
 * Firma y secreto de eventos del webhook de Wompi (`app/api/webhooks/wompi_co`).
 * Extraído tal cual de la ruta (sin cambios de comportamiento) para que otros
 * cobros por Wompi verifiquen la firma con la MISMA lógica.
 */

// Connector ID de Wompi Colombia en integration_connectors
export const WOMPI_CONNECTOR_ID = '39950173-5f7c-48a9-a242-c6fdf5a07aee'

/**
 * Interruptor de verificación de firma.
 *
 * `false` (por defecto) = MODO OBSERVACIÓN: la firma se calcula y el resultado se
 * registra en integration_events, pero el webhook se procesa igual. Existe porque
 * el events_secret guardado nunca ha validado una firma real — la consulta lo
 * buscaba por la columna equivocada — así que nadie sabe todavía si coincide con
 * el de Wompi. Pasar a bloquear sin comprobarlo dejaría de confirmar pedidos
 * pagados, y en silencio: el cron `reconcile-web-orders` NO los recupera, porque
 * busca `payment_status='paid'` y ese update ocurre después de esta guarda.
 *
 * `true` = fallar cerrado: sin firma válida, 401.
 *
 * Se pasa a 'true' en cuanto los eventos registrados confirmen `match` con
 * tráfico real de las tres tiendas en producción. Es config, no despliegue.
 */
export const SIGNATURE_ENFORCED = process.env.WOMPI_WEBHOOK_ENFORCE_SIGNATURE === 'true'

export type SignatureVerdict = 'match' | 'mismatch' | 'no_secret' | 'no_signature'

/**
 * Deja rastro del resultado de la verificación de firma en integration_events.
 *
 * `connection_id` es NOT NULL en la tabla. La versión anterior de esta función lo
 * mandaba en null —heredado del insert original, que además usaba `status: 'rejected'`,
 * fuera del CHECK— y por eso ninguno de los dos rastros se escribió jamás: el insert
 * fallaba en silencio. Sin conexión resuelta no hay fila; se deja en consola.
 *
 * `external_event_id` va en null a propósito: `idx_integration_events_dedupe` es
 * UNIQUE (connection_id, external_event_id) y con el id de la transacción este
 * registro chocaría con el evento de procesamiento. El id queda en `payload`.
 *
 * `status` sólo admite 'received' | 'processed' | 'error'.
 */
export async function logSignatureCheck(
  supabase: any,
  params: {
    connectionId: string | null
    organizationId: number
    transactionId: string | null
    body: Record<string, any>
    verdict: SignatureVerdict
    blocked: boolean
  }
): Promise<void> {
  const { connectionId, organizationId, transactionId, body, verdict, blocked } = params

  if (!connectionId) {
    console.error(
      `[Wompi Webhook] veredicto de firma "${verdict}" sin conexión resuelta para org ${organizationId}; no se registra en integration_events`
    )
    return
  }

  const { error } = await supabase.from('integration_events').insert({
    connection_id: connectionId,
    organization_id: organizationId,
    source: 'webhook',
    direction: 'inbound',
    event_type: 'transaction.updated',
    external_event_id: null,
    payload: {
      provider: 'wompi',
      signature_verdict: verdict,
      blocked,
      transaction_id: transactionId,
      ...body,
    },
    status: verdict === 'match' ? 'received' : 'error',
    error_message:
      verdict === 'match'
        ? null
        : `Firma de webhook no verificada (${verdict})${blocked ? '' : ' — modo observación, procesado igual'}`,
    // event_time es GENERATED ALWAYS AS (created_at), no se puede insertar.
  } as any)

  if (error) {
    console.error('[Wompi Webhook] No se pudo registrar el chequeo de firma:', error)
  }
}

/**
 * Mapea el status de Wompi al payment_status de web_orders
 */
export function mapWompiStatus(wompiStatus: string): string {
  const map: Record<string, string> = {
    APPROVED: 'paid',
    DECLINED: 'failed',
    VOIDED: 'refunded',
    ERROR: 'failed',
    PENDING: 'pending',
  }
  return map[wompiStatus] || 'pending'
}

/**
 * Valida la firma del webhook de Wompi.
 * checksum = SHA256(concat(property_values) + timestamp + events_secret)
 */
export async function validateSignature(
  transaction: Record<string, any>,
  signature: { properties: string[]; checksum: string },
  timestamp: number,
  eventsSecret: string
): Promise<boolean> {
  try {
    // Concatenar los valores de las propiedades listadas
    const values = signature.properties.map((prop) => {
      // Las propiedades vienen como "transaction.id", "transaction.status", etc.
      const key = prop.replace('transaction.', '')
      return String(transaction[key] ?? '')
    })

    const payload = values.join('') + String(timestamp) + eventsSecret

    // SHA256 hash
    const encoder = new TextEncoder()
    const data = encoder.encode(payload)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    return hashHex === signature.checksum
  } catch (error) {
    console.error('[Wompi Webhook] Error validating signature:', error)
    return false
  }
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/**
 * Obtiene el events_secret de Wompi para una organización.
 * Busca en integration_credentials vía integration_connections.
 *
 * El valor 'events_secret' vive en la columna `purpose`, NO en `credential_type`
 * (que para estas filas vale 'secret'). Filtrar por `credential_type` devolvía 0
 * filas para las 4 organizaciones con Wompi, y como la guarda del POST era
 * `if (eventsSecret && signature)`, la firma no se verificaba nunca.
 *
 * Orden de resolución:
 *   1. fn_get_provider_secret(connection_id, purpose) — Vault. Cuando exista, es la fuente.
 *   2. secret_ref crudo, sólo si NO es un uuid (estado previo a la migración a Vault).
 *   3. connection.settings.events_secret — fallback histórico.
 *
 * Un `secret_ref` con forma de uuid y sin función de Vault disponible se trata
 * como "sin secreto" a propósito: firmar con el uuid daría mismatch en todas las
 * firmas legítimas y es peor que declarar que no hay secreto.
 */
export async function getEventsSecret(
  supabase: any,
  organizationId: number
): Promise<{ secret: string | null; connectionId: string | null }> {
  // 1. Buscar la conexión de Wompi para esta org (active o connected)
  const { data: connection } = await supabase
    .from('integration_connections')
    .select('id, settings')
    .eq('organization_id', organizationId)
    .eq('connector_id', WOMPI_CONNECTOR_ID)
    .in('status', ['active', 'connected'])
    .limit(1)
    .maybeSingle()

  if (!connection) return { secret: null, connectionId: null }

  const connectionId: string = connection.id

  // 2. Buscar la credencial cuyo PROPÓSITO es el secreto de eventos
  const { data: credential } = await supabase
    .from('integration_credentials')
    .select('secret_ref')
    .eq('connection_id', connectionId)
    .eq('purpose', 'events_secret')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const secretRef: string | null = credential?.secret_ref ?? null

  // 3. Vault: la referencia se resuelve por función SECURITY DEFINER.
  //    Mientras fn_get_provider_secret no exista, el rpc falla y se sigue al paso 4.
  if (secretRef) {
    try {
      const { data: secret, error } = await supabase.rpc('fn_get_provider_secret', {
        p_connection_id: connectionId,
        p_purpose: 'events_secret',
      })
      if (!error && secret) return { secret: secret as string, connectionId }
    } catch {
      // Función aún no desplegada — se intenta el valor crudo abajo.
    }

    // 4. Valor crudo, sólo si todavía no es una referencia a Vault.
    if (!UUID_RE.test(secretRef)) return { secret: secretRef, connectionId }

    console.error(
      '[Wompi Webhook] secret_ref es un uuid de Vault pero fn_get_provider_secret no respondió. org:',
      organizationId
    )
    return { secret: null, connectionId }
  }

  // 5. Fallback histórico en los settings de la conexión.
  return { secret: connection.settings?.events_secret || null, connectionId }
}
