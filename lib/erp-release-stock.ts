/**
 * Helper para llamar al endpoint del ERP que libera la reserva de stock
 * cuando un pedido web es cancelado (pago fallido, expiración, etc.).
 *
 * Es fire-and-forget: no bloquea el webhook si falla.
 */

const ERP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.goadmin.io'
const WEBHOOK_SECRET = process.env.CRON_SECRET || ''

/**
 * Notifica al ERP que libere el stock reservado de un pedido web.
 * El ERP decrementa qty_reserved en stock_levels de forma atómica e idempotente.
 */
export async function notifyErpReleaseStock(webOrderId: string): Promise<void> {
  try {
    if (!webOrderId) return

    const url = `${ERP_BASE_URL}/api/web-orders/${webOrderId}/release-stock`

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
      console.log(`[ERP Release Stock] Pedido ${webOrderId}: stock liberado (items=${data.itemsReleased || 0}, already=${data.alreadyReleased || false})`)
    } else {
      const errorText = await response.text().catch(() => 'unknown')
      console.error(`[ERP Release Stock] Error liberando pedido ${webOrderId}: ${response.status} ${errorText}`)
    }
  } catch (error) {
    // No bloquear el webhook si el ERP no responde
    console.error(`[ERP Release Stock] Error de red liberando pedido ${webOrderId}:`, error)
  }
}
