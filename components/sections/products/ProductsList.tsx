'use client'

interface ProductsListProps {
  content: Record<string, any>
  primaryColor?: string
  data?: Record<string, any>
}

export function ProductsList({ content, primaryColor = '#3B82F6', data }: ProductsListProps) {
  const title = content.title || 'Nuestros Productos'
  const products = data?.products || []
  const maxItems = content.max_items || 12
  const displayed = maxItems > 0 ? products.slice(0, maxItems) : products

  return (
    <section className="py-16 px-4">
      <div className="max-w-4xl mx-auto">
        {title && <h2 className="text-3xl font-bold text-center mb-10">{title}</h2>}
        <div className="space-y-4">
          {displayed.map((product: any) => {
            const price = product.product_prices?.[0]
            const image = product.product_images?.find((img: any) => img.is_primary) || product.product_images?.[0]
            const imageUrl = image?.shared_images?.storage_path || image?.storage_path
            return (
              <a key={product.id} href={`/productos/${product.uuid}`} className="flex items-center gap-4 bg-white rounded-xl border p-4 hover:shadow-md transition-shadow group">
                <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                  {imageUrl ? (
                    <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">📦</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold group-hover:underline">{product.name}</h3>
                  {product.description && <p className="text-gray-500 text-sm line-clamp-1">{product.description}</p>}
                </div>
                {price && <p className="font-bold text-lg flex-shrink-0" style={{ color: primaryColor }}>${Number(price.price).toLocaleString()}</p>}
              </a>
            )
          })}
        </div>
      </div>
    </section>
  )
}
