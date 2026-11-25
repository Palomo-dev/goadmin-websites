'use client'

/**
 * Reseñas de la ficha con opciones (Figma «16 Sitio web» 2986:73149 escritorio, 2987:73444
 * celular; paneles 2987:73690 / 73880 / 74017). Solo se usa cuando la sección `product_reviews`
 * trae alguna clave nueva (`lib/website/v2/seccionesFicha.ts`); sin ellas `ProductReviews` pinta
 * lo de siempre.
 *
 * Estilos: A Clásico (resumen y barras a la izquierda, lista con filtros a la derecha), B Carrusel
 * de destacadas (las más útiles en tarjetas), C Compacta (para la columna de compra) y D Fotos
 * primero. Estado vacío con «Escribir una opinión» (mismo en los cuatro).
 *
 * Los datos son los mismos que hoy (providers de `ProductReviews`): las reseñas de ejemplo y su
 * «Compra verificada» se quedan como están (decisión del dueño, 2026-11-24), salvo que la sección
 * apague el switch «Mostrar “Compra verificada” en las de ejemplo» (lo aplica `ProductReviews`).
 *
 * «Escribir una opinión» abre el formulario que guarda (`ReviewForm`, Figma 2B/2C). Con «Solo
 * compradores» el mismo formulario pide verificar la compra antes de escribir.
 */

import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Check, ChevronLeft, ChevronRight, ChevronDown, ImageIcon, Pencil, Star, ThumbsUp } from 'lucide-react'
import type { ReviewItem } from './types'
import { ReviewForm } from './ReviewForm'
import { PX_TITULO, ordenarResenas, type FiltroResenas, type OpcionesResenas, type OrdenResenas } from '@/lib/website/v2/seccionesFicha'

const AMARILLO = '#FACC15'
const GRIS_BARRA = '#374151'

interface Props {
  opciones: OpcionesResenas
  reviews: ReviewItem[]
  totalReviews: number
  avgRating: number
  primaryColor: string
  /** Modo «Reales» sin ninguna aprobada. */
  vacio: boolean
  textosVacio: { titulo: string; mensaje: string; boton: string }
  aviso: ReactNode
  productId?: number
  productName?: string
  formulario?: { soloCompradores: boolean; fotosPermitidas: boolean; moderar: boolean }
  onPublicada?: () => void
}

type Filtro = 'todas' | 'fotos' | 'verificada' | 5 | 4 | 'bajas'

function Estrellas({ valor, color, tamano = 16 }: { valor: number; color: string; tamano?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${valor.toFixed(1)} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const lleno = valor >= i - 0.25
        const medio = !lleno && valor >= i - 0.75
        return (
          <span key={i} className="relative inline-block" style={{ width: tamano, height: tamano }} aria-hidden="true">
            <Star className="absolute inset-0 text-gray-300" style={{ width: tamano, height: tamano }} />
            {(lleno || medio) && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: lleno ? tamano : tamano / 2 }}>
                <Star style={{ width: tamano, height: tamano, color, fill: color }} />
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}

/** Las destacadas por la tienda primero, sin cambiar el orden del resto (orden estable). */
function destacadasPrimero(lista: ReviewItem[]): ReviewItem[] {
  return lista.some((r) => r.featured) ? [...lista.filter((r) => r.featured), ...lista.filter((r) => !r.featured)] : lista
}

function fecha(valor: string): string {
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function ResenasConOpciones({ opciones: o, reviews, totalReviews, avgRating, primaryColor, vacio, textosVacio, aviso, productId, productName, formulario: ajustesFormulario, onPublicada }: Props) {
  const colorEstrella = o.colorEstrellas === 'tienda' ? primaryColor : AMARILLO
  const colorBarra = o.colorBarras === 'gris' ? GRIS_BARRA : primaryColor
  const [formulario, setFormulario] = useState(false)
  const [verTodas, setVerTodas] = useState(false)
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [orden, setOrden] = useState<OrdenResenas>(o.orden)
  const [visibles, setVisibles] = useState(o.porPagina)

  const conFotos = useMemo(() => reviews.filter((r) => (r.images?.length ?? 0) > 0), [reviews])
  const verificadas = useMemo(() => reviews.filter((r) => r.verified), [reviews])
  const conteo = (n: number) => reviews.filter((r) => r.rating === n).length

  const filtradas = useMemo(() => {
    let lista = reviews
    if (filtro === 'fotos') lista = conFotos
    else if (filtro === 'verificada') lista = verificadas
    else if (filtro === 'bajas') lista = reviews.filter((r) => r.rating <= 3)
    else if (typeof filtro === 'number') lista = reviews.filter((r) => r.rating === filtro)
    return ordenarResenas(lista, orden)
  }, [reviews, conFotos, verificadas, filtro, orden])

  const tituloEstilo: CSSProperties = { fontSize: PX_TITULO[o.tamanoTitulo] }
  const promedio = Number.isFinite(avgRating) ? avgRating : 0

  // ── Piezas comunes ──
  const botonEscribir = (texto: string, extra = '') => {
    const base = 'inline-flex items-center justify-center gap-2 text-sm font-semibold transition-opacity hover:opacity-90'
    const clase =
      o.boton === 'enlace'
        ? `${base} underline-offset-4 hover:underline`
        : `${base} h-10 rounded-lg px-4 ${o.boton === 'borde' ? 'border-2 bg-transparent' : 'text-white'}`
    const estilo: CSSProperties =
      o.boton === 'relleno' ? { backgroundColor: primaryColor } : { color: primaryColor, borderColor: o.boton === 'borde' ? primaryColor : undefined }
    return (
      <button type="button" onClick={() => setFormulario((v) => !v)} className={`${clase} ${extra}`} style={estilo} aria-expanded={formulario}>
        <Pencil className="h-4 w-4" aria-hidden="true" />
        {texto}
      </button>
    )
  }

  const panelFormulario = formulario ? (
    <ReviewForm
      primaryColor={primaryColor}
      productId={productId}
      productName={productName}
      soloCompradores={ajustesFormulario?.soloCompradores ?? o.quienOpina === 'compradores'}
      fotosPermitidas={ajustesFormulario?.fotosPermitidas ?? true}
      moderar={ajustesFormulario?.moderar ?? true}
      onCerrar={() => setFormulario(false)}
      onPublicada={onPublicada}
    />
  ) : null

  const claseTarjeta =
    o.tarjeta === 'borde' ? 'border border-gray-200 dark:border-gray-700' : o.tarjeta === 'suave' ? 'bg-gray-50 dark:bg-gray-800/50' : ''

  const tarjeta = (r: ReviewItem, compacta = false) => (
    <article key={r.id} className={`rounded-xl p-5 ${claseTarjeta}`} data-resena="">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {o.avatar && (
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 15%, white)`, color: primaryColor }}
            >
              {r.avatar}
            </span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-white">{r.name}</span>
              {r.verified && (
                <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-700">
                  <Check className="h-3 w-3" aria-hidden="true" /> Compra verificada
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">{[o.ciudad ? r.city : null, fecha(r.date)].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        {!compacta && <Estrellas valor={r.rating} color={colorEstrella} tamano={14} />}
      </div>
      {compacta && <div className="mt-2"><Estrellas valor={r.rating} color={colorEstrella} tamano={14} /></div>}
      {r.title && <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">{r.title}</p>}
      <p className={`mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300 ${compacta ? 'line-clamp-3' : ''}`}>{r.comment}</p>
      {o.fotos && r.images && r.images.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {r.images.slice(0, 4).map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- fotos subidas por clientes (storage)
            <img key={i} src={img} alt={`Foto ${i + 1} de ${r.name}`} className="h-16 w-16 rounded-lg border object-cover" />
          ))}
        </div>
      )}
      {o.respuesta && r.replyText && (
        <div className="mt-3 rounded-lg border-l-2 bg-gray-50 p-3 dark:bg-gray-800/50" style={{ borderColor: primaryColor }}>
          <p className="mb-1 text-xs font-semibold text-gray-700 dark:text-gray-200">Respuesta de la tienda</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{r.replyText}</p>
        </div>
      )}
      {o.util && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-gray-500">
          <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" /> Útil ({r.likes})
        </p>
      )}
    </article>
  )

  const barras = (
    <div className="space-y-1.5">
      {[5, 4, 3, 2, 1].map((n) => {
        const c = conteo(n)
        const pct = reviews.length > 0 ? Math.round((c / reviews.length) * 100) : 0
        return (
          <button
            key={n}
            type="button"
            onClick={() => setFiltro(filtro === n ? 'todas' : (n as 5 | 4))}
            className="flex w-full items-center gap-2 text-xs text-gray-600 dark:text-gray-300"
          >
            <span className="w-7 text-left">{n} ★</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colorBarra }} />
            </span>
            <span className="w-8 text-right tabular-nums">{c}</span>
          </button>
        )
      })}
    </div>
  )

  const chips = () => {
    const lista: { id: Filtro; etiqueta: string; filtro: FiltroResenas | null }[] = [
      { id: 'todas', etiqueta: `Todas (${totalReviews.toLocaleString('es-CO')})`, filtro: null },
      { id: 'fotos', etiqueta: `Con fotos (${conFotos.length})`, filtro: 'fotos' },
      { id: 'verificada', etiqueta: `Compra verificada (${verificadas.length})`, filtro: 'verificada' },
      { id: 5, etiqueta: '5 ★', filtro: 'estrellas' },
      { id: 4, etiqueta: '4 ★', filtro: 'estrellas' },
      { id: 'bajas', etiqueta: '3 ★ o menos', filtro: 'estrellas' },
    ]
    return lista
      .filter((c) => c.filtro === null || o.filtros.includes(c.filtro))
      .map((c) => {
        const activo = filtro === c.id
        return (
          <button
            key={String(c.id)}
            type="button"
            aria-pressed={activo}
            onClick={() => {
              setFiltro(activo && c.id !== 'todas' ? 'todas' : c.id)
              setVisibles(o.porPagina)
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${activo ? 'border-transparent text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200'}`}
            style={activo ? { backgroundColor: primaryColor } : undefined}
          >
            {c.etiqueta}
          </button>
        )
      })
  }

  const selectorOrden = (
    <label className="ml-auto inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
      <span>Ordenar:</span>
      <select value={orden} onChange={(e) => setOrden(e.target.value as OrdenResenas)} className="rounded-lg border bg-white px-2 py-1.5 text-xs dark:bg-gray-900">
        <option value="helpful">Más útiles</option>
        <option value="recent">Más recientes</option>
        <option value="highest">Mejor calificadas</option>
        <option value="lowest">Peor calificadas</option>
      </select>
    </label>
  )

  const listaConMas = (lista: ReviewItem[], columnas = false) => (
    <>
      <div className={columnas ? 'grid gap-4 md:grid-cols-2' : 'space-y-4'}>{lista.slice(0, visibles).map((r) => tarjeta(r))}</div>
      {lista.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {visibles < lista.length && (
            <button
              type="button"
              onClick={() => setVisibles((v) => v + o.porPagina)}
              className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100"
            >
              Ver más opiniones
            </button>
          )}
          <span className="text-xs text-gray-500">
            Mostrando {Math.min(visibles, lista.length)} de {lista.length.toLocaleString('es-CO')}
          </span>
        </div>
      )}
    </>
  )

  // ── Estado vacío (igual en los cuatro estilos) ──
  if (vacio) {
    return (
      <section className="mt-16 border-t pt-12" data-resenas="vacio">
        <h2 className="titulo-legado font-bold text-gray-900 dark:text-white" style={tituloEstilo}>{o.titulo}</h2>
        <div className="mt-6 flex flex-col items-center gap-3 rounded-xl bg-gray-50 px-6 py-10 text-center dark:bg-gray-800/50">
          <Estrellas valor={0} color={colorEstrella} tamano={20} />
          <p className="text-base font-semibold text-gray-900 dark:text-white">{textosVacio.titulo}</p>
          <p className="text-sm text-gray-500">{textosVacio.mensaje}</p>
          {botonEscribir(textosVacio.boton)}
        </div>
        {panelFormulario && <div className="mt-6">{panelFormulario}</div>}
      </section>
    )
  }

  const resumenFondo = o.resumen === 'suave' ? 'bg-gray-50 dark:bg-gray-800/50 p-5' : ''

  // ── C · Compacta ──
  if (o.estilo === 'compacta') {
    const destacadas = destacadasPrimero(ordenarResenas(reviews, 'helpful')).slice(0, 2)
    return (
      <section className={`mt-8 rounded-xl ${claseTarjeta} p-5`} data-resenas="compacta">
        <div className="flex flex-wrap items-center gap-2">
          <Estrellas valor={promedio} color={colorEstrella} />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{promedio.toFixed(1)}</span>
          <span className="text-sm text-gray-500">· {totalReviews.toLocaleString('es-CO')} opiniones</span>
          <button type="button" onClick={() => setVerTodas((v) => !v)} className="ml-auto text-sm font-semibold underline underline-offset-2" style={{ color: primaryColor }} aria-expanded={verTodas}>
            {verTodas ? 'Ver menos' : 'Ver todas'}
          </button>
        </div>
        <ul className="mt-3 divide-y divide-gray-200 dark:divide-gray-700">
          {destacadas.map((r) => (
            <li key={r.id} className="py-3">
              <p className="text-sm font-medium text-gray-900 dark:text-white">«{r.title || r.comment.slice(0, 60)}»</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <Estrellas valor={r.rating} color={colorEstrella} tamano={12} />
                {[r.name, o.ciudad ? r.city : null].filter(Boolean).join(' · ')}
                {r.verified && <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-green-700">Compra verificada</span>}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-2">{botonEscribir(o.textoBoton, o.boton === 'enlace' ? '' : 'h-9')}</div>
        {panelFormulario && <div className="mt-4">{panelFormulario}</div>}
        {verTodas && <div className="mt-4">{listaConMas(filtradas)}</div>}
        {aviso}
      </section>
    )
  }

  // ── B · Carrusel de destacadas ──
  if (o.estilo === 'carrusel') {
    return <CarruselResenas o={o} reviews={reviews} total={totalReviews} promedio={promedio} colorEstrella={colorEstrella} primaryColor={primaryColor}
      tituloEstilo={tituloEstilo} tarjeta={tarjeta} botonEscribir={botonEscribir} panelFormulario={panelFormulario}
      verTodas={verTodas} setVerTodas={setVerTodas} lista={listaConMas(filtradas)} aviso={aviso} />
  }

  // ── D · Fotos primero ──
  if (o.estilo === 'fotos') {
    const fotos = conFotos.flatMap((r) => r.images ?? [])
    const mostradas = fotos.slice(0, 8)
    const resto = fotos.length - mostradas.length
    const primero = [...ordenarResenas(conFotos, orden), ...ordenarResenas(reviews.filter((r) => !(r.images?.length)), orden)]
    return (
      <section className="mt-16 border-t pt-12" data-resenas="fotos">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="titulo-legado font-bold text-gray-900 dark:text-white" style={tituloEstilo}>{o.titulo}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
              <Estrellas valor={promedio} color={colorEstrella} tamano={14} />
              {promedio.toFixed(1)} · {totalReviews.toLocaleString('es-CO')} opiniones · {conFotos.length} con fotos
            </p>
          </div>
          {botonEscribir(o.textoBoton)}
        </div>
        {panelFormulario}
        {o.fotos && mostradas.length > 0 && (
          <div className="mb-6 grid grid-cols-4 gap-2 sm:grid-cols-8">
            {mostradas.map((src, i) => (
              <span key={i} className="relative block aspect-square overflow-hidden rounded-lg bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element -- fotos subidas por clientes (storage) */}
                <img src={src} alt="" className="h-full w-full object-cover" />
                {i === mostradas.length - 1 && resto > 0 && (
                  <span className="absolute inset-0 flex items-center justify-center bg-gray-900/60 text-sm font-semibold text-white">+{resto}</span>
                )}
              </span>
            ))}
          </div>
        )}
        {o.fotos && mostradas.length === 0 && (
          <p className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500"><ImageIcon className="h-4 w-4" aria-hidden="true" /> Aún no hay fotos de clientes.</p>
        )}
        {listaConMas(primero, true)}
        {aviso}
      </section>
    )
  }

  // ── A · Clásico ──
  return (
    <section className="mt-16 border-t pt-12" data-resenas="clasico">
      <h2 className="titulo-legado font-bold text-gray-900 dark:text-white" style={tituloEstilo}>{o.titulo}</h2>
      <p className="mt-1 text-sm text-gray-500">
        {totalReviews.toLocaleString('es-CO')} opiniones · {promedio.toFixed(1)} de 5
      </p>
      <div className="mt-6 grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className={`self-start rounded-xl ${resumenFondo}`}>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-bold text-gray-900 dark:text-white">{promedio.toFixed(1).replace('.', ',')}</span>
            <span>
              <Estrellas valor={promedio} color={colorEstrella} />
              <span className="block text-xs text-gray-500">{totalReviews.toLocaleString('es-CO')} opiniones</span>
            </span>
          </div>
          <div className="mt-4">{barras}</div>
          <div className="mt-4">{botonEscribir(o.textoBoton, o.boton === 'enlace' ? '' : 'w-full')}</div>
        </aside>
        <div className="min-w-0">
          {panelFormulario}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {chips()}
            {selectorOrden}
          </div>
          {listaConMas(filtradas)}
          {aviso}
        </div>
      </div>
    </section>
  )
}

interface PropsCarrusel {
  o: OpcionesResenas
  reviews: ReviewItem[]
  total: number
  promedio: number
  colorEstrella: string
  primaryColor: string
  tituloEstilo: CSSProperties
  tarjeta: (r: ReviewItem, compacta?: boolean) => ReactNode
  botonEscribir: (texto: string, extra?: string) => ReactNode
  panelFormulario: ReactNode
  verTodas: boolean
  setVerTodas: (f: (v: boolean) => boolean) => void
  lista: ReactNode
  aviso: ReactNode
}

function CarruselResenas({ o, reviews, total, promedio, colorEstrella, primaryColor, tituloEstilo, tarjeta, botonEscribir, panelFormulario, verTodas, setVerTodas, lista, aviso }: PropsCarrusel) {
  const pista = useRef<HTMLDivElement>(null)
  const [pagina, setPagina] = useState(0)
  const destacadas = useMemo(() => destacadasPrimero(ordenarResenas(reviews, 'helpful')).slice(0, 6), [reviews])
  const paginas = Math.max(1, Math.ceil(destacadas.length / 3))
  const mover = (dir: number) => pista.current?.scrollBy({ left: dir * (pista.current.clientWidth * 0.9), behavior: 'smooth' })
  const flecha = (dir: number, Icono: typeof ChevronLeft, etiqueta: string) => (
    <button type="button" onClick={() => mover(dir)} aria-label={etiqueta} className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200">
      <Icono className="h-4 w-4" aria-hidden="true" />
    </button>
  )
  return (
    <section className="mt-16 border-t pt-12" data-resenas="carrusel">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="titulo-legado font-bold text-gray-900 dark:text-white" style={tituloEstilo}>{o.titulo}</h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
            <Estrellas valor={promedio} color={colorEstrella} tamano={14} />
            <span className="font-semibold text-gray-900 dark:text-white">{promedio.toFixed(1).replace('.', ',')}</span>· {total.toLocaleString('es-CO')} opiniones
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {destacadas.length > 3 && flecha(-1, ChevronLeft, 'Anteriores')}
          {destacadas.length > 3 && flecha(1, ChevronRight, 'Siguientes')}
          <button type="button" onClick={() => setVerTodas((v) => !v)} aria-expanded={verTodas} className="inline-flex h-10 items-center gap-1 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100">
            {verTodas ? 'Ver menos' : `Ver las ${total.toLocaleString('es-CO')} opiniones`}
            <ChevronDown className={`h-4 w-4 transition-transform ${verTodas ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {botonEscribir(o.textoBoton)}
        </div>
      </div>
      {panelFormulario}
      <div
        ref={pista}
        onScroll={(e) => {
          const el = e.currentTarget
          const max = el.scrollWidth - el.clientWidth
          setPagina(max > 0 ? Math.round((el.scrollLeft / max) * (paginas - 1)) : 0)
        }}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
        style={{ scrollbarWidth: 'none' }}
      >
        {destacadas.map((r) => (
          <div key={r.id} className="w-[85%] shrink-0 snap-start sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-11px)]">{tarjeta(r, true)}</div>
        ))}
      </div>
      {paginas > 1 && (
        <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
          {Array.from({ length: paginas }).map((_, i) => (
            <span key={i} className={`h-2 rounded-full ${i === pagina ? 'w-6' : 'w-2 bg-gray-300'}`} style={i === pagina ? { backgroundColor: primaryColor } : undefined} />
          ))}
        </div>
      )}
      {verTodas && <div className="mt-8">{lista}</div>}
      {aviso}
    </section>
  )
}
