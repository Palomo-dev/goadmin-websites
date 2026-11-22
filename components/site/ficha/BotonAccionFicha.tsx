'use client'

/**
 * «Tienda/Botón de acción de la ficha» (Figma 2779:65882): Tipo (Agregar · Comprar ahora ·
 * Favorito · WhatsApp · Compartir) × Tamaño (Largo · Mitad · Pequeño) × Estilo (Relleno · Con
 * borde · Enlace) × Estado (Normal · Hover · Deshabilitado · Guardado).
 *
 * Alto 48 (escritorio y celular), radio 10, texto 15 semibold. Agregar y Comprar usan el color de
 * la marca; WhatsApp su verde; Favorito y Compartir son neutros (el favorito guardado, rojo).
 * Pequeño = cuadrado de 48 con solo el ícono y nombre accesible.
 */
import type { CSSProperties, ReactNode } from 'react'
import { Check, Heart, Loader2, Share2, ShoppingCart, Zap } from 'lucide-react'
import type { EstiloAccionFicha, TamanoAccionFicha, TipoAccionFicha } from '@/lib/website/v2/accionesFicha'

export type EstadoBotonAccion = 'normal' | 'deshabilitado' | 'guardado' | 'exito' | 'cargando'

/** Verde de WhatsApp del diseño (normal y hover). */
export const VERDE_WHATSAPP = '#128C7E'
/** Rojo del corazón guardado (Figma 2780:66065). */
const ROJO_GUARDADO = '#EF4444'

/** Glifo de WhatsApp (Figma 2779:65046): burbuja con el auricular. */
export function GlifoWhatsapp({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3.5 20.5l1.3-3.9A8.5 8.5 0 1 1 8 19.6z" />
      <path d="M9.2 8.6c.2-.5.6-.5.9-.5h.4c.2 0 .4.1.5.4l.6 1.4c.1.2 0 .5-.1.6l-.4.5c-.1.2-.1.4 0 .6.6 1 1.4 1.8 2.4 2.3.2.1.4.1.6-.1l.5-.5c.2-.2.4-.2.6-.1l1.4.7c.2.1.4.3.3.5v.4c0 .4-.2.8-.6 1-.5.3-1.2.4-2 .2-2.1-.6-3.9-2.3-4.6-4.4-.3-.8-.2-1.5.1-2z" />
    </svg>
  )
}

function Icono({ tipo, estado }: { tipo: TipoAccionFicha; estado: EstadoBotonAccion }) {
  const c = 'h-5 w-5 shrink-0'
  if (estado === 'cargando') return <Loader2 aria-hidden="true" className={`${c} animate-spin`} />
  if (estado === 'exito') return <Check aria-hidden="true" className={c} />
  switch (tipo) {
    case 'agregar':
      return <ShoppingCart aria-hidden="true" className={c} />
    case 'comprar':
      return <Zap aria-hidden="true" className={c} />
    case 'favorito':
      return (
        <Heart
          aria-hidden="true"
          className={c}
          style={estado === 'guardado' ? { color: ROJO_GUARDADO, fill: ROJO_GUARDADO } : undefined}
        />
      )
    case 'whatsapp':
      return <GlifoWhatsapp className={c} />
    case 'compartir':
      return <Share2 aria-hidden="true" className={c} />
    default:
      return null
  }
}

/** Clases y variable de color de un botón según tipo, estilo y estado (sin el ancho). */
export function apariencia(tipo: TipoAccionFicha, estilo: EstiloAccionFicha, estado: EstadoBotonAccion, primaryColor: string): { clases: string; style: CSSProperties } {
  const enlace = estilo === 'enlace'
  if (estado === 'deshabilitado') {
    const clases = enlace
      ? 'text-gray-400'
      : estilo === 'borde'
        ? 'border-[1.5px] border-gray-200 bg-white text-gray-400'
        : 'bg-gray-200 text-gray-400'
    return { clases: `${clases} cursor-not-allowed`, style: {} }
  }
  if (estado === 'exito') return { clases: 'bg-green-500 text-white', style: {} }

  if (tipo === 'favorito' && estado === 'guardado') {
    const clases = enlace ? 'text-red-700' : estilo === 'borde' ? 'border border-red-200 bg-red-50 text-red-700' : 'bg-red-50 text-red-700'
    return { clases, style: {} }
  }

  if (tipo === 'favorito' || tipo === 'compartir') {
    const hoverBorde = tipo === 'favorito' ? 'hover:border-red-200' : 'hover:bg-gray-100'
    const clases = enlace
      ? 'text-gray-900 underline underline-offset-4'
      : estilo === 'borde'
        ? `border border-gray-300 bg-white text-gray-900 ${hoverBorde}`
        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
    return { clases, style: {} }
  }

  // Agregar y Comprar: color de la marca. WhatsApp: su verde.
  const color = tipo === 'whatsapp' ? VERDE_WHATSAPP : primaryColor
  const style = { '--accion': color } as CSSProperties
  if (enlace) return { clases: 'text-[var(--accion)] underline underline-offset-4 hover:opacity-80', style }
  if (estilo === 'borde') {
    return {
      clases: 'border-[1.5px] border-[var(--accion)] bg-white text-[var(--accion)] hover:bg-[color-mix(in_srgb,var(--accion)_8%,white)]',
      style,
    }
  }
  // Clases literales: Tailwind no ve las armadas con plantillas.
  const hover = tipo === 'whatsapp' ? 'hover:bg-[#0C7266]' : 'hover:brightness-90'
  return { clases: `bg-[var(--accion)] text-white ${hover}`, style }
}

/** Ancho dentro de la fila: el Pequeño es un cuadrado; Largo y Mitad reparten el espacio. */
export function anchoAccion(tamano: TamanoAccionFicha): string {
  return tamano === 'pequeno' ? 'w-12 shrink-0 px-0' : 'min-w-0 flex-1 px-4'
}

export interface BotonAccionFichaProps {
  tipo: TipoAccionFicha
  tamano: TamanoAccionFicha
  estilo: EstiloAccionFicha
  estado?: EstadoBotonAccion
  /** Texto en escritorio (y en el celular si no hay `textoCelular`). */
  texto: ReactNode
  /** Celular: el texto corto (la fila es compartida). */
  textoCelular?: ReactNode | null
  /** Nombre accesible (obligatorio para el Pequeño, que no muestra texto). */
  etiqueta: string
  primaryColor: string
  onClick?: () => void
  /** Con `href` es un enlace (WhatsApp). */
  href?: string
  ariaPressed?: boolean
  className?: string
  dataAccion?: string
  /** Ícono propio (el corazón con su latido). */
  icono?: ReactNode
}

export function BotonAccionFicha({
  tipo,
  tamano,
  estilo,
  estado = 'normal',
  texto,
  textoCelular = null,
  etiqueta,
  primaryColor,
  onClick,
  href,
  ariaPressed,
  className = '',
  dataAccion,
  icono,
}: BotonAccionFichaProps) {
  const { clases, style } = apariencia(tipo, estilo, estado, primaryColor)
  const pequeno = tamano === 'pequeno'
  const base = `inline-flex h-12 items-center justify-center gap-2 rounded-[10px] text-[15px] font-semibold leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400 ${anchoAccion(tamano)} ${clases} ${className}`
  const contenido = (
    <>
      {icono ?? <Icono tipo={tipo} estado={estado} />}
      {!pequeno && (
        textoCelular ? (
          <>
            <span className="truncate sm:hidden">{textoCelular}</span>
            <span className="hidden truncate sm:inline">{texto}</span>
          </>
        ) : (
          <span className="truncate">{texto}</span>
        )
      )}
    </>
  )
  const comunes = {
    className: base,
    style,
    'aria-label': pequeno ? etiqueta : undefined,
    title: pequeno ? etiqueta : undefined,
    'data-accion-ficha': dataAccion ?? tipo,
  }
  if (href && estado !== 'deshabilitado') {
    return (
      <a {...comunes} href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}>
        {contenido}
      </a>
    )
  }
  return (
    <button
      {...comunes}
      type="button"
      onClick={onClick}
      disabled={estado === 'deshabilitado' || estado === 'cargando'}
      aria-busy={estado === 'cargando' || undefined}
      aria-pressed={ariaPressed}
    >
      {contenido}
    </button>
  )
}
