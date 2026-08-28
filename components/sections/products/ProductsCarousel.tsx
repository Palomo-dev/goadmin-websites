'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ProductCard, getProductImageUrl, getProductPrice, getProductComparePrice } from './ProductCard'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

interface ProductsCarouselProps {
  content: Record<string, any>
  primaryColor?: string
  data?: Record<string, any>
  organization?: { subdomain?: string; website_settings?: any }
}

export function ProductsCarousel({ content, primaryColor = '#3B82F6', data, organization }: ProductsCarouselProps) {
  const router = useRouter()
  const organizationSubdomain = organization?.subdomain || ''
  const showBuyNow = organization?.website_settings?.show_buy_now_button !== false
  const allProducts = (data?.products || []) as any[]
  const maxItems = content.max_items || 12
  const selectedIds: number[] = content.selected_category_ids || []

  // Filtrar por categorías seleccionadas
  const filtered = selectedIds.length > 0
    ? allProducts.filter((p) => selectedIds.includes(p.category_id))
    : allProducts

  // Ordenar
  const sortOrder = content.sort_order || 'default'
  const sorted = [...filtered]
  if (sortOrder === 'price_asc') sorted.sort((a, b) => (getProductPrice(a) ?? 0) - (getProductPrice(b) ?? 0))
  else if (sortOrder === 'price_desc') sorted.sort((a, b) => (getProductPrice(b) ?? 0) - (getProductPrice(a) ?? 0))
  else if (sortOrder === 'name') sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  else if (sortOrder === 'sales') sorted.sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0))

  const products = maxItems > 0 ? sorted.slice(0, maxItems) : sorted

  // slides_per_view responsive: puede ser número o { desktop, tablet, mobile }
  const spv = content.slides_per_view
  const spvDesktop = (typeof spv === 'object' ? spv?.desktop : spv) || 4
  const spvTablet = (typeof spv === 'object' ? spv?.tablet : spv) || Math.min(3, spvDesktop)
  const spvMobile = (typeof spv === 'object' ? spv?.mobile : spv) || Math.min(2, spvDesktop)
  // Calcula ancho de cada card según slides_per_view
  const cardWidthClass = `flex-shrink-0 w-[calc(${100 / spvMobile}%-${spvMobile > 1 ? '8px' : '0px'})] sm:w-[calc(${100 / spvTablet}%-${spvTablet > 1 ? '11px' : '0px'})] lg:w-[calc(${100 / spvDesktop}%-${spvDesktop > 1 ? '12px' : '0px'})] snap-start`

  const [addedToCart, setAddedToCart] = useState<Set<number>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [activePage, setActivePage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
    const scrollWidth = el.scrollWidth - el.clientWidth
    if (scrollWidth <= 0) { setTotalPages(1); setActivePage(0); return }
    const pages = Math.ceil(products.length / 2)
    setTotalPages(pages)
    setActivePage(Math.round((el.scrollLeft / scrollWidth) * (pages - 1)))
  }, [products.length])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateScrollState()
    el.addEventListener('scroll', updateScrollState, { passive: true })
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', updateScrollState); ro.disconnect() }
  }, [updateScrollState])

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.8
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  const addToCart = (product: any) => {
    const price = getProductPrice(product)
    if (price === null) return
    const host = typeof window !== 'undefined' ? window.location.hostname : ''
    const sub = organizationSubdomain || host.split('.')[0]
    const cartKey = `cart_${sub}`
    const cart = JSON.parse(localStorage.getItem(cartKey) || '[]')
    const idx = cart.findIndex((item: any) => item.id === product.id)
    if (idx >= 0) {
      cart[idx].quantity += 1
    } else {
      const imgUrl = getProductImageUrl(product)
      const cp = getProductComparePrice(product)
      cart.push({ id: product.id, name: product.name, price, quantity: 1, ...(imgUrl && { imageUrl: imgUrl }), ...(cp && { comparePrice: cp }) })
    }
    localStorage.setItem(cartKey, JSON.stringify(cart))
    window.dispatchEvent(new CustomEvent('cart-updated'))
    setAddedToCart((prev) => new Set(prev).add(product.id))
    setTimeout(() => {
      setAddedToCart((prev) => { const n = new Set(prev); n.delete(product.id); return n })
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
        <p className="text-gray-600 dark:text-gray-300 text-center mb-8">{content.subtitle}</p>
      )}

      {products.length > 0 ? (
        <div className="relative group/carousel">
          {/* Flecha izquierda */}
          {canScrollLeft && (
            <button
              onClick={() => scroll('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-lg border dark:border-gray-700 flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity -translate-x-1/2 hover:scale-110"
              style={{ color: primaryColor }}
              aria-label="Anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {/* Flecha derecha */}
          {canScrollRight && (
            <button
              onClick={() => scroll('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-lg border dark:border-gray-700 flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity translate-x-1/2 hover:scale-110"
              style={{ color: primaryColor }}
              aria-label="Siguiente"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
          <div
            ref={scrollRef}
            onScroll={updateScrollState}
            className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide scroll-smooth"
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
                  badges={content.badges}
                  cardButtons={content.card_buttons}
                  buttonsPosition={content.buttons_position}
                  buttonsLayout={content.buttons_layout}
                  buttonsFullWidth={content.buttons_full_width !== false}
                  iconOnly={content.icon_only}
                  showBuyNow={showBuyNow}
                  onAddToCart={addToCart}
                  onBuyNow={buyNow}
                  isAdded={isAdded}
                  organizationSubdomain={organizationSubdomain}
                  className={cardWidthClass}
                />
              )
            })}
          </div>
          {/* Puntos de navegación */}
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
                  aria-label={`Ir a página ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">📦</p>
          <p>No hay productos disponibles</p>
        </div>
      )}
    </div>
  )
}
