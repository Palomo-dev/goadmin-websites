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
 * La lupa no cuenta. «Barra compacta» (`mini`) es chica a propósito: solo baja si la fila desborda,
 * y en la segunda fila se pinta como barra normal a todo el ancho.
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
      const barra = fila.querySelector('[data-buscador]:not([data-buscador="icon_overlay"])') as HTMLElement | null
      // «Barra compacta» (mini) es chica a propósito: solo baja si la fila desborda.
      const mini = barra?.dataset.buscador === 'mini'
      // «Buscador grande» (mega): cuenta el campo, no el conjunto con el selector y el botón.
      const campo = barra?.dataset.buscador === 'mega' ? (barra.querySelector('input') as HTMLElement | null) ?? barra : barra
      const barraChica = !mini && !!campo && campo.getBoundingClientRect().width < ANCHO_MINIMO_BARRA - 0.5
      const navRecorta = !mini && !!fila.querySelector('nav[data-nav-recorta]')
      const desborda = fila.scrollWidth > fila.clientWidth + 1
      if (barra && (barraChica || navRecorta || desborda)) {
        umbral.current = ancho
        poner(true)
      }
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(fila)
    // Los hijos de la fila cambian de ancho sin que la fila cambie (la fuente que llega tarde,
    // el menú que manda enlaces a «Más»): también se vuelve a medir entonces.
    for (const c of Array.from(fila.children)) ro.observe(c)
    let vivo = true
    document.fonts?.ready.then(() => { if (vivo) medir() })
    // NavList marca `data-nav-recorta` después de medir: también se vuelve a medir entonces.
    const mo = new MutationObserver(medir)
    mo.observe(fila, { subtree: true, attributes: true, attributeFilter: ['data-nav-recorta'] })
    window.addEventListener('resize', medir)
    return () => {
      vivo = false
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener('resize', medir)
    }
  }, [activa])
  return abajo
}
