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

import { procesarCobroFirmadoWompi, type ResultadoCobroFirmado } from '@/lib/payments/wompi-cobro-firmado'
import { mapToPaymentMethodCode } from '@/lib/payments/mapPaymentMethod'
import { sendRestaurantTableConfirmationEmail } from '@/lib/email/send-restaurant-table-confirmation'
import { sendRestaurantTeamNotice } from '@/lib/email/send-restaurant-team-notice'
import { fechaLarga } from './horario'
import { contextoCorreoReserva } from './reservas-servidor'
import { rutaGestionReserva, tokenValido } from './reservas-errores'
import { estadoDepositoWompi } from './deposito-modelo'

export type ResultadoWebhookDeposito = ResultadoCobroFirmado

function origenSitio(org: { custom_domain?: string | null; subdomain?: string | null } | null): string {
  if (org?.custom_domain) return `https://${org.custom_domain}`
  if (org?.subdomain) return `https://${org.subdomain}.goadmin.io`
  return ''
}

/**
 * Firma, idempotencia y registro en `integration_events`: lib/payments/wompi-cobro-firmado.ts
 * (el mismo esqueleto del abono en línea de la Carta QR). Aquí solo lo propio del depósito.
 */
export async function procesarDepositoWompi(
  supabase: any,
  body: Record<string, any>,
): Promise<ResultadoWebhookDeposito> {
  return procesarCobroFirmadoWompi<{ id: string }>(supabase, body, {
    fuente: 'restaurant_reservation',
    etiqueta: 'Depósito de reserva',
    noEncontrado: 'Reserva no encontrada',
    // 1. Organización desde la reserva.
    buscar: async (db, reference) => {
      const { data: reserva, error: errReserva } = await db
        .from('restaurant_reservations')
        .select('id, organization_id')
        .eq('deposit_reference', reference)
        .maybeSingle()
      if (errReserva || !reserva) {
        if (errReserva) console.error('[Wompi Webhook] Depósito de reserva', { reference, code: errReserva.code })
        return null
      }
      return { id: reserva.id as string, organizationId: Number(reserva.organization_id) }
    },
    // 4. Resultado del pago (transaccional e idempotente en la base).
    aplicar: (db, reserva, transaction) =>
      db.rpc('fn_reserva_mesa_deposito_resultado', {
        p_organization_id: reserva.organizationId,
        p_reference: transaction.reference,
        p_estado: estadoDepositoWompi(transaction.status),
        p_transaction_id: String(transaction.id ?? ''),
        p_monto: Number(transaction.amount_in_cents ?? 0) / 100,
        p_moneda: transaction.currency || 'COP',
        p_pasarela: 'wompi_co',
        p_metodo: mapToPaymentMethodCode(transaction.payment_method_type, 'wompi'),
        p_respuesta: transaction,
      }),
    // 5. Pagado por primera vez: correo al cliente y aviso al equipo (los de siempre).
    despues: async (db, reserva, resultado, transaction) => {
      if (estadoDepositoWompi(transaction.status) === 'paid' && resultado?.transicion === true) {
        await avisarReservaPagada(db, reserva.organizationId, reserva.id)
      } else {
        // Rechazado, vencido, repetido o pendiente: nada que avisar por correo.
      }
    },
    respuesta: (reserva, resultado, transaction) => ({
      received: true,
      source: 'restaurant_reservation',
      reservationId: reserva.id,
      deposit_status: estadoDepositoWompi(transaction.status),
      ...(resultado?.motivo ? { motivo: resultado.motivo } : {}),
    }),
  })
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
