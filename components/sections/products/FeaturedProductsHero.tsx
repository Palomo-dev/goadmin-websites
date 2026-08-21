'use client'

import Image from 'next/image'
import { Package } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

function getImageUrl(product: any): string | null {
  if (!product.product_images || product.product_images.length === 0) return null
  const primary = product.product_images.find((img: any) => img.is_primary)
  const image = primary || product.product_images[0]
  const path = image.storage_path || image.shared_images?.storage_path
  if (!path) return null
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`
}

function getPrice(product: any): number | null {
  if (product.product_prices && product.product_prices.length > 0) {
    return Number(product.product_prices[0].price)
  }
  return null
}

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

  const heroImg = getImageUrl(hero)
  const heroPrice = getPrice(hero)

  return (
    <div>
      {title && <h2 className="text-2xl md:text-3xl font-bold text-center mb-10 text-gray-900 dark:text-white">{title}</h2>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Producto principal */}
        <a href={`/productos/${hero.uuid}`} className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
          <div className="aspect-square bg-gray-100 dark:bg-gray-700 overflow-hidden relative">
            {heroImg ? (
              <Image src={heroImg} alt={hero.name} fill className="object-cover group-hover:scale-105 transition-transform" sizes="(max-width: 1024px) 100vw, 50vw" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="h-20 w-20 text-gray-300 dark:text-gray-500" />
              </div>
            )}
          </div>
          <div className="p-6">
            <h3 className="font-bold text-xl mb-2 text-gray-900 dark:text-white">{hero.name}</h3>
            {hero.description && <p className="text-gray-500 dark:text-gray-400 text-sm mb-3 line-clamp-2">{hero.description}</p>}
            {heroPrice !== null && (
              <span className="font-bold text-2xl" style={{ color: primaryColor }}>${heroPrice.toLocaleString('es-CO')}</span>
            )}
          </div>
        </a>
        {/* Grid secundario */}
        <div className="grid grid-cols-2 gap-4">
          {rest.map((product: any) => {
            const imgUrl = getImageUrl(product)
            const price = getPrice(product)
            return (
              <a key={product.id} href={`/productos/${product.uuid}`} className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
                <div className="aspect-square bg-gray-100 dark:bg-gray-700 overflow-hidden relative">
                  {imgUrl ? (
                    <Image src={imgUrl} alt={product.name} fill className="object-cover group-hover:scale-105 transition-transform" sizes="25vw" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-10 w-10 text-gray-300 dark:text-gray-500" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-1">{product.name}</h3>
                  {price !== null && (
                    <span className="font-bold text-sm" style={{ color: primaryColor }}>${price.toLocaleString('es-CO')}</span>
                  )}
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}
