'use client'

/**
 * Hooks de carrusel compartidos por las secciones del sitio (galería, aliados, marcas, productos).
 *
 * Todo corre en el cliente: ni el autoplay ni el deslizar hacen consultas, y el servidor pinta el
 * primer elemento como siempre.
 */

import { useCallback, useEffect, useRef } from 'react'
import type { FocusEvent, TouchEvent } from 'react'
import { crearControlAutoplay, type ControlAutoplay } from './controlAutoplay'

const CONSULTA_MOVIMIENTO = '(prefers-reduced-motion: reduce)'

/**
 * Avance automático. Respeta `prefers-reduced-motion` (no avanza), se pausa con la pestaña oculta
 * y con el foco del teclado dentro, y con el puntero encima si `pausarAlPasar`.
 *
 * Devuelve los manejadores para el contenedor del carrusel.
 */
export function useAutoplayCarrusel({
  activo,
  intervaloMs,
  pausarAlPasar,
  avanzar,
}: {
  activo: boolean
  intervaloMs: number
  pausarAlPasar: boolean
  /** Devuelve `false` si ya no hay a dónde avanzar (sin bucle). */
  avanzar: () => boolean | void
}) {
  const avanzarRef = useRef(avanzar)
  avanzarRef.current = avanzar
  const controlRef = useRef<ControlAutoplay | null>(null)

  useEffect(() => {
    if (!activo) return
    const control = crearControlAutoplay({ intervaloMs, avanzar: () => avanzarRef.current() })
    controlRef.current = control

    const mq = typeof window.matchMedia === 'function' ? window.matchMedia(CONSULTA_MOVIMIENTO) : null
    const alMovimiento = () => (mq?.matches ? control.pausar('movimiento') : control.reanudar('movimiento'))
    const alVisibilidad = () => (document.hidden ? control.pausar('pestana') : control.reanudar('pestana'))
    alMovimiento()
    alVisibilidad()
    mq?.addEventListener?.('change', alMovimiento)
    document.addEventListener('visibilitychange', alVisibilidad)
    return () => {
      mq?.removeEventListener?.('change', alMovimiento)
      document.removeEventListener('visibilitychange', alVisibilidad)
      control.detener()
      controlRef.current = null
    }
  }, [activo, intervaloMs])

  const onMouseEnter = useCallback(() => {
    if (pausarAlPasar) controlRef.current?.pausar('puntero')
  }, [pausarAlPasar])
  const onMouseLeave = useCallback(() => {
    controlRef.current?.reanudar('puntero')
  }, [])
  const onFocus = useCallback(() => {
    controlRef.current?.pausar('foco')
  }, [])
  const onBlur = useCallback((e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) controlRef.current?.reanudar('foco')
  }, [])

  return { onMouseEnter, onMouseLeave, onFocus, onBlur }
}

/** Umbral en px para contar un gesto como deslizamiento (y no como toque). */
const UMBRAL_PX = 40

/**
 * Deslizar con el dedo en carruseles por índice (los de desplazamiento nativo ya lo hacen solos).
 * Con `activo` en false no devuelve manejadores.
 */
export function useDeslizar({ activo, alSiguiente, alAnterior }: { activo: boolean; alSiguiente: () => void; alAnterior: () => void }) {
  const inicio = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = useCallback((e: TouchEvent) => {
    const t = e.touches[0]
    inicio.current = t ? { x: t.clientX, y: t.clientY } : null
  }, [])
  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      const desde = inicio.current
      inicio.current = null
      const t = e.changedTouches[0]
      if (!desde || !t) return
      const dx = t.clientX - desde.x
      const dy = t.clientY - desde.y
      if (Math.abs(dx) < UMBRAL_PX || Math.abs(dx) < Math.abs(dy)) return
      if (dx < 0) alSiguiente()
      else alAnterior()
    },
    [alSiguiente, alAnterior],
  )
  return activo ? { onTouchStart, onTouchEnd } : {}
}
