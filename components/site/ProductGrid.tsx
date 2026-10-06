'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus, Check, Package, Layers, ChevronLeft, ChevronRight, SlidersHorizontal, ShoppingBag } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { VariantSelector } from './VariantSelector'
import { getAvailableStock } from '@/lib/stock'
import { getCartKey } from '@/lib/utils'
import { isParentProduct, requiereElegir } from '@/components/sections/products/ProductCard'
import { agregarPlatoAlCarrito } from '@/lib/cart'
import type { ModifierGroup, SelectedModifier } from './ProductModifierSelector'

interface ProductImage {
  id: number
  storage_path: string | null
  is_primary: boolean
  display_order: number
  shared_image_id: number | null
  shared_images?: {
    storage_path: string
  } | null
}

interface StockLevel {
  qty_on_hand: number
  qty_reserved: number
}

interface Product {
  id: number
  uuid: string
  name: string
  description?: string
  category_id?: number
  is_parent?: boolean
  has_variants?: boolean
  variant_count?: number
  track_stock?: boolean
  product_prices?: { price: number; compare_price?: number | null; currency_code?: string }[]
  product_images?: ProductImage[]
  stock_levels?: StockLevel[]
  variant_data?: Record<string, string> | null
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

function getProductImageUrl(product: Product): string | null {
  if (!product.product_images || product.product_images.length === 0) return null
  
  // Buscar imagen primaria primero
  const primaryImage = product.product_images.find(img => img.is_primary)
  const image = primaryImage || product.product_images[0]
  
  // Obtener el path de storage
  const storagePath = image.storage_path || image.shared_images?.storage_path
  
  if (!storagePath) return null
  
  // Construir URL de Supabase Storage (bucket: product-images)
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${storagePath}`
}

interface Category {
  id: number
  name: string
  slug: string
}

interface ProductGridProps {
  products: Product[]
  categories: Category[]
  primaryColor: string
  organizationSubdomain: string
  organizationId?: number
  showBuyNow?: boolean
  branchId?: number | null
}

const ITEMS_PER_PAGE = 12

export function ProductGrid({ products, categories, primaryColor, organizationSubdomain, organizationId, showBuyNow = true, branchId }: ProductGridProps) {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [addedToCart, setAddedToCart] = useState<Set<number>>(new Set())
  const [variantParent, setVariantParent] = useState<Product | null>(null)
  const [variantChildren, setVariantChildren] = useState<any[]>([])
  const [variantGroups, setVariantGroups] = useState<ModifierGroup[]>([])
  const [loadingVariants, setLoadingVariants] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortBy, setSortBy] = useState<'default' | 'price_asc' | 'price_desc' | 'name'>('default')
  const [onlyOffers, setOnlyOffers] = useState(false)

  const filteredProducts = useMemo(() => {
    let result = selectedCategory ? products.filter(p => p.category_id === selectedCategory) : [...products]
    if (onlyOffers) result = result.filter(p => {
      const cp = p.product_prices?.[0]?.compare_price
      const pr = p.product_prices?.[0]?.price
      return cp && pr && Number(cp) > Number(pr)
    })
    if (sortBy === 'price_asc') result.sort((a, b) => (a.product_prices?.[0]?.price ?? 0) - (b.product_prices?.[0]?.price ?? 0))
    else if (sortBy === 'price_desc') result.sort((a, b) => (b.product_prices?.[0]?.price ?? 0) - (a.product_prices?.[0]?.price ?? 0))
    else if (sortBy === 'name') result.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return result
  }, [products, selectedCategory, sortBy, onlyOffers])

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
  const resetPage = () => setCurrentPage(1)
  
  const openVariantSelector = async (product: Product) => {
    if (!organizationId) return
    setVariantParent(product)
    setLoadingVariants(true)
    try {
      // Con sede, la ruta aplica su carta (mismo precio que cobra /api/orders).
      const sedeParam = typeof branchId === 'number' ? `&branchId=${branchId}` : ''
      const res = await fetch(`/api/products/${product.id}/variants?organizationId=${organizationId}${sedeParam}`)
      const data = await res.json()
      setVariantChildren(data.variants || [])
      // Grupos del padre (acompañante…): las variantes los heredan en el cobro.
      setVariantGroups(Array.isArray(data.modifierGroups) ? data.modifierGroups : [])
    } catch (err) {
      console.error('Error loading variants:', err)
      setVariantChildren([])
      setVariantGroups([])
    } finally {
      setLoadingVariants(false)
    }
  }

  const buyNow = (product: Product) => {
    addToCart(product)
    router.push('/checkout')
  }

  const addToCart = (product: Product) => {
    const price = product.product_prices?.[0]?.price || 0
    
    // Obtener carrito actual
    const cartKey = getCartKey(organizationSubdomain, branchId)
    const existingCart = JSON.parse(localStorage.getItem(cartKey) || '[]')
    
    // Buscar si ya existe el producto
    const existingIndex = existingCart.findIndex((item: any) => item.id === product.id)
    
    if (existingIndex >= 0) {
      existingCart[existingIndex].quantity += 1
    } else {
      const imgUrl = getProductImageUrl(product)
      const cp = product.product_prices?.[0]?.compare_price
      existingCart.push({
        id: product.id,
        name: product.name,
        price: Number(price),
        quantity: 1,
        ...(imgUrl && { imageUrl: imgUrl }),
        ...(cp && { comparePrice: Number(cp) }),
        ...(product.variant_data && { variantAttributes: product.variant_data })
      })
    }
    
    localStorage.setItem(cartKey, JSON.stringify(existingCart))
    
    // Mostrar feedback
    setAddedToCart(prev => new Set(prev).add(product.id))
    setTimeout(() => {
      setAddedToCart(prev => {
        const next = new Set(prev)
        next.delete(product.id)
        return next
      })
    }, 1500)
    
    // Disparar evento para actualizar el header si tiene contador de carrito
    window.dispatchEvent(new CustomEvent('cart-updated'))
  }
  
  return (
    <div>
      {/* Filtros */}
      <div className="mb-6 space-y-3">
        {/* Categorías */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            <button
              onClick={() => { setSelectedCategory(null); resetPage() }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all border ${
                !selectedCategory ? 'text-white border-transparent' : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400'
              }`}
              style={!selectedCategory ? { backgroundColor: primaryColor } : {}}
            >
              Todos
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => { setSelectedCategory(selectedCategory === category.id ? null : category.id); resetPage() }}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all border ${
                  selectedCategory === category.id ? 'text-white border-transparent' : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400'
                }`}
                style={selectedCategory === category.id ? { backgroundColor: primaryColor } : {}}
              >
                {category.name}
              </button>
            ))}
          </div>
        )}
        {/* Ordenar + Ofertas */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setOnlyOffers(!onlyOffers); resetPage() }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all border ${
              onlyOffers ? 'text-white border-transparent' : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
            }`}
            style={onlyOffers ? { backgroundColor: '#EF4444' } : {}}
          >
            <SlidersHorizontal className="h-3 w-3" /> Ofertas
          </button>
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value as any); resetPage() }}
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
      
      {/* Grid de productos */}
      {paginatedProducts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
          {paginatedProducts.map((product) => {
            const price = product.product_prices?.[0]
            const isAdded = addedToCart.has(product.id)
            
            return (
              <Card key={product.id} className="group overflow-hidden hover:shadow-lg transition-all h-full">
                <Link href={`/productos/${product.uuid}`}>
                  <div 
                    className="aspect-square flex items-center justify-center relative overflow-hidden"
                    style={{ 
                      background: `linear-gradient(135deg, ${primaryColor}10 0%, ${primaryColor}05 100%)` 
                    }}
                  >
                    {(() => {
                      const stock = getAvailableStock(product)
                      const cp = product.product_prices?.[0]?.compare_price
                      const pr = product.product_prices?.[0]?.price
                      const hasDiscount = cp && pr && Number(cp) > Number(pr)
                      if (hasDiscount) {
                        return (
                          <span className="absolute top-2 left-2 z-10 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                            -{Math.round((1 - Number(pr) / Number(cp)) * 100)}%
                          </span>
                        )
                      }
                      return stock !== null && stock <= 0 ? (
                        <span className="absolute top-2 left-2 z-10 bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded-full">
                          Agotado
                        </span>
                      ) : null
                    })()}
                    {product.has_variants && (product.variant_count ?? 0) > 0 && (
                      <span className="absolute top-2 right-2 z-10 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1" style={{ backgroundColor: primaryColor }}>
                        <Layers className="h-3 w-3" />
                        {product.variant_count}
                      </span>
                    )}
                    {getProductImageUrl(product) ? (
                      <Image
                        src={getProductImageUrl(product)!}
                        alt={product.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    ) : (
                      <Package className="h-16 w-16 opacity-30" style={{ color: primaryColor }} />
                    )}
                  </div>
                </Link>
                
                <CardContent className="p-2.5 sm:p-4">
                  <Link href={`/productos/${product.uuid}`}>
                    <h3 className="font-semibold text-xs sm:text-sm text-gray-900 mb-1 line-clamp-2 transition-colors">
                      {product.name}
                    </h3>
                  </Link>
                  
                  <div className="flex flex-col gap-2 mt-1">
                    <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                      {price?.compare_price && Number(price.compare_price) > Number(price.price) && (
                        <span className="text-xs sm:text-sm text-gray-400 line-through">${Number(price.compare_price).toLocaleString('es-CO')}</span>
                      )}
                      {price && (
                        <span className="text-sm sm:text-lg font-bold" style={{ color: primaryColor }}>
                          ${Number(price.price).toLocaleString('es-CO')}
                        </span>
                      )}
                    </div>
                    
                    {(() => {
                      const stock = getAvailableStock(product)
                      const outOfStock = stock !== null && stock <= 0
                      const isParent = isParentProduct(product)
                      // Grupo obligatorio sin variantes: se elige en el detalle del producto.
                      const soloElegir = !isParent && requiereElegir(product)
                      return outOfStock && !isParent ? (
                        <span className="text-xs text-red-500 font-medium">Sin stock</span>
                      ) : soloElegir ? (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault()
                            router.push(`/productos/${product.uuid}`)
                          }}
                          className="w-full text-xs sm:text-sm"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <Layers className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          Elegir
                        </Button>
                      ) : isParent ? (
                        <Button 
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault()
                            openVariantSelector(product)
                          }}
                          className="w-full text-xs sm:text-sm"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <Layers className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          Elegir
                        </Button>
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
                            >
                              <ShoppingBag className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              Comprar ahora
                            </Button>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-20 border-2 border-dashed dark:border-gray-700 rounded-xl">
          <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">
            {selectedCategory || onlyOffers
              ? 'No hay productos con estos filtros' 
              : 'No hay productos disponibles en este momento.'}
          </p>
          {(selectedCategory || onlyOffers) && (
            <button onClick={() => { setSelectedCategory(null); setOnlyOffers(false); setSortBy('default'); resetPage() }} className="mt-2 text-sm underline" style={{ color: primaryColor }}>Limpiar filtros</button>
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

      {/* Variant Selector Dialog */}
      {variantParent && (
        <VariantSelector
          parentName={variantParent.name}
          variants={variantChildren}
          primaryColor={primaryColor}
          mode="dialog"
          modifierGroups={variantGroups}
          onClose={() => { setVariantParent(null); setVariantChildren([]); setVariantGroups([]) }}
          onSelect={(variant, qty = 1, mods: SelectedModifier[] = []) => {
            const v = variant as any
            const base = Number(v.product_prices?.[0]?.price ?? variantParent.product_prices?.[0]?.price ?? 0)
            agregarPlatoAlCarrito(organizationSubdomain, branchId, {
              productId: Number(v.id),
              name: v.name,
              sku: v.sku ?? null,
              unitPrice: base + mods.reduce((t, m) => t + (m.extraPrice || 0), 0),
              quantity: qty,
              imageUrl: getProductImageUrl(v),
              comparePrice: mods.length === 0 && v.product_prices?.[0]?.compare_price ? Number(v.product_prices[0].compare_price) : null,
              modifiers: mods,
              variantAttributes: v.variant_data ?? null,
            })
            setVariantParent(null)
            setVariantChildren([])
            setVariantGroups([])
          }}
        />
      )}
    </div>
  )
}
