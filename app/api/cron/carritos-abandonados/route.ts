import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { enviarCorreoCompraPendiente } from '@/lib/orders/correoCompraPendiente'
import {
  ESPERA_COMPRA_PENDIENTE_MS,
  MOTIVOS_SELLADOS,
  VENTANA_COMPRA_PENDIENTE_MS,
  motivoNoEscribir,
  type FilaMetodoPago,
  type PagoPosterior,
  type PedidoPendiente,
} from '@/lib/orders/compraPendiente'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Un correo por pedido, unas dos horas después de quedar cancelado o expirado.
 *
 * Solo entra lo de las últimas 48 horas: la primera ejecución no escribe pedidos
 * viejos. Quien no califica (sin correo, pago en efectivo, mesa, ya pagó después)
 * queda sellado para no reevaluarlo. Si el envío falla, se quita el sello y el
 * siguiente ciclo lo reintenta, mientras siga en la ventana.
 *
 * Autenticación igual que `/api/revalidate/sitios-v2`: falla cerrado sin
 * CRON_SECRET. Vercel Cron llama con GET y `Authorization: Bearer`.
 */
const LOTE = 20
const TOPE_PAGOS = 1000

function secretoValido(request: NextRequest): boolean {
  const esperado = process.env.CRON_SECRET
  if (!esperado) return false
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null
  const recibido = request.headers.get('x-webhook-secret') ?? bearer
  if (!recibido) return false
  const a = Buffer.from(recibido)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

interface FilaPedido {
  id: string
  organization_id: number
  status: string
  source: string | null
  payment_status: string | null
  payment_method: string | null
  customer_email: string | null
  delivery_type: string | null
  restaurant_table_id: string | null
  internal_notes: string | null
  cancelled_at: string | null
  created_at: string | null
  abandoned_email_sent_at: string | null
}

function aPedido(fila: FilaPedido): PedidoPendiente {
  return {
    id: fila.id,
    organizationId: fila.organization_id,
    status: fila.status,
    paymentStatus: fila.payment_status,
    paymentMethod: fila.payment_method,
    source: fila.source,
    email: fila.customer_email,
    deliveryType: fila.delivery_type,
    restaurantTableId: fila.restaurant_table_id,
    notasInternas: fila.internal_notes,
    cancelledAt: fila.cancelled_at,
    createdAt: fila.created_at,
    yaEnviado: fila.abandoned_email_sent_at != null,
  }
}

async function sellar(sb: any, id: string, sello: string): Promise<boolean> {
  const { data, error } = await sb
    .from('web_orders')
    .update({ abandoned_email_sent_at: sello })
    .eq('id', id)
    .is('abandoned_email_sent_at', null)
    .select('id')
  if (error) {
    console.error('[carritos-abandonados] No se pudo sellar el pedido', { id, error: error.message })
    return false
  }
  return Array.isArray(data) && data.length > 0
}

async function quitarSello(sb: any, id: string, sello: string): Promise<void> {
  const { error } = await sb
    .from('web_orders')
    .update({ abandoned_email_sent_at: null })
    .eq('id', id)
    .eq('abandoned_email_sent_at', sello)
  if (error) console.error('[carritos-abandonados] No se pudo quitar el sello', { id, error: error.message })
}

async function procesar(request: NextRequest) {
  if (!secretoValido(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!process.env.RESEND_API_KEY) {
    console.error('[carritos-abandonados] Falta RESEND_API_KEY')
    return NextResponse.json({ error: 'Servicio no configurado' }, { status: 500 })
  }
  const supabase = createAdminClient()
  if (!supabase) {
    console.error('[carritos-abandonados] Sin SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.json({ error: 'Servicio no configurado' }, { status: 500 })
  }
  const sb = supabase as any
  const ahora = new Date()
  const hasta = new Date(ahora.getTime() - ESPERA_COMPRA_PENDIENTE_MS).toISOString()
  const desde = new Date(ahora.getTime() - VENTANA_COMPRA_PENDIENTE_MS).toISOString()
  const { data, error } = await sb
    .from('web_orders')
    .select('id, organization_id, status, source, payment_status, payment_method, customer_email, delivery_type, restaurant_table_id, internal_notes, cancelled_at, created_at, abandoned_email_sent_at')
    .in('status', ['expired', 'cancelled'])
    .eq('payment_status', 'failed')
    .eq('source', 'website')
    .is('abandoned_email_sent_at', null)
    .lte('cancelled_at', hasta)
    .gte('cancelled_at', desde)
    .order('cancelled_at', { ascending: true })
    .limit(LOTE)
  if (error) {
    console.error('[carritos-abandonados] No se pudo leer la cola', error.message || error)
    return NextResponse.json({ error: 'No se pudo leer la cola' }, { status: 500 })
  }

  const filas = (data || []) as FilaPedido[]
  const resultado = { revisados: filas.length, enviados: 0, omitidos: 0, reintentos: 0 }
  if (filas.length === 0) return NextResponse.json({ ok: true, ...resultado })

  const orgIds = Array.from(new Set(filas.map((f) => f.organization_id)))
  const creados = filas.map((f) => f.created_at).filter((v): v is string => !!v).sort()
  const [{ data: metodos, error: errorMetodos }, { data: pagos, error: errorPagos }] = await Promise.all([
    sb
      .from('organization_payment_methods')
      .select('organization_id, payment_method_code, integration_connection_id')
      .in('organization_id', orgIds),
    creados.length === 0
      ? Promise.resolve({ data: [], error: null })
      : sb
          .from('web_orders')
          .select('id, organization_id, customer_email, created_at')
          .in('organization_id', orgIds)
          .eq('payment_status', 'paid')
          .gt('created_at', creados[0])
          .limit(TOPE_PAGOS),
  ])
  if (errorMetodos || errorPagos) {
    console.error('[carritos-abandonados] No se pudieron leer métodos o pagos posteriores', {
      metodos: errorMetodos?.message, pagos: errorPagos?.message,
    })
    return NextResponse.json({ error: 'No se pudo evaluar la cola' }, { status: 500 })
  }
  if (Array.isArray(pagos) && pagos.length >= TOPE_PAGOS) {
    console.error('[carritos-abandonados] Demasiados pagos posteriores; no se envía nada en este ciclo')
    return NextResponse.json({ ok: false, error: 'Cola de pagos incompleta' }, { status: 500 })
  }

  const filasMetodo: FilaMetodoPago[] = (metodos || []).map((m: any) => ({
    organizationId: Number(m.organization_id),
    code: String(m.payment_method_code || ''),
    sinPasarela: m.integration_connection_id == null,
  }))
  const pagosHechos: PagoPosterior[] = (pagos || []).map((p: any) => ({
    id: String(p.id),
    organizationId: Number(p.organization_id),
    email: p.customer_email ?? null,
    createdAt: p.created_at ?? null,
  }))

  for (const fila of filas) {
    const motivo = motivoNoEscribir(aPedido(fila), ahora, filasMetodo, pagosHechos)
    if (motivo) {
      if ((MOTIVOS_SELLADOS as readonly string[]).includes(motivo)) {
        const ok = await sellar(sb, fila.id, ahora.toISOString())
        if (ok) resultado.omitidos += 1
      }
      continue
    }
    const sello = new Date().toISOString()
    const reclamado = await sellar(sb, fila.id, sello)
    if (!reclamado) continue
    const enviado = await enviarCorreoCompraPendiente(fila.id)
    if (enviado) {
      resultado.enviados += 1
    } else {
      await quitarSello(sb, fila.id, sello)
      resultado.reintentos += 1
    }
  }

  return NextResponse.json({ ok: true, ...resultado })
}

export async function POST(request: NextRequest) {
  return procesar(request)
}

/** Vercel Cron invoca con GET. */
export async function GET(request: NextRequest) {
  return procesar(request)
}
