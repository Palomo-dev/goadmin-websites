'use client'

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

/** Ancho mínimo de la barra del buscador en una fila del encabezado de escritorio. */
export const ANCHO_MINIMO_BARRA = 240

/**
 * Regla común de los encabezados de escritorio con la barra del buscador en una fila con logo,
 * menú, íconos y botones: la barra nunca se aplasta ni recorta el menú.
 * Baja a una segunda fila de ancho completo si en la fila:
 * - la barra quedaría por debajo de 240px, o
 * - el menú tendría que mandar enlaces a «Más» (`data-nav-recorta`, lo marca NavList), o
 * - la fila desborda.
 * Para no oscilar, recuerda el ancho de la fila al bajar y solo vuelve a probar arriba cuando la
 * fila es más ancha que eso. Con espacio (lo de hoy en pantallas anchas), la barra no se mueve.
 * «Barra compacta» (`mini`) y la lupa no cuentan: su ancho en reposo es chico a propósito.
 */
export function useBarraAbajo(filaRef: RefObject<HTMLElement | null>, activa: boolean): boolean {
  const [abajo, setAbajo] = useState(false)
  const abajoRef = useRef(false)
  const umbral = useRef<number | null>(null)
  const efecto = typeof window === 'undefined' ? useEffect : useLayoutEffect
  efecto(() => {
    if (!activa) {
      abajoRef.current = false
      umbral.current = null
      setAbajo(false)
      return
    }
    const fila = filaRef.current
    if (!fila) return
    const poner = (v: boolean) => {
      abajoRef.current = v
      setAbajo(v)
    }
    const medir = () => {
      if (window.innerWidth < 768) return
      const ancho = fila.clientWidth
      if (abajoRef.current) {
        if (umbral.current !== null && ancho > umbral.current + 1) {
          umbral.current = null
          poner(false)
        }
        return
      }
      const barra = fila.querySelector('[data-buscador]:not([data-buscador="mini"]):not([data-buscador="icon_overlay"])') as HTMLElement | null
      const barraChica = !!barra && barra.getBoundingClientRect().width < ANCHO_MINIMO_BARRA - 0.5
      const navRecorta = !!fila.querySelector('nav[data-nav-recorta]')
      const desborda = fila.scrollWidth > fila.clientWidth + 1
      if (barra && (barraChica || navRecorta || desborda)) {
        umbral.current = ancho
        poner(true)
      }
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(fila)
    // NavList marca `data-nav-recorta` después de medir: también se vuelve a medir entonces.
    const mo = new MutationObserver(medir)
    mo.observe(fila, { subtree: true, attributes: true, attributeFilter: ['data-nav-recorta'] })
    window.addEventListener('resize', medir)
    return () => {
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener('resize', medir)
    }
  }, [activa])
  return abajo
}
