/**
 * Helper para llamar al endpoint del ERP que procesa un reembolso
 * de pedido web de forma completa (nota crédito, devolución de stock,
 * ajuste de cartera, asiento contable de reversión).
 *
 * Es fire-and-forget: no bloquea el webhook si falla.
 */

const ERP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.goadmin.io'
const WEBHOOK_SECRET = process.env.CRON_SECRET || ''

/**
 * Notifica al ERP que un pedido web fue reembolsado.
 * El ERP crea nota crédito, devuelve stock, ajusta AR y genera asiento de reversión.
 *
 * @param webOrderId - UUID del web_order
 * @param refundData - Datos del reembolso (amount, reason, items para parcial)
 */
export async function notifyErpRefund(
  webOrderId: string,
  refundData?: { amount?: number; reason?: string; items?: Array<{ product_id: number; quantity: number }> }
): Promise<void> {
  try {
    if (!webOrderId) return

    const url = `${ERP_BASE_URL}/api/web-orders/${webOrderId}/refund`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (WEBHOOK_SECRET) {
      headers['x-webhook-secret'] = WEBHOOK_SECRET
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(refundData || {}),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (response.ok) {
      const data = await response.json()
      console.log(`[ERP Refund] Pedido ${webOrderId}: reembolsado (NC=${data.creditNoteNumber || 'N/A'}, amount=${data.refundAmount})`)
    } else {
      const errorText = await response.text().catch(() => 'unknown')
      console.error(`[ERP Refund] Error reembolsando pedido ${webOrderId}: ${response.status} ${errorText}`)
    }
  } catch (error) {
    // No bloquear el webhook si el ERP no responde
    console.error(`[ERP Refund] Error de red reembolsando pedido ${webOrderId}:`, error)
  }
}
