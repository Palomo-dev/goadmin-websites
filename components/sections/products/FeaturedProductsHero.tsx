'use client'

interface FeaturedProductsHeroProps {
  content: Record<string, any>
  primaryColor?: string
  data?: { products?: any[] }
}

export function FeaturedProductsHero({ content, primaryColor = '#3B82F6', data }: FeaturedProductsHeroProps) {
  const title = content.title || 'Productos Destacados'
  const allProducts = data?.products || []
  const maxItems = content.max_items || 5
  const products = allProducts.slice(0, maxItems)
  const hero = products[0]
  const rest = products.slice(1)

  if (!hero) {
    return (
      <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
        <p className="text-4xl mb-3">⭐</p>
        <p>No hay productos destacados aún</p>
      </div>
    )
  }

  return (
    <div>
      {title && <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">{title}</h2>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Producto principal */}
        <a href={`/productos/${hero.uuid}`} className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
          <div className="aspect-square bg-gray-100 overflow-hidden relative">
            {hero.image_url ? (
              <img src={hero.image_url} alt={hero.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300 text-6xl">📦</div>
            )}
            {hero.compare_at_price && hero.compare_at_price > hero.price && (
              <span className="absolute top-3 right-3 bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                -{Math.round((1 - hero.price / hero.compare_at_price) * 100)}%
              </span>
            )}
          </div>
          <div className="p-6">
            <h3 className="font-bold text-xl mb-2">{hero.name}</h3>
            {hero.description && <p className="text-gray-500 dark:text-gray-400 text-sm mb-3 line-clamp-2">{hero.description}</p>}
            {hero.price != null && (
              <span className="font-bold text-2xl" style={{ color: primaryColor }}>${Number(hero.price).toLocaleString()}</span>
            )}
          </div>
        </a>
        {/* Grid secundario */}
        <div className="grid grid-cols-2 gap-4">
          {rest.map((product: any) => (
            <a key={product.id} href={`/productos/${product.uuid}`} className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
              <div className="aspect-square bg-gray-100 overflow-hidden">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">📦</div>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-semibold text-sm line-clamp-1">{product.name}</h3>
                {product.price != null && (
                  <span className="font-bold text-sm" style={{ color: primaryColor }}>${Number(product.price).toLocaleString()}</span>
                )}
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
