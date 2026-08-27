'use client'

/**
 * F9.4 — Sección category_filters.
 *
 * Renderiza los filtros de categoría: pills de subcategorías, selector de
 * ordenamiento y toggle de vista (grid/list). Reproduce el comportamiento
 * del CategoryPageClient actual.
 */

import { useRouter } from 'next/navigation'
import { Grid3X3, List, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'

export const CONTENT_KEYS = ['filter_position', 'show_sort', 'show_view_toggle'] as const

const SORT_OPTIONS = [
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

  return (
    <div>
      {/* Subcategorías */}
      {subcategories.length > 0 && (
        <div className="mb-6 overflow-x-auto">
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
