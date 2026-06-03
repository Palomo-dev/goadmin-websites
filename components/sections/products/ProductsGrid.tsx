'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, Check, Layers, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'

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

function getComparePrice(product: any): number | null {
  const cp = product.product_prices?.[0]?.compare_price
  return cp ? Number(cp) : null
}

function getStock(product: any): number | null {
  if (!product.stock_levels || product.stock_levels.length === 0) return null
  return product.stock_levels.reduce(
    (sum: number, sl: any) => sum + (Number(sl.qty_on_hand) - Number(sl.qty_reserved)), 0
  )
}

interface ProductsGridProps {
  content: {
    title?: string
    show_filters?: boolean
    show_search?: boolean
    show_categories?: boolean
  }
  primaryColor?: string
  data?: { products?: any[]; categories?: any[] }
  organization?: { subdomain?: string }
}

export function ProductsGrid({ content, primaryColor = '#3B82F6', data, organization }: ProductsGridProps) {
  const organizationSubdomain = organization?.subdomain || ''
  const products = data?.products || []
  const [addedToCart, setAddedToCart] = useState<Set<number>>(new Set())

  const addToCart = (product: any) => {
    const price = getPrice(product)
    if (price === null) return

    const host = typeof window !== 'undefined' ? window.location.hostname : ''
    const subdomain = organizationSubdomain || host.split('.')[0]
    const cartKey = `cart_${subdomain}`
    const cart = JSON.parse(localStorage.getItem(cartKey) || '[]')

    const existingIndex = cart.findIndex((item: any) => item.id === product.id)
    if (existingIndex >= 0) {
      cart[existingIndex].quantity += 1
    } else {
      const imgUrl = getImageUrl(product)
      const comparePrice = getComparePrice(product)
      cart.push({
        id: product.id,
        name: product.name,
        price,
        quantity: 1,
        ...(imgUrl && { imageUrl: imgUrl }),
        ...(comparePrice && { comparePrice })
      })
    }

    localStorage.setItem(cartKey, JSON.stringify(cart))
    window.dispatchEvent(new CustomEvent('cart-updated'))

    setAddedToCart(prev => new Set(prev).add(product.id))
    setTimeout(() => {
      setAddedToCart(prev => {
        const next = new Set(prev)
        next.delete(product.id)
        return next
      })
    }, 1500)
  }

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {products.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
          {products.map((product: any) => {
            const price = getPrice(product)
            const comparePrice = getComparePrice(product)
            const imgUrl = getImageUrl(product)
            const isAdded = addedToCart.has(product.id)
            const variantCount = product.variant_count || 0
            const stock = getStock(product)
            const outOfStock = stock !== null && stock <= 0
            const isParent = product.is_parent && variantCount > 0

            return (
              <div
                key={product.id}
                className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all"
              >
                <Link href={`/productos/${product.uuid}`}>
                  <div className="aspect-square bg-gray-100 dark:bg-gray-700 overflow-hidden relative">
                    {comparePrice && price !== null && comparePrice > price && (
                      <span className="absolute top-2 left-2 z-10 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        -{Math.round((1 - price / comparePrice) * 100)}%
                      </span>
                    )}
                    {outOfStock && !isParent && !comparePrice && (
                      <span className="absolute top-2 left-2 z-10 bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded-full">Agotado</span>
                    )}
                    {variantCount > 0 && (
                      <span className="absolute top-2 right-2 z-10 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1" style={{ backgroundColor: primaryColor }}>
                        <Layers className="h-3 w-3" />
                        {variantCount}
                      </span>
                    )}
                    {imgUrl ? (
                      <Image
                        src={imgUrl}
                        alt={product.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-16 w-16 text-gray-300 dark:text-gray-500" />
                      </div>
                    )}
                  </div>
                </Link>
                <div className="p-2.5 sm:p-4">
                  <Link href={`/productos/${product.uuid}`}>
                    <h3 className="font-semibold text-xs sm:text-base text-gray-900 dark:text-white mb-1 line-clamp-2 transition-colors">
                      {product.name}
                    </h3>
                  </Link>
                  {product.description && (
                    <p className="hidden sm:block text-gray-500 dark:text-gray-400 text-sm mb-3 line-clamp-2">{product.description}</p>
                  )}
                  <div className="flex flex-col gap-2 mt-1">
                    <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                      {comparePrice && price !== null && comparePrice > price && (
                        <span className="text-xs sm:text-sm text-gray-400 line-through">${comparePrice.toLocaleString()}</span>
                      )}
                      {price !== null && (
                        <span className="font-bold text-sm sm:text-lg" style={{ color: primaryColor }}>
                          ${price.toLocaleString()}
                        </span>
                      )}
                    </div>
                    {outOfStock && !isParent ? (
                      <span className="text-xs text-red-500 font-medium">Sin stock</span>
                    ) : isParent ? (
                      <Link href={`/productos/${product.uuid}`}>
                        <Button size="sm" className="w-full text-xs sm:text-sm" style={{ backgroundColor: primaryColor }}>
                          <Layers className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> Elegir
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault()
                          addToCart(product)
                        }}
                        className={`w-full text-xs sm:text-sm transition-all ${isAdded ? 'bg-green-500 hover:bg-green-600' : ''}`}
                        style={!isAdded ? { backgroundColor: primaryColor } : {}}
                        disabled={price === null}
                      >
                        {isAdded ? (
                          <>
                            <Check className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            Listo
                          </>
                        ) : (
                          <>
                            <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            Agregar
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">📦</p>
          <p>No hay productos disponibles aún</p>
        </div>
      )}
    </div>
  )
}
