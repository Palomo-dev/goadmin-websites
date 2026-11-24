/**
 * Resumen del pago y opciones de pago del checkout, sin emojis (Figma «16 Sitio web»):
 * - «5 · Resumen del pago: íconos y etiquetas» 3061:82007, versión 1 «Color de la tienda»
 *   (aprobada por el dueño el 2026-11-24): chip de entrega con ícono en un cuadro del color de la
 *   tienda, sellos en una fila de 3 con íconos de línea y «Medios de pago» como chips neutros
 *   (el efectivo en verde) que salen de los métodos que la tienda tiene activos en la web.
 * - Contraentrega 08 (3019:76155) y 10/10c (3020:76243, 3029:77604): tarjeta por método con el
 *   radio a la izquierda, título, una línea de descripción y el ícono a la derecha.
 *
 * Puro (sin React, sin imports): lo usan los componentes de ./ResumenPagoPiezas.tsx y
 * ./TarjetaMetodoPago.tsx y `scripts/verify-barra-pago.mjs`. Los nombres de ícono son de lucide;
 * el componente los traduce.
 */

// ─── Chip del tipo de entrega ────────────────────────────────────────────────────────────────

export type TipoEntregaResumen = 'domicilio' | 'transportadora' | 'recoger' | 'comer_aqui'
export type IconoEntrega = 'truck' | 'package' | 'store' | 'utensils'

/** Etiqueta e ícono del chip (camión, paquete, tienda, cubiertos). */
export function chipEntrega(tipo: TipoEntregaResumen): { etiqueta: string; icono: IconoEntrega } {
  switch (tipo) {
    case 'domicilio':
      return { etiqueta: 'Domicilio', icono: 'truck' }
    case 'transportadora':
      return { etiqueta: 'Transportadora', icono: 'package' }
    case 'recoger':
      return { etiqueta: 'Recoger en tienda', icono: 'store' }
    default:
      return { etiqueta: 'Comer aquí', icono: 'utensils' }
  }
}

// ─── Sellos de confianza ─────────────────────────────────────────────────────────────────────

export type IconoSello = 'shield' | 'undo' | 'package' | 'badge'

/**
 * Ícono de línea de un sello. Los emojis por defecto de la tienda (🔒 ✅ 🚚, app/checkout/page.tsx)
 * pasan a escudo, devolución y paquete; un sello sin ícono, a escudo. Si la tienda escribió OTRO
 * emoji propio, se conserva tal cual (`{ emoji }`): las mejoras suman, no quitan.
 */
export function iconoSello(icono: string | null | undefined, texto: string): { linea: IconoSello } | { emoji: string } {
  const i = (icono || '').trim().replace(/️/g, '')
  if (i === '' || i === '\u{1F512}' || i === '\u{1F510}') return { linea: 'shield' }
  if (i === '✅' || i === '✔') return { linea: /devoluc|cambio|reembols/i.test(texto) ? 'undo' : 'badge' }
  if (i === '\u{1F69A}' || i === '\u{1F4E6}') return { linea: 'package' }
  return { emoji: icono as string }
}

// ─── Medios de pago aceptados ────────────────────────────────────────────────────────────────

export interface MetodoResumen {
  code: string
  name: string
  type: 'native' | 'gateway'
}

export type IconoMedio = 'card' | 'bank' | 'phone' | 'cash' | 'transfer' | 'wallet'

export interface ChipMedio {
  clave: string
  etiqueta: string
  icono: IconoMedio
  /** El efectivo, en verde como el ícono de contraentrega. */
  verde: boolean
}

const WOMPI = new Set(['wompi', 'wompi_co'])
const MERCADOPAGO = new Set(['mp', 'mp_checkout', 'mercadopago'])
const BOLD = new Set(['bold', 'bold_link'])

/** Qué medios ofrece cada pasarela en la tienda (lo seguro: sin prometer lo que no cobra). */
function mediosDePasarela(code: string): ChipMedio[] {
  const tarjeta: ChipMedio = { clave: 'tarjeta', etiqueta: 'Tarjeta', icono: 'card', verde: false }
  const pse: ChipMedio = { clave: 'pse', etiqueta: 'PSE', icono: 'bank', verde: false }
  const nequi: ChipMedio = { clave: 'nequi', etiqueta: 'Nequi', icono: 'phone', verde: false }
  if (WOMPI.has(code)) return [tarjeta, pse, nequi]
  if (MERCADOPAGO.has(code) || BOLD.has(code)) return [tarjeta, pse]
  return [tarjeta]
}

/**
 * Chips de «Medios de pago» desde los métodos ACTIVOS de la tienda web (los mismos del paso de
 * pago, ya filtrados por sede): primero lo de las pasarelas, luego transferencia y otros, y el
 * efectivo al final. Sin repetidos. Sin métodos: lista vacía (no se pinta la sección).
 */
export function chipsMediosPago(metodos: readonly MetodoResumen[], aDomicilio: boolean): ChipMedio[] {
  const enLinea: ChipMedio[] = []
  const otros: ChipMedio[] = []
  let efectivo: ChipMedio | null = null
  for (const m of metodos) {
    if (m.code === 'cash') efectivo = { clave: 'efectivo', etiqueta: aDomicilio ? 'Efectivo al recibir' : 'Efectivo', icono: 'cash', verde: true }
    else if (m.code === 'transfer') otros.push({ clave: 'transferencia', etiqueta: 'Transferencia', icono: 'transfer', verde: false })
    else if (m.type === 'gateway') enLinea.push(...mediosDePasarela(m.code))
    else if (m.name.trim()) otros.push({ clave: `m-${m.code}`, etiqueta: m.name.trim(), icono: 'wallet', verde: false })
  }
  const vistos = new Set<string>()
  return [...enLinea, ...otros, ...(efectivo ? [efectivo] : [])].filter((c) => (vistos.has(c.clave) ? false : (vistos.add(c.clave), true)))
}

// ─── Tarjeta de cada método en el paso de pago ───────────────────────────────────────────────

export type TonoIconoMetodo = 'verde' | 'azul' | 'rojo' | 'gris'

/** Íconos del cuadro de la derecha (nombres de lucide en kebab-case). */
export const ICONOS_METODO = [
  'wallet',
  'banknote',
  'landmark',
  'coins',
  'credit-card',
  'arrow-left-right',
  'smartphone',
  'qr-code',
  'globe',
  'zap',
  'truck',
  'store',
] as const
export type NombreIconoMetodo = (typeof ICONOS_METODO)[number]
export type IconoMetodo = { tono: TonoIconoMetodo; icono: NombreIconoMetodo } | { emoji: string }

/**
 * «Icono en la tienda» que la tienda elige en el ERP (Finanzas › Métodos de pago › Tienda web,
 * `ICONOS_TIENDA` de PaymentMethodForm.tsx; columna `website_icon`) → ícono de lucide. Antes la
 * tienda pintaba la palabra («truck») en vez del ícono.
 */
export const ICONO_TIENDA_A_LUCIDE: Readonly<Record<string, NombreIconoMetodo>> = {
  banknotes: 'banknote',
  coins: 'coins',
  'credit-card': 'credit-card',
  'building-bank': 'landmark',
  'arrow-left-right': 'arrow-left-right',
  wallet: 'wallet',
  smartphone: 'smartphone',
  'qr-code': 'qr-code',
  globe: 'globe',
  zap: 'zap',
  truck: 'truck',
  store: 'store',
}

/** Nombre visible de la pasarela por su código. */
export function nombrePasarelaMetodo(code: string): string | null {
  if (WOMPI.has(code)) return 'Wompi'
  if (MERCADOPAGO.has(code)) return 'Mercado Pago'
  if (BOLD.has(code)) return 'Bold'
  if (code === 'payu_co') return 'PayU'
  if (code === 'stripe_payments') return 'Stripe'
  if (code === 'paypal_checkout') return 'PayPal'
  return null
}

/** Color e ícono por tipo cuando la tienda no eligió ícono. */
function iconoPorTipo(code: string): { tono: TonoIconoMetodo; icono: NombreIconoMetodo } {
  if (WOMPI.has(code)) return { tono: 'verde', icono: 'wallet' }
  if (MERCADOPAGO.has(code)) return { tono: 'azul', icono: 'wallet' }
  if (BOLD.has(code)) return { tono: 'rojo', icono: 'wallet' }
  if (code === 'cash') return { tono: 'verde', icono: 'banknote' }
  if (code === 'transfer') return { tono: 'gris', icono: 'landmark' }
  if (code === 'card') return { tono: 'gris', icono: 'credit-card' }
  return { tono: 'gris', icono: 'wallet' }
}

/** Un emoji (los íconos viejos que guardaban algunas tiendas) se pinta tal cual. */
export function esEmoji(texto: string): boolean {
  return /\p{Extended_Pictographic}/u.test(texto)
}

/**
 * Ícono del cuadro redondeado a la derecha.
 * - Sin ícono elegido: el de su tipo (Wompi verde, Mercado Pago azul, Bold rojo, con billetera;
 *   efectivo con billete en verde; transferencia con banco en gris; otro, billetera gris).
 * - Con ícono elegido en el ERP: ese ícono, con el color de su tipo (gris si el tipo no tiene).
 * - Un emoji guardado: tal cual. Una palabra que no se reconoce: el de su tipo (nunca la palabra).
 */
export function iconoMetodo(m: { code: string; type: 'native' | 'gateway'; icon?: string | null }): IconoMetodo {
  const porTipo = iconoPorTipo(m.code)
  const elegido = (m.icon || '').trim()
  if (!elegido) return porTipo
  const lucide = ICONO_TIENDA_A_LUCIDE[elegido.toLowerCase()]
  if (lucide) return { tono: porTipo.tono, icono: lucide }
  if (esEmoji(elegido)) return { emoji: elegido }
  return porTipo
}

/** Texto plano corto de las instrucciones (texto enriquecido del ERP): sin etiquetas ni entidades. */
export function textoPlanoCorto(html: string | null | undefined, max = 140): string {
  const plano = (html || '')
    .replace(/<\s*(br|\/p|\/div|\/li)\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
  return plano.length > max ? `${plano.slice(0, max - 1).trimEnd()}…` : plano
}

/**
 * Línea pequeña bajo el título. Las instrucciones que escribió la tienda («Paga al recibir tu
 * pedido», `website_description`, en texto plano) mandan; si no, un texto por tipo de método. (La
 * de contraentrega con condiciones la pone el checkout, con sus montos.)
 */
export function descripcionMetodo(m: { code: string; type: 'native' | 'gateway'; description?: string | null }, aDomicilio: boolean): string | null {
  const propia = textoPlanoCorto(m.description)
  if (propia) return propia
  if (m.code === 'cash') return aDomicilio ? 'Pagas en efectivo al recibir tu pedido' : 'Pagas en efectivo en la tienda'
  if (m.code === 'transfer') return 'Te damos los datos de la cuenta'
  if (m.type === 'gateway') {
    const nombre = nombrePasarelaMetodo(m.code)
    return nombre ? `Pago en línea con ${nombre}` : 'Pago en línea'
  }
  return null
}

// ─── Método pedido desde el chat (?metodo=<código>) ─────────────────────────────────────────

/**
 * Código de método que trae el traspaso del chat al checkout: `?metodo=cash` en la URL o, si el
 * chat lo mandara dentro de `customer`, su clave `metodo`. Solo un código con forma de código
 * (letras, números, «_» y «-», hasta 40); lo demás, null (el checkout de siempre).
 */
export function metodoDeTraspaso(...valores: unknown[]): string | null {
  for (const v of valores) {
    if (typeof v !== 'string') continue
    const c = v.trim()
    if (/^[A-Za-z0-9_-]{1,40}$/.test(c)) return c
  }
  return null
}

/**
 * Qué método queda elegido por lo que pidió el chat. `pedido` = el código del traspaso;
 * `activos` = los métodos de la tienda web para este pedido (ya filtrados por sede);
 * `disponible` = si ese método aplica para este pedido (contraentrega con condiciones: el
 * `disponible` de /api/contraentrega; null = sin condiciones, como hoy).
 * - Activo y disponible → ese código (preseleccionado; el cliente lo puede cambiar).
 * - No activo, o no disponible (fuera de zona, bajo el mínimo…) → null: no se fuerza; queda el
 *   primero disponible y la opción muestra su motivo.
 */
export function metodoPreseleccionado(pedido: string | null, activos: readonly string[], disponible: boolean | null): string | null {
  if (!pedido || !activos.includes(pedido)) return null
  if (disponible === false) return null
  return pedido
}

/** Si lo pedido no aplica y ya estaba elegido: el primer método activo que no sea ese. */
export function metodoDeRespaldo(pedido: string, activos: readonly string[]): string | null {
  return activos.find((c) => c !== pedido) ?? null
}
