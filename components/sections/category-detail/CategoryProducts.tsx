'use client'
import { urlPublicaStorage } from '@/lib/storage/urlPublica'

/**
 * F9.4 — Sección category_products.
 *
 * Renderiza el grid de productos con paginación. Reutiliza ProductCard.
 * Reproduce el comportamiento del CategoryPageClient actual.
 */

import { useRouter } from 'next/navigation'
import Link from '@/components/site/Enlace'
import { Package, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CLAVES_PRODUCTOS_CATEGORIA_NUEVAS, normalizarProductosCategoria } from '@/lib/website/v2/contrato/seccionesTienda'
import { urlListadoCategoria } from './columnasCategoria'
import { ProductCard } from '@/components/sections/products/ProductCard'
import { getCartKey } from '@/lib/utils'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { separacionTarjetas } from '@/lib/website/tarjetaProducto'
import { useEstiloTarjeta } from '@/components/site/TarjetaProductoContext'
import { rejillaConLineas } from '@/lib/website/tarjetaPlantillasTienda'

export const CONTENT_KEYS = ['columns', 'max_items', 'empty_message', ...CLAVES_PRODUCTOS_CATEGORIA_NUEVAS] as const

/**
 * Clases literales de la rejilla (Tailwind las necesita escritas tal cual). 4 columnas = la de
 * siempre (3 desde `lg`, 4 desde `xl`). Figma «16 Sitio web», bloque 6.
 */
const COLUMNAS_COMPUTADOR: Record<number, string> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-3 xl:grid-cols-4',
  5: 'lg:grid-cols-4 xl:grid-cols-5',
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://taqjemqjtumhwptchcxk.supabase.co'

interface CategoryProductsProps {
  content: {
    columns?: number
    max_items?: number
    empty_message?: string
    /** Columnas en el celular y paginación: `normalizarProductosCategoria`. */
    [clave: string]: unknown
  }
  primaryColor?: string
  data?: {
    products?: any[]
    categorySlug?: string
    total?: number
    totalPages?: number
    currentPage?: number
    currentView?: string
    currentSort?: string
    currentSubcategory?: string
    ordenPorDefecto?: string
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
  return urlPublicaStorage(storagePath, 'product-images', SUPABASE_URL)
}

export function CategoryProducts({ content, primaryColor = '#3B82F6', data }: CategoryProductsProps) {
  const { ruta } = useRutaSitio()
  const estiloSeccion = useEstiloTarjeta((content as { product_card_style?: unknown } | undefined)?.product_card_style)
  const separacion = separacionTarjetas(estiloSeccion)
  // card_grid_lines (plantillas de tienda): sin la clave es null y la rejilla queda igual que hoy.
  const lineas = rejillaConLineas(estiloSeccion)
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
  // Sin claves: 2 columnas en el celular, 3-4 en computador y números (la rejilla de siempre).
  const rejilla = normalizarProductosCategoria(content as Record<string, unknown>)
  const claseRejilla = `${rejilla.columnasCelular === 1 ? 'grid-cols-1' : 'grid-cols-2'} sm:grid-cols-2 ${COLUMNAS_COMPUTADOR[rejilla.columnas] ?? COLUMNAS_COMPUTADOR[4]}`

  const [addedToCart, setAddedToCart] = useState<Set<number>>(new Set())

  // La paginación conserva el orden, la subcategoría y la vista (antes los perdía).
  const urlCon = (pagina: { page?: number; hasta?: number }) =>
    ruta(
      urlListadoCategoria(
        categorySlug,
        { orden: data?.currentSort, sub: data?.currentSubcategory || undefined, vista: view, ...pagina },
        data?.ordenPorDefecto || 'best_selling',
      ),
    )

  const handlePageChange = (newPage: number) => {
    router.push(urlCon({ page: newPage }))
  }

  // «Ver más» y «Al bajar»: `currentPage` = cuántas páginas van cargadas juntas (`?hasta=`).
  const hayMas = rejilla.paginacion !== 'numbers' && currentPage < totalPages
  const [cargando, setCargando] = useState(false)
  useEffect(() => setCargando(false), [currentPage])
  const cargarMas = () => {
    if (cargando) return
    setCargando(true)
    router.push(urlCon({ hasta: currentPage + 1 }), { scroll: false })
  }
  const centinela = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (rejilla.paginacion !== 'infinite' || !hayMas || typeof IntersectionObserver === 'undefined') return
    const el = centinela.current
    if (!el) return
    const obs = new IntersectionObserver((e) => {
      if (e.some((x) => x.isIntersecting)) cargarMas()
    }, { rootMargin: '400px 0px' })
    obs.observe(el)
    return () => obs.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rejilla.paginacion, hayMas, currentPage])

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
    router.push(ruta('/checkout'))
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-20 border-2 border-dashed dark:border-gray-700 rounded-xl">
        <Package className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <p className="text-gray-500 dark:text-gray-400 text-lg">{emptyMessage}</p>
        <Link
          href={ruta('/productos')}
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
        <div className={`grid ${claseRejilla} gap-3 sm:gap-6${lineas ? ` ${lineas.className}` : ''}`} style={lineas ? { ...separacion, ...lineas.style } : separacion}>
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" style={separacion} data-vista-lista="">
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

      {/* «Ver más» / «Al bajar» (el botón queda también como respaldo de «Al bajar») */}
      {hayMas && (
        <div ref={centinela} className="mt-10 flex justify-center" data-paginacion-categoria={rejilla.paginacion}>
          <button
            type="button"
            onClick={cargarMas}
            disabled={cargando}
            aria-busy={cargando}
            className="min-h-[44px] rounded-lg border px-6 text-sm font-semibold transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            {cargando ? 'Cargando…' : 'Ver más productos'}
          </button>
        </div>
      )}

      {/* Paginación */}
      {rejilla.paginacion === 'numbers' && totalPages > 1 && (
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
