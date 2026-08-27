'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ProductCard } from '@/components/sections/products/ProductCard'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

function getImageUrl(product: any): string | null {
  if (!product.product_images || product.product_images.length === 0) return null
  const primary = product.product_images.find((img: any) => img.is_primary) || product.product_images[0]
  const path = primary.storage_path || primary.shared_images?.storage_path
  if (!path) return null
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`
}

interface RelatedProductsProps {
  products: any[]
  primaryColor: string
  currentProductId: number
  organizationSubdomain?: string
  title?: string
  maxItems?: number
  cardStyle?: Record<string, any>
  layoutConfig?: Record<string, any>
}

export function RelatedProducts({ products, primaryColor, currentProductId, organizationSubdomain, title, maxItems, cardStyle, layoutConfig }: RelatedProductsProps) {
  const [addedToCart, setAddedToCart] = useState<Set<number>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activePage, setActivePage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Filtrar el producto actual
  const relatedProducts = products.filter(p => p.id !== currentProductId).slice(0, maxItems || 8)

  // Configuración de layout
  const columns = layoutConfig?.columns || 4
  const gap = layoutConfig?.gap ?? 16
  const showArrows = layoutConfig?.show_arrows !== false
  const showDots = layoutConfig?.show_dots !== false

  // Cálculo de ancho según columnas en desktop
  const lgWidthMap: Record<number, string> = {
    2: 'lg:w-[calc(50%-8px)]',
    3: 'lg:w-[calc(33.333%-11px)]',
    4: 'lg:w-[calc(25%-12px)]',
    5: 'lg:w-[calc(20%-13px)]',
    6: 'lg:w-[calc(16.666%-13px)]',
  }
  const lgWidth = lgWidthMap[columns] || 'lg:w-[calc(25%-12px)]'

  const updatePagination = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const scrollLeft = el.scrollLeft
    const scrollWidth = el.scrollWidth - el.clientWidth
    if (scrollWidth <= 0) { setTotalPages(1); setActivePage(0); return }
    const pages = Math.ceil(relatedProducts.length / 2)
    setTotalPages(pages)
    setActivePage(Math.round((scrollLeft / scrollWidth) * (pages - 1)))
  }, [relatedProducts.length])

  useEffect(() => { updatePagination() }, [updatePagination])

  if (relatedProducts.length === 0) return null

  const addToCart = (product: any) => {
    const price = product.product_prices?.[0]?.price
    if (!price) return

    const subdomain = organizationSubdomain || window.location.hostname.split('.')[0]
    const cartKey = `cart_${subdomain}`
    const cart = JSON.parse(localStorage.getItem(cartKey) || '[]')

    const existingIndex = cart.findIndex((item: any) => item.id === product.id)
    if (existingIndex >= 0) {
      cart[existingIndex].quantity += 1
    } else {
      const imgUrl = getImageUrl(product)
      const cp = product.product_prices?.[0]?.compare_price
      cart.push({
        id: product.id,
        name: product.name,
        price: Number(price),
        quantity: 1,
        ...(imgUrl && { imageUrl: imgUrl }),
        ...(cp && { comparePrice: Number(cp) })
      })
    }

    localStorage.setItem(cartKey, JSON.stringify(cart))
    window.dispatchEvent(new CustomEvent('cart-updated'))
    setAddedToCart(prev => new Set(prev).add(product.id))
    setTimeout(() => {
      setAddedToCart(prev => { const n = new Set(prev); n.delete(product.id); return n })
    }, 1500)
  }

  return (
    <div className="mt-16 border-t pt-12">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{title || 'Productos relacionados'}</h2>
      <div className="relative group/carousel">
        {showArrows && (
          <button
            onClick={() => scrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' })}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white shadow-lg border flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity -translate-x-1/2 hover:scale-110"
            style={{ color: primaryColor }}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {showArrows && (
          <button
            onClick={() => scrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white shadow-lg border flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity translate-x-1/2 hover:scale-110"
            style={{ color: primaryColor }}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
        <div
          ref={scrollRef}
          onScroll={updatePagination}
          className="flex overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide"
          style={{ gap: `${gap}px`, scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
        {relatedProducts.map((product: any) => {
          const isAdded = addedToCart.has(product.id)
          return (
            <ProductCard
              key={product.id}
              product={product}
              primaryColor={primaryColor}
              variant="grid"
              showBuyNow={false}
              onAddToCart={addToCart}
              isAdded={isAdded}
              organizationSubdomain={organizationSubdomain}
              cardStyle={cardStyle}
              className={`flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(33.333%-11px)] ${lgWidth} snap-start`}
            />
          )
        })}
        </div>
        {/* Pagination dots */}
        {showDots && totalPages > 1 && (
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
    </div>
  )
}
