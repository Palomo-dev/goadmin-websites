/**
 * Marca y remitente del correo de un pedido pagado en el sitio.
 *
 * El comprador tiene que ver la tienda: su nombre, su logo y su color.
 * El sobre solo puede salir de un dominio que el proveedor ya autenticó
 * (`email_domains` en estado `verified`). Si el correo de la tienda está en
 * ese dominio, el From es ese correo. Si no, poner un Gmail (o cualquier
 * dominio ajeno) como From hace que el proveedor rechace el mensaje y el
 * cliente no recibe nada: el nombre visible sigue siendo el de la tienda,
 * Reply-To es su correo y la dirección de envío queda en el dominio de la
 * plataforma.
 *
 * Código puro: sin React, Next ni Supabase.
 */

export interface DominioRemitente {
  domain: string
  fromEmail: string
  isDefault: boolean
}

export interface MarcaCorreoPedido {
  nombre: string
  correo: string | null
  logoUrl: string | null
  color: string | null
  dominios: DominioRemitente[]
}

export interface SobreCorreoPedido {
  from: string
  replyTo: string | null
  nombre: string
  correo: string | null
  logoUrl: string | null
  color: string
  texto: '#ffffff' | '#111827'
  /** La dirección del sobre es de la tienda, no la de la plataforma. */
  propio: boolean
}

const COLOR_POR_DEFECTO = '#111827'
const RESPALDO_POR_DEFECTO = 'pedidos@goadmin.io'

export function correoValido(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const limpio = valor.trim().toLowerCase()
  if (limpio.length > 254 || !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(limpio)) return null
  return limpio
}

export function dominioDe(correo: string): string {
  return correo.slice(correo.lastIndexOf('@') + 1)
}

/** `#RGB`, `#RRGGBB` o `#RRGGBBAA` → `#rrggbb`. Cualquier otra cosa, null. */
export function colorMarca(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(valor.trim())
  if (!m) return null
  const hex = m[1]
  if (hex.length === 3) return `#${hex.split('').map((c) => c + c).join('')}`.toLowerCase()
  return `#${hex.slice(0, 6)}`.toLowerCase()
}

/** Solo https absoluto. Una ruta del sitio no se resuelve dentro de un correo. */
export function logoCorreo(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const limpio = valor.trim()
  if (limpio.length > 2000 || !/^https:\/\/[^\s<>"]+$/i.test(limpio)) return null
  return limpio
}

/** Texto blanco sobre color oscuro; texto oscuro si el fondo es claro (amarillo, blanco). */
export function textoSobreColor(color: string): '#ffffff' | '#111827' {
  const hex = color.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return y > 0.62 ? '#111827' : '#ffffff'
}

function valorPublicado(campo: unknown): string | null {
  if (!campo || typeof campo !== 'object') return null
  const c = campo as { mode?: unknown; value?: unknown }
  if (c.mode !== 'value' || typeof c.value !== 'string') return null
  const limpio = c.value.trim()
  return limpio || null
}

function esClear(campo: unknown): boolean {
  return !!campo && typeof campo === 'object' && (campo as { mode?: unknown }).mode === 'clear'
}

/**
 * Herencia de sede, la misma regla del sitio: `clear` vacía, `value` gana,
 * ausente o `inherit` usa el principal.
 */
export function valorHeredado(principal: unknown, sede: unknown): string | null {
  if (sede && typeof sede === 'object') {
    const c = sede as { mode?: unknown; value?: unknown }
    if (c.mode === 'clear') return null
    if (c.mode === 'value') return typeof c.value === 'string' && c.value.trim() ? c.value.trim() : null
  }
  return valorPublicado(principal)
}

function dominiosLimpios(dominios: DominioRemitente[]): DominioRemitente[] {
  return (dominios || [])
    .map((d) => ({
      domain: typeof d.domain === 'string' ? d.domain.trim().toLowerCase().replace(/\.$/, '') : '',
      fromEmail: correoValido(d.fromEmail) || '',
      isDefault: d.isDefault === true,
    }))
    .filter((d) => d.domain && d.fromEmail && dominioDe(d.fromEmail) === d.domain)
}

function logoEfectivo(entrada: {
  v2: boolean
  v2Sede: boolean
  logoV2Principal: unknown
  logoV2Sede: unknown
  logoSede: unknown
  logoOrganizacion: unknown
}): string | null {
  const legacy = logoCorreo(entrada.logoSede) ?? logoCorreo(entrada.logoOrganizacion)
  if (!entrada.v2) return legacy
  if (entrada.v2Sede && esClear(entrada.logoV2Sede)) return null
  const publicado = entrada.v2Sede
    ? valorHeredado(entrada.logoV2Principal, entrada.logoV2Sede)
    : valorPublicado(entrada.logoV2Principal)
  return logoCorreo(publicado) ?? legacy
}

/** Arma la marca a partir de las filas ya leídas. La sede gana al principal; V2 gana a lo legacy. */
export function ensamblarMarca(entrada: {
  nombre: unknown
  correoOrganizacion: unknown
  correoSede: unknown
  logoOrganizacion: unknown
  logoSede: unknown
  colorOrganizacion: unknown
  colorAjustes: unknown
  colorAjustesSede: unknown
  logoV2Principal: unknown
  colorV2Principal: unknown
  logoV2Sede: unknown
  colorV2Sede: unknown
  v2Principal: boolean
  v2Sede: boolean
  dominios: DominioRemitente[]
}): MarcaCorreoPedido {
  const v2 = entrada.v2Principal || entrada.v2Sede
  const colorV2 = entrada.v2Sede
    ? valorHeredado(entrada.v2Principal ? entrada.colorV2Principal : null, entrada.colorV2Sede)
    : entrada.v2Principal
      ? valorPublicado(entrada.colorV2Principal)
      : null
  return {
    nombre: typeof entrada.nombre === 'string' ? entrada.nombre.replace(/[\r\n]/g, ' ').trim() : '',
    correo: correoValido(entrada.correoSede) ?? correoValido(entrada.correoOrganizacion),
    logoUrl: logoEfectivo({
      v2,
      v2Sede: entrada.v2Sede,
      logoV2Principal: entrada.v2Principal ? entrada.logoV2Principal : null,
      logoV2Sede: entrada.logoV2Sede,
      logoSede: entrada.logoSede,
      logoOrganizacion: entrada.logoOrganizacion,
    }),
    color: colorMarca(colorV2)
      ?? colorMarca(entrada.colorAjustesSede)
      ?? colorMarca(entrada.colorAjustes)
      ?? colorMarca(entrada.colorOrganizacion),
    dominios: dominiosLimpios(entrada.dominios),
  }
}

function formatoDesde(nombre: string, correo: string): string {
  const limpio = nombre.replace(/[\r\n<>"]/g, '').replace(/\s+/g, ' ').trim() || 'Tienda'
  return `"${limpio}" <${correo}>`
}

/**
 * Sobre del correo. `propio` es true solo cuando la dirección de envío
 * pertenece a un dominio autenticado de la tienda.
 */
export function sobreCorreoPedido(entrada: {
  nombre: string
  correoTienda: string | null
  logoUrl: string | null
  color: string | null
  dominios: DominioRemitente[]
  respaldo: string
}): SobreCorreoPedido {
  const nombre = (entrada.nombre || '').replace(/[\r\n]/g, ' ').trim()
  const correo = correoValido(entrada.correoTienda)
  const color = colorMarca(entrada.color) ?? COLOR_POR_DEFECTO
  const logoUrl = logoCorreo(entrada.logoUrl)
  const dominios = dominiosLimpios(entrada.dominios)
  const base = { nombre, correo, logoUrl, color, texto: textoSobreColor(color) }
  const delCorreo = correo ? dominios.find((d) => dominioDe(correo) === d.domain) : undefined
  if (correo && delCorreo) {
    return { ...base, from: formatoDesde(nombre, correo), replyTo: null, propio: true }
  }
  const propio = dominios.find((d) => d.isDefault) ?? dominios[0]
  const desdePropio = propio ? correoValido(propio.fromEmail) : null
  if (desdePropio) {
    return {
      ...base,
      from: formatoDesde(nombre, desdePropio),
      replyTo: correo && correo !== desdePropio ? correo : null,
      propio: true,
    }
  }
  const respaldo = correoValido(entrada.respaldo) ?? RESPALDO_POR_DEFECTO
  return {
    ...base,
    from: formatoDesde(nombre, respaldo),
    replyTo: correo && correo !== respaldo ? correo : null,
    propio: false,
  }
}
