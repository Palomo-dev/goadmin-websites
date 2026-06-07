'use client'

import { useState } from 'react'
import Link from 'next/link'

interface CategoriesGridProps {
  content: {
    title?: string
    subtitle?: string
    show_count?: boolean
    max_items?: number
    shape?: 'square' | 'round'
    pagination?: boolean
    items_per_page?: number
    mobile_layout?: 'grid' | 'carousel' | 'list'
  }
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

export function CategoriesGrid({ content, primaryColor, data }: CategoriesGridProps) {
  const maxItems = content.max_items || 0
  const shape = content.shape || 'square'
  const hasPagination = content.pagination === true
  const itemsPerPage = content.items_per_page || 6
  const mobileLayout = content.mobile_layout || 'grid'
  const allCategories = data?.categories || []
  const categories = maxItems > 0 ? allCategories.slice(0, maxItems) : allCategories

  const [page, setPage] = useState(0)

  const isRound = shape === 'round'
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
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-10">{content.subtitle}</p>
      )}
      {visibleCategories.length > 0 ? (
        <>
          <div
            className={isMobileList
              ? 'grid grid-cols-1 sm:grid-cols-2 gap-6'
              : isMobileCarousel
                ? 'flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 md:grid md:overflow-visible md:snap-none md:pb-0 md:gap-6'
                : `grid ${desktopGrid} gap-6`
            }
            style={isMobileCarousel ? undefined : (isMobileList ? { gridTemplateColumns: undefined } : undefined)}
          >
            {visibleCategories.map((cat: any) => (
              <Link
                key={cat.id}
                href={`/categorias/${cat.slug}`}
                className={`group relative overflow-hidden bg-gray-100 hover:shadow-lg transition-shadow ${
                  isMobileCarousel ? 'flex-shrink-0 w-[200px] snap-start md:w-auto ' : ''
                }${isMobileList ? 'flex items-center gap-4 rounded-xl p-3 md:block md:p-0 ' : ''}${
                  isRound ? 'rounded-full aspect-square' : isMobileList ? '' : 'rounded-xl aspect-[4/3]'
                }`}
              >
                {isMobileList ? (
                  <>
                    <div className={`w-16 h-16 shrink-0 overflow-hidden md:w-full md:h-auto ${isRound ? 'rounded-full md:aspect-square' : 'rounded-lg md:rounded-xl md:aspect-[4/3]'}`}>
                      {cat.image_url ? (
                        <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor || '#8B6914'}15` }}>
                          <span className="text-2xl">🏷️</span>
                        </div>
                      )}
                    </div>
                    <div className="md:hidden">
                      <h3 className="font-semibold text-gray-800 dark:text-gray-200">{cat.name}</h3>
                      {content.show_count && cat.product_count != null && (
                        <span className="text-sm text-gray-500">{cat.product_count} productos</span>
                      )}
                    </div>
                    <div className={`hidden md:flex absolute inset-0 bg-gradient-to-t from-black/60 to-transparent items-end justify-center ${isRound ? 'p-2' : 'p-4'}`}>
                      <div className={isRound ? 'text-center' : ''}>
                        <h3 className={`text-white font-semibold ${isRound ? 'text-sm' : 'text-lg'}`}>{cat.name}</h3>
                        {content.show_count && cat.product_count != null && (
                          <span className="text-white/80 text-sm">{cat.product_count} productos</span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {cat.image_url ? (
                      <img
                        src={cat.image_url}
                        alt={cat.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ backgroundColor: `${primaryColor || '#8B6914'}15` }}
                      >
                        <span className="text-4xl">🏷️</span>
                      </div>
                    )}
                    <div className={`absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-center ${isRound ? 'p-2' : 'p-4'}`}>
                      <div className={isRound ? 'text-center' : ''}>
                        <h3 className={`text-white font-semibold ${isRound ? 'text-sm' : 'text-lg'}`}>{cat.name}</h3>
                        {content.show_count && cat.product_count != null && (
                          <span className="text-white/80 text-sm">{cat.product_count} productos</span>
                        )}
                      </div>
                    </div>
                  </>
                )}
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
                  style={page === i ? { backgroundColor: primaryColor || '#3B82F6' } : undefined}
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
