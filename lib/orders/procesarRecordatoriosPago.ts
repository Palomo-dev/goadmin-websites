/**
 * Corrida del recordatorio «Termina tu pago» (cron `/api/cron/recordatorio-pago`, cada 5 minutos).
 *
 * 1. Una consulta: los pedidos del sitio de las últimas 6 horas (todos los estados, hasta 500),
 *    con sus filas `recordatorio_pago` de `web_order_email_log` embebidas y el anticipo de la
 *    contraentrega (`advance_status`, `advance_due_at`): esos no necesitan las consultas del paso 2.
 * 2. Filtro puro (`motivoPrevio`) y, solo para los pares organización + método que quedan, el
 *    plazo (`fn_web_order_plazo_minutos`, el mismo del vencimiento) y si el método es nativo
 *    (`fn_web_order_metodo_nativo`): consultas por par, no por pedido.
 * 3. Plan puro (`planRecordatorios`): uno por pedido, el más reciente del comprador, tope 20.
 * 4. Por cada uno: reclama la fila del registro, comprueba que ganó el reclamo, envía y cierra.
 *
 * Si la base aún no admite el tipo `recordatorio_pago` (CHECK, SQLSTATE 23514) se corta la
 * corrida sin enviar nada: sin registro no hay forma de no repetir el correo cada 5 minutos.
 */

import { reclamarCorreoPedido, cerrarCorreoPedido } from '@/lib/email/registrarCorreoPedido'
import { claveResend } from '@/lib/orders/claveResend'
import { enviarRecordatorioPago } from '@/lib/orders/correoRecordatorioPago'
import {
  FILAS_RECORDATORIO,
  TIPO_RECORDATORIO_PAGO,
  VENTANA_RECORDATORIO_MS,
  clavePar,
  ganaReclamo,
  paresPorConsultar,
  planRecordatorios,
  type ContextoMetodo,
  type PedidoRecordatorio,
} from '@/lib/orders/recordatorioPago'

type Cliente = {
  from: (tabla: string) => any
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>
}

/** Más pares que esto en una corrida esperan a la siguiente (cada par son dos consultas). */
const MAX_PARES = 40

export interface ResultadoRecordatorios {
  revisados: number
  candidatos: number
  enviados: number
  omitidos: number
  errores: number
  /** `sin_resend`: no hay clave. `tipo_no_admitido`: falta la migración del CHECK. */
  motivo?: 'sin_resend' | 'tipo_no_admitido'
}

export class ErrorLecturaRecordatorios extends Error {
  readonly mensajePostgres: string
  constructor(mensajePostgres: string) {
    super('No se pudieron leer los pedidos')
    this.name = 'ErrorLecturaRecordatorios'
    this.mensajePostgres = mensajePostgres
  }
}

function aPedido(fila: any): PedidoRecordatorio {
  const registros = Array.isArray(fila.web_order_email_log) ? fila.web_order_email_log : []
  return {
    id: String(fila.id),
    organizationId: Number(fila.organization_id),
    status: String(fila.status || ''),
    paymentStatus: fila.payment_status ?? null,
    paymentMethod: fila.payment_method ?? null,
    source: fila.source ?? null,
    email: fila.customer_email ?? null,
    deliveryType: fila.delivery_type ?? null,
    restaurantTableId: fila.restaurant_table_id ?? null,
    notasInternas: fila.internal_notes ?? null,
    createdAt: fila.created_at ?? null,
    stockReleasedAt: fila.stock_released_at ?? null,
    anticipoEstado: fila.advance_status ?? null,
    anticipoVence: fila.advance_due_at ?? null,
    recordatorios: registros
      .filter((r: any) => r?.tipo === TIPO_RECORDATORIO_PAGO)
      .map((r: any) => ({ createdAt: r.created_at ?? null })),
  }
}

async function contextoDePar(sb: Cliente, organizationId: number, metodo: string): Promise<ContextoMetodo> {
  const [nativo, plazo] = await Promise.all([
    sb.rpc('fn_web_order_metodo_nativo', { p_organization_id: organizationId, p_metodo: metodo }),
    sb.rpc('fn_web_order_plazo_minutos', { p_organization_id: organizationId, p_payment_method: metodo, p_por_defecto: 30 }),
  ])
  if (nativo.error) console.error('[recordatorio-pago] fn_web_order_metodo_nativo falló', { organizationId, error: nativo.error.message })
  if (plazo.error) console.error('[recordatorio-pago] fn_web_order_plazo_minutos falló', { organizationId, error: plazo.error.message })
  return {
    nativo: !nativo.error && typeof nativo.data === 'boolean' ? nativo.data : null,
    plazoMinutos: !plazo.error && typeof plazo.data === 'number' ? plazo.data : null,
  }
}

export async function procesarRecordatoriosPago(supabase: object): Promise<ResultadoRecordatorios> {
  const sb = supabase as Cliente
  const resultado: ResultadoRecordatorios = { revisados: 0, candidatos: 0, enviados: 0, omitidos: 0, errores: 0 }
  const apiKey = await claveResend(supabase)
  if (!apiKey) {
    console.error('[recordatorio-pago] Falta la clave de envío')
    return { ...resultado, motivo: 'sin_resend' }
  }

  const ahora = new Date()
  const desde = new Date(ahora.getTime() - VENTANA_RECORDATORIO_MS).toISOString()
  const hasta = new Date(ahora.getTime() - 60_000).toISOString()
  const { data, error } = await sb
    .from('web_orders')
    .select('id, organization_id, status, payment_status, payment_method, source, customer_email, delivery_type, restaurant_table_id, internal_notes, created_at, stock_released_at, advance_status, advance_due_at, web_order_email_log ( tipo, created_at )')
    .eq('source', 'website')
    .gte('created_at', desde)
    .lte('created_at', hasta)
    .eq('web_order_email_log.tipo', TIPO_RECORDATORIO_PAGO)
    .order('created_at', { ascending: false })
    .limit(FILAS_RECORDATORIO)
  if (error) {
    console.error('[recordatorio-pago] No se pudieron leer los pedidos', { error: error.message })
    throw new ErrorLecturaRecordatorios(String(error.message || 'sin mensaje'))
  }
  const pedidos = (Array.isArray(data) ? data : []).map(aPedido)
  resultado.revisados = pedidos.length

  const pares = paresPorConsultar(pedidos, ahora).slice(0, MAX_PARES)
  const contextos = new Map<string, ContextoMetodo>()
  const respuestas = await Promise.all(pares.map((p) => contextoDePar(sb, p.organizationId, p.metodo)))
  pares.forEach((p, i) => contextos.set(clavePar(p.organizationId, p.metodo), respuestas[i]))

  const plan = planRecordatorios(pedidos, ahora, contextos)
  resultado.candidatos = plan.enviar.length
  const porId = new Map(pedidos.map((p) => [p.id, p]))

  for (const { id, plazoMinutos } of plan.enviar) {
    const pedido = porId.get(id)
    if (!pedido?.email) continue
    const reclamo = await reclamarCorreoPedido(sb, {
      webOrderId: id,
      organizationId: pedido.organizationId,
      email: pedido.email,
      tipo: TIPO_RECORDATORIO_PAGO,
    })
    if (!reclamo.ok) {
      if (reclamo.codigo === '23514') {
        console.error('[recordatorio-pago] La base aún no admite el tipo recordatorio_pago: no se envía nada')
        return { ...resultado, motivo: 'tipo_no_admitido' }
      }
      if (reclamo.codigo === '23505') {
        resultado.omitidos += 1 // otra corrida ya lo reclamó (índice único)
        continue
      }
      console.error('[recordatorio-pago] No se pudo reclamar el envío', { id, codigo: reclamo.codigo, error: reclamo.mensaje })
      resultado.errores += 1
      continue
    }
    const { data: filas, error: errorFilas } = await sb
      .from('web_order_email_log')
      .select('id, created_at')
      .eq('web_order_id', id)
      .eq('tipo', TIPO_RECORDATORIO_PAGO)
    const reclamos = (Array.isArray(filas) ? filas : []).map((f: any) => ({ id: String(f.id), createdAt: f.created_at ?? null }))
    if (errorFilas || !ganaReclamo(reclamos, reclamo.id)) {
      await cerrarCorreoPedido(sb, reclamo.id, { estado: 'omitido', resendId: null, error: errorFilas ? 'no se pudo comprobar el reclamo' : 'duplicado' })
      resultado.omitidos += 1
      continue
    }
    const envio = await enviarRecordatorioPago(sb, { webOrderId: id, plazoMinutos, reclamoId: reclamo.id, apiKey })
    if (envio === 'enviado') resultado.enviados += 1
    else if (envio === 'omitido') resultado.omitidos += 1
    else resultado.errores += 1
  }
  return resultado
}
