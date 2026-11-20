'use client'

import { useEffect, useRef, useState, type FocusEvent as EventoFoco, type MouseEvent as EventoMouse, type PointerEvent as EventoPuntero, type ReactNode } from 'react'
import { FlechaCarrusel, PuntosCarrusel } from '@/components/site/carrusel/ControlesCarrusel'
import { useListaCarrusel } from '@/components/site/listaCarrusel'
import { useAutoplayCarrusel } from '@/lib/carrusel/useCarrusel'
import { indiceAnterior, indiceSiguiente } from '@/lib/carrusel/opcionesCarrusel'
import { paginaTrasArrastre } from '@/lib/website/estiloCategoria'
import { opcionesCarruselCategorias } from '@/lib/website/carruselCategorias'

/** Duración y curva del paso de página. */
export const DURACION_MS = 480
export const CURVA = 'cubic-bezier(0.22, 1, 0.36, 1)'
/**
 * Con «menos movimiento» (Windows con las animaciones apagadas lo activa): un paso corto, no 0, para
 * que se vea hacia dónde va la página. Lo dispara la persona con un clic o un gesto.
 */
export const DURACION_REDUCIDA_MS = 200
/** Movimiento mínimo (px) para que el gesto sea arrastre y no clic. */
const UMBRAL_CLIC = 6

/**
 * Carrusel por páginas de la rejilla de categorías («Círculo» y «Pastilla» con
 * `desktop_layout: 'carousel'` y `desktop_rows` / `mobile_rows`). Cada página es una rejilla de
 * `columnas × filas` al 100 % del ancho, sobre una pista que se mueve con `translate3d` (480 ms,
 * curva suave): se ve el deslizamiento lateral, también en Windows, donde el scroll suave con snap
 * cambiaba casi en el sitio. Mientras se arrastra, la pista sigue al mouse o al dedo 1:1; al soltar
 * va a la página que toca. El dedo solo toma el gesto horizontal (`touch-action: pan-y`): el
 * scroll vertical de la página no se traba. Flechas y puntos en el color primario.
 *
 * Opciones del panel «Carrusel» (`content.carrusel` o el del sitio): flechas, indicador, avance
 * automático (se pausa con el mouse encima y se detiene al tocar; respeta
 * `prefers-reduced-motion`), bucle y arrastre. Sin nada guardado: flechas y puntos, sin avance ni
 * bucle.
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
  const vista = useRef<HTMLDivElement>(null)
  const [actual, setActual] = useState(0)
  const [tocado, setTocado] = useState(false)
  const [dx, setDx] = useState(0)
  const [arrastrando, setArrastrando] = useState(false)
  const [reducido, setReducido] = useState(false)
  const gesto = useRef<{ id: number; x: number; ancho: number; movio: boolean } | null>(null)
  const bloquearClic = useRef(false)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    setReducido(mq.matches)
    const cambio = () => setReducido(mq.matches)
    mq.addEventListener?.('change', cambio)
    return () => mq.removeEventListener?.('change', cambio)
  }, [])

  // Si cambia la cantidad de páginas (otra pantalla), no quedarse fuera de rango.
  useEffect(() => {
    if (actual > total - 1) setActual(Math.max(0, total - 1))
  }, [actual, total])

  const ir = (i: number) => setActual(Math.min(Math.max(0, i), Math.max(0, total - 1)))
  const siguiente = (): boolean => {
    const n = indiceSiguiente(actual, total, o.loop)
    if (n === null) return false
    ir(n)
    return true
  }
  const anterior = (): boolean => {
    const n = indiceAnterior(actual, total, o.loop)
    if (n === null) return false
    ir(n)
    return true
  }

  const autoplay = useAutoplayCarrusel({
    activo: o.autoplay && total > 1 && !tocado,
    intervaloMs: o.intervaloMs,
    pausarAlPasar: o.pausaHover,
    avanzar: siguiente,
  })

  // Arrastre (mouse, si el panel lo permite) y deslizamiento con el dedo, con eventos de puntero.
  // Con `touch-action: pan-y` el navegador se queda el gesto vertical (y manda pointercancel): solo
  // llega aquí el horizontal, así que el scroll de la página nunca se traba.
  const alBajar = (e: EventoPuntero<HTMLDivElement>) => {
    const el = vista.current
    if (!el || total <= 1 || e.button !== 0) return
    if (e.pointerType === 'mouse' && !o.arrastre) return
    gesto.current = { id: e.pointerId, x: e.clientX, ancho: el.clientWidth, movio: false }
  }
  const alMover = (e: EventoPuntero<HTMLDivElement>) => {
    const g = gesto.current
    if (!g || g.id !== e.pointerId) return
    let d = e.clientX - g.x
    if (!g.movio) {
      if (Math.abs(d) <= UMBRAL_CLIC) return
      g.movio = true
      setArrastrando(true)
      vista.current?.setPointerCapture?.(e.pointerId)
    }
    // Sin bucle, en los bordes la pista cede poco (se nota que no hay más).
    if (!o.loop && ((actual === 0 && d > 0) || (actual === total - 1 && d < 0))) d *= 0.35
    setDx(d)
  }
  const terminar = (e: EventoPuntero<HTMLDivElement>, cancelado: boolean) => {
    const g = gesto.current
    if (!g || g.id !== e.pointerId) return
    gesto.current = null
    if (!g.movio) return
    bloquearClic.current = true
    const d = e.clientX - g.x
    const umbral = Math.min(50, g.ancho * 0.15)
    let destino = cancelado ? actual : paginaTrasArrastre(actual, d, total, umbral)
    if (!cancelado && o.loop && destino === actual) {
      if (d <= -umbral) destino = indiceSiguiente(actual, total, true) ?? actual
      else if (d >= umbral) destino = indiceAnterior(actual, total, true) ?? actual
    }
    setArrastrando(false)
    setDx(0)
    ir(destino)
  }
  const alClic = (e: EventoMouse<HTMLDivElement>) => {
    if (!bloquearClic.current) return
    bloquearClic.current = false
    e.preventDefault()
    e.stopPropagation()
  }
  // Con el teclado, el foco en una categoría de otra página lleva a esa página. La vista no se
  // desplaza sola (overflow oculto): se devuelve a 0 para que la pista mande.
  const alEnfocar = (e: EventoFoco<HTMLDivElement>) => {
    const el = vista.current
    if (el) el.scrollLeft = 0
    const pagina = (e.target as HTMLElement).closest<HTMLElement>('[data-pagina]')
    const i = pagina ? Number(pagina.dataset.pagina) : NaN
    if (Number.isInteger(i) && i !== actual) ir(i)
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

  const transicion = arrastrando ? 'none' : `transform ${reducido ? DURACION_REDUCIDA_MS : DURACION_MS}ms ${CURVA}`

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
          ref={vista}
          className={`overflow-hidden ${o.arrastre && total > 1 ? (arrastrando ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
          style={{ touchAction: 'pan-y' }}
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onPointerUp={(e) => terminar(e, false)}
          onPointerCancel={(e) => terminar(e, true)}
          onClickCapture={alClic}
          onFocusCapture={alEnfocar}
          onDragStart={(e) => e.preventDefault()}
        >
          <div
            className="flex select-none will-change-transform"
            style={{ transform: `translate3d(calc(${-actual * 100}% + ${dx}px), 0, 0)`, transition: transicion }}
            data-pista-carrusel=""
          >
            {paginas.map((items, i) => (
              <div
                key={i}
                className="w-full shrink-0"
                role="group"
                aria-roledescription="página"
                aria-label={`Página ${i + 1} de ${total}`}
                data-pagina={i}
              >
                <div className={`grid py-2 ${gap}`} style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}>
                  {items}
                </div>
              </div>
            ))}
          </div>
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
