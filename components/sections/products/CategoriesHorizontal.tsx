'use client'

import { useState } from 'react'
import Link from 'next/link'

interface CategoriesHorizontalProps {
  content: Record<string, any>
  primaryColor?: string
  data?: { categories?: any[] }
}

// Columnas responsivas: mínimo 2 para evitar items gigantes
function getGridClass(count: number): string {
  if (count <= 2) return 'grid-cols-2'
  if (count === 3) return 'grid-cols-2 sm:grid-cols-3'
  if (count === 4) return 'grid-cols-2 lg:grid-cols-4'
  if (count === 5) return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
  return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
}

export function CategoriesHorizontal({ content, primaryColor = '#3B82F6', data }: CategoriesHorizontalProps) {
  const title = content.title || 'Categorías'
  const subtitle = content.subtitle
  const maxItems = content.max_items || 0
  const hasPagination = content.pagination === true
  const itemsPerPage = content.items_per_page || 6
  const mobileLayout = content.mobile_layout || 'grid'
  const allCategories = data?.categories || []
  const categories = maxItems > 0 ? allCategories.slice(0, maxItems) : allCategories

  const [page, setPage] = useState(0)

  const totalPages = hasPagination ? Math.ceil(categories.length / itemsPerPage) : 1
  const visibleCategories = hasPagination
    ? categories.slice(page * itemsPerPage, (page + 1) * itemsPerPage)
    : categories

  const gridCols = hasPagination ? itemsPerPage : (maxItems || categories.length)
  const isMobileCarousel = mobileLayout === 'carousel'
  const isMobileList = mobileLayout === 'list'
  const desktopGrid = getGridClass(gridCols)

  return (
    <div>
      <div className="text-center mb-8">
        {title && <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{title}</h2>}
        {subtitle && <p className="text-gray-600 dark:text-gray-300 mt-2">{subtitle}</p>}
      </div>
      {visibleCategories.length > 0 ? (
        <>
          <div
            className={isMobileList
              ? 'grid grid-cols-1 sm:grid-cols-2 gap-6'
              : isMobileCarousel
                ? 'flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 md:grid md:overflow-visible md:snap-none md:pb-0 md:gap-6'
                : `grid gap-6 ${desktopGrid}`
            }
          >
            {visibleCategories.map((cat: any) => (
              <Link
                key={cat.id}
                href={`/categorias/${cat.slug}`}
                className={`group text-center w-full ${
                  isMobileCarousel ? 'flex-shrink-0 w-[160px] snap-start md:w-auto' : ''
                }${isMobileList ? 'flex items-center gap-4 text-left md:block md:text-center' : ''}`}
              >
                <div className={`${isMobileList ? 'w-14 h-14 shrink-0 md:w-full md:h-auto md:aspect-square md:max-w-[180px] md:mx-auto' : 'w-full aspect-square max-w-[180px] mx-auto'} rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 mb-0 md:mb-3`}>
                  {cat.image_url ? (
                    <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
                      <span className="text-3xl">🏷️</span>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-sm">{cat.name}</h3>
                  {content.show_count && cat.product_count != null && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">{cat.product_count} productos</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
          {hasPagination && totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                    page === i
                      ? 'text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                  style={page === i ? { backgroundColor: primaryColor } : undefined}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">🏷️</p>
          <p>No hay categorías disponibles aún</p>
        </div>
      )}
    </div>
  )
}
