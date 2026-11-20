'use client'

import { useCallback, useEffect, useRef, useState, type MouseEvent as EventoMouse, type ReactNode } from 'react'
import { FlechaCarrusel, PuntosCarrusel } from '@/components/site/carrusel/ControlesCarrusel'
import { useListaCarrusel } from '@/components/site/listaCarrusel'
import { useAutoplayCarrusel } from '@/lib/carrusel/useCarrusel'
import { indiceAnterior, indiceSiguiente } from '@/lib/carrusel/opcionesCarrusel'
import { desplazarPagina, paginaDeScroll, paginaTrasArrastre } from '@/lib/website/estiloCategoria'
import { opcionesCarruselCategorias } from '@/lib/website/carruselCategorias'

/**
 * Carrusel por páginas de la rejilla de categorías («Círculo» y «Pastilla» con
 * `desktop_layout: 'carousel'` y `desktop_rows` / `mobile_rows`). Cada página es una rejilla de
 * `columnas × filas` al 100 % del ancho, con scroll-snap horizontal nativo: el dedo desliza solo y
 * el mouse arrastra (si el panel no lo apaga). Flechas y puntos en el color primario.
 *
 * Opciones del panel «Carrusel» (`content.carrusel` o el del sitio): flechas, indicador, avance
 * automático (se pausa con el mouse encima y se detiene al tocar; respeta
 * `prefers-reduced-motion`) y bucle. Sin nada guardado: flechas y puntos, sin avance ni bucle.
 */
export function CarruselPaginasCategorias({
  paginas,
  columnas,
  color,
  movil,
  carruselSeccion,
  etiqueta,
  className = '',
  gap = 'gap-4',
}: {
  /** Ítems ya pintados, agrupados por página (chunkArray). */
  paginas: ReactNode[][]
  columnas: number
  color: string
  /** Lado que pinta este carrusel: decide `flechasMovil` / `flechasEscritorio` y dónde van. */
  movil: boolean
  /** `content.carrusel` de la sección, tal cual. */
  carruselSeccion?: unknown
  etiqueta: string
  className?: string
  gap?: string
}) {
  const global = useListaCarrusel().carrusel
  const o = opcionesCarruselCategorias(global, carruselSeccion, movil)
  const total = paginas.length
  const ref = useRef<HTMLDivElement>(null)
  const [actual, setActual] = useState(0)
  const [tocado, setTocado] = useState(false)
  const arrastre = useRef<{ x: number; inicio: number; pagina: number; movio: boolean } | null>(null)
  const bloquearClic = useRef(false)

  const medir = useCallback(() => {
    const el = ref.current
    if (el) setActual(paginaDeScroll(el.scrollLeft, el.clientWidth, total))
  }, [total])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    medir()
    el.addEventListener('scroll', medir, { passive: true })
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', medir); ro.disconnect() }
  }, [medir])

  const ir = useCallback((i: number) => {
    const el = ref.current
    if (!el) return
    const reducido = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: i * el.clientWidth, behavior: reducido ? 'auto' : 'smooth' })
  }, [])

  const siguiente = (): boolean => {
    const n = indiceSiguiente(actual, total, o.loop)
    if (n === null) return false
    if (n === actual + 1) desplazarPagina(ref.current, 'right')
    else ir(n)
    return true
  }
  const anterior = (): boolean => {
    const n = indiceAnterior(actual, total, o.loop)
    if (n === null) return false
    if (n === actual - 1) desplazarPagina(ref.current, 'left')
    else ir(n)
    return true
  }

  const autoplay = useAutoplayCarrusel({
    activo: o.autoplay && total > 1 && !tocado,
    intervaloMs: o.intervaloMs,
    pausarAlPasar: o.pausaHover,
    avanzar: siguiente,
  })

  // Arrastre con el mouse: sin snap mientras se arrastra; al soltar, la página siguiente,
  // la anterior o la misma según cuánto se movió. Un arrastre no abre la categoría.
  const alBajar = (e: EventoMouse<HTMLDivElement>) => {
    const el = ref.current
    if (!o.arrastre || !el || e.button !== 0 || total <= 1) return
    arrastre.current = { x: e.clientX, inicio: el.scrollLeft, pagina: actual, movio: false }
  }
  const alMover = (e: EventoMouse<HTMLDivElement>) => {
    const a = arrastre.current
    const el = ref.current
    if (!a || !el) return
    const dx = e.clientX - a.x
    if (!a.movio && Math.abs(dx) > 4) {
      a.movio = true
      el.style.scrollSnapType = 'none'
      el.style.cursor = 'grabbing'
    }
    if (a.movio) {
      e.preventDefault()
      el.scrollLeft = a.inicio - dx
    }
  }
  const alSoltar = (e: EventoMouse<HTMLDivElement>) => {
    const a = arrastre.current
    const el = ref.current
    arrastre.current = null
    if (!a || !el || !a.movio) return
    bloquearClic.current = true
    el.style.cursor = ''
    ir(paginaTrasArrastre(a.pagina, e.clientX - a.x, total))
    window.setTimeout(() => { el.style.scrollSnapType = '' }, 450)
  }
  const alClic = (e: EventoMouse<HTMLDivElement>) => {
    if (!bloquearClic.current) return
    bloquearClic.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  const hayControles = total > 1
  const flechas = hayControles && o.flechas
  const sinAnterior = !o.loop && actual <= 0
  const sinSiguiente = !o.loop && actual >= total - 1
  const puntos = hayControles && o.puntos ? (
    <PuntosCarrusel
      total={total}
      actual={actual}
      onSelect={ir}
      color={o.colorActivo || color}
      etiqueta={(i) => `Ir a la página ${i + 1}`}
      estilo={o.puntos === 'dots' ? undefined : o.puntos}
    />
  ) : null

  return (
    <div
      className={`relative ${className}`}
      role="region"
      aria-roledescription="carrusel"
      aria-label={etiqueta}
      data-carrusel-categorias={movil ? 'movil' : 'escritorio'}
      {...autoplay}
      onTouchStart={() => setTocado(true)}
    >
      <div className="relative">
        {flechas && !movil && (
          <FlechaCarrusel direccion="anterior" onClick={anterior} color={color} disabled={sinAnterior} className="absolute left-0 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2" />
        )}
        <div
          ref={ref}
          className={`flex snap-x snap-mandatory overflow-x-auto scrollbar-hide ${o.arrastre && total > 1 ? 'cursor-grab' : ''}`}
          style={{ scrollbarWidth: 'none' }}
          onMouseDown={alBajar}
          onMouseMove={alMover}
          onMouseUp={alSoltar}
          onMouseLeave={alSoltar}
          onClickCapture={alClic}
          onDragStart={(e) => e.preventDefault()}
        >
          {paginas.map((items, i) => (
            <div
              key={i}
              className="w-full shrink-0 snap-start snap-always"
              role="group"
              aria-roledescription="página"
              aria-label={`Página ${i + 1} de ${total}`}
            >
              <div className={`grid py-2 ${gap}`} style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}>
                {items}
              </div>
            </div>
          ))}
        </div>
        {flechas && !movil && (
          <FlechaCarrusel direccion="siguiente" onClick={siguiente} color={color} disabled={sinSiguiente} className="absolute right-0 top-1/2 z-10 translate-x-1/2 -translate-y-1/2" />
        )}
      </div>
      {movil && flechas ? (
        <div className="mt-3 flex items-center justify-center gap-3">
          <FlechaCarrusel direccion="anterior" onClick={anterior} color={color} disabled={sinAnterior} className="shrink-0" />
          {puntos}
          <FlechaCarrusel direccion="siguiente" onClick={siguiente} color={color} disabled={sinSiguiente} className="shrink-0" />
        </div>
      ) : puntos ? (
        <div className="mt-3">{puntos}</div>
      ) : null}
    </div>
  )
}
