/**
 * Cobro propio llegado por el webhook de Wompi con firma OBLIGATORIA e idempotencia por
 * transacción. Es el esqueleto que comparten los cobros que no son pedidos web: el depósito de
 * una reserva de mesa (`MESA-…`, lib/restaurant/deposito-webhook.ts) y el abono en línea a la
 * cuenta de una mesa desde la Carta QR (`CQR-…`, lib/restaurant/abono-mesa-webhook.ts).
 *
 * Reglas (CLAUDE.md › Webhooks de pasarela):
 * - La organización sale del COBRO (por su referencia), nunca del payload.
 * - Firma verificada y FALLA CERRADO siempre, sin depender de WOMPI_WEBHOOK_ENFORCE_SIGNATURE:
 *   estos flujos son nuevos y no tienen tráfico que proteger en modo observación. Sin secreto,
 *   sin firma o con firma distinta → 401.
 * - Idempotente por `external_event_id` (= id de la transacción):
 *   `idx_integration_events_dedupe` es UNIQUE (connection_id, external_event_id). Un evento ya
 *   `processed` no se repite; uno que quedó en `received`/`error` se reintenta (las RPC también
 *   son idempotentes por transacción y por estado).
 * - `integration_events`: `connection_id` NOT NULL, `status` en received|processed|error,
 *   `event_time` GENERATED (no se escribe). Se comprueba el `error` de cada escritura.
 */

import { getEventsSecret, logSignatureCheck, validateSignature, type SignatureVerdict } from './wompi-firma'

export interface ResultadoCobroFirmado {
  status: number
  body: Record<string, unknown>
}

export interface CobroFirmadoWompi<C> {
  /** `fuente` que queda en el payload del evento (`restaurant_reservation`, `table_bill`). */
  fuente: string
  /** Nombre para los registros («Depósito de reserva», «Abono de mesa»). */
  etiqueta: string
  /** Texto del 404 cuando la referencia no existe («Reserva no encontrada»). */
  noEncontrado: string
  /** El cobro por su referencia: organización e id, o `null` si no existe (→ 404). */
  buscar: (supabase: any, referencia: string) => Promise<(C & { organizationId: number }) | null>
  /** Aplica el resultado (RPC transaccional e idempotente). `error` → evento en error y 500. */
  aplicar: (
    supabase: any,
    cobro: C & { organizationId: number },
    transaction: Record<string, any>,
  ) => Promise<{ data: any; error: { code?: string } | null }>
  /** Después de aplicar con éxito (correos, avisos). No bloquea la respuesta a Wompi. */
  despues?: (supabase: any, cobro: C & { organizationId: number }, resultado: any, transaction: Record<string, any>) => Promise<void>
  /** Cuerpo de la respuesta 200. */
  respuesta: (cobro: C & { organizationId: number }, resultado: any, transaction: Record<string, any>) => Record<string, unknown>
}

export async function procesarCobroFirmadoWompi<C>(
  supabase: any,
  body: Record<string, any>,
  cobroDef: CobroFirmadoWompi<C>,
): Promise<ResultadoCobroFirmado> {
  const { event, data, timestamp, signature } = body
  const transaction = data?.transaction as Record<string, any>
  const reference: string = transaction.reference
  const transactionId: string = String(transaction.id ?? '')

  // 1. Organización desde el cobro.
  const cobro = await cobroDef.buscar(supabase, reference)
  if (!cobro) {
    console.error(`[Wompi Webhook] ${cobroDef.etiqueta} no encontrado`, { reference })
    return { status: 404, body: { error: cobroDef.noEncontrado, reference } }
  }
  const organizationId = cobro.organizationId

  // 2. Firma: falla cerrado.
  const { secret, connectionId } = await getEventsSecret(supabase, organizationId)
  let verdict: SignatureVerdict
  if (!secret) verdict = 'no_secret'
  else if (!signature) verdict = 'no_signature'
  else verdict = (await validateSignature(transaction, signature, timestamp, secret)) ? 'match' : 'mismatch'
  if (verdict !== 'match') {
    console.error(`[Wompi Webhook] ${cobroDef.etiqueta} ${reference}: firma no verificada (${verdict}) — rechazado`)
    await logSignatureCheck(supabase, { connectionId, organizationId, transactionId, body, verdict, blocked: true })
    return { status: 401, body: { error: 'Firma inválida' } }
  } else if (!connectionId) {
    // Con secreto hay conexión; sin ella no se puede deduplicar en integration_events.
    return { status: 500, body: { error: 'Conexión de Wompi no resuelta' } }
  }

  // 3. Idempotencia por external_event_id.
  let eventoId: string | null = null
  const nuevo = await supabase
    .from('integration_events')
    .insert({
      connection_id: connectionId,
      organization_id: organizationId,
      source: 'webhook',
      direction: 'inbound',
      event_type: event,
      external_event_id: transactionId,
      payload: { provider: 'wompi', fuente: cobroDef.fuente, ...body },
      status: 'received',
    })
    .select('id')
    .maybeSingle()
  if (nuevo.error?.code === '23505') {
    const { data: previo } = await supabase
      .from('integration_events')
      .select('id, status')
      .eq('connection_id', connectionId)
      .eq('external_event_id', transactionId)
      .maybeSingle()
    if (previo?.status === 'processed') {
      return { status: 200, body: { received: true, duplicate: true, reference } }
    } else {
      eventoId = previo?.id ?? null // quedó a medias: se reintenta
    }
  } else if (nuevo.error) {
    console.error(`[Wompi Webhook] No se pudo registrar el evento (${cobroDef.etiqueta})`, { code: nuevo.error.code })
    return { status: 500, body: { error: 'No se pudo registrar el evento' } }
  } else {
    eventoId = nuevo.data?.id ?? null
  }

  const marcar = async (status: 'processed' | 'error', mensaje: string | null) => {
    if (!eventoId) return
    const { error } = await supabase
      .from('integration_events')
      .update({ status, error_message: mensaje, processed_at: new Date().toISOString() })
      .eq('id', eventoId)
    if (error) console.error(`[Wompi Webhook] No se pudo cerrar el evento (${cobroDef.etiqueta})`, { code: error.code })
  }

  // 4. Resultado del pago (transaccional e idempotente en la base).
  const { data: resultado, error: errRpc } = await cobroDef.aplicar(supabase, cobro, transaction)
  if (errRpc) {
    console.error(`[Wompi Webhook] ${cobroDef.etiqueta}: la RPC falló`, { reference, code: errRpc.code })
    await marcar('error', `RPC: ${errRpc.code ?? 'error'}`)
    return { status: 500, body: { error: 'No se pudo aplicar el pago' } }
  }
  await marcar(resultado?.ok === false ? 'error' : 'processed', resultado?.ok === false ? String(resultado?.motivo ?? '') : null)

  // 5. Lo que sigue al pago (correos, avisos), sin bloquear.
  if (cobroDef.despues) {
    await cobroDef.despues(supabase, cobro, resultado, transaction).catch((e) =>
      console.error(`[Wompi Webhook] ${cobroDef.etiqueta}: después del pago`, e),
    )
  } else {
    // Sin pasos posteriores.
  }

  return { status: 200, body: cobroDef.respuesta(cobro, resultado, transaction) }
}
