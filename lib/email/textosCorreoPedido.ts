/**
 * Textos del correo de compra pendiente.
 *
 * Mismo sobre que «Pago confirmado» (logo, color, remitente): solo cambian el
 * título, el párrafo y el botón. El número de pedido se escapa porque entra al
 * HTML; el nombre de la tienda del asunto no lleva saltos de línea.
 *
 * Puro: sin React, Next ni Supabase.
 */

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function nombrePlano(valor: string): string {
  return valor.replace(/[\r\n]/g, ' ').replace(/\s+/g, ' ').trim()
}

export interface TextosCorreoCompraPendiente {
  titulo: string
  mensajeHtml: string
  boton: string
  asunto: string
}

export function textosCorreoCompraPendiente(entrada: {
  orderNumber: string
  nombreTienda: string
}): TextosCorreoCompraPendiente {
  const nombre = nombrePlano(entrada.nombreTienda || '')
  const numero = escapeHtml(entrada.orderNumber || '')
  return {
    titulo: 'Tu compra quedó pendiente',
    mensajeHtml: `Tu pedido <strong>${numero}</strong> no se completó. Tus productos siguen disponibles.`,
    boton: 'Retomar mi compra',
    asunto: nombre ? `Tu compra quedó pendiente — ${nombre}` : 'Tu compra quedó pendiente',
  }
}
