/**
 * Handler compartido para procesar pagos de facturas (invoice_sales) desde webhooks.
 *
 * Cuando un webhook recibe una referencia con prefijo "INV-", este handler:
 * 1. Busca la factura por su número (o por el prefijo de su id) DENTRO de la organización
 *    que resolvió el webhook (la conexión verificada de la pasarela), nunca en todas.
 * 2. Registra el pago en `payments` como lo hace el ERP (`source='invoice_sales'`,
 *    `status='completed'`, `idempotency_key` por transacción). El saldo de la factura y de
 *    su cartera lo recalculan los triggers de `payments`
 *    (`fn_recalc_invoice_balance_from_payments`, `update_accounts_receivable_on_payment`):
 *    este sitio no escribe `invoice_sales` ni `accounts_receivable`.
 * 3. Si es exitoso: envía email de confirmación de pago.
 *
 * Antes (hasta 2026-09-29) buscaba la factura por número en TODAS las organizaciones
 * (los números se repiten entre organizaciones), interpolaba la referencia en un filtro
 * `.or(...)`, restaba el saldo a mano sin idempotencia y el insert en `payments` usaba
 * columnas inexistentes (`customer_id`, `metadata`): no quedó registrado ningún pago.
 */

import { sendInvoicePaymentConfirmation } from '@/lib/email/send-invoice-payment-confirmation'
import { mapToPaymentMethodCode } from '@/lib/payments/mapPaymentMethod'

/**
 * Detecta si una referencia de pago corresponde a una factura.
 */
export function isInvoiceReference(reference: string): boolean {
  return reference?.startsWith('INV-') ?? false
}

/** `INV-{número}` o `INV-{8 hex del id}` (lo que arma /api/checkout/init). */
const REFERENCIA_RE = /^INV-([A-Za-z0-9][A-Za-z0-9-]{0,39})$/
const PREFIJO_ID_RE = /^[0-9a-f]{8}$/i

const COLUMNAS_FACTURA = 'id, organization_id, branch_id, customer_id, number, total, balance, status, currency'

interface Factura {
  id: string
  organization_id: number
  branch_id: number | null
  customer_id: string | null
  number: string | null
  total: number | null
  balance: number | null
  status: string | null
  currency: string | null
}

/**
 * Busca la factura de la referencia. Con `organizationId` filtra por esa organización;
 * sin ella devuelve todas las coincidencias (solo para resolver candidatas antes de
 * verificar la firma). Nunca interpola la referencia en un filtro de texto.
 */
async function buscarFacturas(
  supabase: any,
  reference: string,
  organizationId?: number
): Promise<Factura[]> {
  const m = REFERENCIA_RE.exec(reference || '')
  if (!m) return []
  const valor = m[1]

  let q = supabase.from('invoice_sales').select(COLUMNAS_FACTURA).eq('number', valor)
  if (organizationId !== undefined) q = q.eq('organization_id', organizationId)
  const { data: porNumero, error } = await q.limit(50)
  if (error) {
    console.error('[InvoicePayment] Error buscando factura por número:', error)
    return []
  }
  if (porNumero && porNumero.length > 0) return porNumero as Factura[]

  // Facturas sin número: la referencia lleva los 8 primeros caracteres del id.
  if (!PREFIJO_ID_RE.test(valor)) return []
  const hex = valor.toLowerCase()
  let qId = supabase
    .from('invoice_sales')
    .select(COLUMNAS_FACTURA)
    .gte('id', `${hex}-0000-0000-0000-000000000000`)
    .lte('id', `${hex}-ffff-ffff-ffff-ffffffffffff`)
  if (organizationId !== undefined) qId = qId.eq('organization_id', organizationId)
  const { data: porId, error: errorId } = await qId.limit(50)
  if (errorId) {
    console.error('[InvoicePayment] Error buscando factura por id:', errorId)
    return []
  }
  return (porId || []) as Factura[]
}

/**
 * Organizaciones candidatas para una referencia de factura, cuando el webhook aún no
 * sabe a qué organización pertenece (Wompi, Bold). El webhook debe quedarse solo con la
 * organización cuya firma verifica; esta lista no autoriza nada por sí sola.
 */
export async function organizacionesCandidatasFactura(supabase: any, reference: string): Promise<number[]> {
  const facturas = await buscarFacturas(supabase, reference)
  return Array.from(new Set(facturas.map((f) => f.organization_id)))
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
 *
 * `organizationId` sale de la conexión de la pasarela ya verificada (firma o consulta
 * a la API del proveedor con las credenciales de esa organización), nunca del payload.
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
  },
  organizationId: number
): Promise<PaymentResult> {
  try {
    if (!Number.isInteger(organizationId) || organizationId <= 0) {
      return { handled: false, error: 'Organización no resuelta para el pago de factura' }
    }

    // 1. Factura de ESTA organización
    const facturas = await buscarFacturas(supabase, reference, organizationId)
    if (facturas.length === 0) {
      return { handled: false, error: `Factura no encontrada: ${reference}` }
    }
    if (facturas.length > 1) {
      console.error(`[InvoicePayment] Referencia ambigua ${reference} en org ${organizationId}: ${facturas.length} facturas`)
      return { handled: false, error: `Referencia ambigua: ${reference}` }
    }
    const invoice = facturas[0]

    const isApproved = ['APPROVED', 'approved', 'paid', 'succeeded', 'completed'].includes(paymentStatus)

    if (!isApproved) {
      // Pago rechazado — solo registrar
      console.log(`[InvoicePayment] Pago rechazado para ${reference}: ${paymentStatus}`)
      return {
        handled: true,
        invoiceId: invoice.id,
        invoiceNumber: invoice.number ?? undefined,
        status: 'payment_rejected',
      }
    }

    const paymentAmount = Number(paymentDetails.amount)
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return { handled: false, invoiceId: invoice.id, error: 'Monto de pago inválido' }
    }
    if (!paymentDetails.transactionId) {
      return { handled: false, invoiceId: invoice.id, error: 'Pago sin id de transacción' }
    }
    if (invoice.status === 'draft' || invoice.status === 'void') {
      console.error(`[InvoicePayment] Pago aprobado a factura ${invoice.id} en estado ${invoice.status}; no se registra`)
      return { handled: false, invoiceId: invoice.id, error: `Factura en estado ${invoice.status}` }
    }

    // 2. Idempotencia por transacción: los proveedores reintentan el webhook.
    const idempotencyKey = `web:${paymentDetails.gateway}:${paymentDetails.transactionId}`
    const { data: existente } = await supabase
      .from('payments')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('idempotency_key', idempotencyKey)
      .limit(1)
      .maybeSingle()
    if (existente) {
      return { handled: true, invoiceId: invoice.id, invoiceNumber: invoice.number ?? undefined, status: 'duplicate' }
    }

    // 3. Pago como lo registra el ERP. Los triggers recalculan saldo, estado y cartera.
    const { error: pagoError } = await supabase.from('payments').insert({
      organization_id: organizationId,
      branch_id: invoice.branch_id,
      source: 'invoice_sales',
      source_id: invoice.id,
      method: mapToPaymentMethodCode(paymentDetails.method || paymentDetails.gateway, paymentDetails.gateway),
      amount: paymentAmount,
      currency: paymentDetails.currency || invoice.currency || 'COP',
      reference,
      status: 'completed',
      payment_date: new Date().toISOString(),
      idempotency_key: idempotencyKey,
      processor_response: {
        transaction_id: paymentDetails.transactionId,
        gateway: paymentDetails.gateway,
        invoice_number: invoice.number,
      },
    })

    if (pagoError) {
      if (pagoError.code === '23505') {
        // Otro reintento del mismo webhook lo registró primero.
        return { handled: true, invoiceId: invoice.id, invoiceNumber: invoice.number ?? undefined, status: 'duplicate' }
      }
      console.error('[InvoicePayment] Error registrando el pago:', pagoError)
      return { handled: false, invoiceId: invoice.id, error: pagoError.message }
    }

    // 4. Saldo ya recalculado por la base
    const { data: actualizada } = await supabase
      .from('invoice_sales')
      .select('balance, status')
      .eq('id', invoice.id)
      .eq('organization_id', organizationId)
      .maybeSingle()
    const newBalance = Number(actualizada?.balance ?? Math.max(0, Number(invoice.balance || 0) - paymentAmount))
    const newStatus: string = actualizada?.status || (newBalance <= 0 ? 'paid' : 'partial')

    // 5. Datos del cliente para el email
    const { data: customer } = invoice.customer_id
      ? await supabase
          .from('customers')
          .select('email, first_name, last_name')
          .eq('id', invoice.customer_id)
          .eq('organization_id', organizationId)
          .maybeSingle()
      : { data: null }

    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .maybeSingle()

    if (customer?.email) {
      try {
        await sendInvoicePaymentConfirmation({
          customerEmail: customer.email,
          customerName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email,
          organizationName: org?.name || 'GoAdmin',
          invoiceNumber: invoice.number || reference,
          invoiceTotal: Number(invoice.total || 0),
          amountPaid: paymentAmount,
          newBalance,
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
      invoiceNumber: invoice.number ?? undefined,
      status: newStatus,
    }
  } catch (err: any) {
    console.error('[InvoicePayment] Error procesando pago:', err)
    return { handled: false, error: err.message }
  }
}
