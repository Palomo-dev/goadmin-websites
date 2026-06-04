'use client'

import Link from 'next/link'

interface CategoriesHorizontalProps {
  content: Record<string, any>
  primaryColor?: string
  data?: { categories?: any[] }
}

export function CategoriesHorizontal({ content, primaryColor = '#3B82F6', data }: CategoriesHorizontalProps) {
  const title = content.title || 'Categorías'
  const subtitle = content.subtitle
  const maxItems = content.max_items || 0
  const allCategories = data?.categories || []
  const categories = maxItems > 0 ? allCategories.slice(0, maxItems) : allCategories

  return (
    <div>
      <div className="text-center mb-8">
        {title && <h2 className="text-2xl md:text-3xl font-bold">{title}</h2>}
        {subtitle && <p className="text-gray-600 dark:text-gray-300 mt-2">{subtitle}</p>}
      </div>
      {categories.length > 0 ? (
        <div
          className={
            categories.length > 6
              ? 'flex gap-6 overflow-x-auto pb-4 snap-x'
              : 'grid gap-6 justify-items-center'
          }
          style={
            categories.length <= 6
              ? { gridTemplateColumns: `repeat(${categories.length}, minmax(0, 1fr))` }
              : undefined
          }
        >
          {categories.map((cat: any) => (
            <Link
              key={cat.id}
              href={`/categorias/${cat.slug}`}
              className={`group text-center ${categories.length > 6 ? 'flex-shrink-0 w-40 snap-start' : 'w-full max-w-[200px]'}`}
            >
              <div className="w-32 h-32 mx-auto rounded-full overflow-hidden bg-gray-100 mb-3">
                {cat.image_url ? (
                  <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
                    <span className="text-3xl">🏷️</span>
                  </div>
                )}
              </div>
              <h3 className="font-medium text-sm">{cat.name}</h3>
              {content.show_count && cat.product_count != null && (
                <span className="text-xs text-gray-500 dark:text-gray-400">{cat.product_count} productos</span>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">🏷️</p>
          <p>No hay categorías disponibles aún</p>
        </div>
      )}
    </div>
  )
}
