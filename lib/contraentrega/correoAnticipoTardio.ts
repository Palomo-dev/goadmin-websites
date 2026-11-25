/**
 * Correo al comprador cuando su anticipo llegó con el pedido VENCIDO (Figma «05 POS y ventas»
 * 3181-202769 › 11a «Tu pedido sigue en pie» y 12a «Recibimos tu pago, lo estamos revisando»).
 *
 * Con la marca de la tienda: nombre, logo y color (`cargarMarcaPedido` + `sobreCorreoPedido`), From
 * del dominio verificado de la tienda o el respaldo sin marca de la plataforma
 * (`lib/email/remitenteRespaldo.ts`), clave de envío del vault (`claveResend`). Una vez por pedido y
 * tipo: queda en `web_order_notices` (momento `anticipo_reactivado` / `anticipo_revisando`, canal
 * correo), el mismo historial de avisos que lee el ERP. Nunca lanza.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { cargarMarcaPedido } from '@/lib/email/cargarMarcaPedido'
import { sobreCorreoPedido } from '@/lib/email/marcaCorreoPedido'
import { correoRespaldoTiendas } from '@/lib/email/remitenteRespaldo'
import { claveResend } from '@/lib/orders/claveResend'
import { origenSitio } from '@/lib/orders/cargarOrigenSitio'
import { rutaSeguimiento } from '@/lib/orders/tokenSeguimiento'
import { ZONA_POR_DEFECTO } from '@/lib/restaurant/horario'
import { diaPedido, horaPedido } from '@/lib/restaurant/ventanaPedido'
import { cobroEnPuerta } from './reglaContraentrega'
import { armarCorreoAnticipoTardio, type CorreoAnticipoTardio } from './anticipoTardio'

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const pesos = (n: number): string => `$ ${Math.round(n).toLocaleString('es-CO')}`

function aprox(iso: string | null | undefined, zona: string): string | null {
  if (!iso) return null
  const hora = horaPedido(iso, zona)
  if (!hora) return null
  const dia = diaPedido(iso, zona)
  return `${dia === 'Hoy' ? 'hoy' : dia ? dia.toLowerCase() : ''} alrededor de las ${hora}`.trim()
}

const MOMENTO: Record<CorreoAnticipoTardio, string> = {
  reactivado: 'anticipo_reactivado',
  revisando: 'anticipo_revisando',
}

export async function enviarCorreoAnticipoTardio(webOrderId: string, tipo: CorreoAnticipoTardio): Promise<void> {
  try {
    const supabase = createAdminClient()
    if (!supabase) return
    const sb = supabase as any
    const { data: pedido, error } = await sb
      .from('web_orders')
      .select('id, order_number, organization_id, branch_id, customer_email, customer_name, total, advance_amount, advance_status, advance_due_at, estimated_ready_at, estimated_delivery_at, delivery_type, web_order_items ( product_name, quantity )')
      .eq('id', webOrderId)
      .maybeSingle()
    if (error) console.error('[Anticipo] No se pudo leer el pedido', { webOrderId, error: error.message })
    if (error || !pedido?.customer_email || pedido.advance_status !== 'paid') return
    const organizationId = Number(pedido.organization_id)
    const momento = MOMENTO[tipo]

    // Una vez por pedido y tipo (los webhooks se reintentan).
    const { data: previos } = await sb
      .from('web_order_notices')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('web_order_id', webOrderId)
      .eq('moment', momento)
      .eq('channel', 'email')
      .in('status', ['queued', 'sent', 'delivered'])
      .limit(1)
    if (Array.isArray(previos) && previos.length > 0) return

    const apiKey = await claveResend(sb)
    if (!apiKey) {
      console.error('[Anticipo] Falta la clave de envío: correo sin enviar', { webOrderId })
      return
    }
    const [{ data: org }, { data: sede }, { data: pago }] = await Promise.all([
      sb.from('organizations').select('name, timezone').eq('id', organizationId).maybeSingle(),
      pedido.branch_id
        ? sb.from('branches').select('name, address, timezone').eq('id', pedido.branch_id).eq('organization_id', organizationId).maybeSingle()
        : Promise.resolve({ data: null }),
      sb.from('payments')
        .select('created_at')
        .eq('organization_id', organizationId)
        .eq('source', 'web_order')
        .eq('source_id', webOrderId)
        .eq('status', 'completed')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ])
    const zona: string = sede?.timezone || org?.timezone || ZONA_POR_DEFECTO
    const marca = await cargarMarcaPedido(sb, organizationId, pedido.branch_id ?? null)
    const sobre = sobreCorreoPedido({
      nombre: marca.nombre || org?.name || '',
      correoTienda: marca.correo,
      logoUrl: marca.logoUrl,
      color: marca.color,
      dominios: marca.dominios,
      respaldo: correoRespaldoTiendas(),
    })
    const origen = await origenSitio(sb, organizationId)
    const lineas = (Array.isArray(pedido.web_order_items) ? pedido.web_order_items : [])
      .map((i: { product_name?: string; quantity?: number }) => `${num(i.quantity)} × ${i.product_name ?? ''}`.trim())
      .join(' · ')
    const correo = armarCorreoAnticipoTardio(tipo, {
      nombreCliente: pedido.customer_name || '',
      numeroPedido: pedido.order_number,
      anticipo: pesos(num(pedido.advance_amount)),
      alRecibir: pesos(cobroEnPuerta(pedido.total, { monto: pedido.advance_amount, estado: 'paid' })),
      horaPago: horaPedido(pago?.created_at ?? new Date().toISOString(), zona),
      horaVencio: pedido.advance_due_at ? horaPedido(pedido.advance_due_at, zona) : null,
      listoAprox: aprox(pedido.estimated_ready_at, zona),
      entregaAprox: pedido.delivery_type && pedido.delivery_type !== 'pickup' ? aprox(pedido.estimated_delivery_at, zona) : null,
      lineas: lineas || null,
      urlPedido: origen ? `${origen}${rutaSeguimiento(organizationId, pedido)}` : null,
      pie: [sobre.nombre, sede?.name, sede?.address].filter(Boolean).join(' · '),
    }, sobre)

    let ok = false
    let idProveedor: string | null = null
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          from: sobre.from,
          to: [pedido.customer_email],
          ...(sobre.replyTo ? { reply_to: sobre.replyTo } : {}),
          subject: correo.asunto,
          html: correo.html,
          text: correo.texto,
        }),
      })
      ok = res.ok
      const cuerpo = (await res.json().catch(() => null)) as { id?: unknown } | null
      idProveedor = typeof cuerpo?.id === 'string' ? cuerpo.id : null
      if (!ok) console.error('[Anticipo] Resend no envió el correo del anticipo tardío', { webOrderId, status: res.status })
    } catch {
      console.error('[Anticipo] Error enviando el correo del anticipo tardío', { webOrderId })
    }
    const { error: fallo } = await sb.from('web_order_notices').insert({
      organization_id: organizationId,
      web_order_id: webOrderId,
      moment: momento,
      channel: 'email',
      status: ok ? 'sent' : 'failed',
      recipient: pedido.customer_email,
      provider_message_id: idProveedor,
      detail: ok ? null : 'no se pudo enviar',
    })
    if (fallo) console.error('[Anticipo] No se pudo registrar el aviso', { webOrderId, error: fallo.message })
  } catch (err) {
    console.error('[Anticipo] Error con el correo del anticipo tardío', { webOrderId, err })
  }
}
