/**
 * F9.4 — Sección category_subcategories.
 *
 * Renderiza las subcategorías como tarjetas con icono/color.
 * Reutiliza el estilo de CategoriesSection de la F4.
 */

import Link from 'next/link'

export const CONTENT_KEYS = ['title', 'layout'] as const

interface CategorySubcategoriesProps {
  content: {
    title?: string
    layout?: string
  }
  primaryColor?: string
  data?: {
    subcategories?: any[]
  }
}

export function CategorySubcategories({ content, primaryColor = '#3B82F6', data }: CategorySubcategoriesProps) {
  const subcategories = data?.subcategories || []
  if (subcategories.length === 0) return null

  const title = content.title || 'Subcategorías'
  const layout = content.layout || 'grid'

  if (layout === 'horizontal') {
    return (
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{title}</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {subcategories.map((sub: any) => (
            <Link
              key={sub.id}
              href={`/categorias/${sub.slug}`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap shrink-0"
            >
              {sub.icon && <span className="text-lg">{sub.icon}</span>}
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{sub.name}</span>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {subcategories.map((sub: any) => (
          <Link
            key={sub.id}
            href={`/categorias/${sub.slug}`}
            className="group flex flex-col items-center gap-2 p-4 rounded-xl border dark:border-gray-700 hover:shadow-md transition-all"
          >
            {sub.image_url ? (
              <img
                src={sub.image_url}
                alt={sub.name}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
                style={{ backgroundColor: `${primaryColor}15` }}
              >
                {sub.icon || '📦'}
              </div>
            )}
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
              {sub.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
