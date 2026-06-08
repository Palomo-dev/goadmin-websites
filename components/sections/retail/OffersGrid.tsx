'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, Check, Layers, Package, ChevronLeft, ChevronRight, Flame, TrendingUp, ShoppingBag } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'
const ITEMS_PER_PAGE = 12

function getImageUrl(product: any): string | null {
  if (!product.product_images || product.product_images.length === 0) return null
  const primary = product.product_images.find((img: any) => img.is_primary)
  const image = primary || product.product_images[0]
  const path = image.storage_path || image.shared_images?.storage_path
  if (!path) return null
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`
}

function getDiscount(product: any): number {
  const pp = product.product_prices?.[0]
  if (!pp?.compare_price || !pp?.price) return 0
  return Math.round((1 - Number(pp.price) / Number(pp.compare_price)) * 100)
}

interface OffersGridProps {
  content: {
    title?: string
    subtitle?: string
    offers?: Array<{
      title: string
      description?: string
      discount?: string
      image_url?: string
      cta_text?: string
      cta_url?: string
    }>
  }
  primaryColor?: string
  organization?: { subdomain?: string; website_settings?: any }
  data?: { offerProducts?: any[] }
}

export function OffersGrid({ content, primaryColor = '#3B82F6', organization, data }: OffersGridProps) {
  const router = useRouter()
  const showBuyNow = organization?.website_settings?.show_buy_now_button !== false
  const manualOffers = content.offers || []
  const products = data?.offerProducts || []
  const [addedToCart, setAddedToCart] = useState<Set<number>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<'sales' | 'discount' | 'price_asc' | 'price_desc'>('sales')

  const categories = useMemo(() => {
    const catMap = new Map<number, string>()
    products.forEach((p: any) => {
      if (p.category_id && p.categories?.name) catMap.set(p.category_id, p.categories.name)
    })
    return Array.from(catMap.entries()).map(([id, name]) => ({ id, name }))
  }, [products])

  const filteredProducts = useMemo(() => {
    let result = selectedCategory ? products.filter((p: any) => p.category_id === selectedCategory) : [...products]
    if (sortBy === 'sales') result.sort((a: any, b: any) => (b.sales_count || 0) - (a.sales_count || 0))
    else if (sortBy === 'discount') result.sort((a: any, b: any) => getDiscount(b) - getDiscount(a))
    else if (sortBy === 'price_asc') result.sort((a: any, b: any) => Number(a.product_prices?.[0]?.price || 0) - Number(b.product_prices?.[0]?.price || 0))
    else if (sortBy === 'price_desc') result.sort((a: any, b: any) => Number(b.product_prices?.[0]?.price || 0) - Number(a.product_prices?.[0]?.price || 0))
    return result
  }, [products, selectedCategory, sortBy])

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
  const resetPage = () => setCurrentPage(1)

  const addToCart = (product: any) => {
    const price = Number(product.product_prices?.[0]?.price || 0)
    if (!price) return
    const subdomain = organization?.subdomain || (typeof window !== 'undefined' ? window.location.hostname.split('.')[0] : '')
    const cartKey = `cart_${subdomain}`
    const cart = JSON.parse(localStorage.getItem(cartKey) || '[]')
    const idx = cart.findIndex((item: any) => item.id === product.id)
    if (idx >= 0) { cart[idx].quantity += 1 } else {
      const imgUrl = getImageUrl(product)
      const cp = product.product_prices?.[0]?.compare_price
      cart.push({ id: product.id, name: product.name, price, quantity: 1, ...(imgUrl && { imageUrl: imgUrl }), ...(cp && { comparePrice: Number(cp) }) })
    }
    localStorage.setItem(cartKey, JSON.stringify(cart))
    window.dispatchEvent(new CustomEvent('cart-updated'))
    setAddedToCart(prev => new Set(prev).add(product.id))
    setTimeout(() => { setAddedToCart(prev => { const n = new Set(prev); n.delete(product.id); return n }) }, 1500)
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

      {/* Banners manuales (si los hay) */}
      {manualOffers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {manualOffers.map((offer, i) => (
            <div key={i} className="rounded-xl overflow-hidden border dark:border-gray-700 hover:shadow-lg transition-shadow">
              {offer.image_url && <img src={offer.image_url} alt={offer.title} className="w-full h-48 object-cover" loading="lazy" />}
              <div className="p-5">
                {offer.discount && (
                  <span className="inline-block px-3 py-1 rounded-full text-sm font-bold text-white mb-3" style={{ backgroundColor: primaryColor }}>{offer.discount}</span>
                )}
                <h3 className="font-bold text-lg mb-1">{offer.title}</h3>
                {offer.description && <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">{offer.description}</p>}
                {offer.cta_text && offer.cta_url && (
                  <Link href={offer.cta_url} className="text-sm font-medium hover:underline" style={{ color: primaryColor }}>{offer.cta_text} →</Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Productos con descuento automático */}
      {products.length > 0 && (
        <>
          {/* Filtros */}
          <div className="mb-6 space-y-3">
            {categories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                <button
                  onClick={() => { setSelectedCategory(null); resetPage() }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all border ${!selectedCategory ? 'text-white border-transparent' : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'}`}
                  style={!selectedCategory ? { backgroundColor: primaryColor } : {}}
                >Todos</button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => { setSelectedCategory(selectedCategory === cat.id ? null : cat.id); resetPage() }}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all border ${selectedCategory === cat.id ? 'text-white border-transparent' : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'}`}
                    style={selectedCategory === cat.id ? { backgroundColor: primaryColor } : {}}
                  >{cat.name}</button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value as any); resetPage() }}
                className="px-3 py-1.5 rounded-full text-xs sm:text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 outline-none"
              >
                <option value="sales">🔥 Más vendidos</option>
                <option value="discount">% Mayor descuento</option>
                <option value="price_asc">Precio: menor a mayor</option>
                <option value="price_desc">Precio: mayor a menor</option>
              </select>
              <span className="text-xs text-gray-400 ml-auto">{filteredProducts.length} ofertas</span>
            </div>
          </div>

          {/* Grid */}
          {paginatedProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
              {paginatedProducts.map((product: any) => {
                const pp = product.product_prices?.[0]
                const price = pp ? Number(pp.price) : null
                const comparePrice = pp?.compare_price ? Number(pp.compare_price) : null
                const discount = getDiscount(product)
                const imgUrl = getImageUrl(product)
                const isAdded = addedToCart.has(product.id)
                const variantCount = product.variant_count || 0
                const isParent = product.is_parent && variantCount > 0

                return (
                  <div key={product.id} className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all">
                    <Link href={`/productos/${product.uuid}`}>
                      <div className="aspect-square bg-gray-100 dark:bg-gray-700 overflow-hidden relative">
                        <span className="absolute top-2 left-2 z-10 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                          -{discount}%
                        </span>
                        {product.sales_count > 0 && (
                          <span className="absolute bottom-2 left-2 z-10 bg-black/70 text-white text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" /> {product.sales_count} vendidos
                          </span>
                        )}
                        {variantCount > 0 && (
                          <span className="absolute top-2 right-2 z-10 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1" style={{ backgroundColor: primaryColor }}>
                            <Layers className="h-3 w-3" /> {variantCount}
                          </span>
                        )}
                        {imgUrl ? (
                          <Image src={imgUrl} alt={product.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-16 w-16 text-gray-300 dark:text-gray-500" />
                          </div>
                        )}
                      </div>
                    </Link>
                    <div className="p-2.5 sm:p-4">
                      <Link href={`/productos/${product.uuid}`}>
                        <h3 className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-white mb-1 line-clamp-2">{product.name}</h3>
                      </Link>
                      <div className="flex flex-col gap-2 mt-1">
                        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                          {comparePrice && price && comparePrice > price && (
                            <span className="text-xs sm:text-sm text-gray-400 line-through">${comparePrice.toLocaleString()}</span>
                          )}
                          {price && (
                            <span className="font-bold text-sm sm:text-lg" style={{ color: primaryColor }}>${price.toLocaleString()}</span>
                          )}
                        </div>
                        {isParent ? (
                          <Link href={`/productos/${product.uuid}`}>
                            <Button size="sm" className="w-full text-xs sm:text-sm" style={{ backgroundColor: primaryColor }}>
                              <Layers className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> Elegir
                            </Button>
                          </Link>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            <Button
                              size="sm"
                              onClick={(e) => { e.preventDefault(); addToCart(product) }}
                              className={`w-full text-xs sm:text-sm transition-all ${isAdded ? 'bg-green-500 hover:bg-green-600' : ''}`}
                              style={!isAdded ? { backgroundColor: primaryColor } : {}}
                              disabled={price === null}
                            >
                              {isAdded ? (<><Check className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> Listo</>) : (<><Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> Agregar</>)}
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
                                <ShoppingBag className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> Comprar ahora
                              </Button>
                            )}
                          </div>
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
              <p>No hay ofertas con estos filtros</p>
              <button onClick={() => { setSelectedCategory(null); resetPage() }} className="mt-2 text-sm underline" style={{ color: primaryColor }}>Limpiar filtros</button>
            </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 mt-8">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }).map((_, i) => {
                const page = i + 1
                if (totalPages <= 7 || page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1) {
                  return (
                    <button key={page} onClick={() => setCurrentPage(page)} className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-all ${currentPage === page ? 'text-white' : 'text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`} style={currentPage === page ? { backgroundColor: primaryColor } : {}}>
                      {page}
                    </button>
                  )
                }
                if (page === 2 && currentPage > 3) return <span key="s-dots" className="px-1 text-gray-400">...</span>
                if (page === totalPages - 1 && currentPage < totalPages - 2) return <span key="e-dots" className="px-1 text-gray-400">...</span>
                return null
              })}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Mensaje vacío solo si no hay ni manuales ni automáticas */}
      {manualOffers.length === 0 && products.length === 0 && (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">🔥</p>
          <p>No hay ofertas activas en este momento</p>
        </div>
      )}
    </div>
  )
}
