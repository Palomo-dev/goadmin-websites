/**
 * Boletín de la sección `newsletter`.
 *
 * Sin `newsletter_layout` ni objeto `newsletter`, devuelve null: la variante
 * de hoy (simple, banner, con imagen) sigue igual y el botón no envía.
 * No hay tabla de suscriptores: `validarEnvio` solo decide el mensaje en
 * pantalla. No escribe en la base.
 */

const LAYOUTS = ['centered', 'image_left', 'image_right', 'image_top', 'image_bottom', 'card_floating', 'inline_bar', 'split_bg'] as const
const ALINEA = ['left', 'center', 'right'] as const
const AJUSTE = ['cover', 'contain'] as const
const FOCO = ['center', 'top', 'bottom', 'left', 'right'] as const
const ANCHO = ['content', 'full'] as const
const GRADIENTE = ['linear', 'radial'] as const
const DISPOSICION = ['inline', 'stacked', 'inside'] as const
const ESTILO_INPUT = ['outline', 'filled', 'underline'] as const
const FORMA = ['square', 'rounded', 'semi', 'pill'] as const
const TAM = ['sm', 'md', 'lg'] as const
const ESTILO_BOTON = ['solid', 'outline', 'gradient', 'icon_only'] as const
const TAM_TEXTO = ['sm', 'md', 'lg', 'xl', '2xl', '3xl'] as const
const PESOS = ['normal', 'medium', 'semibold', 'bold'] as const
const DISPARO = ['enter', 'delay', 'exit'] as const

export type LayoutBoletin = (typeof LAYOUTS)[number]

export interface TextoBoletin {
  text?: string
  font?: string
  size?: (typeof TAM_TEXTO)[number]
  weight?: (typeof PESOS)[number]
  color?: string
}

export interface Boletin {
  layout: LayoutBoletin
  align: (typeof ALINEA)[number]
  media?: {
    desktop?: string
    mobile?: string
    fit: (typeof AJUSTE)[number]
    radius?: number
    shadow?: boolean
    focal: (typeof FOCO)[number]
    hideMobile?: boolean
  }
  background?: {
    color?: string
    gradient?: string[]
    angle?: number
    gradientType: (typeof GRADIENTE)[number]
    image?: string
    overlay?: string
    overlayOpacity?: number
    pattern?: boolean
    padding?: number
    width: (typeof ANCHO)[number]
  }
  container?: {
    color?: string
    border?: string
    borderWidth?: number
    radius?: number
    shadow?: boolean
    padding?: number
    maxWidth?: number
  }
  eyebrow?: TextoBoletin
  title: TextoBoletin
  description?: TextoBoletin
  legal?: TextoBoletin & { href?: string }
  success: string
  error: string
  incentive?: string
  social: boolean
  form: {
    showName: boolean
    showPhone: boolean
    showBirthday: boolean
    showConsent: boolean
    consentLabel: string
    consentHref?: string
    arrangement: (typeof DISPOSICION)[number]
    placeholder: string
    input: {
      style: (typeof ESTILO_INPUT)[number]
      shape: (typeof FORMA)[number]
      borderWidth?: number
      borderColor?: string
      focusColor?: string
      background?: string
      color?: string
      placeholderColor?: string
      icon: boolean
      size: (typeof TAM)[number]
    }
    button: {
      text: string
      icon: boolean
      style: (typeof ESTILO_BOTON)[number]
      shape: (typeof FORMA)[number]
      size: (typeof TAM)[number]
      color?: string
      textColor?: string
      hover?: string
    }
  }
  popup?: {
    enabled: boolean
    trigger: (typeof DISPARO)[number]
    delay: number
  }
}

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

function enLista<T extends string>(lista: readonly T[], valor: unknown): T | undefined {
  return typeof valor === 'string' && (lista as readonly string[]).includes(valor) ? (valor as T) : undefined
}

function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, unknown>) : {}
}

function texto(valor: unknown, max = 300): string | undefined {
  if (typeof valor !== 'string') return undefined
  const t = valor.trim()
  return t ? t.slice(0, max) : undefined
}

function color(valor: unknown): string | undefined {
  if (typeof valor !== 'string' || !HEX.test(valor.trim())) return undefined
  return valor.trim()
}

function entero(valor: unknown, min: number, max: number): number | undefined {
  const n = typeof valor === 'number' ? valor : typeof valor === 'string' && valor.trim() ? Number(valor) : NaN
  if (!Number.isFinite(n)) return undefined
  const r = Math.round(n)
  return r >= min && r <= max ? r : undefined
}

function urlSegura(valor: unknown): string | undefined {
  const t = texto(valor, 500)
  if (!t) return undefined
  if (t.startsWith('/') || /^https?:\/\//i.test(t)) return t
  return undefined
}

function fuente(valor: unknown): string | undefined {
  const t = texto(valor, 80)
  if (!t) return undefined
  if (t === 'site' || /^[A-Za-z0-9 ]+$/.test(t)) return t
  return undefined
}

function pieza(base: Record<string, unknown>, prefijo: string, suelto?: unknown): TextoBoletin | undefined {
  const text = texto(suelto ?? base[prefijo], 300)
  const font = fuente(base[`${prefijo}_font`])
  const size = enLista(TAM_TEXTO, base[`${prefijo}_size`])
  const weight = enLista(PESOS, base[`${prefijo}_weight`])
  const col = color(base[`${prefijo}_color`])
  if (!text && !font && !size && !weight && !col) return undefined
  return { text, font, size, weight, color: col }
}

/** Correo con forma de dirección. Vacío o sin dominio: no pasa. */
export function validarEnvio(email: string, consentimiento: boolean, requiereConsentimiento: boolean): 'ok' | 'correo' | 'aceptacion' {
  const t = email.trim()
  if (t.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return 'correo'
  if (requiereConsentimiento && !consentimiento) return 'aceptacion'
  return 'ok'
}

/**
 * null = la variante de hoy. `layout` (centrado / izquierda / dividido) es
 * la clave vieja y no activa este lector.
 */
export function leerBoletin(content: unknown): Boletin | null {
  if (!content || typeof content !== 'object') return null
  const c = content as Record<string, unknown>
  const layout = enLista(LAYOUTS, c.newsletter_layout)
  const n = objeto(c.newsletter)
  const hayObjeto = Object.keys(n).length > 0
  if (!layout && !hayObjeto) return null

  const media = objeto(n.media)
  const fondo = objeto(n.background)
  const caja = objeto(n.container)
  const textos = objeto(n.texts)
  const form = objeto(n.form)
  const input = objeto(form.input)
  const boton = objeto(form.button)
  const popup = objeto(n.popup)

  const gradiente = [color(fondo.gradient_1), color(fondo.gradient_2), color(fondo.gradient_3)].filter((x): x is string => !!x)
  const layoutFinal = layout || 'centered'
  const pideImagen = layoutFinal === 'image_left' || layoutFinal === 'image_right' || layoutFinal === 'image_top' || layoutFinal === 'image_bottom' || layoutFinal === 'split_bg'
  const desktop = urlSegura(media.desktop) || (pideImagen ? urlSegura(c.image_url) : undefined)
  const movil = urlSegura(media.mobile)
  const hayMedia = !!(desktop || movil || media.fit || media.radius != null || media.shadow != null || media.focal || media.hide_mobile != null)
  const hayFondo = !!(color(fondo.color) || gradiente.length || urlSegura(fondo.image) || color(fondo.overlay) || fondo.overlay_opacity != null || fondo.pattern != null || fondo.padding != null || fondo.width)
  const hayCaja = !!(color(caja.color) || color(caja.border) || caja.border_width != null || caja.radius != null || caja.shadow != null || caja.padding != null || caja.max_width != null)

  const eyebrow = pieza(textos, 'eyebrow')
  const titleExtra = pieza(textos, 'title')
  const descriptionExtra = pieza(textos, 'description', textos.description)
  const legalExtra = pieza(textos, 'legal', textos.legal)
  const legalHref = urlSegura(textos.legal_href)

  const boletin: Boletin = {
    layout: layoutFinal,
    align: enLista(ALINEA, n.align) || (layout === 'centered' || layout === 'image_top' || layout === 'image_bottom' || layout === 'card_floating' || !layout ? 'center' : 'left'),
    eyebrow,
    title: {
      text: texto(c.title, 200),
      font: titleExtra?.font,
      size: titleExtra?.size,
      weight: titleExtra?.weight,
      color: titleExtra?.color,
    },
    description: descriptionExtra
      ? { ...descriptionExtra, text: descriptionExtra.text || texto(c.subtitle, 400) }
      : (texto(c.subtitle, 400) ? { text: texto(c.subtitle, 400) } : undefined),
    legal: legalExtra || legalHref || texto(c.disclaimer, 400)
      ? { ...(legalExtra || {}), text: legalExtra?.text || texto(c.disclaimer, 400), href: legalHref }
      : undefined,
    success: texto(n.success, 200) || 'Listo. Revisa tu correo.',
    error: texto(n.error, 200) || 'Revisa el correo e inténtalo de nuevo.',
    incentive: texto(n.incentive, 120),
    social: n.social === true,
    form: {
      showName: form.show_name === true,
      showPhone: form.show_phone === true,
      showBirthday: form.show_birthday === true,
      showConsent: form.show_consent === true,
      consentLabel: texto(form.consent_label, 180) || 'Acepto el tratamiento de mis datos',
      consentHref: urlSegura(form.consent_href),
      arrangement: enLista(DISPOSICION, form.arrangement) || 'inline',
      placeholder: texto(form.placeholder, 80) || texto(c.placeholder, 80) || 'Tu email',
      input: {
        style: enLista(ESTILO_INPUT, input.style) || 'outline',
        shape: enLista(FORMA, input.shape) || 'rounded',
        borderWidth: entero(input.border_width, 0, 8),
        borderColor: color(input.border_color) || color(c.input_border_color),
        focusColor: color(input.focus_color),
        background: color(input.background) || color(c.input_bg_color),
        color: color(input.color) || color(c.input_text_color),
        placeholderColor: color(input.placeholder_color),
        icon: input.icon === true,
        size: enLista(TAM, input.size) || 'md',
      },
      button: {
        text: texto(boton.text, 40) || texto(c.button_text, 40) || 'Suscribirme',
        icon: boton.icon === true,
        style: enLista(ESTILO_BOTON, boton.style) || 'solid',
        shape: enLista(FORMA, boton.shape) || 'rounded',
        size: enLista(TAM, boton.size) || 'md',
        color: color(boton.color) || color(c.button_bg_color),
        textColor: color(boton.text_color) || color(c.button_text_color),
        hover: color(boton.hover),
      },
    },
  }

  if (hayMedia && (desktop || movil)) {
    boletin.media = {
      desktop,
      mobile: movil,
      fit: enLista(AJUSTE, media.fit) || 'cover',
      radius: entero(media.radius, 0, 48),
      shadow: media.shadow === true,
      focal: enLista(FOCO, media.focal) || 'center',
      hideMobile: media.hide_mobile === true,
    }
  }
  if (hayFondo) {
    boletin.background = {
      color: color(fondo.color),
      gradient: gradiente.length >= 2 ? gradiente.slice(0, 3) : undefined,
      angle: entero(fondo.angle, 0, 360),
      gradientType: enLista(GRADIENTE, fondo.gradient_type) || 'linear',
      image: urlSegura(fondo.image),
      overlay: color(fondo.overlay),
      overlayOpacity: entero(fondo.overlay_opacity, 0, 100),
      pattern: fondo.pattern === true,
      padding: entero(fondo.padding, 0, 160),
      width: enLista(ANCHO, fondo.width) || 'content',
    }
  }
  if (hayCaja) {
    boletin.container = {
      color: color(caja.color),
      border: color(caja.border),
      borderWidth: entero(caja.border_width, 0, 8),
      radius: entero(caja.radius, 0, 48),
      shadow: caja.shadow === true,
      padding: entero(caja.padding, 0, 80),
      maxWidth: entero(caja.max_width, 280, 1200),
    }
  }
  if (popup.enabled === true) {
    boletin.popup = {
      enabled: true,
      trigger: enLista(DISPARO, popup.trigger) || 'enter',
      delay: entero(popup.delay, 2, 60) || 8,
    }
  }
  return boletin
}

/** Lo que un preset deja escrito. No toca el título ni el correo. */
export function precargaBoletin(layout: LayoutBoletin): Record<string, unknown> {
  const comun = { align: layout === 'centered' || layout === 'image_top' || layout === 'image_bottom' || layout === 'card_floating' ? 'center' : 'left' }
  if (layout === 'card_floating') {
    return {
      ...comun,
      background: { gradient_1: '#111827', gradient_2: '#374151', gradient_type: 'linear', angle: 135 },
      container: { color: '#ffffff', radius: 16, shadow: true, padding: 28 },
      form: { arrangement: 'stacked' },
    }
  }
  if (layout === 'inline_bar') {
    return { ...comun, form: { arrangement: 'inline' }, container: { padding: 16, radius: 12 } }
  }
  if (layout === 'split_bg') {
    return { ...comun, background: { width: 'full' }, form: { arrangement: 'stacked' } }
  }
  if (layout === 'image_left' || layout === 'image_right') {
    return { ...comun, form: { arrangement: 'stacked' } }
  }
  return { ...comun, form: { arrangement: 'inline' } }
}
