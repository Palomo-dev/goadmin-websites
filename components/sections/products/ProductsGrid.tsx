'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ProductCard } from './ProductCard'
import { BarraFiltrosProductos, useFiltrosProductos } from './BarraFiltrosProductos'
import { categoriasDisponibles } from '@/lib/products/filtrosProductos'
import { getCartKey } from '@/lib/utils'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'

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

interface ProductsGridProps {
  content: {
    title?: string
    subtitle?: string
    show_filters?: boolean
    show_search?: boolean
    show_categories?: boolean
    selected_category_ids?: number[]
    max_items?: number
    sort_order?: string
    filter?: string
    // Layout
    desktop_layout?: 'grid' | 'carousel' | 'list'
    mobile_layout?: 'grid' | 'list' | 'carousel'
    desktop_columns?: number
    // Card style
    card_radius?: number
    card_shadow?: string
    card_border_width?: number
    card_border_color?: string
    card_bg?: string
    card_padding?: number
    card_hover?: string
    image_fit?: string
    image_ratio?: string
    text_align?: string
    title_lines?: string
    show_description?: boolean
    price_style?: string
    show_compare_price?: boolean
    // Botones y badges (PRODUCT_CARD_INTERACTION_FIELDS)
    badges?: any[]
    card_buttons?: any[]
    buttons_position?: string
    buttons_layout?: string
    buttons_full_width?: boolean
    icon_only?: boolean
  }
  primaryColor?: string
  data?: { products?: any[]; categories?: any[]; branchId?: number | null }
  organization?: { subdomain?: string; website_settings?: any }
}

const ITEMS_PER_PAGE = 12

export function ProductsGrid({ content, primaryColor = '#3B82F6', data, organization }: ProductsGridProps) {
  const { ruta } = useRutaSitio()
  const router = useRouter()
  const organizationSubdomain = organization?.subdomain || ''
  const branchId = data?.branchId ?? null
  const showBuyNow = organization?.website_settings?.show_buy_now_button !== false
  const products = data?.products || []
  const categories = data?.categories || []
  const [addedToCart, setAddedToCart] = useState<Set<number>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  // Categorías únicas de los productos
  const availableCategories = useMemo(
    () => categoriasDisponibles(products, categories, content.selected_category_ids),
    [products, categories, content.selected_category_ids],
  )

  // Base: las categorías elegidas en la sección. Encima, filtros y buscador del visitante (en
  // memoria, sobre lo ya cargado).
  const baseProducts = useMemo(() => {
    const selectedIds = content.selected_category_ids || []
    return selectedIds.length > 0 ? products.filter((p: any) => selectedIds.includes(p.category_id)) : products
  }, [products, content.selected_category_ids])
  const filtros = useFiltrosProductos(baseProducts, () => setCurrentPage(1))
  const filteredProducts = filtros.filtrados
  const selectedCategory = filtros.estado.categoria
  const onlyOffers = filtros.estado.soloOfertas
  const busqueda = filtros.estado.busqueda.trim()

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const addToCart = (product: any) => {
    const price = getPrice(product)
    if (price === null) return

    const host = typeof window !== 'undefined' ? window.location.hostname : ''
    const subdomain = organizationSubdomain || host.split('.')[0]
    const cartKey = getCartKey(subdomain, branchId)
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

    // Feedback visual: marcar como agregado durante 1.5s
    setAddedToCart(prev => new Set(prev).add(product.id))
    setTimeout(() => {
      setAddedToCart(prev => {
        const next = new Set(prev)
        next.delete(product.id)
        return next
      })
    }, 1500)
  }

  const buyNow = (product: any) => {
    addToCart(product)
    router.push(ruta('/checkout'))
  }

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-6 text-gray-900 dark:text-white">{content.title}</h2>
      )}

      {/* Filtros — respeta show_filters del editor (default: true para compatibilidad).
          Buscador — show_search (default: false, como antes de leerlo). */}
      {products.length > 0 && (
        <BarraFiltrosProductos
          categorias={availableCategories}
          estado={filtros.estado}
          cambiar={filtros.cambiar}
          total={filteredProducts.length}
          primaryColor={primaryColor}
          mostrarFiltros={content.show_filters !== false}
          mostrarBuscador={content.show_search === true}
          mostrarCategorias={content.show_categories !== false}
        />
      )}

      {paginatedProducts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
          {paginatedProducts.map((product: any) => {
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
                branchId={branchId}
              />
            )
          })}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">📦</p>
          <p>{selectedCategory || onlyOffers || busqueda ? 'No hay productos con estos filtros' : 'No hay productos disponibles aún'}</p>
          {(selectedCategory || onlyOffers || busqueda) && (
            <button onClick={filtros.limpiar} className="mt-2 text-sm underline" style={{ color: primaryColor }}>Limpiar filtros</button>
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
