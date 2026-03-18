import Link from 'next/link'

interface MenuPreviewTabsProps {
  content: {
    title?: string
    subtitle?: string
    max_items?: number
    cta_text?: string
    cta_url?: string
  }
  primaryColor?: string
  data?: { products?: any[]; categories?: any[] }
}

export function MenuPreviewTabs({ content, primaryColor, data }: MenuPreviewTabsProps) {
  const categories = data?.categories || []
  const products = data?.products || []
  const maxItems = content.max_items || 6

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-8">{content.subtitle}</p>
      )}

      {categories.length > 0 ? (
        <div className="space-y-10">
          {categories.slice(0, 4).map((cat: any) => {
            const catProducts = products.filter((p: any) => p.category_id === cat.id).slice(0, maxItems)
            if (catProducts.length === 0) return null
            return (
              <div key={cat.id}>
                <h3 className="text-xl font-semibold mb-4 border-b pb-2" style={{ borderColor: primaryColor }}>
                  {cat.name}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {catProducts.map((product: any) => (
                    <Link
                      key={product.id}
                      href={`/productos/${product.uuid}`}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      {product.image_url && (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                          loading="lazy"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 dark:text-white truncate">{product.name}</h4>
                        {product.description && (
                          <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-1">{product.description}</p>
                        )}
                      </div>
                      {product.price != null && (
                        <span className="font-bold whitespace-nowrap" style={{ color: primaryColor }}>
                          ${Number(product.price).toLocaleString()}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">🍽️</p>
          <p>Menú no disponible aún</p>
        </div>
      )}

      {content.cta_text && content.cta_url && (
        <div className="text-center mt-8">
          <Link
            href={content.cta_url}
            className="inline-block px-6 py-3 rounded-lg text-white font-medium"
            style={{ backgroundColor: primaryColor }}
          >
            {content.cta_text}
          </Link>
        </div>
      )}
    </div>
  )
}
