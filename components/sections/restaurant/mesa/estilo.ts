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
  tarjeta: 'color-mix(in srgb, var(--background-color, #F4EFE6) 45%, #ffffff)',
  borde: 'color-mix(in srgb, var(--text-color, #1f1a14) 13%, transparent)',
  texto: 'var(--text-color, #1f1a14)',
  suave: 'color-mix(in srgb, var(--text-color, #1f1a14) 62%, transparent)',
  muySuave: 'color-mix(in srgb, var(--text-color, #1f1a14) 7%, var(--background-color, #F4EFE6))',
  primario: 'var(--primary-color, #8B2F1C)',
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
      return { backgroundColor: C.primarioSuave, color: C.primario }
    case 'por_confirmar':
    case 'enviada':
      return { backgroundColor: C.muySuave, color: C.texto }
    case 'en_preparacion':
      return { backgroundColor: '#F6E7BE', color: '#7A5200' }
    case 'lista':
      return { backgroundColor: '#F6E7BE', color: '#7A5200' }
    case 'servida':
      return { backgroundColor: '#DCEBDC', color: '#2E6B3A' }
    case 'cancelada':
      return { backgroundColor: C.muySuave, color: C.suave }
  }
}

export const OK = { fondo: '#DCEBDC', texto: '#2E6B3A' }
export const ALERTA = { fondo: '#F8EBC8', texto: '#7A5200' }
