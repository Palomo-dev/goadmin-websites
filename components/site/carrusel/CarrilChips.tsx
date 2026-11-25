'use client'

/**
 * Carril horizontal de chips: la ÚNICA pieza para las filas de categorías / subcategorías de las
 * secciones de productos (destacados, nuevos, carrusel, lista, rejilla, ofertas, rejilla editorial,
 * listado de la plantilla, página y plantilla de categoría y la rejilla vieja de /productos).
 * Estilo marketplace:
 *
 * - Scroll libre sin la barra gris del sistema (`scrollbar-hide`).
 * - Celular: el dedo desliza solo (el navegador). Computador: flechas ‹ › solo en el lado con
 *   chips fuera de vista, arrastre con el mouse (umbral para no romper el clic, sin seleccionar
 *   texto, cursor de mano), trackpad horizontal, Shift+rueda y rueda vertical, que solo mueve la
 *   barra mientras le quede recorrido; en el borde la página vuelve a bajar.
 * - Chip fijo opcional a la izquierda («Todas» / «Todos»).
 * - Desvanecido en el lado con chips ocultos con `mask-image` (no un degradado de color encima):
 *   sirve sobre fondo claro, oscuro, de color o con imagen.
 * - El chip elegido (`aria-pressed="true"`) se trae a la vista al cargar y al cambiar; al tabular,
 *   el chip con foco queda a la vista y no debajo de una flecha, con anillo de foco visible.
 * - Respeta prefers-reduced-motion.
 *
 * No cambia el estilo ni el contenido de los chips: cada sección pasa los suyos.
 * Sin bucle ni avance automático, a propósito: son filtros para navegar (accesibilidad y foco).
 * Reglas puras en lib/site/carrilChips.ts.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { FlechaCarrusel } from './ControlesCarrusel'
import {
  desplazamientoParaMostrar,
  desplazamientoRueda,
  esArrastre,
  ladosOcultos,
  MARGEN_FOCO,
  pasoFlecha,
  pixelesRueda,
} from '@/lib/site/carrilChips'

const DEGRADADO = 28

/** Anillo de foco de teclado para los chips (hijos directos), sin tocar su estilo normal. */
const FOCO_CHIPS =
  '[&>*:focus-visible]:outline [&>*:focus-visible]:outline-2 [&>*:focus-visible]:outline-offset-2 [&>*:focus-visible]:outline-current'

export function CarrilChips({
  children,
  chipFijo,
  color,
  etiqueta,
  claveActivo,
  className = '',
  claseFila = 'gap-2',
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
  /** Separación entre chips (la que ya tenía la sección); por defecto `gap-2`. */
  claseFila?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [lados, setLados] = useState({ izquierda: false, derecha: false })
  const [arrastrando, setArrastrando] = useState(false)
  const arrastre = useRef<{ id: number; x: number; inicio: number; movio: boolean; seleccion: string } | null>(null)
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
    // Cambia el ancho del carril o el de los chips (llegan categorías, carga la fuente): re-medir.
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    const observarHijos = () => Array.from(el.children).forEach((h) => ro.observe(h))
    observarHijos()
    const mo = new MutationObserver(() => {
      observarHijos()
      medir()
    })
    mo.observe(el, { childList: true })
    // Rueda vertical (o Shift+rueda que el navegador no convirtió) → horizontal. No pasivo: hay que
    // poder cancelar el scroll de la página. El trackpad horizontal lo maneja el navegador.
    const rueda = (e: WheelEvent) => {
      const dy = pixelesRueda(e.deltaY, e.deltaMode, el.clientWidth)
      const dx = pixelesRueda(e.deltaX, e.deltaMode, el.clientWidth)
      const mover = desplazamientoRueda(el.scrollLeft, el.scrollWidth, el.clientWidth, dx, dy)
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
      mo.disconnect()
    }
  }, [medir])

  const suave = (): ScrollBehavior =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'

  /** Lleva un chip a la vista (centrado si se puede). `margen`: px que tapan flecha y desvanecido. */
  const mostrar = useCallback((chip: HTMLElement, margen = 0) => {
    const el = ref.current
    if (!el) return
    const izquierda = chip.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft
    const destino = desplazamientoParaMostrar(izquierda, chip.offsetWidth, el.scrollLeft, el.clientWidth, el.scrollWidth, margen)
    if (destino === null) return
    el.scrollTo({ left: destino, behavior: suave() })
    window.setTimeout(medir, 450)
  }, [medir])

  // El chip elegido, a la vista (al cargar con una categoría y al cambiarla).
  useEffect(() => {
    const chip = ref.current?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (chip) mostrar(chip)
  }, [claveActivo, mostrar])

  // Al tabular: el chip con foco, a la vista y no debajo de una flecha. Solo foco de teclado
  // (`:focus-visible`): el clic del mouse no mueve la barra.
  const alFoco = (e: React.FocusEvent<HTMLDivElement>) => {
    const chip = e.target as HTMLElement
    if (chip === ref.current || chip.parentElement !== ref.current) return
    let teclado = true
    try {
      teclado = chip.matches(':focus-visible')
    } catch {
      /* navegador sin :focus-visible: se trata como teclado */
    }
    if (teclado) mostrar(chip, MARGEN_FOCO)
  }

  const flecha = (sentido: 1 | -1) => {
    const el = ref.current
    if (!el) return
    el.scrollBy({ left: sentido * pasoFlecha(el.clientWidth), behavior: suave() })
    // Además del evento scroll: vuelve a medir al terminar (desvanecido y flechas al día).
    window.setTimeout(medir, 450)
  }

  // Arrastre con el mouse (el dedo y el trackpad ya los maneja el navegador). Mientras el botón está
  // abajo no se selecciona texto (user-select: none en el documento); pasado el umbral se captura el
  // puntero, así el arrastre sigue aunque el mouse salga de la barra, y el clic final no abre el chip.
  const raiz = () => (typeof document !== 'undefined' ? document.documentElement : null)
  const terminar = () => {
    window.removeEventListener('pointerup', terminar)
    window.removeEventListener('pointercancel', terminar)
    const a = arrastre.current
    if (!a) return
    arrastre.current = null
    const r = raiz()
    if (r) r.style.userSelect = a.seleccion
    setArrastrando(false)
    if (a.movio) {
      bloquearClic.current = true
      // Si el clic no llega (se soltó fuera), que no bloquee el siguiente clic de verdad.
      window.setTimeout(() => {
        bloquearClic.current = false
      }, 0)
      medir()
    }
  }
  const alBajar = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || e.pointerType !== 'mouse' || e.button !== 0) return
    if (!(lados.izquierda || lados.derecha)) return
    const r = raiz()
    arrastre.current = { id: e.pointerId, x: e.clientX, inicio: el.scrollLeft, movio: false, seleccion: r?.style.userSelect ?? '' }
    if (r) r.style.userSelect = 'none'
    // En la ventana y no en la barra: suelta bien aunque el mouse salga antes del umbral.
    window.addEventListener('pointerup', terminar)
    window.addEventListener('pointercancel', terminar)
  }
  const alMover = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = arrastre.current
    const el = ref.current
    if (!a || !el || e.pointerId !== a.id) return
    const dx = e.clientX - a.x
    if (!a.movio && esArrastre(dx)) {
      a.movio = true
      setArrastrando(true)
      window.getSelection?.()?.removeAllRanges()
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* sin captura: el arrastre sigue mientras el mouse esté sobre la barra */
      }
    }
    if (a.movio) el.scrollLeft = a.inicio - dx
  }
  const alClic = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!bloquearClic.current) return
    bloquearClic.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  // Al desmontar a mitad de un arrastre, devolver la selección de texto al documento.
  useEffect(() => () => {
    const a = arrastre.current
    const r = raiz()
    if (a && r) r.style.userSelect = a.seleccion
  }, [])

  const desbordado = lados.izquierda || lados.derecha
  const mascara = desbordado
    ? `linear-gradient(to right, ${lados.izquierda ? 'transparent' : '#000'} 0, #000 ${lados.izquierda ? DEGRADADO : 0}px, #000 calc(100% - ${lados.derecha ? DEGRADADO : 0}px), ${lados.derecha ? 'transparent' : '#000'} 100%)`
    : undefined

  return (
    <div className={`flex items-center gap-2 ${className}`} role="group" aria-label={etiqueta} data-carril-chips="">
      {chipFijo && <div className={`flex-shrink-0 ${FOCO_CHIPS}`}>{chipFijo}</div>}
      <div className="relative min-w-0 flex-1">
        {/* -mx-1 px-1: aire para el anillo de foco del primer y el último chip sin mover nada. */}
        <div
          ref={ref}
          className={`-mx-1 flex overflow-x-auto scrollbar-hide px-1 py-1 ${claseFila} ${FOCO_CHIPS}`}
          style={{
            scrollbarWidth: 'none',
            ...(mascara ? { maskImage: mascara, WebkitMaskImage: mascara } : {}),
            ...(desbordado ? { cursor: arrastrando ? 'grabbing' : 'grab' } : {}),
            ...(arrastrando ? { userSelect: 'none' as const, WebkitUserSelect: 'none' as const } : {}),
          }}
          data-arrastrando={arrastrando ? '' : undefined}
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onClickCapture={alClic}
          onFocus={alFoco}
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
