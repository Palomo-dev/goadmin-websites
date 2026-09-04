'use client'

/**
 * F9.4 — Sección category_products.
 *
 * Renderiza el grid de productos con paginación. Reutiliza ProductCard.
 * Reproduce el comportamiento del CategoryPageClient actual.
 */

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Package, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { ProductCard } from '@/components/sections/products/ProductCard'
import { getCartKey } from '@/lib/utils'

export const CONTENT_KEYS = ['columns', 'max_items', 'empty_message'] as const

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

interface CategoryProductsProps {
  content: {
    columns?: number
    max_items?: number
    empty_message?: string
  }
  primaryColor?: string
  data?: {
    products?: any[]
    categorySlug?: string
    total?: number
    totalPages?: number
    currentPage?: number
    currentView?: string
    organizationSubdomain?: string
    showBuyNow?: boolean
    branchId?: number | null
  }
}

function getProductImageUrl(product: any): string | null {
  if (!product.product_images || product.product_images.length === 0) return null
  const primaryImage = product.product_images.find((img: any) => img.is_primary)
  const image = primaryImage || product.product_images[0]
  const storagePath = image.storage_path || image.shared_images?.storage_path
  if (!storagePath) return null
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${storagePath}`
}

export function CategoryProducts({ content, primaryColor = '#3B82F6', data }: CategoryProductsProps) {
  const router = useRouter()
  const products = data?.products || []
  const categorySlug = data?.categorySlug || ''
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const currentPage = data?.currentPage ?? 1
  const view = (data?.currentView || 'grid') as 'grid' | 'list'
  const organizationSubdomain = data?.organizationSubdomain || ''
  const showBuyNow = data?.showBuyNow ?? true
  const branchId = data?.branchId ?? null
  const emptyMessage = content.empty_message || 'No hay productos en esta categoría'

  const [addedToCart, setAddedToCart] = useState<Set<number>>(new Set())

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams()
    const values = {
      page: String(currentPage),
      ...overrides,
    }
    Object.entries(values).forEach(([key, val]) => {
      if (val && val !== '1') {
        params.set(key, val)
      }
    })
    const qs = params.toString()
    return `/categorias/${categorySlug}${qs ? `?${qs}` : ''}`
  }

  const handlePageChange = (newPage: number) => {
    router.push(buildUrl({ page: String(newPage) }))
  }

  const addToCart = (product: any) => {
    const price = product.product_prices?.[0]?.price || 0
    const cartKey = getCartKey(organizationSubdomain, branchId)
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
        ...(imgUrl && { imageUrl: imgUrl }),
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

  const buyNow = (product: any) => {
    addToCart(product)
    router.push('/checkout')
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-20 border-2 border-dashed dark:border-gray-700 rounded-xl">
        <Package className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <p className="text-gray-500 dark:text-gray-400 text-lg">{emptyMessage}</p>
        <Link
          href="/productos"
          className="inline-block mt-4 text-sm font-medium hover:underline"
          style={{ color: primaryColor }}
        >
          Ver todos los productos
        </Link>
      </div>
    )
  }

  return (
    <>
      {view === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
          {products.map((product: any) => (
            <ProductCard
              key={product.id}
              product={product}
              primaryColor={primaryColor}
              variant="grid"
              isAdded={addedToCart.has(product.id)}
              onAddToCart={() => addToCart(product)}
              onBuyNow={() => buyNow(product)}
              showBuyNow={showBuyNow}
              organizationSubdomain={organizationSubdomain}
              branchId={branchId}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {products.map((product: any) => (
            <ProductCard
              key={product.id}
              product={product}
              primaryColor={primaryColor}
              variant="list"
              isAdded={addedToCart.has(product.id)}
              onAddToCart={() => addToCart(product)}
              onBuyNow={() => buyNow(product)}
              showBuyNow={showBuyNow}
              organizationSubdomain={organizationSubdomain}
              branchId={branchId}
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
  )
}

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
