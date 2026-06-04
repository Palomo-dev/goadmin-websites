import Link from 'next/link'

interface CategoriesGridProps {
  content: {
    title?: string
    subtitle?: string
    show_count?: boolean
    max_items?: number
    shape?: 'square' | 'round'
  }
  primaryColor?: string
  data?: { categories?: any[] }
}

// Mapeo de columnas responsivas según cantidad de items
function getGridClass(count: number): string {
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-1 sm:grid-cols-2'
  if (count === 3) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
  if (count === 4) return 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4'
  if (count === 5) return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
  return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
}

export function CategoriesGrid({ content, primaryColor, data }: CategoriesGridProps) {
  const maxItems = content.max_items || 0
  const shape = content.shape || 'square'
  const allCategories = data?.categories || []
  const categories = maxItems > 0 ? allCategories.slice(0, maxItems) : allCategories

  const isRound = shape === 'round'

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-10">{content.subtitle}</p>
      )}
      {categories.length > 0 ? (
        <div className={`grid ${getGridClass(categories.length)} gap-6`}>
          {categories.map((cat: any) => (
            <Link
              key={cat.id}
              href={`/categorias/${cat.slug}`}
              className={`group relative overflow-hidden bg-gray-100 hover:shadow-lg transition-shadow ${
                isRound ? 'rounded-full aspect-square' : 'rounded-xl aspect-[4/3]'
              }`}
            >
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
