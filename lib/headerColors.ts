import { ajustarHastaContraste, hexARgb, rgbAHex } from './website/v2/contrasteColor'
import { colorDivisorEfectivo, colorHexValido, colorHoverEfectivo, luminanciaHex } from './website/encabezadoEstilo'

/**
 * Color utilities for header/topbar/nav customization.
 *
 * Strategy: user picks a background color (hex). Text color is auto-computed
 * (white or black) based on the luminance of the background, ensuring
 * WCAG AA contrast by default. The user does NOT need to pick a text color.
 */

/**
 * Returns the relative luminance of a hex color (0-1).
 * Uses the WCAG 2.0 formula.
 */
function hexLuminance(hex: string): number {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return 1; // fallback: treat invalid as white
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Returns '#ffffff' or '#000000' depending on which has better contrast
 * against the given background hex color.
 */
export function getContrastTextColor(bgHex: string | null | undefined): string {
  if (!bgHex) return ''; // empty → inherit from CSS
  const lum = hexLuminance(bgHex);
  return lum > 0.5 ? '#111827' : '#ffffff'; // gray-900 or white
}

/**
 * Returns a semi-transparent version of a hex color with the given opacity
 * (0-100). If no hex color is provided, returns '' (inherit from CSS).
 */
export function hexWithOpacity(hex: string | null | undefined, opacity: number): string {
  if (!hex) return '';
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return '';
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
}

/**
 * Returns a slightly darker version of a hex color (for hover states).
 * If no hex color is provided, returns ''.
 */
export function darkenHex(hex: string | null | undefined, amount = 0.1): string {
  if (!hex) return '';
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return '';
  const r = Math.max(0, Math.round(parseInt(normalized.slice(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(normalized.slice(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(normalized.slice(4, 6), 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Returns a slightly lighter version of a hex color (for hover on dark bg).
 */
export function lightenHex(hex: string | null | undefined, amount = 0.1): string {
  if (!hex) return '';
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return '';
  const r = Math.min(255, Math.round(parseInt(normalized.slice(0, 2), 16) + (255 - parseInt(normalized.slice(0, 2), 16)) * amount));
  const g = Math.min(255, Math.round(parseInt(normalized.slice(2, 4), 16) + (255 - parseInt(normalized.slice(2, 4), 16)) * amount));
  const b = Math.min(255, Math.round(parseInt(normalized.slice(4, 6), 16) + (255 - parseInt(normalized.slice(4, 6), 16)) * amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Returns the hover color for text on a given background:
 * - On light bg: darken the text color
 * - On dark bg: lighten the text color
 */
export function getHoverTextColor(bgHex: string | null | undefined): string {
  if (!bgHex) return '';
  const lum = hexLuminance(bgHex);
  if (lum > 0.5) {
    // light bg → text is dark → hover slightly darker
    return darkenHex('#111827', 0.2);
  }
  // dark bg → text is white → hover slightly lighter (light gray)
  return lightenHex('#ffffff', 0.15);
}

export interface HeaderColors {
  /** Background color for the main header row (hex or null) */
  headerBg: string | null;
  /** Background color for the topbar (hex or null → inherits header) */
  topbarBg: string | null;
  /** Background color for the nav row (hex or null → inherits header) */
  navBg: string | null;
  /** Accent color for links/hover/badges (hex or null → uses primaryColor) */
  accent: string | null;
  /** Auto-computed text color for the header (white or dark) */
  headerText: string;
  /** Auto-computed text color for the topbar */
  topbarText: string;
  /** Auto-computed text color for the nav row */
  navText: string;
  /** Hover text color for the header */
  headerHover: string;
  /** Hover text color for the topbar */
  topbarHover: string;
  /** Hover text color for the nav row */
  navHover: string;
  /** Effective accent color (accent or primaryColor fallback) */
  accentEffective: string;
}

/**
 * Computes all derived colors from the user-configurable settings.
 * Pass `primaryColor` as the fallback for the accent color.
 */
export function computeHeaderColors(
  settings: {
    header_bg_color?: string | null;
    topbar_bg_color?: string | null;
    nav_bg_color?: string | null;
    accent_color?: string | null;
  } | null | undefined,
  primaryColor: string,
): HeaderColors {
  const headerBg = settings?.header_bg_color ?? null;
  const topbarBg = settings?.topbar_bg_color ?? null;
  const navBg = settings?.nav_bg_color ?? null;
  const accent = settings?.accent_color ?? null;
  const accentEffective = accent || primaryColor;

  return {
    headerBg,
    topbarBg,
    navBg,
    accent,
    headerText: getContrastTextColor(headerBg),
    topbarText: getContrastTextColor(topbarBg || headerBg),
    navText: getContrastTextColor(navBg || headerBg),
    headerHover: getHoverTextColor(headerBg),
    topbarHover: getHoverTextColor(topbarBg || headerBg),
    navHover: getHoverTextColor(navBg || headerBg),
    accentEffective,
  };
}

/**
 * Colores del menú móvil. Los grises son los de hoy (Tailwind) sobre fondo claro:
 * sin color guardado y sin fondo propio, el CSS los pinta y el sitio se ve igual.
 */
export const GRISES_MENU_CLARO = {
  texto: '#374151',
  suave: '#4b5563',
  titulo: '#111827',
  divisor: '#f3f4f6',
  monedaTexto: '#6b7280',
  monedaValor: '#111827',
  monedaBorde: '#e5e7eb',
  monedaIcono: '#9ca3af',
  icono: '#374151',
  salir: '#DC2626',
  salirBorde: '#FECACA',
} as const

export interface TemaMenuMovil {
  /** Fondo del tema, para mezclar un encabezado con opacidad. */
  fondo?: string | null
  oscuro?: boolean
  primario?: string | null
}

export interface AjustesMenuMovil {
  header_bg_color?: string | null
  header_opacity?: number | string | null
  header_text_color?: string | null
  header_divider_color?: string | null
  header_hover_color?: string | null
  header_mobile_icon_color?: string | null
  mobile_menu_bg_color?: string | null
  mobile_menu_text_color?: string | null
  mobile_menu_link_hover_color?: string | null
  mobile_menu_link_active_color?: string | null
  mobile_menu_title_color?: string | null
  mobile_menu_divider_color?: string | null
  mobile_menu_currency_text_color?: string | null
  mobile_menu_currency_border_color?: string | null
  mobile_menu_currency_bg_color?: string | null
  mobile_menu_login_bg_color?: string | null
  mobile_menu_login_text_color?: string | null
  mobile_menu_register_border_color?: string | null
  mobile_menu_register_text_color?: string | null
  mobile_menu_logout_color?: string | null
}

export interface ColoresMenuMovil {
  fondo: string
  fondoBarra: string
  texto: string
  textoSuave: string
  hoverFondo: string
  hoverTexto: string
  activo: string
  titulo: string
  divisor: string
  monedaTexto: string
  monedaValor: string
  monedaBorde: string
  monedaFondo: string
  monedaIcono: string
  loginFondo: string
  loginTexto: string
  registroBorde: string
  registroTexto: string
  salir: string
  salirBorde: string
  iconoBarra: string
  /** Hay que pintar el paquete en línea: el fondo es propio (claro u oscuro) o hay un color del menú. */
  fijar: boolean
  hoverExplicito: boolean
  activoExplicito: boolean
  superficiePropia: boolean
}

function hex(valor: unknown): string {
  return colorHexValido(valor)
}

function mezclar(base: string, tinta: string, t: number): string {
  const a = hexARgb(base)
  const b = hexARgb(tinta)
  if (!a || !b) return hex(base) || base
  const u = Math.min(1, Math.max(0, t))
  return rgbAHex({
    r: a.r + (b.r - a.r) * u,
    g: a.g + (b.g - a.g) * u,
    b: a.b + (b.b - a.b) * u,
  })
}

function esOscuro(color: string): boolean {
  const lum = luminanciaHex(color)
  return lum !== null && lum <= 0.5
}

function opacidad(settings: AjustesMenuMovil | null | undefined): number {
  const n = Number(settings?.header_opacity)
  if (!Number.isFinite(n)) return 95
  return Math.min(100, Math.max(0, n))
}

function debajo(tema?: TemaMenuMovil | null): string {
  const fondo = hex(tema?.fondo)
  if (fondo) return fondo
  return tema?.oscuro ? '#111827' : '#FFFFFF'
}

/** Mueve el color hacia negro o blanco hasta AA 4,5:1. Si ya cumple, lo normaliza. */
function asegurar(color: string, fondo: string): string {
  const fondoHex = hex(fondo) || '#FFFFFF'
  const base = hex(color) || (esOscuro(fondoHex) ? '#FFFFFF' : '#111827')
  return ajustarHastaContraste(base, fondoHex) || (esOscuro(fondoHex) ? '#FFFFFF' : '#111827')
}

function suaveDe(texto: string, fondo: string): string {
  return asegurar(mezclar(fondo, texto, 0.72), fondo)
}

/**
 * Colores efectivos del menú móvil.
 * Configurado → heredado (texto, divisor y hover del encabezado, primario) → contraste del fondo.
 */
export function resolverColoresMenuMovil(
  settings: AjustesMenuMovil | null | undefined,
  tema?: TemaMenuMovil | null,
): ColoresMenuMovil {
  const s = settings ?? {}
  const headerBg = hex(s.header_bg_color)
  const menuBg = hex(s.mobile_menu_bg_color)
  const textoPedido = hex(s.mobile_menu_text_color)
  const textoEncabezado = hex(s.header_text_color)
  const tituloPedido = hex(s.mobile_menu_title_color)
  const divisorPedido = hex(s.mobile_menu_divider_color)
  const divisorEncabezado = hex(s.header_divider_color)
  const hoverPedido = hex(s.mobile_menu_link_hover_color)
  const activoPedido = hex(s.mobile_menu_link_active_color)
  const iconoPedido = hex(s.header_mobile_icon_color)
  const monedaTextoPedido = hex(s.mobile_menu_currency_text_color)
  const monedaBordePedido = hex(s.mobile_menu_currency_border_color)
  const monedaFondoPedido = hex(s.mobile_menu_currency_bg_color)
  const loginFondoPedido = hex(s.mobile_menu_login_bg_color)
  const loginTextoPedido = hex(s.mobile_menu_login_text_color)
  const registroBordePedido = hex(s.mobile_menu_register_border_color)
  const registroTextoPedido = hex(s.mobile_menu_register_text_color)
  const salirPedido = hex(s.mobile_menu_logout_color)
  const primario = hex(tema?.primario) || '#111827'

  const fondoBarra = headerBg ? mezclar(debajo(tema), headerBg, opacidad(s) / 100) : (tema?.oscuro ? (hex(tema.fondo) || '#111827') : '#FFFFFF')
  const fondo = menuBg || (headerBg ? fondoBarra : fondoBarra)
  const superficiePropia = Boolean(menuBg || headerBg)
  const oscuro = esOscuro(fondo)
  const barraOscura = esOscuro(fondoBarra)

  const hayColorMenu = Boolean(
    textoPedido || tituloPedido || divisorPedido || hoverPedido || activoPedido || iconoPedido
    || monedaTextoPedido || monedaBordePedido || monedaFondoPedido
    || loginFondoPedido || loginTextoPedido || registroBordePedido || registroTextoPedido || salirPedido
    || menuBg,
  )
  const fijar = superficiePropia || hayColorMenu

  const textoBase = textoPedido || (oscuro ? (textoEncabezado || '#FFFFFF') : (textoEncabezado || GRISES_MENU_CLARO.texto))
  const texto = fijar || textoPedido || textoEncabezado ? asegurar(textoBase, fondo) : GRISES_MENU_CLARO.texto
  const tituloBase = tituloPedido || (oscuro ? (textoEncabezado || '#FFFFFF') : (textoEncabezado || GRISES_MENU_CLARO.titulo))
  const titulo = fijar || tituloPedido || textoEncabezado ? asegurar(tituloBase, fondo) : GRISES_MENU_CLARO.titulo
  const textoSuave = oscuro || textoPedido ? suaveDe(texto, fondo) : GRISES_MENU_CLARO.suave

  const divisor = divisorPedido
    || divisorEncabezado
    || (oscuro && superficiePropia ? (colorDivisorEfectivo(null, fondo) || mezclar(fondo, texto, 0.1)) : GRISES_MENU_CLARO.divisor)

  let hoverFondo = colorHoverEfectivo(s.header_hover_color, superficiePropia ? fondo : null) || (oscuro ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)')
  let hoverTexto = texto
  if (hoverPedido) {
    hoverTexto = asegurar(hoverPedido, fondo)
    hoverFondo = mezclar(fondo, hoverPedido, 0.1)
  }

  const activo = activoPedido ? asegurar(activoPedido, fondo) : titulo

  const iconoBarra = iconoPedido
    ? asegurar(iconoPedido, fondoBarra)
    : textoEncabezado
      ? asegurar(textoEncabezado, fondoBarra)
      : barraOscura && (headerBg || tema?.oscuro)
        ? asegurar('#FFFFFF', fondoBarra)
        : GRISES_MENU_CLARO.icono

  const superficieMoneda = monedaFondoPedido || fondo
  const monedaTexto = monedaTextoPedido
    ? asegurar(monedaTextoPedido, superficieMoneda)
    : (oscuro || fijar)
      ? asegurar(GRISES_MENU_CLARO.monedaTexto, superficieMoneda)
      : GRISES_MENU_CLARO.monedaTexto
  const monedaValor = monedaTextoPedido
    ? asegurar(monedaTextoPedido, superficieMoneda)
    : (oscuro || fijar)
      ? asegurar(GRISES_MENU_CLARO.monedaValor, superficieMoneda)
      : GRISES_MENU_CLARO.monedaValor
  const monedaBorde = monedaBordePedido
    || (oscuro ? mezclar(fondo, texto, 0.18) : GRISES_MENU_CLARO.monedaBorde)
  const monedaIcono = (oscuro || fijar) ? suaveDe(texto, superficieMoneda) : GRISES_MENU_CLARO.monedaIcono

  const loginFondo = loginFondoPedido || primario
  const loginTexto = asegurar(loginTextoPedido || '#FFFFFF', loginFondo)

  const registroTexto = asegurar(registroTextoPedido || primario, monedaFondoPedido ? superficieMoneda : fondo)
  const registroBorde = registroBordePedido ? asegurar(registroBordePedido, fondo) : registroTexto

  const salirBase = salirPedido || (oscuro ? '#F87171' : GRISES_MENU_CLARO.salir)
  const salir = asegurar(salirBase, fondo)
  const salirBorde = oscuro ? mezclar(fondo, salir, 0.45) : GRISES_MENU_CLARO.salirBorde

  return {
    fondo,
    fondoBarra,
    texto,
    textoSuave,
    hoverFondo,
    hoverTexto,
    activo,
    titulo,
    divisor,
    monedaTexto,
    monedaValor,
    monedaBorde,
    monedaFondo: monedaFondoPedido || 'transparent',
    monedaIcono,
    loginFondo,
    loginTexto,
    registroBorde,
    registroTexto,
    salir,
    salirBorde,
    iconoBarra,
    fijar,
    hoverExplicito: Boolean(hoverPedido),
    activoExplicito: Boolean(activoPedido),
    superficiePropia,
  }
}

function poner(vars: Record<string, string>, clave: string, valor: string) {
  if (valor) vars[clave] = valor
}

/**
 * Variables CSS del menú. Vacío cuando el fondo no es propio y no hay colores:
 * el stylesheet (claro, `.dark` y tema) sigue pintando los grises de hoy.
 * El texto de «Iniciar sesión» se emite si el blanco sobre el primario no llega a AA.
 */
export function variablesMenuMovil(
  settings: AjustesMenuMovil | null | undefined,
  tema?: TemaMenuMovil | null,
): Record<string, string> {
  const c = resolverColoresMenuMovil(settings, tema)
  const s = settings ?? {}
  const vars: Record<string, string> = {}
  const loginPedido = Boolean(hex(s.mobile_menu_login_bg_color) || hex(s.mobile_menu_login_text_color))
  const loginDistinto = c.loginTexto.toUpperCase() !== '#FFFFFF'
  if (c.fijar) {
    poner(vars, '--mm-bg', c.fondo)
    poner(vars, '--mm-fg', c.texto)
    poner(vars, '--mm-fg-muted', c.textoSuave)
    poner(vars, '--mm-hover-bg', c.hoverFondo)
    poner(vars, '--mm-hover-fg', c.hoverTexto)
    poner(vars, '--mm-active', c.activo)
    poner(vars, '--mm-title', c.titulo)
    poner(vars, '--mm-divider', c.divisor)
    poner(vars, '--mm-cur-text', c.monedaTexto)
    poner(vars, '--mm-cur-value', c.monedaValor)
    poner(vars, '--mm-cur-border', c.monedaBorde)
    poner(vars, '--mm-cur-bg', c.monedaFondo)
    poner(vars, '--mm-cur-icon', c.monedaIcono)
    poner(vars, '--mm-login-bg', c.loginFondo)
    poner(vars, '--mm-login-text', c.loginTexto)
    poner(vars, '--mm-register-border', c.registroBorde)
    poner(vars, '--mm-register-text', c.registroTexto)
    poner(vars, '--mm-logout', c.salir)
    poner(vars, '--mm-logout-border', c.salirBorde)
    poner(vars, '--hdr-mobile-icon', c.iconoBarra)
    return vars
  }
  if (hex(s.mobile_menu_text_color) || hex(s.header_text_color)) poner(vars, '--mm-fg', c.texto)
  if (hex(s.mobile_menu_title_color) || hex(s.header_text_color)) poner(vars, '--mm-title', c.titulo)
  if (hex(s.header_text_color) || hex(s.mobile_menu_text_color)) poner(vars, '--mm-fg-muted', c.textoSuave)
  if (hex(s.mobile_menu_divider_color) || hex(s.header_divider_color)) poner(vars, '--mm-divider', c.divisor)
  if (c.hoverExplicito) {
    poner(vars, '--mm-hover-bg', c.hoverFondo)
    poner(vars, '--mm-hover-fg', c.hoverTexto)
  }
  if (c.activoExplicito) poner(vars, '--mm-active', c.activo)
  if (hex(s.header_mobile_icon_color) || hex(s.header_text_color)) poner(vars, '--hdr-mobile-icon', c.iconoBarra)
  if (hex(s.mobile_menu_currency_text_color)) {
    poner(vars, '--mm-cur-text', c.monedaTexto)
    poner(vars, '--mm-cur-value', c.monedaValor)
  }
  if (hex(s.mobile_menu_currency_border_color)) poner(vars, '--mm-cur-border', c.monedaBorde)
  if (hex(s.mobile_menu_currency_bg_color)) poner(vars, '--mm-cur-bg', c.monedaFondo)
  if (loginPedido || loginDistinto) {
    poner(vars, '--mm-login-bg', c.loginFondo)
    poner(vars, '--mm-login-text', c.loginTexto)
  }
  const registroPedido = Boolean(hex(s.mobile_menu_register_border_color) || hex(s.mobile_menu_register_text_color))
  const fondoAuth = hex(tema?.fondo) || '#FFFFFF'
  const registroFalla = tema?.oscuro && asegurar(hex(tema?.primario) || '#111827', fondoAuth).toUpperCase() !== (hex(tema?.primario) || '#111827').toUpperCase()
  if (registroPedido || registroFalla) {
    poner(vars, '--mm-register-border', c.registroBorde)
    poner(vars, '--mm-register-text', c.registroTexto)
  }
  if (hex(s.mobile_menu_logout_color) || (tema?.oscuro && c.salir.toUpperCase() !== '#DC2626' && c.salir.toUpperCase() !== '#F87171')) {
    poner(vars, '--mm-logout', c.salir)
    poner(vars, '--mm-logout-border', c.salirBorde)
  }
  return vars
}

export function atributosMenuMovil(
  settings: AjustesMenuMovil | null | undefined,
  tema?: TemaMenuMovil | null,
): { 'data-mm-hover'?: ''; 'data-mm-activo'?: '' } {
  const c = resolverColoresMenuMovil(settings, tema)
  return {
    ...(c.hoverExplicito ? { 'data-mm-hover': '' as const } : {}),
    ...(c.activoExplicito ? { 'data-mm-activo': '' as const } : {}),
  }
}
