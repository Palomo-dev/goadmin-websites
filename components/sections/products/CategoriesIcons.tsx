'use client'

import { useState } from 'react'
import Link from 'next/link'

interface CategoriesIconsProps {
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

export function CategoriesIcons({ content, primaryColor = '#3B82F6', data }: CategoriesIconsProps) {
  const title = content.title || 'Categorías'
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
      {title && <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">{title}</h2>}
      {visibleCategories.length > 0 ? (
        <>
          <div
            className={isMobileList
              ? 'grid grid-cols-1 sm:grid-cols-2 gap-4'
              : isMobileCarousel
                ? 'flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 md:grid md:overflow-visible md:snap-none md:pb-0 md:gap-6'
                : `grid gap-6 ${desktopGrid}`
            }
          >
            {visibleCategories.map((cat: any) => (
              <Link
                key={cat.id}
                href={`/categorias/${cat.slug}`}
                className={`group w-full ${
                  isMobileList
                    ? 'flex items-center gap-3 md:flex-col md:items-center md:gap-2'
                    : isMobileCarousel
                      ? 'flex-shrink-0 w-[100px] snap-start md:w-auto flex flex-col items-center gap-2'
                      : 'flex flex-col items-center gap-2'
                }`}
              >
                <div
                  className={`${isMobileList ? 'w-10 h-10 shrink-0 md:w-full md:h-auto md:aspect-square md:max-w-[80px]' : 'w-full aspect-square max-w-[80px]'} rounded-full flex items-center justify-center text-white text-xl font-bold transition-transform group-hover:scale-110 overflow-hidden`}
                  style={{ backgroundColor: primaryColor }}
                >
                  {cat.image_url ? (
                    <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    cat.name?.charAt(0) || '?'
                  )}
                </div>
                <span className="text-sm font-medium text-center leading-tight">{cat.name}</span>
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
