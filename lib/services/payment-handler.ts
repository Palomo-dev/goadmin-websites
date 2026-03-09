/**
 * Handler compartido para procesar pagos de facturas (invoice_sales) desde webhooks.
 *
 * Cuando un webhook recibe una referencia con prefijo "INV-", este handler:
 * 1. Busca la invoice_sales por su número (INV-{number})
 * 2. Actualiza invoice_sales.balance y status según el resultado del pago
 * 3. Inserta un registro en payments (source: 'invoice')
 * 4. Actualiza accounts_receivable.balance y status
 * 5. Si es exitoso: envía email de confirmación de pago
 */

import { sendInvoicePaymentConfirmation } from '@/lib/email/send-invoice-payment-confirmation'

/**
 * Detecta si una referencia de pago corresponde a una factura.
 */
export function isInvoiceReference(reference: string): boolean {
  return reference?.startsWith('INV-') ?? false
}

interface PaymentResult {
  handled: boolean
  invoiceId?: string
  invoiceNumber?: string
  status?: string
  error?: string
}

/**
 * Procesa un pago de factura desde un webhook.
 */
export async function handleInvoicePayment(
  supabase: any,
  reference: string,
  paymentStatus: string,
  paymentDetails: {
    transactionId: string
    amount: number
    currency: string
    method: string
    gateway: string
  }
): Promise<PaymentResult> {
  try {
    // 1. Extraer número de factura de la referencia INV-{number}
    const invoiceNumber = reference.replace('INV-', '')

    // 2. Buscar factura por número
    const { data: invoice, error: invError } = await supabase
      .from('invoice_sales')
      .select('id, organization_id, customer_id, number, total, balance, status, currency')
      .or(`number.eq.${invoiceNumber},id.ilike.${invoiceNumber.toLowerCase()}%`)
      .limit(1)
      .maybeSingle()

    if (invError || !invoice) {
      return { handled: false, error: `Factura no encontrada: ${reference}` }
    }

    const isApproved = ['APPROVED', 'approved', 'paid', 'succeeded', 'completed'].includes(paymentStatus)

    if (isApproved) {
      // 3. Calcular nuevo balance
      const currentBalance = Number(invoice.balance || 0)
      const paymentAmount = paymentDetails.amount
      const newBalance = Math.max(0, currentBalance - paymentAmount)
      const newStatus = newBalance <= 0 ? 'paid' : 'partial'

      // 4. Actualizar invoice_sales
      await supabase
        .from('invoice_sales')
        .update({
          balance: newBalance,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoice.id)

      // 5. Insertar payment
      await supabase
        .from('payments')
        .insert({
          organization_id: invoice.organization_id,
          customer_id: invoice.customer_id,
          source: 'invoice',
          source_id: invoice.id,
          method: paymentDetails.method || paymentDetails.gateway,
          amount: paymentAmount,
          currency: paymentDetails.currency || invoice.currency || 'COP',
          reference: reference,
          status: 'approved',
          metadata: {
            transaction_id: paymentDetails.transactionId,
            gateway: paymentDetails.gateway,
            invoice_number: invoice.number,
          },
        })

      // 6. Actualizar accounts_receivable si existe
      const { data: receivable } = await supabase
        .from('accounts_receivable')
        .select('id, balance')
        .eq('invoice_id', invoice.id)
        .limit(1)
        .maybeSingle()

      if (receivable) {
        const arNewBalance = Math.max(0, Number(receivable.balance || 0) - paymentAmount)
        await supabase
          .from('accounts_receivable')
          .update({
            balance: arNewBalance,
            status: arNewBalance <= 0 ? 'paid' : 'partial',
            updated_at: new Date().toISOString(),
          })
          .eq('id', receivable.id)
      }

      // 7. Obtener datos del cliente para email
      const { data: customer } = await supabase
        .from('customers')
        .select('email, first_name, last_name')
        .eq('id', invoice.customer_id)
        .single()

      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', invoice.organization_id)
        .single()

      // 8. Enviar email de confirmación
      if (customer?.email) {
        try {
          await sendInvoicePaymentConfirmation({
            customerEmail: customer.email,
            customerName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email,
            organizationName: org?.name || 'GoAdmin',
            invoiceNumber: invoice.number || reference,
            invoiceTotal: Number(invoice.total || 0),
            amountPaid: paymentAmount,
            newBalance: newBalance,
            currency: paymentDetails.currency || invoice.currency || 'COP',
            transactionId: paymentDetails.transactionId,
            gateway: paymentDetails.gateway,
          })
        } catch (emailErr) {
          console.error('[InvoicePayment] Error enviando email:', emailErr)
        }
      }

      return {
        handled: true,
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        status: newStatus,
      }
    } else {
      // Pago rechazado — solo registrar
      console.log(`[InvoicePayment] Pago rechazado para ${reference}: ${paymentStatus}`)
      return {
        handled: true,
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        status: 'payment_rejected',
      }
    }
  } catch (err: any) {
    console.error('[InvoicePayment] Error procesando pago:', err)
    return { handled: false, error: err.message }
  }
}
