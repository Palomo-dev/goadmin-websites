'use client'

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

// Ancho máximo del contenedor según cantidad
function getMaxWidth(count: number): string {
  if (count <= 2) return 'max-w-md'
  if (count === 3) return 'max-w-2xl'
  return ''
}

export function CategoriesIcons({ content, primaryColor = '#3B82F6', data }: CategoriesIconsProps) {
  const title = content.title || 'Categorías'
  const maxItems = content.max_items || 0
  const allCategories = data?.categories || []
  const categories = maxItems > 0 ? allCategories.slice(0, maxItems) : allCategories

  return (
    <div>
      {title && <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">{title}</h2>}
      {categories.length > 0 ? (
        <div className={`grid gap-6 justify-items-center ${getGridClass(categories.length)} ${getMaxWidth(categories.length)} mx-auto`}>
          {categories.map((cat: any) => (
            <Link
              key={cat.id}
              href={`/categorias/${cat.slug}`}
              className="group flex flex-col items-center gap-2 w-full"
            >
              <div
                className="w-full aspect-square max-w-[80px] rounded-full flex items-center justify-center text-white text-xl font-bold transition-transform group-hover:scale-110 overflow-hidden"
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
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">🏷️</p>
          <p>No hay categorías disponibles aún</p>
        </div>
      )}
    </div>
  )
}
