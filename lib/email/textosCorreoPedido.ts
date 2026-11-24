/**
 * Textos de los correos del pedido: compra pendiente, «Termina tu pago» y el párrafo de
 * «Recibimos tu pedido».
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

/**
 * Párrafo y botón de «Recibimos tu pedido» (al crear el pedido).
 *
 * Antes decía «llegó al restaurante» en todas las tiendas. Ahora:
 * - pago por pasarela aún sin completar: dice que falta el pago, y el botón lleva a pagarlo;
 * - restaurante (`organizations.type_id = 1`): el texto de siempre;
 * - cualquier otra tienda, o sin saber el tipo: recibido y en revisión.
 */
export function textosCorreoRecibido(entrada: {
  orderNumber: string
  esRestaurante?: boolean | null
  faltaPagoEnLinea?: boolean | null
}): { mensajeHtml: string; boton: string } {
  const numero = `<strong>${escapeHtml(entrada.orderNumber || '')}</strong>`
  if (entrada.faltaPagoEnLinea) {
    return {
      mensajeHtml: `Recibimos tu pedido ${numero}, pero aún falta tu pago. Cuando se complete, ${entrada.esRestaurante ? 'el restaurante lo confirma' : 'lo confirmamos'}. Si no terminaste de pagar, puedes hacerlo desde el botón de abajo.`,
      boton: 'Ver mi pedido y pagar',
    }
  }
  if (entrada.esRestaurante) {
    return {
      mensajeHtml: `Tu pedido ${numero} llegó al restaurante. Te avisaremos cuando lo confirmen.`,
      boton: 'Seguir mi pedido',
    }
  }
  return {
    mensajeHtml: `Recibimos tu pedido ${numero} y lo estamos revisando. Te avisamos cuando lo confirmemos.`,
    boton: 'Seguir mi pedido',
  }
}

/** «hasta las 7:30 p. m.», «hasta la 1:15 p. m.», «hasta el 25 nov · 9:00 a. m.». */
function hastaCuando(hasta: string, mismoDia: boolean): string {
  const limpio = escapeHtml(nombrePlano(hasta))
  if (!mismoDia) return `hasta el <strong>${limpio}</strong>`
  return `${/^1:/.test(limpio) ? 'hasta la' : 'hasta las'} <strong>${limpio}</strong>`
}

/**
 * Correo «Termina tu pago»: el pedido por pasarela sigue sin pagar y aún no vence.
 * `hasta` ya viene formateado en la zona de la sede (la hora si vence hoy; si no, fecha y hora).
 */
export function textosCorreoRecordatorioPago(entrada: {
  orderNumber: string
  nombreTienda: string
  total: number
  hasta: string
  mismoDia: boolean
  esRestaurante?: boolean | null
}): TextosCorreoCompraPendiente {
  const nombre = nombrePlano(entrada.nombreTienda || '')
  const numeroPlano = nombrePlano(entrada.orderNumber || '')
  const total = Number.isFinite(entrada.total) ? entrada.total : 0
  const apartado = entrada.esRestaurante ? 'Guardamos tu pedido' : 'Apartamos tus productos'
  const plazo = entrada.hasta && entrada.hasta.trim()
    ? ` ${apartado} ${hastaCuando(entrada.hasta, entrada.mismoDia)}; si no se paga a tiempo, el pedido se cancela.`
    : ''
  const asuntoBase = numeroPlano ? `Termina tu pago del pedido ${numeroPlano}` : 'Termina tu pago'
  return {
    titulo: 'Termina tu pago',
    mensajeHtml: `Tu pedido <strong>${escapeHtml(numeroPlano)}</strong> por <strong>$${total.toLocaleString('es-CO')}</strong> está esperando tu pago.${plazo}`,
    boton: 'Pagar ahora',
    asunto: nombre ? `${asuntoBase} — ${nombre}` : asuntoBase,
  }
}
