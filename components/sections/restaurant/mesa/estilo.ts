/**
 * Carta QR en la mesa — colores y medidas compartidos por las secciones de mesa.
 *
 * Ninguna sección trae colores propios (lámina 18): todo sale de las variables del tema del
 * sitio (--background-color, --text-color, --primary-color, --accent-color, --font-heading),
 * con mezclas para tarjetas, bordes y textos secundarios. Los estados (en preparación, lista,
 * servida, avisos) usan tonos fijos suaves con el texto del estado siempre escrito.
 */

import type { CSSProperties } from 'react'
import type { EstadoRonda } from '@/lib/restaurant/mesa-modelo'

export const C = {
  fondo: 'var(--background-color, #F4EFE6)',
  // Superficie elevada (tarjetas, buscador): en fondo claro, el fondo con 45 % de blanco; en fondo
  // oscuro, `--mesa-superficie` de app/globals.css (el fondo con 8 % del texto).
  tarjeta: 'var(--mesa-superficie, color-mix(in srgb, var(--background-color, #F4EFE6) 45%, #ffffff))',
  borde: 'color-mix(in srgb, var(--text-color, #1f1a14) 13%, transparent)',
  texto: 'var(--text-color, #1f1a14)',
  // 66 %: AA (≥ 4,5:1) sobre el fondo y sobre la tarjeta en Marfil, Noir y Pop.
  suave: 'color-mix(in srgb, var(--text-color, #1f1a14) 66%, transparent)',
  muySuave: 'color-mix(in srgb, var(--text-color, #1f1a14) 7%, var(--background-color, #F4EFE6))',
  primario: 'var(--primary-color, #8B2F1C)',
  /** El primario como texto: el del tema si el primario no llega a AA sobre el fondo (Pop). */
  primarioTexto: 'var(--primario-texto, var(--primary-color, #8B2F1C))',
  /** Texto e iconos SOBRE el primario (botones, «+», barra del pedido): negro o blanco, el que se lea. */
  sobrePrimario: 'var(--texto-sobre-primario, #ffffff)',
  primarioSuave: 'color-mix(in srgb, var(--primary-color, #8B2F1C) 13%, var(--background-color, #F4EFE6))',
  oscuro: 'var(--text-color, #1f1a14)',
  sobreOscuro: 'var(--background-color, #F4EFE6)',
} as const

export const TITULO: CSSProperties = { fontFamily: 'var(--font-heading, Georgia, serif)', color: C.texto }

/** 44 px: botones táctiles mínimos (lámina 02, botón «+»). */
export const TACTIL = 44

/** Píldora de estado de una ronda (lámina 04/06). */
export function estiloEstado(estado: EstadoRonda): CSSProperties {
  switch (estado) {
    case 'por_enviar':
      return { backgroundColor: C.primarioSuave, color: C.primarioTexto }
    case 'por_confirmar':
    case 'enviada':
      return { backgroundColor: C.muySuave, color: C.texto }
    case 'en_preparacion':
    case 'lista':
      return { backgroundColor: ALERTA.fondo, color: ALERTA.texto }
    case 'servida':
      return { backgroundColor: OK.fondo, color: OK.texto }
    case 'cancelada':
      return { backgroundColor: C.muySuave, color: C.suave }
  }
}

/** Tonos de estado: los claros de siempre; en fondo oscuro, los de app/globals.css (`--mesa-…`). */
export const OK = { fondo: 'var(--mesa-ok-fondo, #DCEBDC)', texto: 'var(--mesa-ok-texto, #2E6B3A)' }
export const ALERTA = { fondo: 'var(--mesa-alerta-fondo, #F8EBC8)', texto: 'var(--mesa-alerta-texto, #7A5200)' }
/** Rojo de «picante» y de los errores escritos sobre el fondo. */
export const ERROR_TEXTO = 'var(--mesa-error-texto, #B5371F)'
