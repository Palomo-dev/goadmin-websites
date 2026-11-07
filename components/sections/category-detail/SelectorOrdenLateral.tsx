'use client'

/**
 * Selector de orden de la columna lateral (`category_filters · sidebar_facets`, `show_sort`).
 * Mismas opciones y misma URL que CategoryFilters; conserva la subcategoría y la vista.
 */

import { useRouter } from 'next/navigation'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { SORT_OPTIONS } from './CategoryFilters'
import { urlListadoCategoria } from './columnasCategoria'

interface SelectorOrdenLateralProps {
  categorySlug: string
  currentSort: string
  currentSubcategory: string
  currentView: string
  primaryColor: string
  id: string
}

export function SelectorOrdenLateral({ categorySlug, currentSort, currentSubcategory, currentView, primaryColor, id }: SelectorOrdenLateralProps) {
  const router = useRouter()
  const { ruta } = useRutaSitio()
  return (
    <select
      id={id}
      value={currentSort || 'best_selling'}
      onChange={(e) => router.push(ruta(urlListadoCategoria(categorySlug, { orden: e.target.value, sub: currentSubcategory || undefined, vista: currentView })), { scroll: false })}
      className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-0 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      style={{ ['--tw-ring-color' as any]: primaryColor }}
    >
      {SORT_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}
