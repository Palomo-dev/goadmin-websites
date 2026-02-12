/**
 * Handler compartido para procesar pagos de membresías desde webhooks.
 *
 * Cuando un webhook recibe una referencia con prefijo "MEM-", este handler:
 * 1. Busca la membresía por ID
 * 2. Actualiza membership.status según el resultado del pago
 * 3. Inserta un registro en payments (source: 'membership')
 * 4. Crea membership_payments (membership_id → payment_id)
 * 5. Registra membership_events (audit trail)
 * 6. Envía email de confirmación si el pago fue exitoso
 */

import { sendMembershipConfirmationEmail } from '@/lib/email/send-membership-confirmation'

/**
 * Detecta si una referencia de pago corresponde a una membresía.
 */
export function isMembershipReference(reference: string): boolean {
  return reference?.startsWith('MEM-') ?? false
}

/**
 * Extrae el membership ID de la referencia MEM-{id}
 */
function extractMembershipId(reference: string): string {
  return reference.replace('MEM-', '')
}

interface PaymentResult {
  handled: boolean
  membershipId?: number
  status?: string
  error?: string
}

/**
 * Procesa un pago de membresía desde un webhook.
 *
 * @param supabase - Cliente de Supabase con permisos admin
 * @param reference - Referencia de la transacción (ej: "MEM-42")
 * @param paymentStatus - Estado mapeado del pago: 'paid', 'failed', 'refunded', 'pending'
 * @param paymentDetails - Detalles del pago para registrar
 */
export async function handleMembershipPayment(
  supabase: any,
  reference: string,
  paymentStatus: string,
  paymentDetails: {
    transactionId: string
    amount: number
    currency: string
    method: string
    processorResponse: any
    gateway: string
  }
): Promise<PaymentResult> {
  if (!isMembershipReference(reference)) {
    return { handled: false }
  }

  const membershipId = extractMembershipId(reference)

  try {
    // 1. Buscar membresía
    const { data: membership, error: searchError } = await supabase
      .from('memberships')
      .select('id, organization_id, customer_id, membership_plan_id, status, start_date, end_date, access_code')
      .eq('id', membershipId)
      .single()

    if (searchError || !membership) {
      console.error(`[MembershipPayment] Membresía no encontrada: ${reference}`, searchError)
      return { handled: true, error: 'Membresía no encontrada' }
    }

    // 2. Obtener branch principal de la organización
    const { data: branch } = await supabase
      .from('branches')
      .select('id')
      .eq('organization_id', membership.organization_id)
      .eq('is_main', true)
      .limit(1)
      .single()

    // 3. Determinar nuevo status de la membresía
    let newStatus = membership.status
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (paymentStatus === 'paid') {
      newStatus = 'active'
      updateData.status = 'active'
    } else if (paymentStatus === 'failed') {
      newStatus = 'cancelled'
      updateData.status = 'cancelled'
      updateData.notes = `Pago rechazado por ${paymentDetails.gateway}`
    } else if (paymentStatus === 'refunded') {
      newStatus = 'cancelled'
      updateData.status = 'cancelled'
      updateData.notes = `Reembolsado vía ${paymentDetails.gateway}`
    }

    // 4. Actualizar membresía
    const { error: updateError } = await supabase
      .from('memberships')
      .update(updateData)
      .eq('id', membership.id)

    if (updateError) {
      console.error('[MembershipPayment] Error actualizando membresía:', updateError)
    }

    // 5. Insertar payment
    const { data: payment } = await supabase.from('payments').insert({
      organization_id: membership.organization_id,
      branch_id: branch?.id || null,
      source: 'membership',
      source_id: String(membership.id),
      method: paymentDetails.method,
      amount: paymentDetails.amount,
      currency: paymentDetails.currency,
      reference: paymentDetails.transactionId,
      processor_response: paymentDetails.processorResponse,
      status: paymentStatus,
    }).select('id').single()

    // 6. Crear membership_payments (vínculo membership → payment)
    if (payment?.id) {
      await supabase.from('membership_payments').insert({
        membership_id: membership.id,
        payment_id: payment.id,
      })
    }

    // 7. Registrar membership_event
    await supabase.from('membership_events').insert({
      membership_id: membership.id,
      organization_id: membership.organization_id,
      event_type: paymentStatus === 'paid' ? 'activated' : paymentStatus === 'failed' ? 'payment_failed' : 'refunded',
      description: paymentStatus === 'paid'
        ? `Membresía activada - Pago confirmado vía ${paymentDetails.gateway}`
        : paymentStatus === 'failed'
          ? `Pago rechazado vía ${paymentDetails.gateway}`
          : `Pago reembolsado vía ${paymentDetails.gateway}`,
      old_value: { status: membership.status },
      new_value: { status: newStatus, payment_id: payment?.id },
      metadata: {
        source: 'website',
        gateway: paymentDetails.gateway,
        transaction_id: paymentDetails.transactionId,
        amount: paymentDetails.amount,
        currency: paymentDetails.currency,
      },
    })

    // 8. Enviar email de confirmación si el pago fue exitoso
    if (paymentStatus === 'paid') {
      try {
        const { data: customer } = await supabase
          .from('customers')
          .select('first_name, last_name, email')
          .eq('id', membership.customer_id)
          .single()

        const { data: plan } = await supabase
          .from('membership_plans')
          .select('name, price, duration_days, frequency')
          .eq('id', membership.membership_plan_id)
          .single()

        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', membership.organization_id)
          .single()

        if (customer?.email) {
          await sendMembershipConfirmationEmail({
            membershipId: membership.id,
            customerEmail: customer.email,
            customerName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Miembro',
            planName: plan?.name || 'Membresía',
            planPrice: Number(plan?.price || paymentDetails.amount),
            startDate: membership.start_date,
            endDate: membership.end_date,
            accessCode: membership.access_code || '',
            frequency: plan?.frequency || 'monthly',
            organizationName: org?.name || '',
            portalUrl: `${process.env.NEXT_PUBLIC_BASE_URL || ''}/mi-cuenta/membresia`,
          })
        }
      } catch (emailErr) {
        console.error('[MembershipPayment] Error enviando email:', emailErr)
      }
    }

    console.log(
      `[MembershipPayment] Procesado: membership=${membership.id} status=${newStatus} payment=${paymentStatus}`
    )

    return {
      handled: true,
      membershipId: membership.id,
      status: newStatus,
    }
  } catch (error) {
    console.error('[MembershipPayment] Error inesperado:', error)
    return { handled: true, error: 'Error interno procesando pago de membresía' }
  }
}
