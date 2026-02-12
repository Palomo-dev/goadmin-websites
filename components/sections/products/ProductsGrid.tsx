import Link from 'next/link'

interface ProductsGridProps {
  content: {
    title?: string
    show_filters?: boolean
    show_search?: boolean
    show_categories?: boolean
  }
  primaryColor?: string
  data?: { products?: any[]; categories?: any[] }
}

export function ProductsGrid({ content, primaryColor, data }: ProductsGridProps) {
  const products = data?.products || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">{content.title}</h2>
      )}
      {products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product: any) => (
            <Link
              key={product.id}
              href={`/productos/${product.uuid}`}
              className="group bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-square bg-gray-100 overflow-hidden">
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
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{product.name}</h3>
                {product.description && (
                  <p className="text-gray-500 text-sm mb-2 line-clamp-2">{product.description}</p>
                )}
                <div className="flex items-center justify-between">
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
          <p className="text-4xl mb-3">📦</p>
          <p>No hay productos disponibles aún</p>
        </div>
      )}
    </div>
  )
}
