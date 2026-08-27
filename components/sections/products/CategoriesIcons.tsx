'use client'

import { useState } from 'react'
import { CategoryCard, type CategoryCardStyle } from './CategoryCard'

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

/**
 * Construye el estilo de card desde `content`.
 * Por defecto reproduce el aspecto original de Icons: círculo pequeño (max
 * 80px) con la inicial sobre el color primario + texto debajo.
 */
function buildCardStyle(content: Record<string, any>): CategoryCardStyle {
  const style: CategoryCardStyle = {
    shape: content.shape || 'circle',
    text_position: content.text_position || 'below',
    text_align: content.text_align || 'center',
    title_size: content.title_size || 'sm',
    media_max_width: content.media_max_width || '80px',
    media_source: content.media_source || 'auto',
    fallback_media: content.fallback_media || 'initial',
    show_count: content.show_count,
    show_description: content.show_description,
    show_icon: content.show_icon,
    show_image: content.show_image ?? true,
    show_color: content.show_color,
  }
  if (content.card_radius != null) style.card_radius = content.card_radius
  if (content.card_shadow) style.card_shadow = content.card_shadow
  if (content.card_border_width != null) style.card_border_width = content.card_border_width
  if (content.card_border_color) style.card_border_color = content.card_border_color
  if (content.card_bg) style.card_bg = content.card_bg
  if (content.card_padding != null) style.card_padding = content.card_padding
  if (content.card_hover) style.card_hover = content.card_hover
  if (content.image_fit) style.image_fit = content.image_fit
  if (content.badge) style.badge = content.badge
  return style
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
  const cardStyle = buildCardStyle(content)

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
              <div
                key={cat.id}
                className={isMobileList
                  ? 'flex items-center gap-3 md:flex-col md:items-center md:gap-2'
                  : isMobileCarousel
                    ? 'flex-shrink-0 w-[100px] snap-start md:w-auto flex flex-col items-center gap-2'
                    : 'flex flex-col items-center gap-2'
                }
              >
                <CategoryCard cat={cat} cardStyle={cardStyle} primaryColor={primaryColor} />
              </div>
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
