'use client'

/**
 * Pestañas de la ficha: la ÚNICA pieza de pestañas de la tienda (Figma «Ficha — pestañas reales»
 * 3255-99475, aprobado el 2026-11-25). La usan el bloque «Pestañas de la ficha»
 * (`product_anchor_nav · tabs`, vía NavAnclas) y los estilos «Pestañas» y «Acordeón» de la
 * descripción (ProductDescription). Las reglas puras están en anclasFicha.ts.
 *
 * - Sin JavaScript (y hasta hidratar): los bloques apilados, cada uno con su título.
 * - Computador: `tablist` / `tab` / `tabpanel`. Tocar una pestaña solo cambia el panel; la página
 *   no se mueve y la dirección no cambia. ← → cambian de pestaña (y la abren), Inicio y Fin van a
 *   la primera y la última; solo la activa entra con Tab (`tabindex` 0, las demás -1).
 * - Celular: acordeón (cada título es un botón con `aria-expanded`), varias abiertas a la vez;
 *   abre la primera con contenido. O las mismas pestañas, si así se eligió.
 * - Una sola pestaña con contenido: sin barra, el bloque con su título.
 * - Pestaña sin contenido (su bloque mide 0 px en este dispositivo): no aparece.
 * - Los paneles no se desmontan al cambiar de pestaña ni de modo (las reseñas no se vuelven a
 *   pedir): se esconden con `hidden`.
 * - Con `escuchar` (bloque de la ficha): `#resenas` (y equivalentes) en la dirección abre esa
 *   pestaña, y las estrellas y «Ver detalles» la piden (eventosPestanas.ts). Solo en esos casos
 *   la página baja, suave (sin animación con `prefers-reduced-motion`), hasta la barra.
 */

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { useResumenResenas } from '@/components/site/reviews/useResumenResenas'
import type { ReviewsConfig } from '@/components/site/reviews/types'
import {
  ANCHO_ESCRITORIO_PESTANAS,
  abrirEnAcordeon,
  alternarAbierta,
  destinoSaltoAncla,
  etiquetaConConteo,
  idDomPestana,
  modoPestanas,
  pestanaActivaValida,
  pestanaDeHash,
  pestanasConContenido,
  siguientePorTecla,
} from './anclasFicha'
import { EVENTO_ABRIR_PESTANA, type DetalleAbrirPestana } from './eventosPestanas'

/** `useLayoutEffect` en el navegador; en el servidor no corre (y no avisa). */
const useEfectoDeDiseno = typeof window === 'undefined' ? useEffect : useLayoutEffect

export interface PestanaFicha {
  /** Tipo del bloque (`product_reviews`) o parte de la descripción (`envio`). */
  id: string
  titulo: string
  contenido: ReactNode
  /** Lleva el número de reseñas en el título («Reseñas (12)»). */
  conConteoResenas?: boolean
}

export interface ResenasPestana {
  productId: number
  reviewsConfig: Partial<ReviewsConfig> | null
  productStats: { rating_avg?: number | null; reviews_count?: number | null } | null
}

interface PestanasFichaProps {
  items: PestanaFicha[]
  /** Subrayado de la pestaña activa (el color de la tienda o `currentColor`). */
  colorActivo: string
  /** En el celular (< 768 px). */
  celular: 'acordeon' | 'pestanas'
  /** `acordeon`: acordeón también en el computador (estilo «Acordeón» de la descripción). */
  estilo?: 'pestanas' | 'acordeon'
  /** Acordeón: ¿varias abiertas a la vez? */
  variasAbiertas: boolean
  /** La que abre al cargar (si tiene contenido); si no, la primera con contenido. */
  abierta?: string | null
  /** Quitar las pestañas cuyo bloque no pinta nada (bloques de la ficha). */
  medir?: boolean
  /** Barra fija arriba al bajar (`sticky` guardado en el bloque). */
  sticky?: boolean
  /** `#…` en la dirección y pedidos de las estrellas / «Ver detalles». */
  escuchar?: boolean
  /** Nombre de la barra para lectores de pantalla. */
  etiqueta: string
  /** Títulos: `bloque` (h2, bloques de la ficha) o `parte` (h3, partes de la descripción). */
  titulos: 'bloque' | 'parte'
  /** Clase de ancho de los paneles. */
  ancho?: string
  /** Reseñas: para el número de la pestaña «Reseñas (N)». */
  resenas?: ResenasPestana | null
  /** Atributo de datos de la raíz (lo leen los verify y el lienzo). */
  marca?: string
}

/** Alto del encabezado fijo del sitio (`--header-h`); el mismo respaldo que el resto de la ficha. */
function alturaEncabezado(el: Element): number {
  const valor = Number.parseFloat(getComputedStyle(el).getPropertyValue('--header-h'))
  return Number.isFinite(valor) ? valor : 72
}

function sinMovimiento(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function esEscritorio(): boolean {
  return typeof window.matchMedia !== 'function' || window.matchMedia(`(min-width: ${ANCHO_ESCRITORIO_PESTANAS}px)`).matches
}

export function PestanasFicha({
  items,
  colorActivo,
  celular,
  estilo = 'pestanas',
  variasAbiertas,
  abierta = null,
  medir = false,
  sticky = false,
  escuchar = false,
  etiqueta,
  titulos,
  ancho = '',
  resenas = null,
  marca,
}: PestanasFichaProps) {
  const uid = useId().replace(/:/g, '')
  const [hidratado, setHidratado] = useState(false)
  const [escritorio, setEscritorio] = useState(true)
  /** Por id: ¿su bloque pinta algo? `null` = sin medir (todas). */
  const [conContenido, setConContenido] = useState<Record<string, boolean> | null>(null)
  const [activa, setActiva] = useState<string>(abierta ?? '')
  /** Acordeón: las abiertas. `null` = aún no se tocó (abre la inicial). */
  const [abiertas, setAbiertas] = useState<string[] | null>(null)
  const panelesRef = useRef(new Map<string, HTMLElement>())
  const botonesRef = useRef(new Map<string, HTMLElement>())
  const barraRef = useRef<HTMLDivElement | null>(null)
  const raizRef = useRef<HTMLDivElement | null>(null)

  const conteo = useResumenResenas(resenas?.productId ?? null, resenas?.reviewsConfig ?? null, resenas?.productStats ?? null)
  const claveItems = items.map((i) => i.id).join('|')

  // Cambian las pestañas (en vivo en el editor): se vuelven a medir, apiladas un instante (antes
  // de pintar, sin parpadeo).
  useEfectoDeDiseno(() => {
    setHidratado(false)
  }, [claveItems])

  // Medir con todo a la vista (apiladas) y pasar a pestañas o acordeón antes de pintar.
  useEfectoDeDiseno(() => {
    if (hidratado) return
    const medidas: Record<string, boolean> = {}
    for (const i of items) medidas[i.id] = (panelesRef.current.get(i.id)?.getBoundingClientRect().height ?? 0) > 0
    setConContenido(medir ? medidas : null)
    setEscritorio(esEscritorio())
    setHidratado(true)
    // `items` cambia en cada render; `claveItems` dice cuándo cambiaron de verdad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidratado, claveItems, medir])

  // Al cruzar el ancho de computador: otra vez a medir (un bloque puede ocultarse en el celular).
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const consulta = window.matchMedia(`(min-width: ${ANCHO_ESCRITORIO_PESTANAS}px)`)
    const cambio = () => setHidratado(false)
    consulta.addEventListener?.('change', cambio)
    return () => consulta.removeEventListener?.('change', cambio)
  }, [])

  const visibles = useMemo(() => pestanasConContenido(items, conContenido), [items, conContenido])
  const modo = modoPestanas({ hidratado, cantidad: visibles.length, escritorio, celular, estilo })
  const marcada = pestanaActivaValida(activa, visibles, abierta)
  const abiertasEfectivas = abiertas ?? (marcada ? [marcada] : [])

  const tituloDe = (p: PestanaFicha) => (p.conConteoResenas && resenas ? etiquetaConConteo(p.titulo, conteo.oculto ? 0 : conteo.cantidad) : p.titulo)

  /** Abre una pestaña pedida desde fuera (dirección, estrellas, «Ver detalles») y baja hasta ella. */
  const abrirPedida = useCallback((id: string) => {
    setActiva(id)
    setAbiertas((previas) => abrirEnAcordeon(previas ?? (marcada ? [marcada] : []), id, variasAbiertas))
    // Tras pintar el panel abierto: bajar hasta la barra (o el título del acordeón) y darle el foco.
    requestAnimationFrame(() => {
      const raiz = raizRef.current
      if (!raiz) return
      const destino = (barraRef.current && barraRef.current.offsetParent !== null ? barraRef.current : null)
        ?? botonesRef.current.get(id)
        ?? panelesRef.current.get(id)
        ?? raiz
      const top = destinoSaltoAncla({
        topDestino: destino.getBoundingClientRect().top,
        scrollY: window.scrollY,
        alturaEncabezado: alturaEncabezado(raiz),
        alturaPestanas: 0,
        pestanasEncima: false,
      })
      window.scrollTo({ top, behavior: sinMovimiento() ? 'auto' : 'smooth' })
      botonesRef.current.get(id)?.focus({ preventScroll: true })
    })
  }, [marcada, variasAbiertas])

  // `#resenas` (y equivalentes) al llegar o al cambiar la dirección; pedidos de otros botones.
  useEffect(() => {
    if (!escuchar || !hidratado) return
    const ids = visibles.map((v) => v.id)
    const porHash = () => {
      const id = pestanaDeHash(window.location.hash, ids)
      if (id) abrirPedida(id)
    }
    const porEvento = (e: Event) => {
      const detalle = (e as CustomEvent<DetalleAbrirPestana>).detail
      const id = pestanaDeHash(detalle?.destino ?? '', ids)
      if (!id) return
      e.preventDefault()
      abrirPedida(id)
    }
    window.addEventListener('hashchange', porHash)
    window.addEventListener(EVENTO_ABRIR_PESTANA, porEvento)
    return () => {
      window.removeEventListener('hashchange', porHash)
      window.removeEventListener(EVENTO_ABRIR_PESTANA, porEvento)
    }
  }, [escuchar, hidratado, visibles, abrirPedida])

  // Llegada con `#…`: una sola vez, ya hidratado.
  const hashLeido = useRef(false)
  useEffect(() => {
    if (!escuchar || !hidratado || hashLeido.current) return
    hashLeido.current = true
    const id = pestanaDeHash(window.location.hash, visibles.map((v) => v.id))
    if (id) abrirPedida(id)
  }, [escuchar, hidratado, visibles, abrirPedida])

  const alTeclear = (e: KeyboardEvent<HTMLButtonElement>) => {
    const siguiente = siguientePorTecla(e.key, marcada, visibles.map((v) => v.id))
    if (!siguiente) return
    e.preventDefault()
    setActiva(siguiente)
    botonesRef.current.get(siguiente)?.focus()
  }

  // Nada que mostrar: la raíz se esconde pero los bloques siguen montados (al cambiar de pantalla
  // se vuelven a medir; un bloque oculto en el celular puede verse en el computador).
  const sinNada = hidratado && visibles.length === 0

  const enfoque = 'rounded-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--text-color,#111827)]'
  const Titulo = titulos === 'bloque' ? 'h2' : 'h3'
  const claseTitulo = titulos === 'bloque'
    ? 'text-xl font-semibold text-gray-900 dark:text-white'
    : 'font-semibold text-gray-900 dark:text-white'
  const lineaSuave: CSSProperties = { borderColor: 'color-mix(in srgb, var(--text-color, #111827) 12%, transparent)' }

  return (
    <div
      ref={raizRef}
      data-pestanas-ficha={modo}
      hidden={sinNada}
      {...(marca ? { [marca]: '' } : {})}
      className={modo === 'acordeon' ? 'divide-y border-y' : modo === 'apiladas' ? (titulos === 'bloque' ? 'space-y-10' : 'space-y-8') : ''}
      style={modo === 'acordeon' ? lineaSuave : undefined}
    >
      {modo === 'pestanas' ? (
        <div
          key="barra"
          ref={barraRef}
          role="tablist"
          aria-label={etiqueta}
          className={`flex gap-8 overflow-x-auto border-b ${sticky ? 'sticky z-10' : ''}`}
          style={{ ...lineaSuave, scrollbarWidth: 'none', ...(sticky ? { top: 'var(--header-h, 0px)', backgroundColor: 'var(--background-color, #ffffff)' } : {}) }}
        >
          {visibles.map((p) => {
            const sel = p.id === marcada
            return (
              <button
                key={p.id}
                ref={(el) => {
                  if (el) botonesRef.current.set(p.id, el)
                  else botonesRef.current.delete(p.id)
                }}
                type="button"
                role="tab"
                id={`${uid}-tab-${p.id}`}
                aria-selected={sel}
                aria-controls={`${uid}-panel-${p.id}`}
                tabIndex={sel ? 0 : -1}
                onClick={() => setActiva(p.id)}
                onKeyDown={alTeclear}
                className={`-mb-px shrink-0 border-b-2 py-3 text-sm motion-safe:transition-colors ${enfoque} ${sel ? 'font-semibold text-gray-900 dark:text-white' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
                style={sel ? { borderColor: colorActivo } : undefined}
              >
                {tituloDe(p)}
              </button>
            )
          })}
        </div>
      ) : null}
      {items.map((p) => {
        const visible = modo === 'apiladas' && !hidratado ? true : visibles.some((v) => v.id === p.id)
        const sel = p.id === marcada
        const abiertaAqui = abiertasEfectivas.includes(p.id)
        const idPanel = `${uid}-panel-${p.id}`
        const idTitulo = `${uid}-tab-${p.id}`
        const panelOculto = !visible || (modo === 'pestanas' && !sel) || (modo === 'acordeon' && !abiertaAqui)
        return (
          <div
            key={p.id}
            id={escuchar ? idDomPestana(p.id) : undefined}
            hidden={!visible}
            className={escuchar && modo !== 'pestanas' ? 'scroll-mt-[calc(var(--header-h,72px)+1rem)]' : undefined}
          >
            <Titulo hidden={modo === 'pestanas'} className={modo === 'apiladas' ? `mb-3 ${claseTitulo}` : claseTitulo}>
              {modo === 'acordeon' ? (
                <button
                  ref={(el) => {
                    if (el) botonesRef.current.set(p.id, el)
                    else botonesRef.current.delete(p.id)
                  }}
                  type="button"
                  id={idTitulo}
                  aria-expanded={abiertaAqui}
                  aria-controls={idPanel}
                  onClick={() => setAbiertas((previas) => alternarAbierta(previas ?? abiertasEfectivas, p.id, variasAbiertas))}
                  className={`flex w-full items-center justify-between gap-3 py-4 text-left ${enfoque}`}
                >
                  <span>{tituloDe(p)}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 motion-safe:transition-transform ${abiertaAqui ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
              ) : (
                tituloDe(p)
              )}
            </Titulo>
            <div
              ref={(el) => {
                if (el) panelesRef.current.set(p.id, el)
                else panelesRef.current.delete(p.id)
              }}
              id={modo === 'apiladas' ? undefined : idPanel}
              role={modo === 'pestanas' ? 'tabpanel' : modo === 'acordeon' ? 'region' : undefined}
              aria-labelledby={modo === 'apiladas' ? undefined : idTitulo}
              tabIndex={modo === 'pestanas' ? 0 : undefined}
              hidden={panelOculto}
              className={`${ancho} ${modo === 'pestanas' ? `pt-6 ${enfoque}` : modo === 'acordeon' ? 'pb-5' : ''}`}
            >
              {p.contenido}
            </div>
          </div>
        )
      })}
    </div>
  )
}
