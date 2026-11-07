/**
 * Plantillas de tienda — sección `category_filters · sidebar_facets` (PLANO §3, Contraste).
 *
 * Columna lateral de la página de categoría con casillas de selección única, solo con lo que
 * el servidor ya filtra (datos reales, sin facetas inventadas):
 * - «Categorías»: las del mismo nivel que la actual (árbol de `getMenuCategories`); marcar
 *   otra lleva a su página. Con menos de 2 no se pinta.
 * - «Subcategorías» (`show_subcategories`): las hijas de la actual con su conteo real
 *   (`product_count`); marcar una = `?sub=`, desmarcarla la quita.
 * - «Ordenar por» (`show_sort`): las opciones de siempre (SelectorOrdenLateral).
 * - «Limpiar filtros» (`clear_text`): solo si hay filtros puestos (subcategoría u orden).
 * El orden va en la columna y no sobre la rejilla: cada sección lleva su propio relleno
 * (SectionWrapper) y una barra fuera de ellas quedaría desalineada.
 * Disponibilidad, precio y multiselección quedan FUERA (PLANO §7).
 *
 * Componente de servidor con enlaces (funciona sin JavaScript); el manifiesto lee
 * `FiltrosLaterales.CONTENT_KEYS`. CategoryDetailRenderer la pone en columna solo si está
 * visible y registrada en SECTION_MAP.
 */

import { Check } from 'lucide-react'
import { EnlaceSitio } from '@/components/site/EnlaceSitio'
import { normalizarFiltrosLaterales } from '@/lib/website/v2/contrato/seccionesTienda'
import { filtrosActivos, urlListadoCategoria, type NodoCategoria } from './columnasCategoria'
import { SelectorOrdenLateral } from './SelectorOrdenLateral'

export const CONTENT_KEYS = ['show_subcategories', 'show_sort', 'clear_text'] as const

interface FiltrosLateralesProps {
  content: Record<string, unknown> | null | undefined
  primaryColor?: string
  data?: {
    category?: { id: number; slug: string; name: string } | null
    subcategories?: any[]
    categoriasHermanas?: NodoCategoria[]
    categorySlug?: string
    currentSort?: string
    currentSubcategory?: string
    currentView?: string
  }
}

function Casilla({ marcada, color }: { marcada: boolean; color: string }) {
  return (
    <span
      className={`flex h-4 w-4 shrink-0 items-center justify-center border ${marcada ? 'text-white' : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900'}`}
      style={marcada ? { backgroundColor: color, borderColor: color } : undefined}
      aria-hidden
    >
      {marcada && <Check className="h-3 w-3" strokeWidth={3} />}
    </span>
  )
}

function Opcion({ href, marcada, nombre, conteo, color }: { href: string; marcada: boolean; nombre: string; conteo?: number | null; color: string }) {
  return (
    <li>
      <EnlaceSitio
        href={href}
        scroll={false}
        aria-current={marcada ? 'true' : undefined}
        className={`flex items-center gap-3 py-1.5 text-sm transition-colors ${marcada ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'}`}
      >
        <Casilla marcada={marcada} color={color} />
        <span className="min-w-0 flex-1 truncate">{nombre}</span>
        {typeof conteo === 'number' && <span className="shrink-0 text-xs text-gray-400">{conteo}</span>}
      </EnlaceSitio>
    </li>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-200 pb-5 dark:border-gray-700">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-white">{titulo}</h2>
      <ul>{children}</ul>
    </div>
  )
}

export function FiltrosLaterales({ content, primaryColor = '#111827', data }: FiltrosLateralesProps) {
  const ajustes = normalizarFiltrosLaterales(content)
  const slug = data?.categorySlug || data?.category?.slug || ''
  if (!slug) return null
  const orden = data?.currentSort || 'best_selling'
  const sub = data?.currentSubcategory || ''
  const vista = data?.currentView || 'grid'
  const hermanas = data?.categoriasHermanas ?? []
  const subcategorias = ajustes.showSubcategories ? (data?.subcategories ?? []).filter((s: any) => s?.slug) : []
  const activos = filtrosActivos(sub, orden)

  const grupos = (idOrden: string) => (
    <div className="flex flex-col gap-5">
      {ajustes.showSort && (
        <div className="border-b border-gray-200 pb-5 dark:border-gray-700">
          <label htmlFor={idOrden} className="mb-3 block text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-white">Ordenar por</label>
          <SelectorOrdenLateral id={idOrden} categorySlug={slug} currentSort={orden} currentSubcategory={sub} currentView={vista} primaryColor={primaryColor} />
        </div>
      )}
      {hermanas.length >= 2 && (
        <Grupo titulo="Categorías">
          {hermanas.map((c) => (
            <Opcion
              key={c.id}
              href={c.slug === slug ? urlListadoCategoria(slug, { orden, sub, vista }) : urlListadoCategoria(c.slug, { orden, vista })}
              marcada={c.slug === slug}
              nombre={c.name}
              color={primaryColor}
            />
          ))}
        </Grupo>
      )}
      {subcategorias.length > 0 && (
        <Grupo titulo="Subcategorías">
          {subcategorias.map((s: any) => (
            <Opcion
              key={s.id}
              href={urlListadoCategoria(slug, { orden, sub: s.slug === sub ? undefined : s.slug, vista })}
              marcada={s.slug === sub}
              nombre={s.name}
              conteo={typeof s.product_count === 'number' ? s.product_count : null}
              color={primaryColor}
            />
          ))}
        </Grupo>
      )}
      {activos > 0 && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">{activos === 1 ? '1 filtro activo' : `${activos} filtros activos`}</p>
          <EnlaceSitio
            href={urlListadoCategoria(slug, { vista })}
            scroll={false}
            className="inline-flex items-center justify-center px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: primaryColor }}
          >
            {ajustes.clearText}
          </EnlaceSitio>
        </div>
      )}
    </div>
  )

  // Sin nada que mostrar (una sola categoría, sin subcategorías, sin orden ni filtros): no se pinta.
  if (hermanas.length < 2 && subcategorias.length === 0 && activos === 0 && !ajustes.showSort) return null

  return (
    <aside aria-label="Filtros">
      {/* Celular: plegado bajo «Filtros»; escritorio: siempre a la vista. */}
      <details className="mb-6 border-y border-gray-200 py-3 md:hidden dark:border-gray-700">
        <summary className="cursor-pointer text-sm font-semibold text-gray-900 dark:text-white">
          Filtros{activos > 0 ? ` (${activos})` : ''}
        </summary>
        <div className="pt-4">{grupos('orden-lateral-movil')}</div>
      </details>
      <div className="hidden md:block">{grupos('orden-lateral')}</div>
    </aside>
  )
}

FiltrosLaterales.CONTENT_KEYS = CONTENT_KEYS

export default FiltrosLaterales
