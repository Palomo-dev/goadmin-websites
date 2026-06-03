'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Check, Package, Layers, Grid3X3, List, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

interface ProductImage {
  id: number
  storage_path: string | null
  is_primary: boolean
  display_order: number
  shared_image_id: number | null
  shared_images?: { storage_path: string } | null
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
  product_prices?: { price: number; currency_code?: string }[]
  product_images?: ProductImage[]
  stock_levels?: StockLevel[]
}

interface Subcategory {
  id: number
  name: string
  slug: string
  icon?: string
  image_url?: string
}

interface CategoryPageClientProps {
  products: Product[]
  subcategories: Subcategory[]
  categorySlug: string
  primaryColor: string
  total: number
  totalPages: number
  currentPage: number
  currentSort: string
  currentSubcategory: string
  currentView: 'grid' | 'list'
  organizationSubdomain: string
  organizationId: number
}

function getProductImageUrl(product: Product): string | null {
  if (!product.product_images || product.product_images.length === 0) return null
  const primaryImage = product.product_images.find(img => img.is_primary)
  const image = primaryImage || product.product_images[0]
  const storagePath = image.storage_path || image.shared_images?.storage_path
  if (!storagePath) return null
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${storagePath}`
}

function getAvailableStock(product: Product): number | null {
  if (!product.stock_levels || product.stock_levels.length === 0) return null
  return product.stock_levels.reduce(
    (sum, sl) => sum + (Number(sl.qty_on_hand) - Number(sl.qty_reserved)), 0
  )
}

const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Nombre A-Z' },
  { value: 'name_desc', label: 'Nombre Z-A' },
  { value: 'price_asc', label: 'Precio: Menor a Mayor' },
  { value: 'price_desc', label: 'Precio: Mayor a Menor' },
  { value: 'newest', label: 'Más recientes' },
]

export function CategoryPageClient({
  products,
  subcategories,
  categorySlug,
  primaryColor,
  total,
  totalPages,
  currentPage,
  currentSort,
  currentSubcategory,
  currentView,
  organizationSubdomain,
  organizationId
}: CategoryPageClientProps) {
  const router = useRouter()
  const [addedToCart, setAddedToCart] = useState<Set<number>>(new Set())
  const [view, setView] = useState<'grid' | 'list'>(currentView)
  const [showFilters, setShowFilters] = useState(false)

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams()
    const values = {
      orden: currentSort,
      page: String(currentPage),
      sub: currentSubcategory || undefined,
      vista: view,
      ...overrides
    }
    Object.entries(values).forEach(([key, val]) => {
      if (val && val !== 'name_asc' && val !== '1' && val !== 'grid' && val !== '') {
        params.set(key, val)
      }
    })
    const qs = params.toString()
    return `/categorias/${categorySlug}${qs ? `?${qs}` : ''}`
  }

  const handleSortChange = (newSort: string) => {
    router.push(buildUrl({ orden: newSort, page: '1' }))
  }

  const handleSubcategoryChange = (subSlug: string) => {
    router.push(buildUrl({ sub: subSlug || undefined, page: '1' }))
  }

  const handlePageChange = (newPage: number) => {
    router.push(buildUrl({ page: String(newPage) }))
  }

  const handleViewChange = (newView: 'grid' | 'list') => {
    setView(newView)
    router.push(buildUrl({ vista: newView }))
  }

  const addToCart = (product: Product) => {
    const price = product.product_prices?.[0]?.price || 0
    const cartKey = `cart_${organizationSubdomain}`
    const existingCart = JSON.parse(localStorage.getItem(cartKey) || '[]')
    const existingIndex = existingCart.findIndex((item: any) => item.id === product.id)

    if (existingIndex >= 0) {
      existingCart[existingIndex].quantity += 1
    } else {
      const imgUrl = getProductImageUrl(product)
      existingCart.push({
        id: product.id,
        name: product.name,
        price: Number(price),
        quantity: 1,
        ...(imgUrl && { imageUrl: imgUrl })
      })
    }

    localStorage.setItem(cartKey, JSON.stringify(existingCart))
    setAddedToCart(prev => new Set(prev).add(product.id))
    setTimeout(() => {
      setAddedToCart(prev => {
        const next = new Set(prev)
        next.delete(product.id)
        return next
      })
    }, 1500)
    window.dispatchEvent(new CustomEvent('cart-updated'))
  }

  return (
    <div>
      {/* Subcategorías */}
      {subcategories.length > 0 && (
        <div className="mb-6 overflow-x-auto">
          <div className="flex gap-2 pb-2">
            <button
              onClick={() => handleSubcategoryChange('')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                !currentSubcategory
                  ? 'text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              style={!currentSubcategory ? { backgroundColor: primaryColor } : {}}
            >
              Todas
            </button>
            {subcategories.map((sub) => (
              <button
                key={sub.id}
                onClick={() => handleSubcategoryChange(sub.slug)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  currentSubcategory === sub.slug
                    ? 'text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
                style={currentSubcategory === sub.slug ? { backgroundColor: primaryColor } : {}}
              >
                {sub.icon && <span className="mr-1">{sub.icon}</span>}
                {sub.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar: ordenamiento + vista */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b dark:border-gray-700">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden flex items-center gap-2 px-3 py-2 rounded-lg border dark:border-gray-700 text-sm"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
          </button>
          <select
            value={currentSort}
            onChange={(e) => handleSortChange(e.target.value)}
            className="px-3 py-2 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-0"
            style={{ ['--tw-ring-color' as any]: primaryColor }}
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
            {total} {total === 1 ? 'producto' : 'productos'}
          </span>
          <div className="flex border dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => handleViewChange('grid')}
              className={`p-2 transition-colors ${view === 'grid' ? 'bg-gray-100 dark:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              title="Vista cuadrícula"
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleViewChange('list')}
              className={`p-2 transition-colors ${view === 'list' ? 'bg-gray-100 dark:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              title="Vista lista"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Productos */}
      {products.length > 0 ? (
        <>
          {view === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
              {products.map((product) => (
                <ProductCardGrid
                  key={product.id}
                  product={product}
                  primaryColor={primaryColor}
                  isAdded={addedToCart.has(product.id)}
                  onAddToCart={() => addToCart(product)}
                  organizationId={organizationId}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {products.map((product) => (
                <ProductCardList
                  key={product.id}
                  product={product}
                  primaryColor={primaryColor}
                  isAdded={addedToCart.has(product.id)}
                  onAddToCart={() => addToCart(product)}
                />
              ))}
            </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-2 rounded-lg border dark:border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              {generatePageNumbers(currentPage, totalPages).map((pageNum, idx) => (
                pageNum === '...' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                ) : (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(Number(pageNum))}
                    className={`min-w-[40px] h-10 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? 'text-white'
                        : 'border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                    style={currentPage === pageNum ? { backgroundColor: primaryColor } : {}}
                  >
                    {pageNum}
                  </button>
                )
              ))}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="p-2 rounded-lg border dark:border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20 border-2 border-dashed dark:border-gray-700 rounded-xl">
          <Package className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-lg">No hay productos en esta categoría</p>
          <Link
            href="/productos"
            className="inline-block mt-4 text-sm font-medium hover:underline"
            style={{ color: primaryColor }}
          >
            Ver todos los productos
          </Link>
        </div>
      )}
    </div>
  )
}

// --- Componentes de tarjeta ---

function ProductCardGrid({
  product,
  primaryColor,
  isAdded,
  onAddToCart,
  organizationId
}: {
  product: Product
  primaryColor: string
  isAdded: boolean
  onAddToCart: () => void
  organizationId: number
}) {
  const price = product.product_prices?.[0]
  const stock = getAvailableStock(product)
  const outOfStock = stock !== null && stock <= 0
  const imgUrl = getProductImageUrl(product)

  return (
    <Card className="group overflow-hidden hover:shadow-lg transition-all h-full">
      <Link href={`/productos/${product.uuid}`}>
        <div
          className="aspect-square flex items-center justify-center relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${primaryColor}10 0%, ${primaryColor}05 100%)` }}
        >
          {outOfStock && (
            <span className="absolute top-2 left-2 z-10 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              Agotado
            </span>
          )}
          {product.has_variants && (product.variant_count ?? 0) > 0 && (
            <span className="absolute top-2 right-2 z-10 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1" style={{ backgroundColor: primaryColor }}>
              <Layers className="h-3 w-3" />
              {product.variant_count}
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
            <Package className="h-16 w-16 opacity-30" style={{ color: primaryColor }} />
          )}
        </div>
      </Link>
      <CardContent className="p-4">
        <Link href={`/productos/${product.uuid}`}>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-1 group-hover:underline">
            {product.name}
          </h3>
        </Link>
        {product.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{product.description}</p>
        )}
        <div className="flex items-center justify-between">
          {price && (
            <span className="text-lg font-bold" style={{ color: primaryColor }}>
              ${Number(price.price).toLocaleString()}
            </span>
          )}
          {outOfStock ? (
            <span className="text-xs text-red-500 font-medium">Sin stock</span>
          ) : (
            <Button
              size="sm"
              onClick={(e) => { e.preventDefault(); onAddToCart() }}
              className={`transition-all ${isAdded ? 'bg-green-500 hover:bg-green-600' : ''}`}
              style={!isAdded ? { backgroundColor: primaryColor } : {}}
            >
              {isAdded ? <><Check className="h-4 w-4 mr-1" />Agregado</> : <><Plus className="h-4 w-4 mr-1" />Agregar</>}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ProductCardList({
  product,
  primaryColor,
  isAdded,
  onAddToCart
}: {
  product: Product
  primaryColor: string
  isAdded: boolean
  onAddToCart: () => void
}) {
  const price = product.product_prices?.[0]
  const stock = getAvailableStock(product)
  const outOfStock = stock !== null && stock <= 0
  const imgUrl = getProductImageUrl(product)

  return (
    <div className="flex gap-4 p-4 bg-white dark:bg-gray-800/50 rounded-xl border dark:border-gray-700 hover:shadow-md transition-shadow">
      <Link href={`/productos/${product.uuid}`} className="shrink-0">
        <div className="w-28 h-28 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 relative">
          {imgUrl ? (
            <Image src={imgUrl} alt={product.name} fill className="object-cover" sizes="112px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-8 w-8 opacity-30" style={{ color: primaryColor }} />
            </div>
          )}
          {outOfStock && (
            <span className="absolute top-1 left-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              Agotado
            </span>
          )}
        </div>
      </Link>
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <Link href={`/productos/${product.uuid}`}>
            <h3 className="font-semibold text-gray-900 dark:text-white hover:underline line-clamp-1">{product.name}</h3>
          </Link>
          {product.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{product.description}</p>
          )}
        </div>
        <div className="flex items-center justify-between mt-3">
          {price && (
            <span className="text-lg font-bold" style={{ color: primaryColor }}>
              ${Number(price.price).toLocaleString()}
            </span>
          )}
          {outOfStock ? (
            <span className="text-xs text-red-500 font-medium">Sin stock</span>
          ) : (
            <Button
              size="sm"
              onClick={onAddToCart}
              className={`transition-all ${isAdded ? 'bg-green-500 hover:bg-green-600' : ''}`}
              style={!isAdded ? { backgroundColor: primaryColor } : {}}
            >
              {isAdded ? <><Check className="h-4 w-4 mr-1" />Agregado</> : <><Plus className="h-4 w-4 mr-1" />Agregar</>}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Helper de paginación ---

function generatePageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | string)[] = []
  pages.push(1)

  if (current > 3) pages.push('...')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let i = start; i <= end; i++) pages.push(i)

  if (current < total - 2) pages.push('...')

  pages.push(total)
  return pages
}
