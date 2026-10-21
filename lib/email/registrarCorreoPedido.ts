/**
 * Deja constancia de cada correo de pedido. El fallo del registro no
 * deshace un envío que ya salió, ni reintenta uno que ya se mandó.
 */

export type TipoCorreoPedido = 'pedido_pagado' | 'compra_pendiente'
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
