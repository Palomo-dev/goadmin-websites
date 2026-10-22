'use client'

import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { leerBoletin, validarEnvio, type Boletin, type TextoBoletin } from '@/lib/website/boletin'

const REDES = ['instagram', 'facebook', 'tiktok', 'youtube', 'whatsapp', 'linkedin', 'twitter'] as const

const FORMA: Record<string, string> = {
  square: 'rounded-none',
  rounded: 'rounded-lg',
  semi: 'rounded-md',
  pill: 'rounded-full',
}
const TAM_INPUT: Record<string, string> = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-3',
  lg: 'px-5 py-4 text-lg',
}
const TAM_TEXTO: Record<string, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl md:text-3xl',
  '3xl': 'text-3xl md:text-4xl',
}
const PESO: Record<string, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
}

interface Props {
  content: Record<string, unknown>
  primaryColor?: string
  organization?: { website_settings?: { social_links?: unknown; show_social_links?: boolean } | null }
  sectionId?: string
}

/**
 * Solo se monta si `leerBoletin` encuentra claves nuevas. El envío no llama
 * a la red: igual que el botón de hoy, que no guarda el correo.
 */
export function NewsletterSection({ content, primaryColor = '#3B82F6', organization, sectionId }: Props) {
  const boletin = leerBoletin(content)
  if (!boletin) return null
  const bloque = <Bloque boletin={boletin} primaryColor={primaryColor} redes={redesDe(organization)} />
  return (
    <>
      {bloque}
      {boletin.popup?.enabled && (
        <PopupBoletin popup={boletin.popup} clave={sectionId || 'boletin'}>
          <Bloque boletin={boletin} primaryColor={primaryColor} redes={redesDe(organization)} />
        </PopupBoletin>
      )}
    </>
  )
}

function redesDe(organization: Props['organization']): { nombre: string; href: string }[] {
  if (organization?.website_settings?.show_social_links === false) return []
  const crudo = organization?.website_settings?.social_links
  if (!crudo || typeof crudo !== 'object') return []
  const o = crudo as Record<string, unknown>
  const out: { nombre: string; href: string }[] = []
  for (const nombre of REDES) {
    const href = typeof o[nombre] === 'string' ? o[nombre].trim() : ''
    if (/^https?:\/\//i.test(href)) out.push({ nombre, href })
  }
  return out
}

function estiloTexto(t: TextoBoletin | undefined, extra?: CSSProperties): CSSProperties {
  return {
    color: t?.color,
    fontFamily: t?.font && t.font !== 'site' ? t.font : undefined,
    ...extra,
  }
}

function claseTexto(t: TextoBoletin | undefined, porDefecto: string) {
  return `${t?.size ? TAM_TEXTO[t.size] : porDefecto} ${t?.weight ? PESO[t.weight] : ''}`.trim()
}

function Bloque({ boletin, primaryColor, redes }: { boletin: Boletin; primaryColor: string; redes: { nombre: string; href: string }[] }) {
  const alineado = boletin.align === 'right' ? 'text-right items-end' : boletin.align === 'left' ? 'text-left items-start' : 'text-center items-center'
  const textos = (
    <div className={`flex flex-col gap-2 ${alineado}`}>
      {boletin.eyebrow?.text && (
        <p className={`text-xs font-semibold uppercase tracking-wide ${claseTexto(boletin.eyebrow, '')}`} style={estiloTexto(boletin.eyebrow, { color: boletin.eyebrow.color || primaryColor })}>
          {boletin.eyebrow.text}
        </p>
      )}
      {boletin.title.text && (
        <h2 className={`${claseTexto(boletin.title, 'text-2xl md:text-3xl')} ${boletin.title.weight ? '' : 'font-bold'} mb-1 text-gray-900 dark:text-white`} style={estiloTexto(boletin.title)}>
          {boletin.title.text}
        </h2>
      )}
      {boletin.description?.text && (
        <p className={`${claseTexto(boletin.description, 'text-base')} text-gray-600 dark:text-gray-300`} style={estiloTexto(boletin.description)}>
          {boletin.description.text}
        </p>
      )}
      {boletin.incentive && <p className="text-sm font-semibold" style={{ color: primaryColor }}>{boletin.incentive}</p>}
    </div>
  )
  const formulario = <Formulario boletin={boletin} primaryColor={primaryColor} />
  const imagen = boletin.media?.desktop || boletin.media?.mobile ? <Imagen boletin={boletin} /> : <div className="min-h-40 rounded-xl bg-black/5" />
  const legal = boletin.legal?.text ? (
    <p className={`mt-3 text-xs text-gray-400 ${claseTexto(boletin.legal, '')}`} style={estiloTexto(boletin.legal)}>
      {boletin.legal.href ? <a href={boletin.legal.href} className="underline">{boletin.legal.text}</a> : boletin.legal.text}
    </p>
  ) : null
  const social = boletin.social && redes.length > 0 ? (
    <ul className="mt-4 flex flex-wrap gap-3 text-sm">
      {redes.map((r) => (
        <li key={r.nombre}><a href={r.href} className="underline" style={{ color: primaryColor }}>{r.nombre}</a></li>
      ))}
    </ul>
  ) : null

  const cuerpo = empaquetar(boletin.layout, textos, formulario, imagen, legal, social, alineado)
  return <Marco boletin={boletin}>{cuerpo}</Marco>
}

function empaquetar(
  layout: Boletin['layout'],
  textos: ReactNode,
  formulario: ReactNode,
  imagen: ReactNode,
  legal: ReactNode,
  social: ReactNode,
  alineado: string,
) {
  const pila = (
    <div className={`flex w-full flex-col gap-4 ${alineado}`}>
      {textos}
      {formulario}
      {legal}
      {social}
    </div>
  )
  if (layout === 'image_left') {
    return <div className="grid items-center gap-8 md:grid-cols-2">{imagen}{pila}</div>
  }
  if (layout === 'image_right') {
    return <div className="grid items-center gap-8 md:grid-cols-2">{pila}{imagen}</div>
  }
  if (layout === 'image_top') {
    return <div className={`mx-auto flex max-w-xl flex-col gap-6 ${alineado}`}>{imagen}{pila}</div>
  }
  if (layout === 'image_bottom') {
    return <div className={`mx-auto flex max-w-xl flex-col gap-6 ${alineado}`}>{pila}{imagen}</div>
  }
  if (layout === 'inline_bar') {
    return (
      <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
        <div className="min-w-0 flex-1">{textos}{legal}</div>
        <div className="w-full md:max-w-md">{formulario}{social}</div>
      </div>
    )
  }
  if (layout === 'split_bg') {
    return <div className="grid items-stretch md:grid-cols-2">{pila}<div className="min-h-48">{imagen}</div></div>
  }
  if (layout === 'card_floating') {
    return pila
  }
  return <div className="mx-auto max-w-xl">{pila}</div>
}

function Marco({ boletin, children }: { boletin: Boletin; children: ReactNode }) {
  const fondo = boletin.background
  const caja = boletin.container
  const estiloFondo: CSSProperties = {}
  if (fondo?.color) estiloFondo.backgroundColor = fondo.color
  if (fondo?.gradient && fondo.gradient.length >= 2) {
    const lista = fondo.gradient.join(', ')
    estiloFondo.backgroundImage = fondo.gradientType === 'radial'
      ? `radial-gradient(circle, ${lista})`
      : `linear-gradient(${fondo.angle ?? 180}deg, ${lista})`
  }
  if (fondo?.image) {
    estiloFondo.backgroundImage = `url("${fondo.image.replace(/"/g, '')}")`
    estiloFondo.backgroundSize = 'cover'
    estiloFondo.backgroundPosition = 'center'
  }
  if (fondo?.padding != null) estiloFondo.padding = `${fondo.padding}px`
  const ancho = fondo?.width === 'full' ? 'w-full' : 'mx-auto w-full max-w-6xl'
  const estiloCaja: CSSProperties = {}
  if (caja?.color) estiloCaja.backgroundColor = caja.color
  if (caja?.border && (caja.borderWidth ?? 1) > 0) {
    estiloCaja.border = `${caja.borderWidth ?? 1}px solid ${caja.border}`
  }
  if (caja?.radius != null) estiloCaja.borderRadius = `${caja.radius}px`
  if (caja?.padding != null) estiloCaja.padding = `${caja.padding}px`
  if (caja?.maxWidth) estiloCaja.maxWidth = `${caja.maxWidth}px`
  if (caja?.shadow) estiloCaja.boxShadow = '0 18px 50px rgba(0,0,0,.18)'
  const interior = (
    <div className={caja ? 'mx-auto w-full' : undefined} style={estiloCaja}>
      {children}
    </div>
  )
  return (
    <div className={`relative ${ancho}`} style={estiloFondo}>
      {fondo?.pattern && <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '14px 14px' }} />}
      {fondo?.overlay && (
        <div aria-hidden className="absolute inset-0" style={{ backgroundColor: fondo.overlay, opacity: (fondo.overlayOpacity ?? 40) / 100 }} />
      )}
      <div className={fondo?.overlay || fondo?.pattern ? 'relative' : undefined}>{interior}</div>
    </div>
  )
}

function Imagen({ boletin }: { boletin: Boletin }) {
  const media = boletin.media
  if (!media) return null
  const escritorio = media.desktop || media.mobile
  const movil = media.mobile || media.desktop
  if (!escritorio && !movil) return null
  const radio = media.radius != null ? { borderRadius: `${media.radius}px` } : undefined
  return (
    <div className={`${media.hideMobile ? 'hidden md:block' : ''} overflow-hidden ${media.shadow ? 'shadow-lg' : ''} ${media.radius == null ? 'rounded-xl' : ''}`} style={radio}>
      {escritorio && <img src={escritorio} alt="" className={media.fit === 'contain' ? 'hidden h-auto w-full object-contain md:block' : 'hidden h-64 w-full object-cover md:block'} style={{ objectPosition: media.focal }} />}
      {movil && <img src={movil} alt="" className={media.fit === 'contain' ? 'h-auto w-full object-contain md:hidden' : 'h-48 w-full object-cover md:hidden'} style={{ objectPosition: media.focal }} />}
    </div>
  )
}

function Formulario({ boletin, primaryColor }: { boletin: Boletin; primaryColor: string }) {
  const [correo, setCorreo] = useState('')
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [cumple, setCumple] = useState('')
  const [acepta, setAcepta] = useState(false)
  const [aviso, setAviso] = useState<'ok' | 'correo' | 'aceptacion' | null>(null)
  const f = boletin.form
  const forma = FORMA[f.input.shape] || FORMA.rounded
  const formaBoton = FORMA[f.button.shape] || FORMA.rounded
  const tam = TAM_INPUT[f.input.size] || TAM_INPUT.md
  const borde = f.input.style === 'underline' ? 'border-0 border-b rounded-none bg-transparent' : f.input.style === 'filled' ? 'border-0' : 'border bg-transparent'
  const estiloInput: CSSProperties = {
    backgroundColor: f.input.background,
    color: f.input.color,
    borderColor: f.input.borderColor,
    borderWidth: f.input.borderWidth,
    ['--tw-ring-color' as string]: f.input.focusColor || primaryColor,
  }
  const estiloBoton: CSSProperties = f.button.style === 'outline'
    ? { color: f.button.color || primaryColor, borderColor: f.button.color || primaryColor, backgroundColor: 'transparent' }
    : f.button.style === 'gradient'
      ? { backgroundImage: `linear-gradient(90deg, ${f.button.color || primaryColor}, ${f.button.hover || '#111827'})`, color: f.button.textColor || '#fff' }
      : { backgroundColor: f.button.color || primaryColor, color: f.button.textColor || '#fff' }

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    const resultado = validarEnvio(correo, acepta, f.showConsent)
    setAviso(resultado === 'ok' ? 'ok' : resultado)
  }

  const inputCorreo = (
    <div className="relative w-full">
      {f.input.icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm" aria-hidden>✉</span>}
      <input
        type="email"
        required
        name="email"
        autoComplete="email"
        placeholder={f.placeholder}
        value={correo}
        onChange={(e) => setCorreo(e.target.value)}
        aria-label="Correo"
        className={`w-full dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 ${borde} ${forma} ${tam} ${f.input.icon ? 'pl-10' : ''}`}
        style={estiloInput}
      />
    </div>
  )
  const boton = (
    <button
      type="submit"
      aria-label={f.button.style === 'icon_only' ? f.button.text : undefined}
      className={`font-medium hover:opacity-90 ${formaBoton} ${f.button.style === 'outline' ? 'border' : ''} ${f.button.style === 'icon_only' ? 'px-3' : tam} whitespace-nowrap`}
      style={estiloBoton}
    >
      {f.button.icon || f.button.style === 'icon_only' ? '✉ ' : ''}{f.button.style === 'icon_only' ? '' : f.button.text}
    </button>
  )

  const extras = (
    <div className="flex w-full flex-col gap-2">
      {f.showName && <input name="nombre" autoComplete="name" placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className={`w-full ${borde} ${forma} ${tam}`} style={estiloInput} />}
      {f.showPhone && <input name="telefono" type="tel" autoComplete="tel" placeholder="Teléfono o WhatsApp" value={telefono} onChange={(e) => setTelefono(e.target.value)} className={`w-full ${borde} ${forma} ${tam}`} style={estiloInput} />}
      {f.showBirthday && <input name="cumpleanos" type="date" value={cumple} onChange={(e) => setCumple(e.target.value)} aria-label="Cumpleaños" className={`w-full ${borde} ${forma} ${tam}`} style={estiloInput} />}
      {f.showConsent && (
        <label className="flex items-start gap-2 text-left text-xs text-gray-600">
          <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-0.5" />
          <span>
            {f.consentHref ? <a href={f.consentHref} className="underline">{f.consentLabel}</a> : f.consentLabel}
          </span>
        </label>
      )}
    </div>
  )

  const fila = f.arrangement === 'stacked' ? (
    <div className="flex w-full flex-col gap-3">{inputCorreo}{boton}</div>
  ) : f.arrangement === 'inside' ? (
    <div className="relative w-full">
      {inputCorreo}
      <div className="absolute inset-y-1 right-1 flex items-center">{boton}</div>
    </div>
  ) : (
    <div className="flex w-full flex-col gap-3 sm:flex-row">{inputCorreo}{boton}</div>
  )

  return (
    <form onSubmit={enviar} className="flex w-full flex-col gap-3" noValidate={false}>
      {fila}
      {(f.showName || f.showPhone || f.showBirthday || f.showConsent) && extras}
      {aviso === 'ok' && <p className="text-sm" role="status">{boletin.success}</p>}
      {aviso && aviso !== 'ok' && <p className="text-sm" role="alert">{boletin.error}</p>}
    </form>
  )
}

function PopupBoletin({ popup, clave, children }: { popup: NonNullable<Boletin['popup']>; clave: string; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  useEffect(() => {
    const memoria = `boletin-visto-${clave}`
    try {
      if (sessionStorage.getItem(memoria)) return
    } catch { return }
    const abrir = () => {
      try { sessionStorage.setItem(memoria, '1') } catch { /* sesión no disponible */ }
      setAbierto(true)
    }
    if (popup.trigger === 'enter') abrir()
    if (popup.trigger === 'delay') {
      const id = window.setTimeout(abrir, popup.delay * 1000)
      return () => window.clearTimeout(id)
    }
    const salir = (e: MouseEvent) => { if (e.clientY <= 0) abrir() }
    document.addEventListener('mouseout', salir)
    return () => document.removeEventListener('mouseout', salir)
  }, [popup.trigger, popup.delay, clave])
  if (!abierto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6">
        <button type="button" aria-label="Cerrar" className="absolute right-3 top-3 h-8 w-8 rounded-full border" onClick={() => setAbierto(false)}>×</button>
        {children}
      </div>
    </div>
  )
}
