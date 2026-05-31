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
        {title && <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{title}</h2>}
        {subtitle && <p className="text-gray-600 dark:text-gray-300 mt-2">{subtitle}</p>}
      </div>
      {products.length > 0 ? (
        <div className="flex gap-6 overflow-x-auto pb-4 snap-x">
          {products.map((product: any) => {
            const imgUrl = getImageUrl(product)
            const price = getPrice(product)
            return (
              <a
                key={product.id}
                href={`/productos/${product.uuid}`}
                className="flex-shrink-0 w-64 snap-start group"
              >
                <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden mb-3 relative">
                  {imgUrl ? (
                    <Image src={imgUrl} alt={product.name} fill className="object-cover group-hover:scale-105 transition-transform" sizes="256px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-12 w-12 text-gray-300 dark:text-gray-500" />
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-2">{product.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {price !== null && (
                    <span className="font-bold" style={{ color: primaryColor }}>${price.toLocaleString()}</span>
                  )}
                </div>
              </a>
            )
          })}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">⭐</p>
          <p>No hay productos destacados aún</p>
        </div>
      )}
    </div>
  )
}
