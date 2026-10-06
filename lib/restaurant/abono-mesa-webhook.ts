/**
 * Abono en línea a la cuenta de una mesa desde la Carta QR (referencia `CQR-…`) llegado por el
 * webhook de Wompi.
 *
 * Firma obligatoria, idempotencia e integration_events: lib/payments/wompi-cobro-firmado.ts (el
 * mismo esqueleto del depósito de reservas). La organización sale del ABONO
 * (`table_online_payments.reference`), nunca del payload. El resultado lo aplica la base en una
 * transacción (`fn_mesa_abono_resultado`): pagado → `pos_checkout_v1` settle sobre la venta de la
 * mesa (el mismo cobro de la caja); si ya no cabe, `paid_unapplied` con aviso al mesero.
 */

import { procesarCobroFirmadoWompi, type ResultadoCobroFirmado } from '@/lib/payments/wompi-cobro-firmado'
import { mapToPaymentMethodCode } from '@/lib/payments/mapPaymentMethod'
import { estadoDepositoWompi } from './deposito-modelo'
import { FUENTE_COBRO_MESA } from './mesa-servidor'

export async function procesarAbonoMesaWompi(
  supabase: any,
  body: Record<string, any>,
): Promise<ResultadoCobroFirmado> {
  return procesarCobroFirmadoWompi<{ id: string }>(supabase, body, {
    fuente: FUENTE_COBRO_MESA,
    etiqueta: 'Abono de mesa',
    noEncontrado: 'Abono no encontrado',
    buscar: async (db, reference) => {
      const { data, error } = await db
        .from('table_online_payments')
        .select('id, organization_id')
        .eq('reference', reference)
        .maybeSingle()
      if (error || !data) {
        if (error) console.error('[Wompi Webhook] Abono de mesa', { reference, code: error.code })
        return null
      }
      return { id: data.id as string, organizationId: Number(data.organization_id) }
    },
    aplicar: (db, abono, transaction) =>
      db.rpc('fn_mesa_abono_resultado', {
        p_organization_id: abono.organizationId,
        p_reference: transaction.reference,
        // Mismo mapeo que el depósito: APPROVED → paid, DECLINED/ERROR → failed, VOIDED → refunded.
        p_estado: estadoDepositoWompi(transaction.status),
        p_transaction_id: String(transaction.id ?? ''),
        p_monto: Number(transaction.amount_in_cents ?? 0) / 100,
        p_moneda: transaction.currency || 'COP',
        p_pasarela: 'wompi_co',
        p_metodo: mapToPaymentMethodCode(transaction.payment_method_type, 'wompi'),
        p_respuesta: transaction,
      }),
    respuesta: (abono, resultado, transaction) => ({
      received: true,
      source: FUENTE_COBRO_MESA,
      onlinePaymentId: abono.id,
      payment_status: estadoDepositoWompi(transaction.status),
      ...(resultado?.status ? { status: resultado.status } : {}),
      ...(resultado?.motivo ? { motivo: resultado.motivo } : {}),
    }),
  })
}

export type { ResultadoCobroFirmado as ResultadoWebhookAbonoMesa }
