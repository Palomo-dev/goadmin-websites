'use client'

/**
 * Entrada al aparecer de una sección (estilo por sección del editor: «Aparecer» o «Revelar
 * texto»). No pinta nada: marca la `<section>` que lo contiene con `data-motion="on"` al montar
 * y `data-inview="true"` cuando entra al viewport; las reglas de `app/globals.css` hacen el resto.
 *
 * Mismo criterio que el movimiento de las secciones de restaurante (`useSectionMotion`): en el
 * SSR y sin JS la sección se ve completa; nada se mueve con `prefers-reduced-motion` ni con
 * «Movimiento: Ninguno» del sitio; si ya está en pantalla al montar no se oculta para volver
 * a mostrarla.
 */
import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from './restaurant/useSectionMotion'

export function EntradaSeccion() {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const seccion = ref.current?.closest('section')
    if (!seccion || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return
    const rect = seccion.getBoundingClientRect()
    if (rect.top < window.innerHeight && rect.bottom > 0) return
    seccion.setAttribute('data-motion', 'on')
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          seccion.setAttribute('data-inview', 'true')
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    )
    observer.observe(seccion)
    return () => observer.disconnect()
  }, [])

  return <span ref={ref} hidden aria-hidden="true" />
}
