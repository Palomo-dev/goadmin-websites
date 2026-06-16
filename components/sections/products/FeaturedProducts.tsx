'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, Check, Package, Layers, ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react'
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

interface FeaturedProductsProps {
  content: {
    title?: string
    subtitle?: string
    max_items?: number
    filter?: string
  }
  primaryColor?: string
  data?: { products?: any[] }
  organization?: { subdomain?: string; website_settings?: { show_buy_now_button?: boolean } }
}

export function FeaturedProducts({ content, primaryColor = '#3B82F6', data, organization }: FeaturedProductsProps) {
  const router = useRouter()
  const showBuyNow = organization?.website_settings?.show_buy_now_button !== false
  const allProducts = data?.products || []
  const maxItems = content.max_items || 8
  const products = allProducts.slice(0, maxItems)
  const [addedToCart, setAddedToCart] = useState<Set<number>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activePage, setActivePage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const updatePagination = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const scrollLeft = el.scrollLeft
    const scrollWidth = el.scrollWidth - el.clientWidth
    if (scrollWidth <= 0) { setTotalPages(1); setActivePage(0); return }
    const pages = Math.ceil(products.length / 2)
    setTotalPages(pages)
    setActivePage(Math.round((scrollLeft / scrollWidth) * (pages - 1)))
  }, [products.length])

  useEffect(() => { updatePagination() }, [updatePagination])

  const addToCart = (product: any) => {
    const price = getPrice(product)
    if (price === null) return

    const host = typeof window !== 'undefined' ? window.location.hostname : ''
    const subdomain = organization?.subdomain || host.split('.')[0]
    const cartKey = `cart_${subdomain}`
    const cart = JSON.parse(localStorage.getItem(cartKey) || '[]')

    const existingIndex = cart.findIndex((item: any) => item.id === product.id)
    if (existingIndex >= 0) {
      cart[existingIndex].quantity += 1
    } else {
      const imgUrl = getImageUrl(product)
      const cp = getComparePrice(product)
      cart.push({ id: product.id, name: product.name, price, quantity: 1, ...(imgUrl && { imageUrl: imgUrl }), ...(cp && { comparePrice: cp }) })
    }

    localStorage.setItem(cartKey, JSON.stringify(cart))
    window.dispatchEvent(new CustomEvent('cart-updated'))

    setAddedToCart(prev => new Set(prev).add(product.id))
    setTimeout(() => {
      setAddedToCart(prev => { const n = new Set(prev); n.delete(product.id); return n })
    }, 1500)
  }

  const buyNow = (product: any) => {
    addToCart(product)
    router.push('/checkout')
  }

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-10">{content.subtitle}</p>
      )}
      {products.length > 0 ? (
        <div className="relative group/carousel">
          {/* Flecha izquierda */}
          <button
            onClick={() => scrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' })}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-lg border dark:border-gray-700 flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity -translate-x-1/2 hover:scale-110"
            style={{ color: primaryColor }}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          {/* Flecha derecha */}
          <button
            onClick={() => scrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-lg border dark:border-gray-700 flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity translate-x-1/2 hover:scale-110"
            style={{ color: primaryColor }}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div
            ref={scrollRef}
            onScroll={updatePagination}
            className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
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
                  className="flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(33.333%-11px)] lg:w-[calc(25%-12px)] snap-start group bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all"
                >
                  <Link href={`/productos/${product.uuid}`}>
                    <div className="aspect-square bg-gray-100 dark:bg-gray-700 overflow-hidden relative">
                      {comparePrice && price !== null && comparePrice > price && (
                        <span className="absolute top-2 left-2 z-10 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                          -{Math.round((1 - price / comparePrice) * 100)}%
                        </span>
                      )}
                      {outOfStock && !isParent && !(comparePrice && price !== null && comparePrice > price) && (
                        <span className="absolute top-2 left-2 z-10 bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded-full">Agotado</span>
                      )}
                      {variantCount > 0 && (
                        <span className="absolute top-2 right-2 z-10 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1" style={{ backgroundColor: primaryColor }}>
                          <Layers className="h-3 w-3" />{variantCount}
                        </span>
                      )}
                      {imgUrl ? (
                        <Image
                          src={imgUrl}
                          alt={product.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
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
                    <div className="flex flex-col gap-2 mt-1">
                      <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                        {comparePrice && price !== null && comparePrice > price && (
                          <span className="text-xs sm:text-sm text-gray-400 line-through">${comparePrice.toLocaleString()}</span>
                        )}
                        {price !== null && (
                          <span className="font-bold text-sm sm:text-lg" style={{ color: primaryColor }}>${price.toLocaleString()}</span>
                        )}
                      </div>
                      {outOfStock && !isParent ? (
                        <span className="text-xs text-red-500 font-medium">Sin stock</span>
                      ) : isParent ? (
                        <Link href={`/productos/${product.uuid}`}>
                          <Button size="sm" className="w-full text-xs sm:text-sm" style={{ backgroundColor: primaryColor }}><Layers className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />Elegir</Button>
                        </Link>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            onClick={(e) => { e.preventDefault(); addToCart(product) }}
                            className={`w-full text-xs sm:text-sm transition-all ${isAdded ? 'bg-green-500 hover:bg-green-600' : ''}`}
                            style={!isAdded ? { backgroundColor: primaryColor } : {}}
                            disabled={price === null}
                          >
                            {isAdded ? <><Check className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />Listo</> : <><Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />Agregar</>}
                          </Button>
                          {showBuyNow && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => { e.preventDefault(); buyNow(product) }}
                              className="w-full text-xs sm:text-sm"
                              style={{ borderColor: primaryColor, color: primaryColor }}
                              disabled={price === null}
                            >
                              <ShoppingBag className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />Comprar ahora
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {/* Pagination dots */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-1.5 mt-3">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const el = scrollRef.current
                    if (!el) return
                    const scrollWidth = el.scrollWidth - el.clientWidth
                    el.scrollTo({ left: (i / (totalPages - 1)) * scrollWidth, behavior: 'smooth' })
                  }}
                  className={`rounded-full transition-all ${i === activePage ? 'w-6 h-2' : 'w-2 h-2 bg-gray-300 dark:bg-gray-600'}`}
                  style={i === activePage ? { backgroundColor: primaryColor } : {}}
                />
              ))}
            </div>
          )}
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
