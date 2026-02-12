import Link from 'next/link'

interface CategoriesGridProps {
  content: {
    title?: string
    subtitle?: string
    show_count?: boolean
  }
  primaryColor?: string
  data?: { categories?: any[] }
}

export function CategoriesGrid({ content, primaryColor, data }: CategoriesGridProps) {
  const categories = data?.categories || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 text-center mb-10">{content.subtitle}</p>
      )}
      {categories.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {categories.map((cat: any) => (
            <Link
              key={cat.id}
              href={`/categorias/${cat.id}`}
              className="group relative rounded-xl overflow-hidden bg-gray-100 aspect-[4/3] hover:shadow-lg transition-shadow"
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                <div>
                  <h3 className="text-white font-semibold text-lg">{cat.name}</h3>
                  {content.show_count && cat.product_count != null && (
                    <span className="text-white/80 text-sm">{cat.product_count} productos</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed rounded-lg">
          <p className="text-4xl mb-3">🏷️</p>
          <p>No hay categorías disponibles aún</p>
        </div>
      )}
    </div>
  )
}
