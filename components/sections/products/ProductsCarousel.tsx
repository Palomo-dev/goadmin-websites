'use client'

interface ProductsCarouselProps {
  content: Record<string, any>
  primaryColor?: string
  data?: Record<string, any>
}

export function ProductsCarousel({ content, primaryColor = '#3B82F6', data }: ProductsCarouselProps) {
  const title = content.title || 'Nuestros Productos'
  const subtitle = content.subtitle
  const products = data?.products || []
  const maxItems = content.max_items || 12

  const displayed = maxItems > 0 ? products.slice(0, maxItems) : products

  return (
    <section className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          {title && <h2 className="text-3xl font-bold">{title}</h2>}
          {subtitle && <p className="text-gray-600 mt-2">{subtitle}</p>}
        </div>
        <div className="flex gap-6 overflow-x-auto pb-4 snap-x">
          {displayed.map((product: any) => {
            const price = product.product_prices?.[0]
            const image = product.product_images?.find((img: any) => img.is_primary) || product.product_images?.[0]
            const imageUrl = image?.shared_images?.storage_path || image?.storage_path
            return (
              <a key={product.id} href={`/productos/${product.uuid}`} className="flex-shrink-0 w-64 snap-start group">
                <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden mb-3">
                  {imageUrl ? (
                    <img src={imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">📦</div>
                  )}
                </div>
                <h3 className="font-semibold text-sm line-clamp-2">{product.name}</h3>
                {price && <p className="font-bold mt-1" style={{ color: primaryColor }}>${Number(price.price).toLocaleString()}</p>}
              </a>
            )
          })}
        </div>
      </div>
    </section>
  )
}
