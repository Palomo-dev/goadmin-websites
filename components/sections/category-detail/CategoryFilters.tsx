'use client'

/**
 * F9.4 — Sección category_filters.
 *
 * Renderiza los filtros de categoría: pills de subcategorías, selector de
 * ordenamiento y toggle de vista (grid/list). Reproduce el comportamiento
 * del CategoryPageClient actual.
 */

import { useRouter } from 'next/navigation'
import { Grid3X3, List, Search, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { normalizarAjustesFiltrosCategoria, TEXTO_BUSCADOR_CATEGORIA } from '@/lib/website/v2/contrato/seccionesTienda'

export const CONTENT_KEYS = ['filter_position', 'show_sort', 'show_view_toggle', 'subcategory_style', 'search'] as const

export const SORT_OPTIONS = [
  { value: 'best_selling', label: 'Más vendidos' },
  { value: 'name_asc', label: 'Nombre A-Z' },
  { value: 'name_desc', label: 'Nombre Z-A' },
  { value: 'price_asc', label: 'Precio: Menor a Mayor' },
  { value: 'price_desc', label: 'Precio: Mayor a Menor' },
  { value: 'newest', label: 'Más recientes' },
]

interface CategoryFiltersProps {
  content: {
    filter_position?: string
    show_sort?: boolean
    show_view_toggle?: boolean
    /** Plantillas de tienda: `chips` (hoy) | `text` | `tabs`. */
    subcategory_style?: string
    /** Plantillas de tienda: buscador en píldora que busca en toda la tienda (`/search?q=`). */
    search?: boolean
  }
  primaryColor?: string
  data?: {
    subcategories?: any[]
    categorySlug?: string
    total?: number
    currentSort?: string
    currentSubcategory?: string
    currentView?: string
  }
}

export function CategoryFilters({ content, primaryColor = '#3B82F6', data }: CategoryFiltersProps) {
  const router = useRouter()
  const subcategories = data?.subcategories || []
  const categorySlug = data?.categorySlug || ''
  const total = data?.total ?? 0
  const currentSort = data?.currentSort || 'best_selling'
  const currentSubcategory = data?.currentSubcategory || ''
  const currentView = data?.currentView || 'grid'

  const [view, setView] = useState<'grid' | 'list'>(currentView as 'grid' | 'list')
  const [showFilters, setShowFilters] = useState(false)

  const showSort = content.show_sort !== false
  const showViewToggle = content.show_view_toggle !== false
  // Ausentes = `chips` y sin buscador: la fila de siempre.
  const ajustes = normalizarAjustesFiltrosCategoria(content as Record<string, unknown>)
  const { ruta } = useRutaSitio()

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams()
    const values = {
      orden: currentSort,
      sub: currentSubcategory || undefined,
      vista: view,
      ...overrides,
    }
    Object.entries(values).forEach(([key, val]) => {
      if (val && val !== 'best_selling' && val !== '1' && val !== 'grid' && val !== '') {
        params.set(key, val)
      }
    })
    const qs = params.toString()
    return `/categorias/${categorySlug}${qs ? `?${qs}` : ''}`
  }

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

  const filaSubcategoriasHoy = subcategories.length > 0 && ajustes.subcategoryStyle === 'chips' ? (
    <div className={buscador ? 'min-w-0 flex-1 overflow-x-auto' : 'mb-6 overflow-x-auto'}>
      <div className="flex gap-2 pb-2">
        <button
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
        {subcategories.map((sub: any) => (
          <button
            key={sub.id}
            onClick={() => handleSubcategoryChange(sub.slug)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              currentSubcategory === sub.slug
                ? 'text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            style={currentSubcategory === sub.slug ? { backgroundColor: primaryColor } : {}}
          >
            {sub.icon && <span className="mr-1">{sub.icon}</span>}
            {sub.name}
          </button>
        ))}
      </div>
    </div>
  ) : null

  return (
    <div>
      {/* Subcategorías (+ buscador, si la plantilla lo pide) */}
      {buscador ? (
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
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden flex items-center gap-2 px-3 py-2 rounded-lg border dark:border-gray-700 text-sm"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
          </button>
          {showSort && (
            <select
              value={currentSort}
              onChange={(e) => handleSortChange(e.target.value)}
              className="px-3 py-2 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-0"
              style={{ ['--tw-ring-color' as any]: primaryColor }}
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
            {total} {total === 1 ? 'producto' : 'productos'}
          </span>
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
    </div>
  )
}
