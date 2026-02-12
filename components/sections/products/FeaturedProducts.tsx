import Link from 'next/link'

interface FeaturedProductsProps {
  content: {
    title?: string
    subtitle?: string
    max_items?: number
    filter?: string
  }
  primaryColor?: string
  data?: { products?: any[] }
}

export function FeaturedProducts({ content, primaryColor, data }: FeaturedProductsProps) {
  const allProducts = data?.products || []
  const maxItems = content.max_items || 8
  const products = allProducts.slice(0, maxItems)

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 text-center mb-10">{content.subtitle}</p>
      )}
      {products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product: any) => (
            <Link
              key={product.id}
              href={`/productos/${product.uuid}`}
              className="group bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-square bg-gray-100 overflow-hidden relative">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-5xl">📦</div>
                )}
                {product.compare_at_price && product.compare_at_price > product.price && (
                  <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    -{Math.round((1 - product.price / product.compare_at_price) * 100)}%
                  </span>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{product.name}</h3>
                <div className="flex items-center gap-2">
                  {product.price != null && (
                    <span className="font-bold text-lg" style={{ color: primaryColor }}>
                      ${Number(product.price).toLocaleString()}
                    </span>
                  )}
                  {product.compare_at_price && product.compare_at_price > product.price && (
                    <span className="text-sm text-gray-400 line-through">
                      ${Number(product.compare_at_price).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed rounded-lg">
          <p className="text-4xl mb-3">⭐</p>
          <p>No hay productos destacados aún</p>
        </div>
      )}
    </div>
  )
}
