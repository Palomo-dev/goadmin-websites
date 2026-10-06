/**
 * Pago del depósito de una reserva de mesa (referencia `MESA-…`) llegado por el
 * webhook de Wompi.
 *
 * Reglas (CLAUDE.md › Webhooks de pasarela):
 * - La organización sale de la RESERVA (por su referencia), nunca del payload.
 * - Firma verificada y FALLA CERRADO siempre, sin depender de
 *   WOMPI_WEBHOOK_ENFORCE_SIGNATURE: este flujo es nuevo y no tiene tráfico que
 *   proteger en modo observación. Sin secreto, sin firma o con firma distinta → 401.
 * - Idempotente por `external_event_id` (= id de la transacción):
 *   `idx_integration_events_dedupe` es UNIQUE (connection_id, external_event_id).
 *   Un evento ya `processed` no se repite; uno que quedó en `received`/`error` se
 *   reintenta (la RPC también es idempotente por transacción y por estado).
 * - `integration_events`: `connection_id` NOT NULL, `status` en
 *   received|processed|error, `event_time` GENERATED (no se escribe). Se comprueba
 *   el `error` de cada escritura.
 *
 * Al confirmarse el pago, la reserva pasa a confirmada o «por confirmar» (según
 * «Confirmación manual» de la sede) en `fn_reserva_mesa_deposito_resultado`, y
 * aquí se mandan el correo al cliente y el aviso al equipo que ya existen.
 */

import { getEventsSecret, logSignatureCheck, validateSignature, type SignatureVerdict } from '@/lib/payments/wompi-firma'
import { mapToPaymentMethodCode } from '@/lib/payments/mapPaymentMethod'
import { sendRestaurantTableConfirmationEmail } from '@/lib/email/send-restaurant-table-confirmation'
import { sendRestaurantTeamNotice } from '@/lib/email/send-restaurant-team-notice'
import { fechaLarga } from './horario'
import { contextoCorreoReserva } from './reservas-servidor'
import { rutaGestionReserva, tokenValido } from './reservas-errores'
import { estadoDepositoWompi } from './deposito-modelo'

export interface ResultadoWebhookDeposito {
  status: number
  body: Record<string, unknown>
}

function origenSitio(org: { custom_domain?: string | null; subdomain?: string | null } | null): string {
  if (org?.custom_domain) return `https://${org.custom_domain}`
  if (org?.subdomain) return `https://${org.subdomain}.goadmin.io`
  return ''
}

export async function procesarDepositoWompi(
  supabase: any,
  body: Record<string, any>,
): Promise<ResultadoWebhookDeposito> {
  const { event, data, timestamp, signature } = body
  const transaction = data?.transaction as Record<string, any>
  const reference: string = transaction.reference
  const transactionId: string = String(transaction.id ?? '')

  // 1. Organización desde la reserva.
  const { data: reserva, error: errReserva } = await supabase
    .from('restaurant_reservations')
    .select('id, organization_id')
    .eq('deposit_reference', reference)
    .maybeSingle()
  if (errReserva || !reserva) {
    console.error('[Wompi Webhook] Depósito de reserva no encontrado', { reference, code: errReserva?.code })
    return { status: 404, body: { error: 'Reserva no encontrada', reference } }
  }
  const organizationId = Number(reserva.organization_id)

  // 2. Firma: falla cerrado.
  const { secret, connectionId } = await getEventsSecret(supabase, organizationId)
  let verdict: SignatureVerdict
  if (!secret) verdict = 'no_secret'
  else if (!signature) verdict = 'no_signature'
  else verdict = (await validateSignature(transaction, signature, timestamp, secret)) ? 'match' : 'mismatch'
  if (verdict !== 'match') {
    console.error(`[Wompi Webhook] Depósito ${reference}: firma no verificada (${verdict}) — rechazado`)
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
      payload: { provider: 'wompi', fuente: 'restaurant_reservation', ...body },
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
    console.error('[Wompi Webhook] No se pudo registrar el evento del depósito', { code: nuevo.error.code })
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
    if (error) console.error('[Wompi Webhook] No se pudo cerrar el evento del depósito', { code: error.code })
  }

  // 4. Resultado del pago (transaccional e idempotente en la base).
  const estado = estadoDepositoWompi(transaction.status)
  const { data: resultado, error: errRpc } = await supabase.rpc('fn_reserva_mesa_deposito_resultado', {
    p_organization_id: organizationId,
    p_reference: reference,
    p_estado: estado,
    p_transaction_id: transactionId,
    p_monto: Number(transaction.amount_in_cents ?? 0) / 100,
    p_moneda: transaction.currency || 'COP',
    p_pasarela: 'wompi_co',
    p_metodo: mapToPaymentMethodCode(transaction.payment_method_type, 'wompi'),
    p_respuesta: transaction,
  })
  if (errRpc) {
    console.error('[Wompi Webhook] fn_reserva_mesa_deposito_resultado', { reference, code: errRpc.code })
    await marcar('error', `RPC: ${errRpc.code ?? 'error'}`)
    return { status: 500, body: { error: 'No se pudo aplicar el pago' } }
  }
  await marcar(resultado?.ok === false ? 'error' : 'processed', resultado?.ok === false ? String(resultado?.motivo ?? '') : null)

  // 5. Pagado por primera vez: correo al cliente y aviso al equipo (los de siempre).
  if (estado === 'paid' && resultado?.transicion === true) {
    await avisarReservaPagada(supabase, organizationId, reserva.id).catch((e) =>
      console.error('[Wompi Webhook] Correos del depósito', e),
    )
  } else {
    // Rechazado, vencido, repetido o pendiente: nada que avisar por correo.
  }

  return {
    status: 200,
    body: { received: true, source: 'restaurant_reservation', reservationId: reserva.id, deposit_status: estado, ...(resultado?.motivo ? { motivo: resultado.motivo } : {}) },
  }
}

async function avisarReservaPagada(supabase: any, organizationId: number, reservationId: string): Promise<void> {
  const [{ data: r }, { data: org }] = await Promise.all([
    supabase
      .from('restaurant_reservations')
      .select('id, branch_id, status, customer_name, customer_email, customer_phone, party_size, reservation_date, reservation_time, notes, manage_token')
      .eq('id', reservationId)
      .eq('organization_id', organizationId)
      .maybeSingle(),
    supabase.from('organizations').select('custom_domain, subdomain').eq('id', organizationId).maybeSingle(),
  ])
  if (!r) return
  const branchId = r.branch_id == null ? null : Number(r.branch_id)
  const datos = await contextoCorreoReserva(supabase, organizationId, branchId)
  const hora = String(r.reservation_time).slice(0, 5)
  const codigo = String(r.id).slice(0, 8).toUpperCase()
  const origen = origenSitio(org)
  const manageUrl = tokenValido(r.manage_token) && origen ? `${origen}${rutaGestionReserva(r.manage_token)}` : null

  if (r.customer_email) {
    await sendRestaurantTableConfirmationEmail({
      reservationId: r.id,
      customerEmail: r.customer_email,
      customerName: r.customer_name,
      date: r.reservation_date,
      time: hora,
      partySize: r.party_size,
      organizationName: datos.organizacion.nombre,
      status: r.status,
      manageUrl,
      dateLabel: fechaLarga(r.reservation_date),
      branchName: datos.sede?.nombre ?? null,
      branchAddress: datos.sede?.direccion ?? null,
      replyTo: datos.sede?.email || datos.organizacion.email || null,
    })
  }
  if (datos.correosEquipo.length > 0) {
    await sendRestaurantTeamNotice({
      destinatarios: datos.correosEquipo,
      organizacion: datos.organizacion.nombre,
      sede: datos.sede?.nombre ?? null,
      codigo,
      cliente: r.customer_name,
      telefono: r.customer_phone || null,
      email: r.customer_email || null,
      personas: r.party_size,
      fecha: fechaLarga(r.reservation_date),
      hora,
      estado: r.status,
      notas: r.notes || null,
    })
  }
}
