/**
 * Encabezado píldora, botón principal y menú inferior flotante (2026-11-07, contrato
 * «Editor · Encabezado píldora, menú inferior y botones», Figma 2390:55039).
 *
 * Lee las claves nuevas del contrato (OPCIONES_SHELL de lib/website/v2/mapeoAjustes.ts, todas con
 * `porDefecto: null`) y las traduce a lo que pintan HeaderPill, HeaderCTA / HeaderCTAMovil, los
 * menús del celular y MenuInferior. **Sin ninguna clave todo es `null` / vacío** y cada componente
 * sigue por su rama de hoy (cada `if` nuevo con su `else` intacto).
 *
 * Puro: servidor, navegador y scripts/verify-pildora.mjs.
 */
import { estiloDeHeaderLayout, normalizarOpcionShell } from './v2/mapeoAjustes'
import type { BotonMenu, IconoMenu, MenuInferior } from './menuInferior'

type Ajustes = Record<string, unknown> | null | undefined

function opcion<T>(ajustes: Ajustes, clave: string): T | null {
  const v = normalizarOpcionShell(clave, ajustes?.[clave])
  return v === null || v === undefined ? null : (v as T)
}

// ─── Composición ──────────────────────────────────────────────────────────────────────────────

/** La composición que pinta el sitio: `header_layout` (si lo hay) o `header_style`. Igual que SiteHeader. */
export function composicionEncabezado(ajustes: Ajustes): string {
  const desdeLayout = estiloDeHeaderLayout(ajustes?.header_layout)
  const estilo = ajustes?.header_style
  return desdeLayout || (typeof estilo === 'string' && estilo ? estilo : 'default')
}

// ─── Píldora del menú (escritorio y celular) ──────────────────────────────────────────────────

export type EstiloPildora = 'vidrio' | 'isla' | 'contorno'

/**
 * Estilo de la píldora tal como lo marca el `<header>` (`data-pildora-estilo`). Sin la clave,
 * `vidrio` (lo de hoy). `solido` y el alias guardado antes del contrato `isla` → `isla` (las reglas
 * de app/globals.css de la isla del tema ya existen).
 */
export function estiloPildora(ajustes: Ajustes): EstiloPildora {
  const crudo = ajustes?.header_pill_style
  if (crudo === 'isla' || crudo === 'solido') return 'isla'
  if (crudo === 'contorno') return 'contorno'
  return 'vidrio'
}

export interface OpcionesPildora {
  /** % de blanco sobre la foto (0–40). `null` = 10, el de hoy. */
  opacidadVidrio: number | null
  /** Desenfoque en px (0–32). `null` = 24 (14 en la isla), el de hoy. */
  desenfoque: number | null
  /** `false` = sin borde. `null`/`true` = el borde de hoy. */
  borde: boolean | null
  /** `igual` = al bajar la píldora sigue de vidrio (ver app/globals.css). `null` = fondo del tema 85 %. */
  alBajar: 'fondo_tema' | 'igual' | null
  /** `normal` = sin versalitas. `null` = versalitas (hoy). */
  letras: 'versalitas' | 'normal' | null
  /** Separación superior en px (0–32). `null` = la de hoy. */
  separacion: number | null
  /** Celular: dónde va la píldora. `null` = arriba. */
  posicion: 'arriba' | 'abajo' | 'ambas' | null
}

export function opcionesPildora(ajustes: Ajustes): OpcionesPildora {
  return {
    opacidadVidrio: opcion<number>(ajustes, 'header_pill_glass_opacity'),
    desenfoque: opcion<number>(ajustes, 'header_pill_blur'),
    borde: opcion<boolean>(ajustes, 'header_pill_border'),
    alBajar: opcion<'fondo_tema' | 'igual'>(ajustes, 'header_pill_on_scroll'),
    letras: opcion<'versalitas' | 'normal'>(ajustes, 'header_pill_text_case'),
    separacion: opcion<number>(ajustes, 'header_float_offset'),
    posicion: opcion<'arriba' | 'abajo' | 'ambas'>(ajustes, 'header_pill_position'),
  }
}

/**
 * Variables CSS del `<header>` píldora (las leen las reglas `header[data-encabezado-pildora]` y
 * `header[data-pildora-movil]` de app/globals.css, con el valor de hoy como respaldo). Solo las de
 * las claves guardadas: sin claves, `{}` y el `style` del encabezado no cambia.
 */
export function variablesPildora(ajustes: Ajustes): Record<string, string> {
  const o = opcionesPildora(ajustes)
  const v: Record<string, string> = {}
  if (o.opacidadVidrio !== null) v['--pildora-vidrio'] = String(o.opacidadVidrio / 100)
  if (o.desenfoque !== null) v['--pildora-desenfoque'] = `${o.desenfoque}px`
  if (o.borde === false) v['--pildora-borde'] = 'transparent'
  if (o.letras === 'normal') {
    v['--pildora-mayusculas'] = 'none'
    v['--pildora-espaciado'] = 'normal'
    v['--pildora-letra'] = '14px'
  }
  return v
}

/** `data-pildora-al-bajar="igual"` solo con la clave en `igual`; si no, sin atributo (hoy). */
export function atributoAlBajar(ajustes: Ajustes): 'igual' | undefined {
  return opcionesPildora(ajustes).alBajar === 'igual' ? 'igual' : undefined
}

/**
 * Celular con la composición `pill` (decisión del dueño, 2026-11-07): `arriba` (también sin la
 * clave) = logo + píldora «Menú» + botón principal; `abajo` = encabezado de hoy y la navegación en
 * una píldora flotante abajo; `ambas`. Con otra composición, nada (el celular de hoy).
 */
export function pildoraMovil(ajustes: Ajustes): { arriba: boolean; abajo: boolean } {
  if (composicionEncabezado(ajustes) !== 'pill') return { arriba: false, abajo: false }
  const pos = opcionesPildora(ajustes).posicion ?? 'arriba'
  return { arriba: pos !== 'abajo', abajo: pos !== 'arriba' }
}

// ─── Botón principal ──────────────────────────────────────────────────────────────────────────

export type FormaBoton = 'pill' | 'circle' | 'rounded' | 'square'
export type EstiloBoton = 'tema' | 'solido' | 'contorno' | 'vidrio' | 'texto'
export type LadoIcono = 'izquierda' | 'derecha' | 'encima'

export interface OpcionesBoton {
  forma: FormaBoton | null
  tamano: 'sm' | 'md' | 'lg' | null
  ancho: number | null
  alto: number | null
  estilo: EstiloBoton | null
  icono: string | null
  ladoIcono: LadoIcono | null
  mayusculas: boolean | null
}

/** Alto del botón por tamaño (P3: sm 36 · md 44 · lg 50; el círculo 56 · 68 · 76). */
export const ALTO_BOTON = { sm: 36, md: 44, lg: 50 } as const
export const DIAMETRO_CIRCULO = { sm: 56, md: 68, lg: 76 } as const
/** Relleno horizontal por tamaño (cta_padding_x guardado manda). */
export const RELLENO_BOTON = { sm: 14, md: 18, lg: 22 } as const
export const RADIO_FORMA: Record<Exclude<FormaBoton, 'circle'>, number> = { pill: 9999, rounded: 12, square: 0 }

/** Nombre de ícono en kebab-case (como header_icons); cualquier otra cosa = sin ícono. */
function nombreIcono(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim().toLowerCase()
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(t) && t.length <= 40 ? t : null
}

export function opcionesBoton(ajustes: Ajustes): OpcionesBoton {
  return {
    forma: opcion<FormaBoton>(ajustes, 'header_cta_shape'),
    tamano: opcion<'sm' | 'md' | 'lg'>(ajustes, 'header_cta_size'),
    ancho: opcion<number>(ajustes, 'header_cta_width'),
    alto: opcion<number>(ajustes, 'header_cta_height'),
    estilo: opcion<EstiloBoton>(ajustes, 'header_cta_style'),
    icono: nombreIcono(opcion<string>(ajustes, 'header_cta_icon')),
    ladoIcono: opcion<LadoIcono>(ajustes, 'header_cta_icon_side'),
    mayusculas: opcion<boolean>(ajustes, 'header_cta_uppercase'),
  }
}

/**
 * ¿El botón va por la rama nueva? Sin claves (o solo `circle`, con o sin ícono: el «Reservar» de
 * hoy) → `false` y HeaderCTA pinta exactamente el botón de hoy.
 */
export function botonConOpcionesNuevas(o: OpcionesBoton): boolean {
  if (o.forma === 'pill' || o.forma === 'rounded' || o.forma === 'square') return true
  if (o.tamano !== null || o.ancho !== null || o.alto !== null || o.estilo !== null) return true
  if (o.ladoIcono !== null || o.mayusculas !== null) return true
  return o.icono !== null && o.forma !== 'circle'
}

export interface MedidasBoton {
  /** Alto en px; `null` = el relleno vertical de hoy (cta_padding_y). */
  alto: number | null
  /** Relleno horizontal en px. */
  rellenoX: number
  /** Relleno vertical en px (solo sin alto). */
  rellenoY: number
  /** Ancho fijo en px (`null` = automático). */
  ancho: number | null
}

/** Medidas del botón rectangular (no círculo). `movil` = la fila del celular (alto ~36). */
export function medidasBoton(o: OpcionesBoton, ajustes: Ajustes, movil = false): MedidasBoton {
  const px = typeof ajustes?.cta_padding_x === 'number' ? (ajustes.cta_padding_x as number) : null
  const py = typeof ajustes?.cta_padding_y === 'number' ? (ajustes.cta_padding_y as number) : null
  if (movil) {
    // La fila del celular no crece: 36 px (o menos si se pidió un alto menor).
    return { alto: Math.min(o.alto ?? ALTO_BOTON.sm, ALTO_BOTON.sm), rellenoX: px ?? RELLENO_BOTON.sm, rellenoY: 0, ancho: o.ancho !== null ? Math.min(o.ancho, 140) : null }
  }
  const alto = o.alto ?? (o.tamano ? ALTO_BOTON[o.tamano] : null)
  return {
    alto,
    rellenoX: px ?? (o.tamano ? RELLENO_BOTON[o.tamano] : 16),
    rellenoY: py ?? 8,
    ancho: o.ancho,
  }
}

/** Diámetro del círculo: alto guardado, o el del tamaño, o 76 (el de hoy). */
export function diametroCirculo(o: OpcionesBoton): number {
  return o.alto ?? (o.tamano ? DIAMETRO_CIRCULO[o.tamano] : DIAMETRO_CIRCULO.lg)
}

/**
 * Radio del botón rectangular. Sin forma: el de hoy (`cta_border_radius ?? 8`); con el estilo
 * `tema`, el del estilo de botón del sitio (`--radio-boton`) con el de hoy como respaldo.
 */
export function radioBoton(o: OpcionesBoton, ajustes: Ajustes, porDefecto = 8): string {
  if (o.forma && o.forma !== 'circle') return `${RADIO_FORMA[o.forma]}px`
  const guardado = typeof ajustes?.cta_border_radius === 'number' ? (ajustes.cta_border_radius as number) : porDefecto
  return o.estilo === 'tema' ? `var(--radio-boton, ${guardado}px)` : `${guardado}px`
}

// ─── Menú inferior flotante con los enlaces del encabezado ────────────────────────────────────

export interface EnlaceEncabezado {
  name: string
  href: string
}

/** Ícono por el texto o la ruta del enlace (ICONOS_MENU del contrato). Sin pista, `link`. */
export function iconoDeEnlace(nombre: string, href: string): IconoMenu {
  const t = `${nombre} ${href}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (href === '/' || /\binicio\b|\bhome\b/.test(t)) return 'home'
  if (/reserv/.test(t)) return 'calendar'
  if (/agend|cita/.test(t)) return 'calendar-check'
  if (/tienda|producto|catalogo|comprar|shop/.test(t)) return 'bag'
  if (/carta|\bmenu\b|categor|platos/.test(t)) return 'grid'
  if (/contact|llam|telefono/.test(t)) return 'phone'
  if (/sede|ubicac|donde|llegar|mapa/.test(t)) return 'map-pin'
  if (/whatsapp/.test(t)) return 'whatsapp'
  if (/envio|rastre|pedido|seguimiento/.test(t)) return 'truck'
  if (/promo|oferta|descuento/.test(t)) return 'percent'
  if (/evento|experienc/.test(t)) return 'sparkles'
  if (/historia|nosotros|quienes/.test(t)) return 'heart'
  return 'link'
}

function botonDeDestino(id: string, label: string, href: string, icon: IconoMenu): BotonMenu | null {
  const etiqueta = label.trim().slice(0, 24)
  if (!etiqueta) return null
  if (href === 'whatsapp') return { id, action: 'whatsapp', label: etiqueta, icon: 'whatsapp', visible: true }
  if (href === 'maps') return { id, action: 'location', label: etiqueta, icon: 'map-pin', visible: true }
  if (href.startsWith('/')) return { id, action: 'page', label: etiqueta, icon, visible: true, target: href }
  if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) return { id, action: 'url', label: etiqueta, icon, visible: true, target: href }
  return null
}

/**
 * Píldora flotante de abajo (`header_pill_position` abajo/ambas sin menú inferior v2 guardado):
 * los enlaces del menú del encabezado, hasta 5. El botón principal va destacado en el centro y,
 * para que quepa, los enlaces se recortan a 4. Sin enlaces ni botón → `null` (no se pinta nada).
 */
export function menuFlotanteDesdeEncabezado(enlaces: EnlaceEncabezado[], boton: { texto: string; href: string } | null): MenuInferior | null {
  const cta = boton && boton.texto.trim() && boton.href
    ? botonDeDestino('pildora-cta', boton.texto, boton.href, /reserv/i.test(boton.href) ? 'calendar' : iconoDeEnlace(boton.texto, boton.href))
    : null
  const max = cta ? 4 : 5
  const vistos = new Set<string>()
  const items: BotonMenu[] = []
  for (const [i, e] of enlaces.entries()) {
    if (items.length >= max) break
    if (!e.href || vistos.has(e.href) || (cta && e.href === boton?.href)) continue
    const b = botonDeDestino(`pildora-${i}`, e.name, e.href, iconoDeEnlace(e.name, e.href))
    if (!b) continue
    vistos.add(e.href)
    items.push(b)
  }
  if (cta) items.splice(Math.floor(items.length / 2), 0, cta)
  if (items.length === 0) return null
  return {
    v: 2,
    enabled: true,
    variant: 'floating',
    items,
    style: { labels: 'always', ...(cta ? { centerId: cta.id } : {}) },
  }
}
