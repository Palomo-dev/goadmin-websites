/**
 * Textos de la contraentrega para el comprador (checkout, página del pedido, correo, carrito y
 * ficha). Puro: sin Next ni Supabase. Los montos llegan ya formateados por quien llama (cada
 * tienda con su moneda). Lo prueba `scripts/verify-contraentrega.mjs`.
 *
 * Figma «16 Sitio web» 3019:76125 (pantallas 08–15, aprobadas el 2026-11-24).
 */

import type { MedioAlRecibir, MotivoNoDisponible, ResultadoContraentrega, TipoAnticipo } from './reglaContraentrega'

const NOMBRE_MEDIO: Record<MedioAlRecibir, string> = {
  cash: 'efectivo',
  card: 'datáfono',
  transfer: 'transferencia',
  qr: 'Nequi',
}

/** «efectivo, datáfono o Nequi». */
export function textoMedios(medios: readonly MedioAlRecibir[]): string {
  const nombres = Array.from(new Set(medios.map((m) => NOMBRE_MEDIO[m]).filter(Boolean)))
  if (nombres.length === 0) return 'efectivo'
  if (nombres.length === 1) return nombres[0]
  return `${nombres.slice(0, -1).join(', ')} o ${nombres[nombres.length - 1]}`
}

/** «En efectivo, con datáfono o Nequi»: la frase con preposiciones de la pantalla 08. */
export function fraseMedios(medios: readonly MedioAlRecibir[]): string {
  const partes = Array.from(new Set(medios)).map((m) => (m === 'cash' ? 'en efectivo' : m === 'card' ? 'con datáfono' : m === 'qr' ? 'Nequi' : 'transferencia'))
  if (partes.length === 0) return 'En efectivo'
  const frase = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} o ${partes[partes.length - 1]}`
  return frase.charAt(0).toUpperCase() + frase.slice(1)
}

/** Nombre visible de una pasarela por su código de conector. */
export function nombrePasarela(codigo: string | null | undefined): string {
  switch (codigo) {
    case 'wompi_co':
    case 'wompi':
      return 'Wompi'
    case 'mp_checkout':
    case 'mp':
    case 'mercadopago':
      return 'Mercado Pago'
    case 'bold_link':
      return 'Bold'
    case 'payu_co':
      return 'PayU'
    case 'stripe_payments':
      return 'Stripe'
    case 'paypal_checkout':
      return 'PayPal'
    default:
      return codigo ? String(codigo) : 'la pasarela'
  }
}

/** «el envío», «20 % del pedido» o «un anticipo»: de qué es el anticipo. */
export function conceptoAnticipo(r: ResultadoContraentrega): string {
  const base = r.anticipo?.base
  if (base === 'envio') return 'el envío'
  return 'el anticipo'
}

/** Línea de la política «si no recibes el pedido» (08c / 10c). */
export function lineaSiNoRecibe(siNoRecibe: 'devolver' | 'retener'): string {
  return siNoRecibe === 'retener'
    ? 'Si no recibes el pedido, el anticipo cubre el envío y no se devuelve.'
    : 'Si no recibes el pedido, te devolvemos el anticipo.'
}

/**
 * Motivo por el que la opción se ve apagada (pantalla 09). `fmt` formatea montos. El primero de
 * `r.motivos` es el que se muestra (la regla ya los ordena: monto → productos → dirección).
 * `ciudad` (opcional, la que escribió el cliente) solo cambia el texto de la zona, con la forma de
 * 09 F: «No llega a tu dirección (Medellín). Contraentrega solo en Chapinero, Zona Norte y Zona
 * Centro.». Sin ella, el texto de siempre (lo usa `/api/orders` en su 422).
 */
export function textoMotivo(motivo: MotivoNoDisponible, fmt: (n: number) => string, ciudad?: string | null): { texto: string; accion: string | null } {
  const ciudadCliente = typeof ciudad === 'string' ? ciudad.trim() : ''
  if (motivo.codigo === 'zona' && ciudadCliente) {
    return {
      texto: motivo.zonas.length > 0
        ? `No llega a tu dirección (${ciudadCliente}). Contraentrega solo en ${listaConY(motivo.zonas)}.`
        : `No llega a tu dirección (${ciudadCliente}) con pago contra entrega.`,
      accion: 'Cambiar dirección',
    }
  }
  switch (motivo.codigo) {
    case 'monto_minimo':
      return { texto: `Disponible desde ${fmt(motivo.minimo)} — te faltan ${fmt(motivo.faltan)}.`, accion: 'Seguir comprando' }
    case 'monto_maximo':
      return { texto: `Solo para pedidos hasta ${fmt(motivo.maximo)}. Tu pedido es de ${fmt(motivo.total)}: págalo en línea o divídelo en dos.`, accion: null }
    case 'productos': {
      const n = motivo.productoIds.length
      return { texto: `No disponible para ${n} ${n === 1 ? 'producto' : 'productos'} de tu carrito.`, accion: 'Ver cuáles' }
    }
    case 'zona':
      return {
        texto: motivo.zonas.length > 0
          ? `No llega a tu dirección. Contraentrega solo en: ${motivo.zonas.join(', ')}.`
          : 'No llega a tu dirección con pago contra entrega.',
        accion: 'Cambiar dirección',
      }
    case 'transportadora':
      return { texto: 'Con envío por transportadora el pago es en línea.', accion: null }
    case 'primera_compra':
      return { texto: 'Disponible desde tu segunda compra. Si ya nos compraste, ingresa a tu cuenta.', accion: 'Ingresar' }
    case 'rechazo_previo':
    case 'apagada':
    case 'sin_pasarela':
    default:
      // Neutro: no acusa al cliente (pantalla 09 I).
      return { texto: 'Para esta compra el pago es en línea. Si tienes dudas, escríbenos.', accion: null }
  }
}

/** «Paga hoy $ 9.000 del envío y $ 142.000 al recibir.» (pantalla 08). */
export function lineaResumenAnticipo(r: ResultadoContraentrega, fmt: (n: number) => string): string | null {
  if (!r.anticipo) return null
  const del = r.anticipo.base === 'envio' ? ' del envío' : ''
  return `Paga hoy ${fmt(r.anticipo.monto)}${del} y ${fmt(r.alRecibir)} al recibir.`
}

/**
 * Descripción de la opción cuando la tienda no escribió su texto (08 / 09 A): «Paga en efectivo, con
 * datáfono o Nequi cuando recibas tu pedido.» y, con anticipo del envío, «Para confirmarlo, hoy
 * pagas solo el envío.».
 */
export function descripcionContraentrega(medios: readonly MedioAlRecibir[], anticipo: { base?: string | null } | null): string {
  const frase = fraseMedios(medios)
  const medio = /^(En|Con) /.test(frase)
    ? frase.charAt(0).toLowerCase() + frase.slice(1)
    : `con ${frase.startsWith('Nequi') ? frase : frase.charAt(0).toLowerCase() + frase.slice(1)}`
  const base = `Paga ${medio} cuando recibas tu pedido.`
  if (!anticipo) return base
  return `${base} ${anticipo.base === 'envio' ? 'Para confirmarlo, hoy pagas solo el envío.' : 'Para confirmarlo, hoy pagas un anticipo.'}`
}

/** Aviso del plazo (08 / 08c). */
export function lineaPlazoAnticipo(plazoMinutos: number, pasarela: string | null): string {
  const con = pasarela ? ` con ${nombrePasarela(pasarela)}` : ''
  return `Paga el anticipo${con} en los próximos ${plazoMinutos} minutos para confirmar el pedido. Si no, se cancela y no se te cobra nada.`
}

/**
 * Código de conector de una pasarela (el que guarda el ERP en «Se cobra con»), desde el código con
 * que la tienda lista sus medios. `null` = no es una pasarela que sepa cobrar el anticipo.
 */
export function codigoConector(codigo: string | null | undefined): string | null {
  switch ((codigo || '').trim()) {
    case 'wompi':
    case 'wompi_co':
      return 'wompi_co'
    case 'mp':
    case 'mercadopago':
    case 'mp_checkout':
      return 'mp_checkout'
    case 'bold_link':
      return 'bold_link'
    case 'payu_co':
      return 'payu_co'
    case 'stripe_payments':
      return 'stripe_payments'
    case 'paypal_checkout':
      return 'paypal_checkout'
    default:
      return null
  }
}

// ─── Carrito lateral y ficha de producto (pantallas 14, 14b, 15 y 15b) ───────────────────────

/**
 * Lo que `GET /api/contraentrega/condiciones` entrega al navegador: SOLO lo que pintan los avisos
 * del carrito y de la ficha. `normalizarCondiciones` lo lee tal cual (los campos ausentes toman el
 * defecto), así el navegador usa `faltaParaMinimo` y `productoAplica` de la regla, sin copiarlas.
 */
export interface CondicionesPublicasContraentrega {
  conCondiciones: true
  montoMinimo: number | null
  montoMaximo: number | null
  transportadora: boolean
  productos: { modo: 'todos' | 'solo' | 'excepto'; categorias: number[]; productos: number[] }
  medios: MedioAlRecibir[]
  anticipo: {
    tipo: TipoAnticipo
    porcentaje: number | null
    valorFijo: number | null
    siEnvioGratis: 'sin_anticipo' | 'valor_fijo'
    valorEnvioGratis: number | null
  }
  /** Nombres de las zonas de domicilio propio permitidas; `null` = todas. */
  zonas: string[] | null
  texto: string | null
  /** Solo si se pidió con `productos=`: los del carrito que no aplican. */
  excluidos?: { productId: number; nombre: string | null }[]
}

/** Sin condiciones en la sede (o la tienda no ofrece contraentrega): no se pinta ningún aviso. */
export type RespuestaCondicionesContraentrega = { conCondiciones: false } | CondicionesPublicasContraentrega

/** «A», «A y B», «A, B y C». */
export function listaConY(nombres: readonly string[]): string {
  const limpios = nombres.map((n) => String(n).trim()).filter(Boolean)
  if (limpios.length <= 1) return limpios[0] ?? ''
  return `${limpios.slice(0, -1).join(', ')} y ${limpios[limpios.length - 1]}`
}

/** «hoy pagas solo el envío», «hoy pagas el 20 % del pedido», «hoy pagas $ 10.000» o `null` sin anticipo. */
export function fraseAnticipoHoy(anticipo: CondicionesPublicasContraentrega['anticipo'], fmt: (n: number) => string): string | null {
  switch (anticipo.tipo) {
    case 'envio':
      return 'hoy pagas solo el envío'
    case 'porcentaje':
      return (anticipo.porcentaje ?? 0) > 0 ? `hoy pagas el ${anticipo.porcentaje} % del pedido` : null
    case 'fijo':
      return (anticipo.valorFijo ?? 0) > 0 ? `hoy pagas ${fmt(anticipo.valorFijo as number)}` : null
    case 'ninguno':
    default:
      return null
  }
}

function conMayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export type AvisoCarritoContraentrega =
  | { tipo: 'disponible'; titulo: string }
  | { tipo: 'minimo'; titulo: string; detalle: string; avance: number }
  | { tipo: 'maximo'; titulo: string; detalle: string }
  | { tipo: 'productos'; titulo: string; productoIds: number[] }

/**
 * Aviso del cajón del carrito (14 / 14b). `falta` = `faltaParaMinimo(...)` de la regla con el valor
 * de los productos con descuentos, sin envío. La zona NO se revisa aquí (aún no hay dirección): se
 * revisa en el checkout. Mismo orden que los motivos de la regla: monto → productos.
 */
export function avisoCarritoContraentrega(
  c: CondicionesPublicasContraentrega,
  e: {
    falta: { minimo: number; faltan: number } | null
    subtotalProductos: number
    excluidos: readonly { productId: number; nombre: string | null }[]
  },
  fmt: (n: number) => string,
): AvisoCarritoContraentrega {
  const hoy = fraseAnticipoHoy(c.anticipo, fmt)
  if (e.falta) {
    const avance = e.falta.minimo > 0 ? Math.min(1, Math.max(0, (e.falta.minimo - e.falta.faltan) / e.falta.minimo)) : 0
    return {
      tipo: 'minimo',
      titulo: `Te faltan ${fmt(e.falta.faltan)} para pagar contra entrega`,
      detalle: `Desde ${fmt(e.falta.minimo)} puedes pagar al recibir${hoy ? ` (${hoy})` : ''}.`,
      avance,
    }
  }
  if (c.montoMaximo !== null && e.subtotalProductos > c.montoMaximo) {
    return {
      tipo: 'maximo',
      titulo: `Contraentrega solo para pedidos hasta ${fmt(c.montoMaximo)}`,
      detalle: 'Este pedido se paga en línea.',
    }
  }
  const ids = Array.from(new Set(e.excluidos.map((x) => x.productId)))
  if (ids.length > 0) {
    const nombre = e.excluidos.find((x) => x.nombre)?.nombre ?? null
    return {
      tipo: 'productos',
      titulo: ids.length === 1 && nombre
        ? `Contraentrega no aplica a «${nombre}». Quítalo para pagar al recibir o paga todo en línea.`
        : `Contraentrega no aplica a ${ids.length} ${ids.length === 1 ? 'producto' : 'productos'} de tu carrito. ${ids.length === 1 ? 'Quítalo' : 'Quítalos'} para pagar al recibir o paga todo en línea.`,
      productoIds: ids,
    }
  }
  return {
    tipo: 'disponible',
    titulo: hoy ? `Contraentrega disponible: ${hoy} y el resto al recibir.` : 'Contraentrega disponible: pagas al recibir.',
  }
}

export type AvisoFichaContraentrega =
  | { tipo: 'disponible'; titulo: string; detalle: string | null }
  | { tipo: 'en_linea'; titulo: string; detalle: string }

/**
 * Aviso de la ficha (15 / 15b). `aplica` = `productoAplica(...)` de la regla para este producto.
 * «En Chapinero, Zona Norte y Zona Centro, en pedidos desde $ 80.000. Hoy pagas solo el envío.»
 */
export function avisoFichaContraentrega(c: CondicionesPublicasContraentrega, aplica: boolean, fmt: (n: number) => string): AvisoFichaContraentrega {
  if (!aplica) {
    return {
      tipo: 'en_linea',
      titulo: 'Este producto se paga en línea',
      detalle: 'No aplica pago contra entrega. Si lo llevas con otros productos, ese pedido también se paga en línea.',
    }
  }
  const partes: string[] = []
  if (c.zonas && c.zonas.length > 0) partes.push(`en ${listaConY(c.zonas)}`)
  if (c.montoMinimo !== null && c.montoMaximo !== null) partes.push(`en pedidos de ${fmt(c.montoMinimo)} a ${fmt(c.montoMaximo)}`)
  else if (c.montoMinimo !== null) partes.push(`en pedidos desde ${fmt(c.montoMinimo)}`)
  else if (c.montoMaximo !== null) partes.push(`en pedidos hasta ${fmt(c.montoMaximo)}`)
  const hoy = fraseAnticipoHoy(c.anticipo, fmt)
  const frases: string[] = []
  if (partes.length > 0) frases.push(`${conMayuscula(partes.join(', '))}.`)
  if (hoy) frases.push(`${conMayuscula(hoy)}.`)
  return {
    tipo: 'disponible',
    titulo: 'Contraentrega disponible · pagas al recibir',
    detalle: frases.length > 0 ? frases.join(' ') : null,
  }
}
