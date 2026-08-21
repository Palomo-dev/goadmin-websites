'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, Check, Package, ChevronLeft, ChevronRight, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isOutOfStock } from '@/lib/stock'

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
}

export function RelatedProducts({ products, primaryColor, currentProductId, organizationSubdomain }: RelatedProductsProps) {
  const [addedToCart, setAddedToCart] = useState<Set<number>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activePage, setActivePage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Filtrar el producto actual
  const relatedProducts = products.filter(p => p.id !== currentProductId).slice(0, 8)

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
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Productos relacionados</h2>
      <div className="relative group/carousel">
        <button
          onClick={() => scrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' })}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white shadow-lg border flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity -translate-x-1/2 hover:scale-110"
          style={{ color: primaryColor }}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => scrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white shadow-lg border flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity translate-x-1/2 hover:scale-110"
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
        {relatedProducts.map((product: any) => {
          const price = product.product_prices?.[0]?.price
          const comparePrice = product.product_prices?.[0]?.compare_price
          const imgUrl = getImageUrl(product)
          const isAdded = addedToCart.has(product.id)
          const outOfStock = isOutOfStock(product)
          const discount = comparePrice && price && Number(comparePrice) > Number(price)
            ? Math.round((1 - Number(price) / Number(comparePrice)) * 100)
            : null

          return (
            <div
              key={product.id}
              className="flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(33.333%-11px)] lg:w-[calc(25%-12px)] snap-start group bg-white rounded-xl border overflow-hidden hover:shadow-lg transition-all"
            >
              <Link href={`/productos/${product.uuid}`}>
                <div className="aspect-square bg-gray-100 overflow-hidden relative">
                  {discount && (
                    <span className="absolute top-2 left-2 z-10 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      -{discount}%
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
                      <Package className="h-12 w-12 text-gray-300" />
                    </div>
                  )}
                </div>
              </Link>
              <div className="p-3">
                <Link href={`/productos/${product.uuid}`}>
                  <h3 className="font-medium text-sm text-gray-900 line-clamp-2 hover:text-blue-600 transition-colors">
                    {product.name}
                  </h3>
                </Link>
                <div className="flex items-center gap-2 mt-2">
                  {comparePrice && Number(comparePrice) > Number(price) && (
                    <span className="text-xs text-gray-400 line-through">${Number(comparePrice).toLocaleString('es-CO')}</span>
                  )}
                  {price && (
                    <span className="font-bold text-sm" style={{ color: primaryColor }}>
                      ${Number(price).toLocaleString('es-CO')}
                    </span>
                  )}
                </div>
                {price && !product.is_parent && (
                  <Button
                    size="sm"
                    onClick={() => addToCart(product)}
                    disabled={outOfStock}
                    className={`w-full mt-2 text-xs transition-all ${isAdded ? 'bg-green-500 hover:bg-green-600' : ''} ${outOfStock ? 'opacity-50' : ''}`}
                    style={!isAdded && !outOfStock ? { backgroundColor: primaryColor } : {}}
                  >
                    {isAdded ? <><Check className="h-3 w-3 mr-1" />Agregado</> : outOfStock ? <><Package className="h-3 w-3 mr-1" />Sin stock</> : <><Plus className="h-3 w-3 mr-1" />Agregar</>}
                  </Button>
                )}
                {product.is_parent && (
                  <Link href={`/productos/${product.uuid}`}>
                    <Button size="sm" className="w-full mt-2 text-xs" style={{ backgroundColor: primaryColor }}>
                      <Layers className="h-3 w-3 mr-1" /> Elegir
                    </Button>
                  </Link>
                )}
                {outOfStock && !product.is_parent && (
                  <span className="inline-block mt-1 text-xs font-medium text-red-500">Agotado</span>
                )}
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
    </div>
  )
}
