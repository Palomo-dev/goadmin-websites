'use client'

/**
 * Desplegable pegado a un campo de la cabecera (sugerencias de la barra de búsqueda, panel de la
 * lupa) que se pinta FUERA del <header>, en la capa que SiteHeader deja justo después del
 * encabezado (`[data-capa-desplegables-encabezado]`, escala en lib/website/capasSitio.ts).
 *
 * Por qué (2026-11-25, celular de una tienda con «Al bajar: encoger» y la barra visible): dentro del
 * <header> las sugerencias quedaban recortadas por el `overflow-x: clip` de la fila del celular, se
 * apilaban con el `z-40` de la cabecera (su `z-[100]` no contaba), heredaban el `transform` del
 * envoltorio de «Al bajar» y, sobre portada, el texto blanco de la cabecera. Se abrían «detrás» del
 * banner: el teclado salía, el cursor también, y las sugerencias no se veían.
 *
 * Aquí el panel va `position: fixed`, con la posición del campo medida en cada cuadro mientras está
 * abierto (el campo se mueve con el scroll, con la animación de «encoger», con el teclado y con la
 * ventana visual del celular). El alto termina antes del borde visible y de las barras de abajo.
 * Hereda lo que heredaba dentro de la cabecera: sus variables (`--header-*`, `--bq-*`…), el color,
 * `data-capa-encabezado` (reglas del tema, como los menús de CapaEncabezado) y `data-hdr-bp`.
 *
 * Fuera de una cabecera (o dentro de un menú del encabezado, que ya va en CapaEncabezado por encima
 * de todo) no hay capa: el panel se pinta donde siempre, `absolute` bajo el campo.
 *
 * Teclado: Tab desde el campo entra al panel, Tab desde el último sale al control que sigue al
 * campo y Shift+Tab desde el primero vuelve al campo (el orden de siempre, aunque el panel esté en
 * otro lugar del DOM). Si el foco estaba dentro al cerrar, vuelve al campo.
 */
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import {
  CAPA_DESPLEGABLE_CABECERA,
  SELECTOR_BARRAS_INFERIORES,
  SEPARACION_DESPLEGABLE,
  altoDisponible,
} from '@/lib/website/capasSitio'

const CapaDesplegables = createContext<HTMLElement | null>(null)

/** SiteHeader da la capa; CapaEncabezado la quita (sus menús ya van por encima de todo). */
export const ProveedorCapaDesplegables = CapaDesplegables.Provider

const usarEfectoDePintado = typeof window === 'undefined' ? useEffect : useLayoutEffect

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function enfocables(raiz: ParentNode): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>(ENFOCABLES)).filter(
    (el) => el.tabIndex >= 0 && !el.closest('[inert]') && el.getClientRects().length > 0,
  )
}

/** Variables CSS en línea del campo hacia arriba hasta el <header> (la más cercana manda). */
function heredadoDelEncabezado(ancla: HTMLElement, encabezado: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {}
  for (let el: HTMLElement | null = ancla; el; el = el.parentElement) {
    const s = el.style
    for (let i = 0; i < s.length; i++) {
      const p = s[i]
      if (p.startsWith('--') && !(p in out)) out[p] = s.getPropertyValue(p)
    }
    if (el === encabezado) break
  }
  out.color = getComputedStyle(ancla).color
  return out
}

interface Destino {
  capa: HTMLElement
  heredado: Record<string, string>
  bp?: string
}

interface Medida {
  top: number
  left: number
  width: number
  alto: number
  visible: boolean
}

export function PanelFlotanteEncabezado({
  abierto,
  ancla,
  posicion,
  alinear = 'izquierda',
  refPanel,
  className,
  enLinea,
  children,
  ...atributos
}: {
  abierto: boolean
  /** El contenedor del campo (o de la lupa): el panel cuelga de su borde de abajo. */
  ancla: RefObject<HTMLElement | null>
  /** `usePosicionPanel` (left relativo al ancla y ancho); null antes de medir. */
  posicion: { left: number; width: number } | null
  /** Sin medida todavía: borde del ancla que sigue el panel. */
  alinear?: 'izquierda' | 'derecha'
  refPanel?: RefObject<HTMLDivElement>
  /** Clase en los dos casos (p. ej. `hidden md:block`; con `data-hdr-bp` sigue el punto de corte). */
  className?: string
  /** Clase y estilo del panel cuando no hay capa (`absolute` bajo el campo, como siempre). */
  enLinea: { className: string; style?: CSSProperties }
  children: ReactNode
} & Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'style' | 'children'>) {
  const capa = useContext(CapaDesplegables)
  const propio = useRef<HTMLDivElement>(null)
  const panel = refPanel ?? propio
  // Destino decidido al abrir, en el mismo render (sin un cuadro en el lugar de siempre): la capa
  // solo si el campo está dentro de un <header>. El campo ya está montado cuando se abre.
  const cache = useRef<Destino | null>(null)
  let destino: Destino | null = null
  if (abierto && capa && typeof document !== 'undefined') {
    const el = ancla.current
    const encabezado = el?.closest('header')
    if (el && encabezado) {
      if (!cache.current || cache.current.capa !== capa) {
        cache.current = {
          capa,
          heredado: heredadoDelEncabezado(el, encabezado),
          bp: el.closest('[data-hdr-bp]')?.getAttribute('data-hdr-bp') ?? undefined,
        }
      }
      destino = cache.current
    }
  }
  if (!abierto) cache.current = null
  const [medida, setMedida] = useState<Medida | null>(null)
  const posicionRef = useRef(posicion)
  posicionRef.current = posicion

  // Posición en cada cuadro mientras está abierto: sigue al campo con el scroll, la animación de
  // «encoger», el teclado y la ventana visual. Solo cambia el estado cuando algo se movió.
  usarEfectoDePintado(() => {
    if (!destino) {
      setMedida(null)
      return
    }
    let marco = 0
    let ultima = ''
    const medir = () => {
      const el = ancla.current
      if (el) {
        const r = el.getBoundingClientRect()
        const p = posicionRef.current
        const width = p?.width ?? r.width
        const left = p ? r.left + p.left : alinear === 'derecha' ? r.right - width : r.left
        const top = r.bottom + SEPARACION_DESPLEGABLE
        const vv = window.visualViewport
        const bordeVisible = vv ? vv.offsetTop + vv.height : window.innerHeight
        const topes: number[] = []
        for (const barra of Array.from(document.querySelectorAll<HTMLElement>(SELECTOR_BARRAS_INFERIORES))) {
          const rb = barra.getBoundingClientRect()
          if (rb.height > 0 && rb.width > 0) topes.push(rb.top)
        }
        // Con «Al bajar: ocultar» el campo sale de la pantalla: el panel no se queda flotando solo.
        const visible = r.bottom > 0 && r.top < bordeVisible
        const m: Medida = { top: Math.round(top), left: Math.round(left), width: Math.round(width), alto: altoDisponible(top, bordeVisible, topes), visible }
        const clave = `${m.top}|${m.left}|${m.width}|${m.alto}|${m.visible}`
        if (clave !== ultima) {
          ultima = clave
          setMedida(m)
        }
      }
      marco = requestAnimationFrame(medir)
    }
    medir()
    return () => cancelAnimationFrame(marco)
  }, [destino, alinear])

  // Orden del Tab como si el panel siguiera junto al campo; foco de vuelta al campo al cerrar.
  useEffect(() => {
    if (!destino) return
    const el = ancla.current
    let focoDentro = false
    const alEnfocar = (e: FocusEvent) => {
      focoDentro = !!panel.current && e.target instanceof Node && panel.current.contains(e.target)
    }
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !el || !panel.current) return
      const activo = document.activeElement as HTMLElement | null
      const enPanel = enfocables(panel.current)
      if (!enPanel.length) return
      const enAncla = enfocables(el)
      if (!e.shiftKey && activo && activo === enAncla[enAncla.length - 1]) {
        e.preventDefault()
        enPanel[0].focus()
      } else if (e.shiftKey && activo === enPanel[0]) {
        e.preventDefault()
        ;(enAncla[enAncla.length - 1] ?? el).focus()
      } else if (!e.shiftKey && activo === enPanel[enPanel.length - 1]) {
        // Al control que sigue al campo en la página (el panel no cuenta).
        const todos = enfocables(document).filter((x) => !panel.current?.contains(x))
        const siguiente = todos.find((x) => !el.contains(x) && !!(el.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING))
        if (siguiente) {
          e.preventDefault()
          siguiente.focus()
        }
      }
    }
    document.addEventListener('focusin', alEnfocar)
    document.addEventListener('keydown', alTeclado)
    return () => {
      document.removeEventListener('focusin', alEnfocar)
      document.removeEventListener('keydown', alTeclado)
      const actual = document.activeElement
      if (focoDentro && (!actual || actual === document.body || !actual.isConnected || !!panel.current?.contains(actual))) {
        el?.querySelector<HTMLElement>('input, button')?.focus({ preventScroll: true })
      }
    }
  }, [destino])

  // Sugerencias abiertas en el celular: la burbuja del chat no las tapa (app/globals.css).
  useEffect(() => {
    if (!destino) return
    const raiz = document.documentElement
    raiz.setAttribute('data-buscador-abierto', '')
    return () => raiz.removeAttribute('data-buscador-abierto')
  }, [destino])

  if (!abierto) return null
  if (!destino) {
    return (
      <div ref={panel} className={[className, enLinea.className].filter(Boolean).join(' ')} style={enLinea.style} {...atributos}>
        {children}
      </div>
    )
  }
  const estilo: CSSProperties = {
    position: 'fixed',
    top: medida?.top ?? 0,
    left: medida?.left ?? 0,
    width: medida?.width,
    zIndex: CAPA_DESPLEGABLE_CABECERA,
    // Sin medida aún (el primer commit, nunca pintado: la medida llega antes de pintar) no se
    // esconde: un `visibility: hidden` impediría que el campo de la lupa tome el foco al abrir.
    visibility: medida && !medida.visible ? 'hidden' : undefined,
    ['--alto-panel' as string]: medida ? `${medida.alto}px` : undefined,
  }
  return createPortal(
    <div className="contents" style={destino.heredado as CSSProperties} data-capa-encabezado="" data-hdr-bp={destino.bp}>
      <div ref={panel} className={className} style={estilo} data-superficie-propia="" {...atributos}>
        {children}
      </div>
    </div>,
    destino.capa,
  )
}
