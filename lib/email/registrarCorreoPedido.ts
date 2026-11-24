/**
 * Deja constancia de cada correo de pedido. El fallo del registro no
 * deshace un envío que ya salió, ni reintenta uno que ya se mandó.
 */

/**
 * `recordatorio_pago` («Termina tu pago») necesita que la base lo admita en
 * `web_order_email_log_tipo_check`. Mientras no, `reclamarCorreoPedido` devuelve el 23514 y el
 * recordatorio no sale (falla cerrado: sin registro no hay forma de no repetirlo).
 */
export type TipoCorreoPedido = 'pedido_pagado' | 'compra_pendiente' | 'recordatorio_pago'
export type EstadoCorreoPedido = 'enviado' | 'omitido' | 'error'

type Cliente = { from: (tabla: string) => any }

export async function registrarCorreoPedido(
  sb: Cliente,
  entrada: {
    webOrderId: string
    organizationId: number
    email: string
    tipo: TipoCorreoPedido
    resendId: string | null
    estado: EstadoCorreoPedido
    error: string | null
  },
): Promise<void> {
  const email = entrada.email.trim().toLowerCase()
  if (!email || !entrada.webOrderId || !Number.isInteger(entrada.organizationId)) return
  const error = entrada.error ? entrada.error.replace(/[\r\n]/g, ' ').trim().slice(0, 500) : null
  const { error: fallo } = await sb.from('web_order_email_log').insert({
    web_order_id: entrada.webOrderId,
    organization_id: entrada.organizationId,
    email,
    tipo: entrada.tipo,
    resend_id: entrada.resendId,
    estado: entrada.estado,
    error,
  })
  if (fallo) {
    console.error('[correo-pedido] No se pudo registrar el envío', {
      webOrderId: entrada.webOrderId,
      organizationId: entrada.organizationId,
      estado: entrada.estado,
      error: fallo.message,
    })
  }
}

export type ResultadoReclamo =
  | { ok: true; id: string; createdAt: string | null }
  | { ok: false; codigo: string | null; mensaje: string }

/**
 * Reclama el envío ANTES de mandarlo: deja la fila con `estado = 'omitido'` y `error = 'en curso'`,
 * y `cerrarCorreoPedido` la pone en `enviado` o `error` al terminar. Si el proceso muere en medio,
 * la fila queda y el correo no se repite (un recordatorio perdido es mejor que dos).
 */
export async function reclamarCorreoPedido(
  sb: Cliente,
  entrada: { webOrderId: string; organizationId: number; email: string; tipo: TipoCorreoPedido },
): Promise<ResultadoReclamo> {
  const email = entrada.email.trim().toLowerCase()
  if (!email || !entrada.webOrderId || !Number.isInteger(entrada.organizationId)) {
    return { ok: false, codigo: null, mensaje: 'datos incompletos' }
  }
  const { data, error } = await sb
    .from('web_order_email_log')
    .insert({
      web_order_id: entrada.webOrderId,
      organization_id: entrada.organizationId,
      email,
      tipo: entrada.tipo,
      resend_id: null,
      estado: 'omitido',
      error: 'en curso',
    })
    .select('id, created_at')
    .single()
  if (error || !data?.id) {
    const codigo = typeof error?.code === 'string' ? error.code : null
    return { ok: false, codigo, mensaje: String(error?.message || 'sin fila') }
  }
  return { ok: true, id: String(data.id), createdAt: data.created_at ?? null }
}

/** Cierra la fila reclamada con lo que pasó. */
export async function cerrarCorreoPedido(
  sb: Cliente,
  id: string,
  entrada: { estado: EstadoCorreoPedido; resendId: string | null; error: string | null },
): Promise<void> {
  const error = entrada.error ? entrada.error.replace(/[\r\n]/g, ' ').trim().slice(0, 500) : null
  const { error: fallo } = await sb
    .from('web_order_email_log')
    .update({ estado: entrada.estado, resend_id: entrada.resendId, error })
    .eq('id', id)
  if (fallo) console.error('[correo-pedido] No se pudo cerrar el registro', { id, estado: entrada.estado, error: fallo.message })
}
