'use client'

/**
 * F9.4 — Sección category_filters.
 *
 * Renderiza los filtros de categoría: pills de subcategorías, selector de
 * ordenamiento y toggle de vista (grid/list). Reproduce el comportamiento
 * del CategoryPageClient actual.
 */

import { useRouter } from 'next/navigation'
import { Grid3X3, List, Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import {
  CLAVES_ORDEN_FILTROS_CATEGORIA,
  ETIQUETAS_ORDEN_CATEGORIA,
  ORDENES_CATEGORIA,
  normalizarAjustesFiltrosCategoria,
  normalizarOrdenFiltrosCategoria,
  TEXTO_BUSCADOR_CATEGORIA,
} from '@/lib/website/v2/contrato/seccionesTienda'
import { IconoGuardado } from '@/components/site/IconoGuardado'
import { CarrilChips } from '@/components/site/carrusel/CarrilChips'
import { filtrosActivos, urlListadoCategoria } from './columnasCategoria'

export const CONTENT_KEYS = ['filter_position', 'show_sort', 'show_view_toggle', 'subcategory_style', 'search', ...CLAVES_ORDEN_FILTROS_CATEGORIA] as const

/** Las seis opciones de siempre (las usa el listado legacy). */
export const SORT_OPTIONS = ORDENES_CATEGORIA.map((value) => ({ value, label: ETIQUETAS_ORDEN_CATEGORIA[value] }))

interface CategoryFiltersProps {
  content: {
    filter_position?: string
    show_sort?: boolean
    show_view_toggle?: boolean
    /** Plantillas de tienda: `chips` (hoy) | `text` | `tabs`. */
    subcategory_style?: string
    /** Plantillas de tienda: buscador en píldora que busca en toda la tienda (`/search?q=`). */
    search?: boolean
    /** Opciones de orden, orden al entrar y conteo (Figma «16 Sitio web», bloque 6). */
    [clave: string]: unknown
  }
  primaryColor?: string
  data?: {
    subcategories?: any[]
    categorySlug?: string
    total?: number
    currentSort?: string
    currentSubcategory?: string
    currentView?: string
    ordenPorDefecto?: string
    /** El encabezado ya muestra «N productos»: aquí no se repite. */
    conteoEnEncabezado?: boolean
  }
}

export function CategoryFilters({ content, primaryColor = '#3B82F6', data }: CategoryFiltersProps) {
  const router = useRouter()
  const subcategories = data?.subcategories || []
  const categorySlug = data?.categorySlug || ''
  const total = data?.total ?? 0
  const porDefecto = data?.ordenPorDefecto || 'best_selling'
  const currentSort = data?.currentSort || porDefecto
  const currentSubcategory = data?.currentSubcategory || ''
  const currentView = data?.currentView || 'grid'

  const [view, setView] = useState<'grid' | 'list'>(currentView as 'grid' | 'list')
  const [showFilters, setShowFilters] = useState(false)

  const showSort = content.show_sort !== false
  const showViewToggle = content.show_view_toggle !== false
  // Ausentes = `chips` y sin buscador: la fila de siempre.
  const ajustes = normalizarAjustesFiltrosCategoria(content as Record<string, unknown>)
  // Ausentes = arriba, las seis opciones de siempre y el conteo (si el encabezado no lo muestra).
  const orden = normalizarOrdenFiltrosCategoria(content as Record<string, unknown>)
  const enPanel = orden.posicion === 'drawer'
  const conConteo = orden.mostrarConteo && data?.conteoEnEncabezado !== true
  const activos = filtrosActivos(currentSubcategory, currentSort, porDefecto)
  const { ruta } = useRutaSitio()

  const buildUrl = (overrides: { orden?: string; sub?: string; vista?: string }) =>
    ruta(
      urlListadoCategoria(
        categorySlug,
        { orden: currentSort, sub: currentSubcategory || undefined, vista: view, ...overrides },
        porDefecto,
      ),
    )

  const handleSortChange = (newSort: string) => {
    router.push(buildUrl({ orden: newSort }))
  }

  const handleSubcategoryChange = (subSlug: string) => {
    router.push(buildUrl({ sub: subSlug || undefined }))
  }

  const handleViewChange = (newView: 'grid' | 'list') => {
    setView(newView)
    router.push(buildUrl({ vista: newView }))
  }

  // Subcategorías como texto (activa en el color del texto) o como pestañas subrayadas.
  const filaSubcategoriasNueva = subcategories.length > 0 && ajustes.subcategoryStyle !== 'chips' ? (
    <nav
      aria-label="Subcategorías"
      className={`overflow-x-auto ${ajustes.subcategoryStyle === 'tabs' ? 'border-b border-gray-200 dark:border-gray-700' : ''}`}
      style={{ scrollbarWidth: 'none' }}
    >
      <div className={`flex ${ajustes.subcategoryStyle === 'tabs' ? 'gap-6' : 'gap-x-6 gap-y-2'} whitespace-nowrap`}>
        {[{ id: '__todas', slug: '', name: 'Todas' }, ...subcategories].map((sub: any) => {
          const activa = sub.slug ? currentSubcategory === sub.slug : !currentSubcategory
          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => handleSubcategoryChange(sub.slug)}
              aria-current={activa ? 'true' : undefined}
              className={ajustes.subcategoryStyle === 'tabs'
                ? `-mb-px border-b-2 pb-3 text-sm font-medium transition-colors ${activa ? 'border-current text-gray-900 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`
                : `text-sm transition-colors ${activa ? 'font-semibold text-gray-900 underline underline-offset-8 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
            >
              {sub.name}
            </button>
          )
        })}
      </div>
    </nav>
  ) : null

  // Buscador en píldora: GET a /search, funciona sin JavaScript. Busca en toda la tienda.
  const buscador = ajustes.search ? (
    <form action={ruta('/search')} method="get" role="search" className="relative w-full md:w-72 md:shrink-0">
      <label className="sr-only" htmlFor="buscar-en-la-tienda">{TEXTO_BUSCADOR_CATEGORIA}</label>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
      <input
        id="buscar-en-la-tienda"
        type="search"
        name="q"
        required
        placeholder={TEXTO_BUSCADOR_CATEGORIA}
        className="w-full rounded-full border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        style={{ ['--tw-ring-color' as any]: primaryColor }}
      />
    </form>
  ) : null

  // La misma pieza de las secciones de productos y de la página de categoría (CarrilChips): flechas,
  // arrastre con el mouse, rueda, «Todas» fijo y desvanecido con máscara.
  const filaSubcategoriasHoy = subcategories.length > 0 && ajustes.subcategoryStyle === 'chips' ? (
    <CarrilChips
      className={buscador ? 'min-w-0 flex-1' : 'mb-6'}
      etiqueta="Subcategorías"
      color={primaryColor}
      claveActivo={currentSubcategory}
      chipFijo={
        <button
          type="button"
          aria-pressed={!currentSubcategory}
          onClick={() => handleSubcategoryChange('')}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            !currentSubcategory
              ? 'text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          style={!currentSubcategory ? { backgroundColor: primaryColor } : {}}
        >
          Todas
        </button>
      }
    >
        {subcategories.map((sub: any) => (
          <button
            key={sub.id}
            type="button"
            aria-pressed={currentSubcategory === sub.slug}
            onClick={() => handleSubcategoryChange(sub.slug)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              currentSubcategory === sub.slug
                ? 'text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            style={currentSubcategory === sub.slug ? { backgroundColor: primaryColor } : {}}
          >
            {sub.icon && <span className="mr-1 inline-flex align-[-2px]"><IconoGuardado icono={sub.icon} nombre={sub.name} className="h-4 w-4" /></span>}
            {sub.name}
          </button>
        ))}
    </CarrilChips>
  ) : null

  return (
    <div>
      {/* Subcategorías (+ buscador, si la plantilla lo pide). Con «Panel», van dentro del panel. */}
      {enPanel ? (
        buscador ? <div className="mb-6">{buscador}</div> : null
      ) : buscador ? (
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {filaSubcategoriasHoy ?? (filaSubcategoriasNueva ? <div className="min-w-0 flex-1">{filaSubcategoriasNueva}</div> : <div className="hidden md:block" />)}
          {buscador}
        </div>
      ) : filaSubcategoriasNueva ? (
        <div className="mb-6">{filaSubcategoriasNueva}</div>
      ) : (
        filaSubcategoriasHoy
      )}

      {/* Toolbar: ordenamiento + vista */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b dark:border-gray-700">
        <div className="flex items-center gap-3">
          {(showSort || subcategories.length > 0) && (
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              aria-haspopup="dialog"
              aria-expanded={showFilters}
              className={`${enPanel ? '' : 'md:hidden '}flex items-center gap-2 px-3 py-2 rounded-lg border dark:border-gray-700 text-sm`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtros{activos > 0 ? ` (${activos})` : ''}
            </button>
          )}
          {showSort && !enPanel && (
            <select
              value={currentSort}
              onChange={(e) => handleSortChange(e.target.value)}
              className="px-3 py-2 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-0"
              style={{ ['--tw-ring-color' as any]: primaryColor }}
            >
              {orden.ordenes.map((o) => (
                <option key={o} value={o}>{ETIQUETAS_ORDEN_CATEGORIA[o]}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          {conConteo && (
            <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
              {total} {total === 1 ? 'producto' : 'productos'}
            </span>
          )}
          {showViewToggle && (
            <div className="flex border dark:border-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() => handleViewChange('grid')}
                className={`p-2 transition-colors ${view === 'grid' ? 'bg-gray-100 dark:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                title="Vista cuadrícula"
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleViewChange('list')}
                className={`p-2 transition-colors ${view === 'list' ? 'bg-gray-100 dark:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                title="Vista lista"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {showFilters && (
        <PanelFiltros
          ordenes={showSort ? orden.ordenes : []}
          subcategorias={subcategories}
          ordenActual={currentSort}
          subActual={currentSubcategory}
          total={total}
          primaryColor={primaryColor}
          alCerrar={() => setShowFilters(false)}
          alAplicar={(o, sub) => {
            setShowFilters(false)
            router.push(buildUrl({ orden: o, sub: sub || undefined }))
          }}
          alLimpiar={() => {
            setShowFilters(false)
            router.push(buildUrl({ orden: porDefecto, sub: undefined }))
          }}
        />
      )}
    </div>
  )
}

/**
 * Panel del botón «Filtros» (celular siempre; computador con «Posición · Panel»): «Ordenar por»
 * con las opciones del bloque y las subcategorías. Se aplica con «Ver N productos»; «Limpiar»
 * vuelve al orden de entrada y a todas las subcategorías. Esc o la X cierran.
 */
function PanelFiltros({
  ordenes,
  subcategorias,
  ordenActual,
  subActual,
  total,
  primaryColor,
  alCerrar,
  alAplicar,
  alLimpiar,
}: {
  ordenes: readonly string[]
  subcategorias: any[]
  ordenActual: string
  subActual: string
  total: number
  primaryColor: string
  alCerrar: () => void
  alAplicar: (orden: string, sub: string) => void
  alLimpiar: () => void
}) {
  const [o, setO] = useState(ordenActual)
  const [sub, setSub] = useState(subActual)
  const cerrarRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null
    cerrarRef.current?.focus()
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar()
    }
    window.addEventListener('keydown', alTeclado)
    const desborde = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', alTeclado)
      document.body.style.overflow = desborde
      previo?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 md:items-center" onClick={alCerrar} data-panel-filtros="">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-panel-filtros"
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl md:max-w-md md:rounded-2xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="titulo-panel-filtros" className="text-base font-semibold text-gray-900 dark:text-white">Filtros</h2>
          <button ref={cerrarRef} type="button" onClick={alCerrar} aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {ordenes.length > 0 && (
          <fieldset className="mb-5">
            <legend className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Ordenar por</legend>
            {ordenes.map((valor) => (
              <label key={valor} className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="orden-panel"
                  value={valor}
                  checked={o === valor}
                  onChange={() => setO(valor)}
                  className="h-4 w-4"
                  style={{ accentColor: primaryColor }}
                />
                {ETIQUETAS_ORDEN_CATEGORIA[valor as keyof typeof ETIQUETAS_ORDEN_CATEGORIA] ?? valor}
              </label>
            ))}
          </fieldset>
        )}
        {subcategorias.length > 0 && (
          <div className="mb-5">
            <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Subcategorías</p>
            <div className="flex flex-wrap gap-2">
              {[{ id: '__todas', slug: '', name: 'Todas' }, ...subcategorias].map((s: any) => {
                const activa = (s.slug || '') === (sub || '')
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSub(s.slug || '')}
                    aria-pressed={activa}
                    className={`min-h-[40px] rounded-full px-4 text-sm font-medium transition-colors ${activa ? 'text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'}`}
                    style={activa ? { backgroundColor: primaryColor } : undefined}
                  >
                    {s.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <div className="flex gap-3 border-t pt-4 dark:border-gray-700">
          <button type="button" onClick={alLimpiar} className="min-h-[44px] flex-1 rounded-lg border text-sm font-semibold dark:border-gray-700">
            Limpiar
          </button>
          <button
            type="button"
            onClick={() => alAplicar(o, sub)}
            className="min-h-[44px] flex-1 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: primaryColor }}
          >
            {o === ordenActual && (sub || '') === (subActual || '') ? `Ver ${total} ${total === 1 ? 'producto' : 'productos'}` : 'Ver productos'}
          </button>
        </div>
      </div>
    </div>
  )
}
