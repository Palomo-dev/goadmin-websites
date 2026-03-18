import Link from 'next/link'

interface SpecialtiesFeaturedProps {
  content: {
    title?: string
    subtitle?: string
    max_items?: number
  }
  primaryColor?: string
  data?: { products?: any[] }
}

export function SpecialtiesFeatured({ content, primaryColor, data }: SpecialtiesFeaturedProps) {
  const products = (data?.products || []).slice(0, content.max_items || 4)

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-10">{content.subtitle}</p>
      )}
      {products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product: any) => (
            <Link
              key={product.id}
              href={`/productos/${product.uuid}`}
              className="group text-center"
            >
              <div className="aspect-square rounded-full overflow-hidden mx-auto w-48 h-48 mb-4 border-4 border-transparent group-hover:border-current transition-colors" style={{ color: primaryColor }}>
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center text-4xl">🍽️</div>
                )}
              </div>
              <h3 className="font-semibold text-lg mb-1">{product.name}</h3>
              {product.price != null && (
                <span className="font-bold" style={{ color: primaryColor }}>${Number(product.price).toLocaleString()}</span>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">⭐</p>
          <p>Sin especialidades destacadas aún</p>
        </div>
      )}
    </div>
  )
}
