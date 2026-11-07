/**
 * `product_pager · default` (plantilla de tienda Hogar): «‹ Pieza anterior / Pieza siguiente ›»
 * con el nombre del producto vecino en el orden de su categoría.
 *
 * Los vecinos los resuelve la página (`lib/queries/tienda/pager.ts`) solo si la plantilla trae
 * este bloque, y llegan en `data.paginadorFicha`. Sin vecinos, no se pinta.
 */

import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CLAVES_SECCION_TIENDA, normalizarPaginadorFicha } from '@/lib/website/v2/contrato/seccionesTienda'
import { conPrefijo } from '@/lib/outlet/rutaSitio'
import type { PaginadorFichaDatos } from './fichaTienda'

export const CONTENT_KEYS = CLAVES_SECCION_TIENDA['product_pager.default']

interface AnteriorSiguienteProps {
  content: Record<string, any>
  data?: { paginadorFicha?: PaginadorFichaDatos | null; prefijoSede?: string }
}

export function AnteriorSiguiente({ content, data }: AnteriorSiguienteProps) {
  const paginador = data?.paginadorFicha
  if (!paginador || (!paginador.anterior && !paginador.siguiente)) return null
  const { prevText, nextText } = normalizarPaginadorFicha(content)
  const prefijo = data?.prefijoSede ?? ''
  return (
    <nav
      aria-label="Productos vecinos"
      data-paginador-ficha=""
      className="mt-16 flex items-start justify-between gap-6 border-t pt-6"
      style={{ borderColor: 'color-mix(in srgb, var(--text-color, #111827) 12%, transparent)' }}
    >
      {paginador.anterior ? (
        <Link href={conPrefijo(`/productos/${paginador.anterior.uuid}`, prefijo)} rel="prev" className="group min-w-0">
          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <ChevronLeft className="h-3 w-3" aria-hidden="true" />
            {prevText}
          </span>
          <span className="block truncate text-sm font-medium text-gray-900 group-hover:underline dark:text-white">{paginador.anterior.name}</span>
        </Link>
      ) : (
        <span />
      )}
      {paginador.siguiente ? (
        <Link href={conPrefijo(`/productos/${paginador.siguiente.uuid}`, prefijo)} rel="next" className="group min-w-0 text-right">
          <span className="flex items-center justify-end gap-1 text-xs text-gray-500 dark:text-gray-400">
            {nextText}
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          </span>
          <span className="block truncate text-sm font-medium text-gray-900 group-hover:underline dark:text-white">{paginador.siguiente.name}</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}
AnteriorSiguiente.CONTENT_KEYS = CONTENT_KEYS
