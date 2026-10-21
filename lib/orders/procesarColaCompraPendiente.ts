/**
 * Cola del correo «Tu compra quedó pendiente».
 *
 * La leen el cron de cada 15 minutos y el de cada minuto que vacía la
 * bandeja de publicación. pg_cron ya no dispara esta ruta. Los dos horarios
 * de Vercel reclaman con `fn_reclamar_cola_compra_pendiente`: la base bloquea
 * la fila (`FOR UPDATE SKIP LOCKED`), escribe un solo correo por comprador y
 * tienda cada 24 horas, y solo por el pedido más reciente. El sello se quita
 * si el envío falla, para que el siguiente ciclo lo reintente.
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
  rpc: (nombre: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>
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
    console.error('[carritos-abandonados] No se pudo reclamar la cola', error.message || error)
    throw new Error('No se pudo reclamar la cola')
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
