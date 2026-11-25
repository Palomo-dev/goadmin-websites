'use client'

/**
 * Selector de orden de la columna lateral (`category_filters · sidebar_facets`, `show_sort`).
 * Mismas opciones y misma URL que CategoryFilters; conserva la subcategoría y la vista.
 */

import { useRouter } from 'next/navigation'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { ETIQUETAS_ORDEN_CATEGORIA, ORDENES_CATEGORIA, type OrdenCategoria } from '@/lib/website/v2/contrato/seccionesTienda'
import { urlListadoCategoria } from './columnasCategoria'

interface SelectorOrdenLateralProps {
  categorySlug: string
  currentSort: string
  currentSubcategory: string
  currentView: string
  primaryColor: string
  id: string
  /** Opciones del bloque de filtros (`sort_options`). Ausente = las seis de siempre. */
  ordenes?: readonly OrdenCategoria[]
  /** «Orden al entrar» (`default_sort`). Ausente = «Más vendidos». */
  ordenPorDefecto?: string
}

export function SelectorOrdenLateral({ categorySlug, currentSort, currentSubcategory, currentView, primaryColor, id, ordenes = ORDENES_CATEGORIA, ordenPorDefecto = 'best_selling' }: SelectorOrdenLateralProps) {
  const router = useRouter()
  const { ruta } = useRutaSitio()
  return (
    <select
      id={id}
      value={currentSort || ordenPorDefecto}
      onChange={(e) => router.push(ruta(urlListadoCategoria(categorySlug, { orden: e.target.value, sub: currentSubcategory || undefined, vista: currentView }, ordenPorDefecto)), { scroll: false })}
      className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-0 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      style={{ ['--tw-ring-color' as any]: primaryColor }}
    >
      {ordenes.map((o) => (
        <option key={o} value={o}>{ETIQUETAS_ORDEN_CATEGORIA[o]}</option>
      ))}
    </select>
  )
}
