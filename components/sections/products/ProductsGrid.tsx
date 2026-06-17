'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, Check, Layers, Package, ChevronLeft, ChevronRight, SlidersHorizontal, ArrowUpDown, ShoppingBag } from 'lucide-react'
import { useRouter } from 'next/navigation'
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
    selected_category_ids?: number[]
  }
  primaryColor?: string
  data?: { products?: any[]; categories?: any[] }
  organization?: { subdomain?: string; website_settings?: any }
}

const ITEMS_PER_PAGE = 12

export function ProductsGrid({ content, primaryColor = '#3B82F6', data, organization }: ProductsGridProps) {
  const router = useRouter()
  const organizationSubdomain = organization?.subdomain || ''
  const showBuyNow = organization?.website_settings?.show_buy_now_button !== false
  const products = data?.products || []
  const categories = data?.categories || []
  const [addedToCart, setAddedToCart] = useState<Set<number>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<'default' | 'price_asc' | 'price_desc' | 'name'>('default')
  const [onlyOffers, setOnlyOffers] = useState(false)

  // Categorías únicas de los productos
  const availableCategories = useMemo(() => {
    const allCats = categories.length > 0
      ? categories
      : (() => {
          const catMap = new Map<number, string>()
          products.forEach((p: any) => {
            if (p.category_id && p.categories?.name) catMap.set(p.category_id, p.categories.name)
          })
          return Array.from(catMap.entries()).map(([id, name]) => ({ id, name }))
        })()
    const selectedIds = content.selected_category_ids || []
    if (selectedIds.length === 0) return allCats
    return selectedIds
      .map((id: number) => allCats.find((c: any) => c.id === id))
      .filter(Boolean)
  }, [products, categories, content.selected_category_ids])

  // Filtrar y ordenar
  const filteredProducts = useMemo(() => {
    const selectedIds = content.selected_category_ids || []
    let result = selectedIds.length > 0
      ? products.filter((p: any) => selectedIds.includes(p.category_id))
      : [...products]
    if (selectedCategory) result = result.filter((p: any) => p.category_id === selectedCategory)
    if (onlyOffers) result = result.filter((p: any) => {
      const cp = p.product_prices?.[0]?.compare_price
      const pr = p.product_prices?.[0]?.price
      return cp && pr && Number(cp) > Number(pr)
    })
    if (sortBy === 'price_asc') result.sort((a: any, b: any) => (getPrice(a) ?? 0) - (getPrice(b) ?? 0))
    else if (sortBy === 'price_desc') result.sort((a: any, b: any) => (getPrice(b) ?? 0) - (getPrice(a) ?? 0))
    else if (sortBy === 'name') result.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))
    return result
  }, [products, selectedCategory, sortBy, onlyOffers, content.selected_category_ids])

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const handleFilterChange = () => { setCurrentPage(1) }

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
  }

  const buyNow = (product: any) => {
    addToCart(product)
    router.push('/checkout')
  }

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-6 text-gray-900 dark:text-white">{content.title}</h2>
      )}

      {/* Filtros */}
      {products.length > 0 && (
        <div className="mb-6 space-y-3">
          {/* Categorías */}
          {availableCategories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
              <button
                onClick={() => { setSelectedCategory(null); handleFilterChange() }}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all border ${
                  !selectedCategory ? 'text-white border-transparent' : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400'
                }`}
                style={!selectedCategory ? { backgroundColor: primaryColor } : {}}
              >
                Todos
              </button>
              {availableCategories.map((cat: any) => (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCategory(selectedCategory === cat.id ? null : cat.id); handleFilterChange() }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all border ${
                    selectedCategory === cat.id ? 'text-white border-transparent' : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400'
                  }`}
                  style={selectedCategory === cat.id ? { backgroundColor: primaryColor } : {}}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
          {/* Ordenar + Ofertas */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { setOnlyOffers(!onlyOffers); handleFilterChange() }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all border ${
                onlyOffers ? 'text-white border-transparent' : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
              }`}
              style={onlyOffers ? { backgroundColor: '#EF4444' } : {}}
            >
              <SlidersHorizontal className="h-3 w-3" /> Ofertas
            </button>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value as any); handleFilterChange() }}
              className="px-3 py-1.5 rounded-full text-xs sm:text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 outline-none"
            >
              <option value="default">Ordenar</option>
              <option value="price_asc">Precio: menor a mayor</option>
              <option value="price_desc">Precio: mayor a menor</option>
              <option value="name">Nombre A-Z</option>
            </select>
            <span className="text-xs text-gray-400 ml-auto">{filteredProducts.length} productos</span>
          </div>
        </div>
      )}

      {paginatedProducts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
          {paginatedProducts.map((product: any) => {
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
                    <h3 className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-white mb-1 line-clamp-2 transition-colors">
                      {product.name}
                    </h3>
                  </Link>
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
                      <div className="flex flex-col gap-1.5">
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
                        {showBuyNow && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.preventDefault()
                              buyNow(product)
                            }}
                            className="w-full text-xs sm:text-sm"
                            style={{ borderColor: primaryColor, color: primaryColor }}
                            disabled={price === null}
                          >
                            <ShoppingBag className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            Comprar ahora
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
          <p>{selectedCategory || onlyOffers ? 'No hay productos con estos filtros' : 'No hay productos disponibles aún'}</p>
          {(selectedCategory || onlyOffers) && (
            <button onClick={() => { setSelectedCategory(null); setOnlyOffers(false); setSortBy('default'); setCurrentPage(1) }} className="mt-2 text-sm underline" style={{ color: primaryColor }}>Limpiar filtros</button>
          )}
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-8">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: totalPages }).map((_, i) => {
            const page = i + 1
            if (totalPages <= 7 || page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1) {
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-all ${
                    currentPage === page ? 'text-white' : 'text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                  style={currentPage === page ? { backgroundColor: primaryColor } : {}}
                >
                  {page}
                </button>
              )
            }
            if (page === 2 && currentPage > 3) return <span key="start-dots" className="px-1 text-gray-400">...</span>
            if (page === totalPages - 1 && currentPage < totalPages - 2) return <span key="end-dots" className="px-1 text-gray-400">...</span>
            return null
          })}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
