'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { topColumnaFija } from './columnaFija'

/**
 * Columna de información de la ficha cuando la galería va en «Desplazamiento» (fotos que bajan
 * con la página). Es `sticky` en escritorio, con un `top` que depende de su altura:
 *  - si cabe en la pantalla, queda fija justo debajo del header (`--header-h` + 16 px);
 *  - si es más alta que la pantalla (información, descripción, especificaciones y botones), sube
 *    con la página hasta mostrar su final y ahí se queda: el botón «Agregar» queda a la vista
 *    mientras se bajan las fotos, sin barra de desplazamiento propia.
 * Antes de medir (render del servidor) vale la regla CSS: debajo del header.
 */
export function ColumnaInfoFija({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [top, setTop] = useState<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => {
      const header = Number.parseFloat(getComputedStyle(el).getPropertyValue('--header-h')) || 72
      setTop(topColumnaFija(el.offsetHeight, window.innerHeight, header))
    }
    medir()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    observer?.observe(el)
    window.addEventListener('resize', medir)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', medir)
    }
  }, [])

  return (
    <div
      ref={ref}
      data-columna-fija=""
      className={`lg:sticky lg:top-[calc(var(--header-h,72px)+1rem)] lg:self-start ${className}`}
      style={top === null ? undefined : { top: `${top}px` }}
    >
      {children}
    </div>
  )
}
