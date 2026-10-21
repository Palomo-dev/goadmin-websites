/**
 * Cola del correo «Tu compra quedó pendiente».
 *
 * La dispara solo pg_cron, cada 15 minutos, contra el proyecto que tiene la
 * clave de servicio. No la reclama el cron de cada minuto ni el otro proyecto
 * de Vercel: los dos compartirían el mismo `vercel.json` y duplicarían el envío.
 * `fn_reclamar_cola_compra_pendiente` bloquea la fila (`FOR UPDATE SKIP LOCKED`),
 * escribe un solo correo por comprador y tienda cada 24 horas, y solo por el
 * pedido más reciente. El sello se quita si el envío falla.
 *
 * La elegibilidad (source = 'website', expirado por falta de pago, sin
 * cancelación manual) vive en esa función. Si falta, no se vuelve al select
 * anterior: dos pedidos del mismo correo volverían a salir.
 *
 * Si falta la clave del correo (ni en el despliegue ni en el vault), no se
 * reclama nada: el siguiente ciclo lo reintenta.
 */

import { claveResend } from '@/lib/orders/claveResend'
import { enviarCorreoCompraPendiente } from '@/lib/orders/correoCompraPendiente'
import { ESPERA_COMPRA_PENDIENTE_MS, VENTANA_COMPRA_PENDIENTE_MS } from '@/lib/orders/compraPendiente'

export class ErrorReclamoCola extends Error {
  readonly sqlstate: string | null
  readonly mensajePostgres: string

  constructor(sqlstate: string | null, mensajePostgres: string) {
    super('No se pudo reclamar la cola')
    this.name = 'ErrorReclamoCola'
    this.sqlstate = sqlstate
    this.mensajePostgres = mensajePostgres
  }
}

function detallePostgres(error: { message?: string; code?: string } | null): { sqlstate: string | null; mensaje: string } {
  const mensaje = typeof error?.message === 'string' && error.message.trim() ? error.message.trim() : 'sin mensaje'
  const code = typeof error?.code === 'string' ? error.code.trim() : ''
  const sqlstate = /^[0-9A-Z]{5}$/.test(code) ? code : null
  return { sqlstate, mensaje }
}

const LOTE = 20

interface FilaReclamada {
  web_order_id: string
  organization_id: number
  sello: string
  accion: string
}

export interface ResultadoColaCompraPendiente {
  revisados: number
  enviados: number
  omitidos: number
  reintentos: number
  /** `sin_resend`: no hay clave; no se tocó la cola. */
  motivo?: 'sin_resend'
}

type ClienteCola = {
  from: (tabla: string) => any
  rpc: (nombre: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }>
}

type ClienteRecibido = { from: (tabla: string) => any }

async function quitarSello(sb: ClienteCola, id: string, sello: string): Promise<void> {
  const { error } = await sb
    .from('web_orders')
    .update({ abandoned_email_sent_at: null })
    .eq('id', id)
    .eq('abandoned_email_sent_at', sello)
  if (error) console.error('[carritos-abandonados] No se pudo quitar el sello', { id, error: error.message })
}

export async function procesarColaCompraPendiente(supabase: ClienteRecibido): Promise<ResultadoColaCompraPendiente> {
  const sb = supabase as ClienteCola
  const apiKey = await claveResend(supabase)
  if (!apiKey) {
    console.error('[carritos-abandonados] Falta la clave de envío')
    return { revisados: 0, enviados: 0, omitidos: 0, reintentos: 0, motivo: 'sin_resend' }
  }
  const ahora = new Date()
  const hasta = new Date(ahora.getTime() - ESPERA_COMPRA_PENDIENTE_MS).toISOString()
  const desde = new Date(ahora.getTime() - VENTANA_COMPRA_PENDIENTE_MS).toISOString()
  const { data, error } = await sb.rpc('fn_reclamar_cola_compra_pendiente', {
    p_desde: desde,
    p_hasta: hasta,
    p_lote: LOTE,
  })
  if (error) {
    const detalle = detallePostgres(error)
    console.error('[carritos-abandonados] No se pudo reclamar la cola', {
      sqlstate: detalle.sqlstate,
      mensajePostgres: detalle.mensaje,
    })
    throw new ErrorReclamoCola(detalle.sqlstate, detalle.mensaje)
  }

  const filas = (Array.isArray(data) ? data : []) as FilaReclamada[]
  const resultado: ResultadoColaCompraPendiente = { revisados: filas.length, enviados: 0, omitidos: 0, reintentos: 0 }
  for (const fila of filas) {
    if (fila.accion !== 'enviar') {
      resultado.omitidos += 1
      continue
    }
    const envio = await enviarCorreoCompraPendiente(fila.web_order_id)
    if (envio.accion === 'enviado') {
      resultado.enviados += 1
    } else if (envio.accion === 'omitido') {
      resultado.omitidos += 1
    } else {
      await quitarSello(sb, fila.web_order_id, fila.sello)
      resultado.reintentos += 1
    }
  }
  return resultado
}
