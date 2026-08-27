'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ProductCard } from './ProductCard'

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
              const isAdded = addedToCart.has(product.id)
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  primaryColor={primaryColor}
                  variant="grid"
                  cardStyle={content}
                  showBuyNow={showBuyNow}
                  onAddToCart={addToCart}
                  onBuyNow={buyNow}
                  isAdded={isAdded}
                  organizationSubdomain={organization?.subdomain}
                  className="flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(33.333%-11px)] lg:w-[calc(25%-12px)] snap-start"
                />
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
