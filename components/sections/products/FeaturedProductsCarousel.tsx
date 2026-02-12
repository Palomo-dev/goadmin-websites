'use client'

interface FeaturedProductsCarouselProps {
  content: Record<string, any>
  primaryColor?: string
  data?: { products?: any[] }
}

export function FeaturedProductsCarousel({ content, primaryColor = '#3B82F6', data }: FeaturedProductsCarouselProps) {
  const title = content.title || 'Productos Destacados'
  const subtitle = content.subtitle
  const allProducts = data?.products || []
  const maxItems = content.max_items || 8
  const products = allProducts.slice(0, maxItems)

  return (
    <div>
      <div className="text-center mb-8">
        {title && <h2 className="text-2xl md:text-3xl font-bold">{title}</h2>}
        {subtitle && <p className="text-gray-600 mt-2">{subtitle}</p>}
      </div>
      {products.length > 0 ? (
        <div className="flex gap-6 overflow-x-auto pb-4 snap-x">
          {products.map((product: any) => (
            <a
              key={product.id}
              href={`/productos/${product.uuid}`}
              className="flex-shrink-0 w-64 snap-start group"
            >
              <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden mb-3 relative">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">📦</div>
                )}
                {product.compare_at_price && product.compare_at_price > product.price && (
                  <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    -{Math.round((1 - product.price / product.compare_at_price) * 100)}%
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-sm line-clamp-2">{product.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                {product.price != null && (
                  <span className="font-bold" style={{ color: primaryColor }}>${Number(product.price).toLocaleString()}</span>
                )}
                {product.compare_at_price && product.compare_at_price > product.price && (
                  <span className="text-sm text-gray-400 line-through">${Number(product.compare_at_price).toLocaleString()}</span>
                )}
              </div>
            </a>
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
