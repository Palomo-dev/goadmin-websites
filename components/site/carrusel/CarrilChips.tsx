'use client'

/**
 * Carril horizontal de chips (subcategorías de la página de categoría y filtros de las listas de
 * productos), estilo marketplace:
 *
 * - Scroll libre sin la barra gris del sistema (`scrollbar-hide`).
 * - Celular: el dedo desliza solo. Computador: trackpad, arrastre con el mouse (soltar después de
 *   arrastrar no abre el chip) y rueda del mouse, que solo mueve la barra mientras le quede
 *   recorrido; en el borde la página vuelve a bajar.
 * - Chip fijo opcional a la izquierda («Todas» / «Todos»).
 * - Degradado en el lado donde hay chips fuera de vista (con máscara: sirve sobre cualquier fondo)
 *   y flechas pequeñas en computador, solo si desborda.
 * - El chip elegido (`aria-pressed="true"`) se trae a la vista al cargar y al cambiar.
 *
 * Sin bucle ni avance automático, a propósito: son filtros para navegar (accesibilidad y foco).
 * Reglas puras en lib/site/carrilChips.ts.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { FlechaCarrusel } from './ControlesCarrusel'
import { desplazamientoParaMostrar, desplazamientoRueda, ladosOcultos, pasoFlecha, UMBRAL_ARRASTRE } from '@/lib/site/carrilChips'

const DEGRADADO = 28

export function CarrilChips({
  children,
  chipFijo,
  color,
  etiqueta,
  claveActivo,
  className = '',
}: {
  children: ReactNode
  /** Chip anclado a la izquierda, fuera del scroll. */
  chipFijo?: ReactNode
  /** Color de las flechas (el primario de la tienda). */
  color?: string
  /** Nombre accesible del grupo («Subcategorías», «Categorías»). */
  etiqueta: string
  /** Cambia cuando cambia el chip elegido: el carril lo trae a la vista. */
  claveActivo?: string | number | null
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [lados, setLados] = useState({ izquierda: false, derecha: false })
  const arrastre = useRef<{ x: number; inicio: number; movio: boolean } | null>(null)
  const bloquearClic = useRef(false)

  const medir = useCallback(() => {
    const el = ref.current
    if (!el) return
    const nuevo = ladosOcultos(el.scrollLeft, el.scrollWidth, el.clientWidth)
    setLados((v) => (v.izquierda === nuevo.izquierda && v.derecha === nuevo.derecha ? v : nuevo))
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    medir()
    el.addEventListener('scroll', medir, { passive: true })
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    // Rueda vertical → horizontal (no pasivo: hay que poder cancelar el scroll de la página).
    const rueda = (e: WheelEvent) => {
      const mover = desplazamientoRueda(el.scrollLeft, el.scrollWidth, el.clientWidth, e.deltaX, e.deltaY)
      if (mover === null) return
      e.preventDefault()
      el.scrollLeft += mover
      medir()
    }
    el.addEventListener('wheel', rueda, { passive: false })
    return () => {
      el.removeEventListener('scroll', medir)
      el.removeEventListener('wheel', rueda)
      ro.disconnect()
    }
  }, [medir])

  const suave = (): ScrollBehavior =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'

  // El chip elegido, a la vista (al cargar con una subcategoría y al cambiarla).
  useEffect(() => {
    const el = ref.current
    const chip = el?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!el || !chip) return
    const izquierda = chip.offsetLeft - el.offsetLeft
    const destino = desplazamientoParaMostrar(izquierda, chip.offsetWidth, el.scrollLeft, el.clientWidth, el.scrollWidth)
    if (destino === null) return
    el.scrollTo({ left: destino, behavior: suave() })
    const t = window.setTimeout(medir, 450)
    return () => window.clearTimeout(t)
  }, [claveActivo, medir])

  const flecha = (sentido: 1 | -1) => {
    const el = ref.current
    if (!el) return
    el.scrollBy({ left: sentido * pasoFlecha(el.clientWidth), behavior: suave() })
    // Además del evento scroll: vuelve a medir al terminar (degradado y flechas al día).
    window.setTimeout(medir, 450)
  }

  // Arrastre con el mouse (el dedo y el trackpad ya los maneja el navegador).
  const alBajar = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || e.pointerType !== 'mouse' || e.button !== 0) return
    arrastre.current = { x: e.clientX, inicio: el.scrollLeft, movio: false }
  }
  const alMover = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = arrastre.current
    const el = ref.current
    if (!a || !el) return
    const dx = e.clientX - a.x
    if (!a.movio && Math.abs(dx) > UMBRAL_ARRASTRE) {
      a.movio = true
      el.style.cursor = 'grabbing'
    }
    if (a.movio) el.scrollLeft = a.inicio - dx
  }
  const alSoltar = () => {
    const a = arrastre.current
    arrastre.current = null
    if (ref.current) ref.current.style.cursor = ''
    if (a?.movio) {
      bloquearClic.current = true
      medir()
    }
  }
  const alClic = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!bloquearClic.current) return
    bloquearClic.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  const mascara = lados.izquierda || lados.derecha
    ? `linear-gradient(to right, ${lados.izquierda ? 'transparent' : '#000'} 0, #000 ${lados.izquierda ? DEGRADADO : 0}px, #000 calc(100% - ${lados.derecha ? DEGRADADO : 0}px), ${lados.derecha ? 'transparent' : '#000'} 100%)`
    : undefined

  return (
    <div className={`flex items-center gap-2 ${className}`} role="group" aria-label={etiqueta} data-carril-chips="">
      {chipFijo && <div className="flex-shrink-0">{chipFijo}</div>}
      <div className="relative min-w-0 flex-1">
        <div
          ref={ref}
          className="flex gap-2 overflow-x-auto scrollbar-hide py-1"
          style={{ scrollbarWidth: 'none', ...(mascara ? { maskImage: mascara, WebkitMaskImage: mascara } : {}) }}
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerLeave={alSoltar}
          onClickCapture={alClic}
          onDragStart={(e) => e.preventDefault()}
        >
          {children}
        </div>
        {lados.izquierda && (
          <FlechaCarrusel
            direccion="anterior"
            onClick={() => flecha(-1)}
            color={color}
            etiqueta={`Ver ${etiqueta.toLowerCase()} anteriores`}
            className="!absolute left-0 top-1/2 z-10 hidden !h-8 !w-8 -translate-y-1/2 !shadow-md md:!flex"
          />
        )}
        {lados.derecha && (
          <FlechaCarrusel
            direccion="siguiente"
            onClick={() => flecha(1)}
            color={color}
            etiqueta={`Ver más ${etiqueta.toLowerCase()}`}
            className="!absolute right-0 top-1/2 z-10 hidden !h-8 !w-8 -translate-y-1/2 !shadow-md md:!flex"
          />
        )}
      </div>
    </div>
  )
}
