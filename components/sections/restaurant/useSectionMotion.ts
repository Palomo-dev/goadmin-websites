'use client'

/**
 * Activa el movimiento de una sección solo en cliente y solo si el visitante
 * no pidió reducirlo. Devuelve los atributos que leen las clases de
 * `motion.module.css`:
 *
 *  - `data-motion="on"`: el cliente montó y hay movimiento permitido. Antes de
 *    esto (SSR, sin JS) el contenido se ve completo y estático.
 *  - `data-inview="true"`: la sección entró al viewport (una sola vez).
 */

import { useEffect, useRef, useState } from 'react'

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export function useSectionMotion<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [enabled, setEnabled] = useState(false)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (prefersReducedMotion()) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    // Si ya está en pantalla al montar (p. ej. el hero, que es el LCP), no se
    // oculta para volver a mostrarlo: se anima desde su posición visible.
    setEnabled(true)
    const rect = el.getBoundingClientRect()
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return {
    ref,
    motionProps: {
      'data-motion': enabled ? 'on' : 'off',
      'data-inview': inView ? 'true' : 'false',
    } as const,
  }
}

/**
 * Parallax suave (≤ `max`, fracción del alto) para una imagen dentro de un
 * contenedor con overflow oculto. Desactivado en móvil (< 768 px) y con
 * movimiento reducido. Escribe un `transform` directo, sin re-render.
 */
export function useParallax<T extends HTMLElement>(max = 0.15) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    const mq = window.matchMedia('(min-width: 768px)')
    let frame = 0
    const update = () => {
      frame = 0
      if (!mq.matches) {
        el.style.transform = ''
        return
      }
      const host = el.parentElement
      if (!host) return
      const rect = host.getBoundingClientRect()
      const vh = window.innerHeight || 1
      // -1 (entrando por abajo) … 1 (saliendo por arriba)
      const progress = Math.max(-1, Math.min(1, (vh / 2 - (rect.top + rect.height / 2)) / vh))
      const shift = progress * max * rect.height * 0.5
      el.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0) scale(${1 + max})`
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      el.style.transform = ''
    }
  }, [max])
  return ref
}
