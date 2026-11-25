/**
 * Consulta pública del pedido (`/pedido/<n>`) — reglas puras de la pantalla.
 *
 * Figma «21 Logística» › 10 (aprobado por el dueño el 2026-11-24): un solo estado arriba, en
 * palabras claras y con lo que hay que hacer; barra de 4 pasos; el nombre público de la sede o
 * nada. Puro: lo usan el servidor (`/api/orders/[id]/tracking`) y el navegador (`OrderTracker`).
 */

import { ESTADOS_SIN_ENTREGA, esComerAqui, esDomicilio } from '@/lib/orders/estados-pedido'

/** Qué se le muestra arriba al cliente. */
export type VistaPedido =
  | 'pagar' // falta el pago por pasarela y aún está apartado
  | 'pago_fallido' // la pasarela rechazó el pago; el pedido sigue apartado
  | 'vencido' // venció el plazo para pagar: se retoma en un pedido nuevo
  | 'recibido' // pendiente de confirmar, se paga al recibir o por transferencia
  | 'preparando'
  | 'listo'
  | 'en_camino'
  | 'entregado'
  | 'cancelado'

export type TonoInsignia = 'advertencia' | 'peligro' | 'exito' | 'informacion' | 'neutro'

export interface EntradaVista {
  status: string
  paymentStatus: string | null
  /** El método del pedido es una pasarela de la tienda (se puede pagar en línea). */
  esPasarela: boolean
}

export function vistaPedido({ status, paymentStatus, esPasarela }: EntradaVista): VistaPedido {
  if (status === 'expired') return 'vencido'
  if (ESTADOS_SIN_ENTREGA.has(status)) return 'cancelado'
  if (status === 'delivered') return 'entregado'
  if (status === 'in_delivery') return 'en_camino'
  if (status === 'ready') return 'listo'
  if (status === 'confirmed' || status === 'preparing') return 'preparando'
  // pending (o un estado desconocido)
  if (esPasarela && paymentStatus === 'failed') return 'pago_fallido'
  if (esPasarela && paymentStatus !== 'paid') return 'pagar'
  return 'recibido'
}

export interface Encabezado {
  insignia: string
  tono: TonoInsignia
  titulo: string
}

export interface ContextoEncabezado {
  nombre: string | null
  pagado: boolean
  deliveryType: string | null
  esRestaurante: boolean
  notasInternas?: string | null
  status: string
}

/** Insignia y título de arriba (un solo estado; nunca «Pendiente» con «Confirmado» abajo). */
export function encabezadoPedido(vista: VistaPedido, c: ContextoEncabezado): Encabezado {
  const pila = (c.nombre || '').trim().split(/\s+/)[0] || ''
  const domicilio = esDomicilio(c.deliveryType)
  const comerAqui = esComerAqui(c.deliveryType, c.notasInternas)
  switch (vista) {
    case 'pagar':
      return { insignia: 'Esperando tu pago', tono: 'advertencia', titulo: 'Falta tu pago para confirmar el pedido' }
    case 'pago_fallido':
      return { insignia: 'Pago rechazado', tono: 'peligro', titulo: 'Tu pago no pasó' }
    case 'vencido':
      return { insignia: 'Pago vencido', tono: 'neutro', titulo: 'Se venció el plazo para pagar' }
    case 'recibido':
      return { insignia: 'Pedido recibido', tono: 'informacion', titulo: pila ? `¡Gracias, ${pila}! Recibimos tu pedido` : '¡Gracias! Recibimos tu pedido' }
    case 'preparando':
      return {
        insignia: c.pagado ? 'Pago recibido' : 'Confirmado',
        tono: 'exito',
        titulo: `${pila ? `¡Gracias, ${pila}! ` : '¡Gracias! '}Estamos ${c.esRestaurante ? 'preparando' : 'alistando'} tu pedido`,
      }
    case 'listo':
      return domicilio
        ? { insignia: 'Listo para salir', tono: 'informacion', titulo: 'Tu pedido está listo para salir' }
        : { insignia: comerAqui ? 'Listo' : 'Listo para recoger', tono: 'exito', titulo: comerAqui ? 'Tu pedido está listo' : 'Ya puedes recoger tu pedido' }
    case 'en_camino':
      return { insignia: 'En camino', tono: 'informacion', titulo: 'Tu pedido va en camino' }
    case 'entregado':
      return domicilio
        ? { insignia: 'Entregado', tono: 'exito', titulo: 'Tu pedido llegó' }
        : { insignia: comerAqui ? 'Servido' : 'Recogido', tono: 'exito', titulo: comerAqui ? '¡Buen provecho!' : 'Recogiste tu pedido' }
    case 'cancelado':
      if (c.status === 'refunded') return { insignia: 'Reembolsado', tono: 'neutro', titulo: 'Te devolvimos el dinero de este pedido' }
      if (c.status === 'rejected') return { insignia: 'Rechazado', tono: 'peligro', titulo: 'La tienda no pudo tomar tu pedido' }
      return { insignia: 'Cancelado', tono: 'neutro', titulo: 'Este pedido fue cancelado' }
  }
}

export type EstadoPaso = 'hecho' | 'actual' | 'pendiente' | 'error'

export interface Paso {
  etiqueta: string
  estado: EstadoPaso
}

/** Barra de 4 pasos (en lugar de la lista vertical de 6 con emojis). */
export function pasosPedido(vista: VistaPedido, deliveryType: string | null, esRestaurante: boolean, notasInternas?: string | null): Paso[] {
  const domicilio = esDomicilio(deliveryType)
  const comerAqui = esComerAqui(deliveryType, notasInternas)
  const final = domicilio ? 'Entregado' : comerAqui ? 'Servido' : 'Recogido'
  const medio = domicilio ? 'En camino' : 'Listo'
  const preparar = esRestaurante ? 'Preparando' : 'Alistando'
  const marcar = (etiquetas: string[], hechos: number, actual: number | null, error = false): Paso[] =>
    etiquetas.map((etiqueta, i) => ({
      etiqueta,
      estado: i < hechos ? 'hecho' : i === actual ? (error ? 'error' : 'actual') : 'pendiente',
    }))
  switch (vista) {
    case 'pagar':
      return marcar(['Pago', 'Confirmado', medio, final], 0, 0)
    case 'pago_fallido':
    case 'vencido':
      return marcar(['Pago', 'Confirmado', medio, final], 0, 0, true)
    case 'recibido':
      return marcar(['Recibido', 'Confirmado', medio, final], 1, 1)
    case 'preparando':
      return marcar(['Confirmado', preparar, medio, final], 1, 1)
    case 'listo':
      // «Listo» (o «En camino» a domicilio) es el paso ACTUAL y «Recogido»/«Entregado» queda
      // pendiente. Antes, en recoger en tienda, el actual era el 4.º: «Listo» salía gris y
      // «Recogido» de color, como si ya lo hubiera recogido (probado en vivo el 2026-11-24).
      return marcar(['Confirmado', preparar, medio, final], 2, 2)
    case 'en_camino':
      return marcar(['Confirmado', preparar, medio, final], 2, 2)
    case 'entregado':
      return marcar(['Confirmado', preparar, medio, final], 4, null)
    case 'cancelado':
      return marcar(['Recibido', 'Confirmado', medio, final], 0, 0, true)
  }
}

/**
 * Motivo de cancelación que puede leer el comprador. `web_orders.cancellation_reason` lo escriben
 * los webhooks y el vencimiento con texto técnico («Pago rechazado por Bold: SALE_REJECTED»,
 * «… Mercado Pago: rejected · cc_rejected_high_risk») o el equipo de la tienda con notas internas
 * («prueba»). Al comprador nunca le llegan códigos de pasarela ni notas internas:
 * - pago rechazado (cualquier pasarela) → «El pago no fue aprobado. No se hizo ningún cobro.»
 * - vencido por falta de pago / anticipo sin pagar → la frase clara de cada uno.
 * - cualquier otro texto (escrito a mano, desconocido) → `null`: la pantalla pone su frase de
 *   siempre («No se hizo ningún cobro.» o «Si pagaste, la tienda te devuelve el dinero.»).
 * Con el pago registrado como pagado, `null` también: la frase de la devolución es la correcta.
 */
export function motivoCancelacionPublico(motivo: string | null | undefined, paymentStatus: string | null | undefined): string | null {
  const texto = (motivo ?? '').trim()
  if (!texto || paymentStatus === 'paid') return null
  if (/^pago rechazado\b/i.test(texto)) return 'El pago no fue aprobado. No se hizo ningún cobro.'
  if (/^expirado por falta de pago\b/i.test(texto)) return 'El pedido no se pagó a tiempo. No se hizo ningún cobro.'
  if (/^anticipo sin pagar\b/i.test(texto)) return 'El anticipo no se pagó a tiempo. No se hizo ningún cobro.'
  return null
}

/**
 * Nombre de la sede que puede ver el cliente. Los nombres internos que pone el sistema
 * («Sucursal 562», «Sede 3», «Bodega #2») no le dicen nada: se omiten.
 */
export function nombrePublicoSede(nombre: string | null | undefined): string | null {
  const limpio = (nombre || '').trim()
  if (!limpio) return null
  if (/^(sucursal|sede|branch|bodega|tienda)\s*(n[ºo°.]?\s*)?#?\s*\d+$/i.test(limpio)) return null
  return limpio
}

/** Hasta cuándo se apartan los productos: creación + plazo (`fn_web_order_plazo_minutos`). */
export function apartadoHasta(creadoEn: string | null | undefined, minutos: number | null | undefined): string | null {
  if (!creadoEn || !minutos || !Number.isFinite(minutos) || minutos <= 0) return null
  const t = Date.parse(creadoEn)
  if (!Number.isFinite(t)) return null
  return new Date(t + minutos * 60_000).toISOString()
}

/** Minutos que faltan (redondeo hacia abajo, nunca negativo). */
export function minutosRestantes(hasta: string | null | undefined, ahora: number = Date.now()): number | null {
  if (!hasta) return null
  const t = Date.parse(hasta)
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.floor((t - ahora) / 60_000))
}

/** «Quedan 58 minutos», «Quedan 3 h 10 min», «Queda menos de un minuto». */
export function textoRestante(min: number | null): string | null {
  if (min === null) return null
  if (min < 1) return 'Queda menos de un minuto.'
  if (min < 60) return `Quedan ${min} ${min === 1 ? 'minuto' : 'minutos'}.`
  const h = Math.floor(min / 60)
  const m = min % 60
  return `Quedan ${h} h${m ? ` ${m} min` : ''}.`
}
