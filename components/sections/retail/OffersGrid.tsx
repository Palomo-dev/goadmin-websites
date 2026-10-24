'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ProductCard } from '@/components/sections/products/ProductCard'
import { getCartKey } from '@/lib/utils'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { BuscadorProductos } from '@/components/sections/products/BarraFiltrosProductos'
import { clasesColumnasProductos, estiloChipFiltro } from '@/lib/website/presentacionTienda'
import { coincideBusqueda, filtrarProductosPorCategorias, incluirSubcategorias } from '@/lib/products/filtrosProductos'
import { separacionTarjetas } from '@/lib/website/tarjetaProducto'
import { useEstiloTarjeta } from '@/components/site/TarjetaProductoContext'
import { ordenInicialOfertas, ordenarListado, recorteListado, type OrdenOfertas } from '@/lib/products/limiteListado'
import { listaDelInspector } from '@/lib/website/cascaronSeccion'
import { SiLista } from '../ListRenderer'
import { resolverPaginacion } from '@/lib/website/v2/paginacionCarrusel'
import { Paginacion } from '@/components/site/Paginacion'
import { useEsMovilLista, useListaCarrusel, usePaginaLista } from '@/components/site/listaCarrusel'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

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
    product_card_style?: unknown
    title?: string
    subtitle?: string
    selected_category_ids?: number[]
    include_subcategories?: boolean
    max_items?: number
    rows?: number
    columns?: unknown
    show_pagination?: boolean
    sort_order?: string
    show_filters?: boolean
    show_search?: boolean
    // PRODUCT_CARD_INTERACTION_FIELDS (los mismos que lee ProductsGrid)
    badges?: any[]
    card_buttons?: any[]
    buttons_position?: string
    buttons_layout?: string
    buttons_full_width?: boolean
    icon_only?: boolean
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
  data?: { offerProducts?: any[]; categories?: any[]; branchId?: number | null }
  branchId?: number | null
}

export function OffersGrid({ content, primaryColor = '#3B82F6', organization, data, branchId }: OffersGridProps) {
  const { ruta } = useRutaSitio()
  const separacion = separacionTarjetas(useEstiloTarjeta(content.product_card_style))
  const router = useRouter()
  const showBuyNow = organization?.website_settings?.show_buy_now_button !== false
  const manualOffers = content.offers || []
  const products = data?.offerProducts || []
  const effectiveBranchId = branchId ?? data?.branchId ?? null
  const [addedToCart, setAddedToCart] = useState<Set<number>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const globalLista = useListaCarrusel()
  const movil = useEsMovilLista()
  const paginacion = resolverPaginacion({ legado: 'grilla', porPagina: 12 }, globalLista.paginacion, (content as { paginacion?: unknown }).paginacion, movil)
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [ordenVisitante, setOrdenVisitante] = useState<OrdenOfertas | null>(null)
  const sortBy = ordenVisitante ?? ordenInicialOfertas(content.sort_order)
  const [busqueda, setBusqueda] = useState('')
  // «Mostrar filtros»: esta sección siempre los pintó (ausente = se muestran). «Mostrar buscador»:
  // ausente = sin buscador, como antes de leerlo. Ambos trabajan sobre las ofertas ya cargadas.
  const showFilters = content.show_filters !== false
  const showSearch = content.show_search === true

  const categories = useMemo(() => {
    const catMap = new Map<number, string>()
    products.forEach((p: any) => {
      if (p.category_id && p.categories?.name) catMap.set(p.category_id, p.categories.name)
    })
    const allCats = Array.from(catMap.entries()).map(([id, name]) => ({ id, name }))
    const selectedIds = content.selected_category_ids || []
    if (selectedIds.length === 0) return allCats
    return selectedIds
      .map((id: number) => allCats.find((c) => c.id === id))
      .filter(Boolean) as { id: number; name: string }[]
  }, [products, content.selected_category_ids])

  const filteredProducts = useMemo(() => {
    // Sin `include_subcategories` el filtro sigue siendo el id exacto (lo de hoy).
    const baseProducts = filtrarProductosPorCategorias(
      products,
      content.selected_category_ids,
      data?.categories,
      incluirSubcategorias(content.include_subcategories, 'offers'),
    )
    let result = selectedCategory ? baseProducts.filter((p: any) => p.category_id === selectedCategory) : [...baseProducts]
    if (busqueda.trim()) result = result.filter((p: any) => coincideBusqueda(p, busqueda))
    if (sortBy === 'discount') result.sort((a: any, b: any) => getDiscount(b) - getDiscount(a))
    else result = ordenarListado(result, sortBy)
    return result
  }, [products, selectedCategory, sortBy, busqueda, content.selected_category_ids, content.include_subcategories, data?.categories])

  const porPagina = paginacion.activo ? paginacion.porPagina : undefined
  const sonda = recorteListado(filteredProducts.length, 1, content, porPagina)
  const lista = usePaginaLista(paginacion.activo, sonda.paginas)
  const pagina = paginacion.activo ? lista.pagina : currentPage
  const recorte = recorteListado(filteredProducts.length, pagina, content, porPagina)
  const totalPages = recorte.paginas
  const acumulable = paginacion.activo && (paginacion.estilo === 'cargar_mas' || paginacion.estilo === 'infinito')
  const paginatedProducts = acumulable ? filteredProducts.slice(0, recorte.hasta) : filteredProducts.slice(recorte.desde, recorte.hasta)
  const resetPage = () => setCurrentPage(1)

  const addToCart = (product: any) => {
    const price = Number(product.product_prices?.[0]?.price || 0)
    if (!price) return
    const subdomain = organization?.subdomain || (typeof window !== 'undefined' ? window.location.hostname.split('.')[0] : '')
    const cartKey = getCartKey(subdomain, effectiveBranchId)
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
    router.push(ruta('/checkout'))
  }

  return (
    <div>
      {content.title && (
        <h2 className="titulo-legado text-2xl md:text-3xl font-bold text-center mb-3 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-8">{content.subtitle}</p>
      )}

      {/* Banners manuales (si los hay) */}
      {manualOffers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {manualOffers.map((offer, i) => (
            <div key={i} className="rounded-xl overflow-hidden border dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
              {offer.image_url && <img src={offer.image_url} alt={offer.title} className="w-full h-48 object-cover" loading="lazy" />}
              <div className="p-5">
                {offer.discount && (
                  <span className="inline-block px-3 py-1 rounded-full text-sm font-bold text-white mb-3" style={{ backgroundColor: primaryColor }}>{offer.discount}</span>
                )}
                <h3 className="font-bold text-lg mb-1 text-gray-900 dark:text-white">{offer.title}</h3>
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
          {(showFilters || showSearch) && (
          <div className="mb-6 space-y-3">
            {showSearch && (
              <div className="flex items-center gap-3">
                <BuscadorProductos valor={busqueda} onChange={(v) => { setBusqueda(v); resetPage() }} placeholder="Buscar ofertas…" />
                {!showFilters && <span className="text-xs text-gray-400 ml-auto" aria-live="polite">{recorte.universo} ofertas</span>}
              </div>
            )}
            {showFilters && categories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                <button
                  onClick={() => { setSelectedCategory(null); resetPage() }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all border ${estiloChipFiltro(!selectedCategory, primaryColor, content).className}`}
                  style={estiloChipFiltro(!selectedCategory, primaryColor, content).style}
                >Todos</button>
                {categories.map((cat) => {
                  const activo = estiloChipFiltro(selectedCategory === cat.id, primaryColor, content)
                  return (
                  <button
                    key={cat.id}
                    onClick={() => { setSelectedCategory(selectedCategory === cat.id ? null : cat.id); resetPage() }}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all border ${activo.className}`}
                    style={activo.style}
                  >{cat.name}</button>
                  )
                })}
              </div>
            )}
            {showFilters && (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={sortBy}
                onChange={(e) => { setOrdenVisitante(e.target.value as OrdenOfertas); resetPage() }}
                className="px-3 py-1.5 rounded-full text-xs sm:text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 outline-none"
              >
                <option value="sales">🔥 Más vendidos</option>
                <option value="newest">Más nuevos</option>
                <option value="discount">% Mayor descuento</option>
                <option value="price_asc">Precio: menor a mayor</option>
                <option value="price_desc">Precio: mayor a menor</option>
                <option value="name">Nombre A-Z</option>
              </select>
              <span className="text-xs text-gray-400 ml-auto">{recorte.universo} ofertas</span>
            </div>
            )}
          </div>
          )}

          {/* Grid */}
          {(listaDelInspector(content) ? filteredProducts : paginatedProducts).length > 0 ? (
            <SiLista content={content} className={clasesColumnasProductos(content.columns)} style={separacion}>
              {(listaDelInspector(content) ? filteredProducts : paginatedProducts).map((product: any) => {
                const isAdded = addedToCart.has(product.id)
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    primaryColor={primaryColor}
                    variant="grid"
                    cardStyle={content}
                    // Botones e insignias del editor, como en products_grid y featured_products.
                    // Ausentes: la tarjeta usa sus botones e insignias por defecto, como antes.
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
                    organizationSubdomain={organization?.subdomain}
                    branchId={effectiveBranchId}
                  />
                )
              })}
            </SiLista>
          ) : (
            <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
              <p className="text-4xl mb-3">📦</p>
              <p>No hay ofertas con estos filtros</p>
              <button onClick={() => { setSelectedCategory(null); setBusqueda(''); resetPage() }} className="mt-2 text-sm underline" style={{ color: primaryColor }}>Limpiar filtros</button>
            </div>
          )}

          {/* Paginación */}
          {!listaDelInspector(content) && totalPages > 1 && (
            paginacion.activo ? (
              <Paginacion pagina={lista.pagina} totalPaginas={totalPages} totalItems={recorte.universo} porPagina={paginacion.porPagina} resuelta={paginacion} color={primaryColor} pathname={lista.pathname} search={lista.search} onIr={lista.ir} />
            ) : (
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
            )
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
