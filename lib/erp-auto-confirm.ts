/**
 * Helper para llamar al endpoint de auto-confirmación del ERP
 * cuando un pedido web es pagado.
 *
 * El ERP crea automáticamente: venta, factura, cuenta por cobrar,
 * descuento de stock y envío.
 */

const ERP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.goadmin.io'
const WEBHOOK_SECRET = process.env.CRON_SECRET || ''

/**
 * Notifica al ERP que un pedido web fue pagado para que cree
 * automáticamente la venta, factura, cuenta por cobrar, descuento
 * de stock y envío.
 *
 * Es fire-and-forget: no bloquea el webhook si falla.
 */
export async function notifyErpAutoConfirm(webOrderId: string): Promise<void> {
  try {
    if (!webOrderId) return

    const url = `${ERP_BASE_URL}/api/web-orders/${webOrderId}/auto-confirm`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (WEBHOOK_SECRET) {
      headers['x-webhook-secret'] = WEBHOOK_SECRET
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (response.ok) {
      const data = await response.json()
      console.log(`[ERP Auto-Confirm] Pedido ${webOrderId} confirmado: sale=${data.saleId}, invoice=${data.invoiceNumber || 'N/A'}`)
    } else {
      const errorText = await response.text().catch(() => 'unknown')
      console.error(`[ERP Auto-Confirm] Error confirmando pedido ${webOrderId}: ${response.status} ${errorText}`)
    }
  } catch (error) {
    // No bloquear el webhook si el ERP no responde
    console.error(`[ERP Auto-Confirm] Error de red confirmando pedido ${webOrderId}:`, error)
  }
}
