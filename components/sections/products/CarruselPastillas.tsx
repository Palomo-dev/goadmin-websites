'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { clasesPastillas, desplazarPagina } from '@/lib/website/estiloCategoria'

/**
 * Fila de pastillas en carrusel (`category_style: 'pill'` + `desktop_layout: 'carousel'`).
 * Las flechas solo se ven en escritorio y con el mismo aspecto que las de CategoriesGrid.
 */
export function CarruselPastillas({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [izq, setIzq] = useState(false)
  const [der, setDer] = useState(false)

  const medir = useCallback(() => {
    const el = ref.current
    if (!el) return
    setIzq(el.scrollLeft > 4)
    setDer(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    medir()
    el.addEventListener('scroll', medir, { passive: true })
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', medir); ro.disconnect() }
  }, [medir])

  return (
    <div className="relative">
      {izq && (
        <button
          type="button"
          onClick={() => desplazarPagina(ref.current, 'left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg hidden md:flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 transition-all -ml-4"
          aria-label="Anterior"
        >
          <svg className="w-5 h-5 text-gray-700 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
      )}
      <div ref={ref} className={clasesPastillas('carousel')} style={{ scrollbarWidth: 'none' }}>
        {children}
      </div>
      {der && (
        <button
          type="button"
          onClick={() => desplazarPagina(ref.current, 'right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg hidden md:flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 transition-all -mr-4"
          aria-label="Siguiente"
        >
          <svg className="w-5 h-5 text-gray-700 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      )}
    </div>
  )
}
