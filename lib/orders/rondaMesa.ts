/**
 * Ronda de la Carta QR en `/api/orders` — piezas puras y la llamada al ERP.
 *
 * Una ronda pedida desde la Carta QR de una mesa es un pedido «Comer aquí» (`dine_in` con la mesa
 * validada en el servidor) con dos datos más:
 * - `dinerLabel`: el comensal que la pidió («Ana»), en `web_orders.diner_label` (migración
 *   20261007090100 del ERP). Saneado aquí y en la base (≤ 40, sin controles).
 * - Sin correo: en la mesa no se pide correo. Sin correo no se busca ni se crea ficha de cliente
 *   (antes se habría creado una ficha vacía por ronda) y no se manda el correo del pedido.
 *
 * Después de crear la ronda, `avisarErpRondaMesa` le pide al ERP que la meta sola en la cuenta de
 * la mesa y en cocina si la sede lo tiene activado (`qr_rounds_auto_confirm`) y la mesa tiene una
 * sesión abierta por el equipo. El ERP reutiliza su confirmación (agregarPedidoALaMesa →
 * pos_mesa_agregar_pedido_web con el reparto de webOrderTotals): el sitio no reparte líneas.
 */

import { sanearComensal } from '@/lib/restaurant/mesa-modelo'

/** Comensal de la ronda (solo con mesa). */
export function comensalDeRonda(dinerLabel: unknown, conMesa: boolean): string | null {
  return conMesa ? sanearComensal(dinerLabel) : null
}

/** Correo plausible del cliente del pedido. */
export function tieneCorreo(email: unknown): boolean {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/** El insert falló porque la base aún no tiene `web_orders.diner_label` (migración sin aplicar). */
export function rechazaComensal(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return (error.code === 'PGRST204' || error.code === '42703') && String(error.message || '').includes('diner_label')
}

export interface ResultadoRondaMesa {
  auto: boolean
  motivo?: string
}

const ERP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.goadmin.io'
const WEBHOOK_SECRET = process.env.CRON_SECRET || ''

/**
 * POST <ERP>/api/web-orders/<id>/mesa-ronda (x-webhook-secret). Responde
 * `{auto:true, table_session_id, kitchen_ticket_id}` o `{auto:false, motivo}` (sede_no_lo_activa,
 * mesa_sin_sesion, …). `null` si el ERP no respondió: la ronda queda para confirmar en
 * POS › Pedidos online, como hoy. Espera como máximo 6 s.
 */
export async function avisarErpRondaMesa(webOrderId: string): Promise<ResultadoRondaMesa | null> {
  if (!webOrderId || !WEBHOOK_SECRET) return null
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)
  try {
    const res = await fetch(`${ERP_BASE_URL}/api/web-orders/${encodeURIComponent(webOrderId)}/mesa-ronda`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': WEBHOOK_SECRET },
      body: JSON.stringify({}),
      signal: controller.signal,
    })
    const data = (await res.json().catch(() => null)) as { auto?: unknown; motivo?: unknown } | null
    if (!data || typeof data.auto !== 'boolean') return null
    return { auto: data.auto, ...(typeof data.motivo === 'string' ? { motivo: data.motivo } : {}) }
  } catch (err) {
    console.warn('[Orders] El ERP no respondió a la ronda de mesa', { webOrderId, error: (err as Error)?.name })
    return null
  } finally {
    clearTimeout(timeout)
  }
}
