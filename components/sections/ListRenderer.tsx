'use client'

import {
  Children,
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { listaDelInspector, type ListaVisual } from '@/lib/website/cascaronSeccion'
import { proporcionEnvoltorio } from './proporcionCeldas'

type ApiCarrusel = { prev: () => void; next: () => void }

const RegistroCtx = createContext<((api: ApiCarrusel | null) => void) | null>(null)
const ApiCtx = createContext<ApiCarrusel | null>(null)
const DuenoCtx = createContext(false)
const SetDuenoCtx = createContext<((v: boolean) => void) | null>(null)

/** Envuelve encabezado e ítems para que las flechas de arriba vivan junto al enlace. */
export function CarruselShell({ children }: { children: ReactNode }) {
  const [api, setApi] = useState<ApiCarrusel | null>(null)
  const [dueno, setDueno] = useState(false)
  const registro = useMemo(() => setApi, [])
  const marcar = useMemo(() => setDueno, [])
  return (
    <RegistroCtx.Provider value={registro}>
      <ApiCtx.Provider value={api}>
        <SetDuenoCtx.Provider value={marcar}>
          <DuenoCtx.Provider value={dueno}>{children}</DuenoCtx.Provider>
        </SetDuenoCtx.Provider>
      </ApiCtx.Provider>
    </RegistroCtx.Provider>
  )
}

/** Flechas del carrusel, a la derecha del enlace del encabezado. */
export function HuecoFlechas() {
  const api = useContext(ApiCtx)
  const setDueno = useContext(SetDuenoCtx)
  useLayoutEffect(() => {
    setDueno?.(true)
    return () => setDueno?.(false)
  }, [setDueno])
  return (
    <span className="inline-flex gap-1">
      <button type="button" aria-label="Anterior" className="h-9 w-9 rounded-full bg-white shadow" onClick={() => api?.prev()} disabled={!api}>‹</button>
      <button type="button" aria-label="Siguiente" className="h-9 w-9 rounded-full bg-white shadow" onClick={() => api?.next()} disabled={!api}>›</button>
    </span>
  )
}

/**
 * Rejilla, carrusel, lista o masonry. Sin `section_display` pinta el `div` de hoy.
 */
export const SiLista = forwardRef<HTMLDivElement, {
  content: unknown
  className?: string
  style?: CSSProperties
  onScroll?: () => void
  /** Rejillas: con la lista del inspector, la «Proporción» va en cada celda. */
  proporcionCeldas?: boolean
  children: ReactNode
}>(function SiLista({ content, className, style, onScroll, proporcionCeldas, children }, ref) {
  const lista = listaDelInspector(content)
  if (!lista) {
    return <div ref={ref} className={className} style={style} onScroll={onScroll}>{children}</div>
  }
  const conserva = lista.mode === 'grid'
    && lista.columnsDesktop == null
    && lista.columnsTablet == null
    && lista.columnsMobile == null
  return (
    <ListRenderer lista={lista} className={conserva ? className : undefined} style={conserva ? style : undefined} celda={proporcionCeldas && !conserva && lista.mode === 'grid' ? proporcionEnvoltorio(content) : undefined}>
      {children}
    </ListRenderer>
  )
})

export function ListRenderer({
  lista,
  className,
  style,
  celda,
  children,
}: {
  lista: ListaVisual
  className?: string
  celda?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const items = Children.toArray(children)
  const [pagina, setPagina] = useState(1)
  const [extra, setExtra] = useState(0)
  const [avance, setAvance] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)
  const sentinel = useRef<HTMLDivElement>(null)
  const arrastre = useRef<{ x: number; left: number; movio: boolean } | null>(null)
  const id = useId().replace(/:/g, '')
  const setApi = useContext(RegistroCtx)
  const dueno = useContext(DuenoCtx)
  const por = lista.perPage ?? 12
  const total = items.length
  const paginas = lista.pagination === 'pages' ? Math.max(1, Math.ceil(total / por)) : 1
  const visibles = lista.pagination === 'pages'
    ? items.slice((pagina - 1) * por, pagina * por)
    : lista.pagination === 'load_more' || lista.pagination === 'infinite'
      ? items.slice(0, por + extra)
      : items
  const gap = lista.gap ?? 16
  const algunaCol = lista.columnsDesktop != null || lista.columnsTablet != null || lista.columnsMobile != null
  const conserva = Boolean(className) && lista.mode === 'grid' && !algunaCol
  const cm = lista.columnsMobile ?? 1
  const ct = lista.columnsTablet ?? Math.min(lista.columnsDesktop ?? 2, 3)
  const cd = lista.columnsDesktop ?? 4
  const vm = lista.visibleMobile ?? 1
  const vt = lista.visibleTablet ?? 2
  const vd = lista.visibleDesktop ?? 4
  const css = conserva
    ? ''
    : lista.mode === 'grid'
      ? (algunaCol
        ? `[data-lista="${id}"]{display:grid;gap:${gap}px;grid-template-columns:repeat(${cm},minmax(0,1fr))}@media(min-width:768px){[data-lista="${id}"]{grid-template-columns:repeat(${ct},minmax(0,1fr))}}@media(min-width:1024px){[data-lista="${id}"]{grid-template-columns:repeat(${cd},minmax(0,1fr))}}`
        : `[data-lista="${id}"]{display:grid;gap:${gap}px;grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}`)
      : lista.mode === 'carousel'
        ? `[data-lista="${id}"]{display:flex;gap:${gap}px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none}${lista.drag === false ? '[data-lista="' + id + '"]{overflow-x:hidden}' : ''}[data-lista="${id}"]>[data-lista-item]{flex:0 0 calc((100% - ${(vm - 1) * gap}px)/${vm});scroll-snap-align:start}@media(min-width:768px){[data-lista="${id}"]>[data-lista-item]{flex-basis:calc((100% - ${(vt - 1) * gap}px)/${vt})}}@media(min-width:1024px){[data-lista="${id}"]>[data-lista-item]{flex-basis:calc((100% - ${(vd - 1) * gap}px)/${vd})}}`
        : lista.mode === 'masonry'
          ? `[data-lista="${id}"]{column-count:${cm};column-gap:${gap}px}@media(min-width:768px){[data-lista="${id}"]{column-count:${ct}}}@media(min-width:1024px){[data-lista="${id}"]{column-count:${cd}}}`
          : `[data-lista="${id}"]{display:flex;flex-direction:column;gap:${gap}px}`

  const desplazar = (dir: number) => {
    const el = scroller.current
    if (!el) return
    const paso = el.clientWidth * 0.8 * dir
    const alFinal = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
    const alInicio = el.scrollLeft <= 4
    if (dir > 0 && alFinal && lista.loop !== false) el.scrollTo({ left: 0, behavior: 'smooth' })
    else if (dir < 0 && alInicio && lista.loop !== false) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
    else el.scrollBy({ left: paso, behavior: 'smooth' })
  }

  useLayoutEffect(() => {
    if (!setApi) return
    setApi({ prev: () => desplazar(-1), next: () => desplazar(1) })
    return () => setApi(null)
    // El setter del shell es estable. desplazar lee el ref en el click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setApi])

  useEffect(() => {
    if (!lista.autoplay || lista.mode !== 'carousel') return
    const idTimer = window.setInterval(() => desplazar(1), (lista.interval ?? 5) * 1000)
    return () => window.clearInterval(idTimer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista.autoplay, lista.interval, lista.loop, lista.mode])

  useEffect(() => {
    if (lista.pagination !== 'infinite') return
    const nodo = sentinel.current
    if (!nodo) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setExtra((n) => n + por)
    }, { rootMargin: '240px' })
    io.observe(nodo)
    return () => io.disconnect()
  }, [lista.pagination, por, extra, total])

  const flechasPropias = lista.mode === 'carousel' && lista.arrows && !(lista.arrows === 'top' && dueno)
  const flechas = flechasPropias ? (
    <div className={lista.arrows === 'bottom' ? 'mt-3 flex justify-center gap-2' : lista.arrows === 'top' ? 'mb-3 flex justify-end gap-2' : 'pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-1'}>
      <button type="button" aria-label="Anterior" className="pointer-events-auto h-9 w-9 rounded-full bg-white shadow" onClick={() => desplazar(-1)}>‹</button>
      <button type="button" aria-label="Siguiente" className="pointer-events-auto h-9 w-9 rounded-full bg-white shadow" onClick={() => desplazar(1)}>›</button>
    </div>
  ) : null

  const paginasCarrusel = Math.max(1, Math.ceil(total / vd))

  return (
    <div>
      {css ? <style>{css}</style> : null}
      {lista.arrows === 'top' && flechas}
      <div className="relative">
        {lista.arrows === 'sides' && flechas}
        <div
          ref={scroller}
          data-lista={id}
          className={conserva ? className : lista.drag === false ? '' : lista.mode === 'carousel' ? 'cursor-grab' : ''}
          style={conserva ? { ...style, ...(lista.gap != null ? { gap: lista.gap } : {}) } : undefined}
          onScroll={() => {
            const el = scroller.current
            if (!el) return
            const ancho = el.scrollWidth - el.clientWidth
            setAvance(ancho <= 0 ? 0 : el.scrollLeft / ancho)
          }}
          onPointerDown={(e) => {
            if (lista.drag === false || lista.mode !== 'carousel') return
            if ((e.target as HTMLElement).closest('a,button,input,textarea,select')) return
            const el = scroller.current
            if (!el) return
            arrastre.current = { x: e.clientX, left: el.scrollLeft, movio: false }
            el.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            const estado = arrastre.current
            const el = scroller.current
            if (!estado || !el) return
            const dx = e.clientX - estado.x
            if (Math.abs(dx) > 4) estado.movio = true
            el.scrollLeft = estado.left - dx
          }}
          onPointerUp={() => { arrastre.current = null }}
        >
          {visibles.map((nodo, i) => (
            <div key={i} data-lista-item="" className={lista.mode === 'masonry' ? 'mb-4 break-inside-avoid' : celda ?? ''}>
              {nodo}
            </div>
          ))}
        </div>
      </div>
      {lista.arrows === 'bottom' && flechas}
      {lista.dots && lista.mode === 'carousel' && (
        <div className="mt-3 flex justify-center gap-1.5">
          {Array.from({ length: paginasCarrusel }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ir a la página ${i + 1}`}
              className="h-2 w-2 rounded-full bg-gray-300"
              onClick={() => scroller.current?.scrollTo({ left: i * (scroller.current?.clientWidth ?? 0), behavior: 'smooth' })}
            />
          ))}
        </div>
      )}
      {lista.progress && lista.mode === 'carousel' && (
        <div className="mx-auto mt-3 h-1 w-24 overflow-hidden rounded-full bg-gray-200" aria-hidden>
          <div className="h-full bg-gray-800" style={{ width: `${Math.round(avance * 100)}%` }} />
        </div>
      )}
      {lista.pagination === 'pages' && paginas > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {Array.from({ length: paginas }, (_, i) => (
            <button key={i} type="button" className="h-8 min-w-8 rounded-full border px-2 text-sm" onClick={() => setPagina(i + 1)}>{i + 1}</button>
          ))}
        </div>
      )}
      {lista.pagination === 'load_more' && por + extra < total && (
        <div className="mt-4 flex justify-center">
          <button type="button" className="rounded-full border px-4 py-2 text-sm" onClick={() => setExtra((n) => n + por)}>Ver más</button>
        </div>
      )}
      {lista.pagination === 'infinite' && por + extra < total && <div ref={sentinel} className="h-px w-full" aria-hidden />}
    </div>
  )
}
