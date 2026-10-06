/**
 * Opciones del encabezado y del pie por plantilla (Figma «16 Sitio web» 2028:38223), leídas de
 * los ajustes efectivos del sitio (V2: `shell.*.opciones`; legacy: columnas de la migración
 * `sitio_encabezado_pie_v2`).
 *
 * Una sola lectura para todos los componentes: cada opción pasa por `normalizarOpcionShell` del
 * contrato (lib/website/v2/mapeoAjustes.ts, copia del ERP). Ausente, nula o fuera de la regla →
 * su default, que es el sitio de hoy. Por eso un sitio legacy sin las columnas (antes de la
 * migración) o un documento V2 sin estas claves se pinta exactamente igual que antes.
 *
 * Puro: servidor, navegador y scripts/verify-encabezado-pie.mjs.
 */
import {
  ACCIONES_BARRA_MOVIL,
  normalizarOpcionShell,
} from './v2/mapeoAjustes'
import type { HorarioSemana } from '@/lib/restaurant/horario'

export type AccionBarraMovil = (typeof ACCIONES_BARRA_MOVIL)[number]

/**
 * Idiomas con traducción en el sitio público. Hoy solo español: el selector de idioma existe
 * (header_show_language + site_locales) pero NO se pinta mientras no haya traducciones, para
 * no ofrecer un idioma que no cambia nada. Cuando haya traducciones, se añaden aquí y el
 * selector aparece solo en los sitios que lo activaron. Es la única guarda.
 */
export const IDIOMAS_DISPONIBLES: readonly string[] = ['es-CO']

export const NOMBRE_IDIOMA: Readonly<Record<string, { corto: string; largo: string }>> = {
  'es-CO': { corto: 'ES', largo: 'Español' },
  en: { corto: 'EN', largo: 'English' },
  fr: { corto: 'FR', largo: 'Français' },
  pt: { corto: 'PT', largo: 'Português' },
}

export interface OpcionesEncabezadoPie {
  /** Segundo botón; `null` sin texto o sin enlace (lo de hoy). */
  boton2: { texto: string; url: string } | null
  topbar: { estadoSede: boolean; envioGratis: boolean; cupos: boolean }
  /** `true` = selector de sede dentro del encabezado; `false` = franja de hoy. */
  selectorSedeEnEncabezado: boolean
  /** Idiomas que el selector ofrece (ya filtrados por IDIOMAS_DISPONIBLES); vacío = sin selector. */
  idiomas: string[]
  barraReserva: boolean
  fuenteMenu: 'menu' | 'categorias_carta'
  /** `auto` (hoy: solo restaurantes), `ninguna` o la lista de acciones. */
  barraMovil: 'auto' | 'ninguna' | AccionBarraMovil[]
  pie: {
    whatsapp: boolean
    mapa: boolean
    mediosPago: boolean
    fondoTema: boolean
    /** Color fijo del texto del pie; `null` = sigue el tema / el fondo (hoy). */
    colorTexto: string | null
    /** Líneas separadoras (hoy: sí). */
    separadores: boolean
  }
  /** Selector de moneda en el encabezado (hoy: sí, con 2 o más monedas). */
  moneda: boolean
  /** Color fijo del texto y los enlaces del encabezado; `null` = sigue el tema (hoy). */
  colorTextoEncabezado: string | null
  /** Encabezado fijo al bajar (hoy: sí). */
  fijo: boolean
}

type Ajustes = Record<string, unknown> | null | undefined

function leer(ajustes: Ajustes, columna: string): unknown {
  return normalizarOpcionShell(columna, ajustes ? ajustes[columna] : undefined)
}

export function opcionesEncabezadoPie(ajustes: Ajustes): OpcionesEncabezadoPie {
  const texto2 = leer(ajustes, 'header_cta2_text') as string | null
  const url2 = leer(ajustes, 'header_cta2_url') as string | null
  const mostrarIdioma = leer(ajustes, 'header_show_language') === true
  const locales = leer(ajustes, 'site_locales') as string[]
  const idiomas = mostrarIdioma ? locales.filter((l) => IDIOMAS_DISPONIBLES.includes(l)) : []
  return {
    boton2: texto2 && url2 ? { texto: texto2, url: url2 } : null,
    topbar: {
      estadoSede: leer(ajustes, 'topbar_show_branch_status') === true,
      envioGratis: leer(ajustes, 'topbar_show_free_shipping') === true,
      cupos: leer(ajustes, 'topbar_show_availability') === true,
    },
    selectorSedeEnEncabezado: leer(ajustes, 'header_show_branch_selector') === true,
    // Con un solo idioma no hay nada que elegir: sin selector.
    idiomas: idiomas.length >= 2 ? idiomas : [],
    barraReserva: leer(ajustes, 'header_booking_bar') === true,
    fuenteMenu: leer(ajustes, 'header_menu_source') === 'categorias_carta' ? 'categorias_carta' : 'menu',
    barraMovil: leer(ajustes, 'mobile_bottom_bar') as OpcionesEncabezadoPie['barraMovil'],
    pie: {
      whatsapp: leer(ajustes, 'footer_show_whatsapp') === true,
      mapa: leer(ajustes, 'footer_show_map') === true,
      mediosPago: leer(ajustes, 'footer_show_payment_methods') === true,
      fondoTema: leer(ajustes, 'footer_background') === 'tema',
      colorTexto: leer(ajustes, 'footer_text_color') as string | null,
      separadores: leer(ajustes, 'footer_show_dividers') !== false,
    },
    moneda: leer(ajustes, 'header_show_currency') !== false,
    colorTextoEncabezado: leer(ajustes, 'header_text_color') as string | null,
    fijo: leer(ajustes, 'header_sticky') !== false,
  }
}

/** Enlaces que resuelve el servidor para los destinos especiales y la barra móvil. */
export interface EnlacesSitio {
  whatsapp: string | null
  comoLlegar: string | null
  llamar: string | null
}

/**
 * `href` de un botón del encabezado: `whatsapp` y `maps` salen del sitio (número de WhatsApp,
 * dirección de la sede); sin dato → `null` y el botón no se pinta. El resto, tal cual (ya
 * validado por el contrato: ruta propia, https, tel: o mailto:).
 */
export function hrefBoton(url: string | null | undefined, enlaces: EnlacesSitio | null | undefined): string | null {
  if (!url) return null
  if (url === 'whatsapp') return enlaces?.whatsapp ?? null
  if (url === 'maps') return enlaces?.comoLlegar ?? null
  return url
}

/** `true` si el enlace sale del sitio (se abre en otra pestaña). */
export function esEnlaceExterno(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

/** «Envío gratis desde $ 100.000» (pesos sin decimales, como el resto del sitio). */
export function textoEnvioGratis(umbral: number | null | undefined): string | null {
  if (typeof umbral !== 'number' || !Number.isFinite(umbral) || umbral <= 0) return null
  return `Envío gratis desde $ ${Math.round(umbral).toLocaleString('es-CO')}`
}

/** «12 cupos libres» / «1 cupo libre» / «Sin cupos libres». */
export function textoCupos(libres: number | null | undefined): string | null {
  if (typeof libres !== 'number' || !Number.isFinite(libres) || libres < 0) return null
  if (libres === 0) return 'Sin cupos libres'
  return libres === 1 ? '1 cupo libre' : `${libres} cupos libres`
}

// ─── Datos que resuelve el servidor (lib/website/extrasEncabezadoPie.server.ts) ───

export interface SedeEstado {
  id: number
  nombre: string
  direccion: string | null
  horario: HorarioSemana | null
  zonaHoraria: string
}

export interface AccionBarra {
  accion: AccionBarraMovil
  href: string
}

export interface ItemMenuCarta {
  name: string
  href: string
}

export interface ExtrasEncabezadoPie {
  enlaces: EnlacesSitio
  /** Sede de la página (o la principal) para «Abierto ahora»; con la organización si no hay sedes publicadas. */
  sedeEstado: SedeEstado | null
  mapaEmbebido: string | null
  envioGratisDesde: number | null
  cuposLibres: number | null
  mediosPago: string[]
  categoriasCarta: ItemMenuCarta[] | null
  /** Barra de reserva del hotel: a dónde van las fechas (`/reservas` con checkin/checkout). */
  rutaReservas: string
  /** Barra móvil con lista de acciones: las que aplican, en el orden pedido. `null` = auto/ninguna. */
  barraMovil: AccionBarra[] | null
}

export const EXTRAS_VACIOS: ExtrasEncabezadoPie = {
  enlaces: { whatsapp: null, comoLlegar: null, llamar: null },
  sedeEstado: null,
  mapaEmbebido: null,
  envioGratisDesde: null,
  cuposLibres: null,
  mediosPago: [],
  categoriasCarta: null,
  rutaReservas: '/reservas',
  barraMovil: null,
}

