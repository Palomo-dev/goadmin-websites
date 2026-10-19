'use client'

/**
 * Barra de filtros y buscador de las listas de productos.
 *
 * - Filtros: chips de categoría, «Ofertas», orden y el conteo. Es el marcado que tenía
 *   `ProductsGrid` (extraído sin cambios: con la clave ausente su HTML es el mismo).
 * - Buscador: campo con lupa del kit (SearchInput, Figma 42:1191 — 40 px, radio 8, borde gris,
 *   lupa de 16 px a la izquierda). Filtra los productos ya cargados al escribir: ni una consulta.
 */

import { useMemo, useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import {
  FILTROS_INICIALES,
  filtrarProductos,
  hayFiltrosActivos,
  type EstadoFiltros,
  type OrdenFiltro,
} from '@/lib/products/filtrosProductos'
import { estiloChipFiltro, type ColoresFiltro } from '@/lib/website/presentacionTienda'

const FOCO = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 dark:focus-visible:ring-white'

/** Estado de filtros + lista filtrada. `alCambiar` se llama en cada cambio (p. ej. volver a la página 1). */
export function useFiltrosProductos<T>(productos: T[], alCambiar?: () => void) {
  const [estado, setEstado] = useState<EstadoFiltros>(FILTROS_INICIALES)
  const filtrados = useMemo(() => filtrarProductos(productos, estado), [productos, estado])
  const cambiar = (parcial: Partial<EstadoFiltros>) => {
    setEstado((e) => ({ ...e, ...parcial }))
    alCambiar?.()
  }
  const limpiar = () => {
    setEstado(FILTROS_INICIALES)
    alCambiar?.()
  }
  return { estado, filtrados, cambiar, limpiar, activos: hayFiltrosActivos(estado) }
}

export function BuscadorProductos({
  valor,
  onChange,
  placeholder = 'Buscar productos…',
}: {
  valor: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative w-full sm:max-w-xs" role="search">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
      <input
        type="search"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder.replace(/…$/, '')}
        autoComplete="off"
        className={`h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white ${FOCO}`}
        data-buscador-productos=""
      />
    </div>
  )
}

export function BarraFiltrosProductos({
  categorias,
  estado,
  cambiar,
  total,
  primaryColor,
  mostrarFiltros,
  mostrarBuscador,
  mostrarCategorias = true,
  etiquetaTotal = 'productos',
  content,
}: {
  categorias: any[]
  estado: EstadoFiltros
  cambiar: (parcial: Partial<EstadoFiltros>) => void
  total: number
  primaryColor?: string
  mostrarFiltros: boolean
  mostrarBuscador: boolean
  mostrarCategorias?: boolean
  etiquetaTotal?: string
  content?: ColoresFiltro | null
}) {
  if (!mostrarFiltros && !mostrarBuscador) return null
  const selectedCategory = estado.categoria
  const onlyOffers = estado.soloOfertas
  const chip = (activo: boolean, acento?: string) => estiloChipFiltro(activo, acento ?? primaryColor, content)
  return (
    <div className="mb-6 space-y-3">
      {mostrarBuscador && (
        <div className="flex items-center gap-3">
          <BuscadorProductos valor={estado.busqueda} onChange={(busqueda) => cambiar({ busqueda })} />
          {!mostrarFiltros && (
            <span className="text-xs text-gray-400 ml-auto" aria-live="polite">{total} {etiquetaTotal}</span>
          )}
        </div>
      )}
      {mostrarFiltros && (
        <>
          {/* Categorías — respeta show_categories (default: true) */}
          {categorias.length > 0 && mostrarCategorias && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
              <button
                onClick={() => cambiar({ categoria: null })}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all border ${chip(!selectedCategory).className}`}
                style={chip(!selectedCategory).style}
              >
                Todos
              </button>
              {categorias.map((cat: any) => {
                const activo = chip(selectedCategory === cat.id)
                return (
                <button
                  key={cat.id}
                  onClick={() => cambiar({ categoria: selectedCategory === cat.id ? null : cat.id })}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all border ${activo.className}`}
                  style={activo.style}
                >
                  {cat.name}
                </button>
                )
              })}
            </div>
          )}
          {/* Ordenar + Ofertas */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => cambiar({ soloOfertas: !onlyOffers })}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all border ${chip(onlyOffers, '#EF4444').className}`}
              style={chip(onlyOffers, '#EF4444').style}
            >
              <SlidersHorizontal className="h-3 w-3" /> Ofertas
            </button>
            <select
              value={estado.orden}
              onChange={(e) => cambiar({ orden: e.target.value as OrdenFiltro })}
              className="px-3 py-1.5 rounded-full text-xs sm:text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 outline-none"
            >
              <option value="default">Ordenar</option>
              <option value="newest">Más nuevos</option>
              <option value="price_asc">Precio: menor a mayor</option>
              <option value="price_desc">Precio: mayor a menor</option>
              <option value="name">Nombre A-Z</option>
            </select>
            <span className="text-xs text-gray-400 ml-auto">{total} {etiquetaTotal}</span>
          </div>
        </>
      )}
    </div>
  )
}

/** Sin resultados por los filtros: lo dice y ofrece limpiarlos (no el vacío de «sin productos»). */
export function SinResultadosFiltros({ onLimpiar, primaryColor }: { onLimpiar: () => void; primaryColor?: string }) {
  return (
    <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg" role="status">
      <p className="text-4xl mb-3">📦</p>
      <p>No hay productos con estos filtros</p>
      <button type="button" onClick={onLimpiar} className={`mt-2 text-sm underline ${FOCO}`} style={{ color: primaryColor }}>Limpiar filtros</button>
    </div>
  )
}
