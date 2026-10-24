'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ProductCard } from './ProductCard'
import { BarraFiltrosProductos, useFiltrosProductos } from './BarraFiltrosProductos'
import { categoriasDisponibles, filtrarProductosPorCategorias, incluirSubcategorias, unirProductosDeCategoria } from '@/lib/products/filtrosProductos'
import { ordenarListado, recorteListado } from '@/lib/products/limiteListado'
import { clasesColumnasProductos } from '@/lib/website/presentacionTienda'
import { separacionTarjetas } from '@/lib/website/tarjetaProducto'
import { useEstiloTarjeta } from '@/components/site/TarjetaProductoContext'
import { clasesColumnasListado, leerPresentacion, pedidoServidor, recortePresentacion } from '@/lib/products/fuenteListado'
import { listaDelInspector } from '@/lib/website/cascaronSeccion'
import { SiLista } from '../ListRenderer'
import { isOutOfStock } from '@/lib/stock'
import { BarraListado } from './BarraListado'
import { resolverPaginacion } from '@/lib/website/v2/paginacionCarrusel'
import { Paginacion } from '@/components/site/Paginacion'
import { useEsMovilLista, useListaCarrusel, usePaginaLista } from '@/components/site/listaCarrusel'
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
    product_card_style?: unknown
    title?: string
    subtitle?: string
    show_filters?: boolean
    show_search?: boolean
    show_categories?: boolean
    selected_category_ids?: number[]
    include_subcategories?: boolean
    max_items?: number
    rows?: number
    columns?: unknown
    show_pagination?: boolean
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
    exclude_out_of_stock?: boolean
    chip_source?: string
    chip_category_ids?: number[]
    pagination?: string
    per_page?: number
    products_limit?: number
  }
  primaryColor?: string
  data?: { products?: any[]; productosCategoria?: any[]; categories?: any[]; branchId?: number | null; listados?: Record<string, { products: any[]; total: number }> }
  organization?: { subdomain?: string; website_settings?: any }
  sectionId?: string
}

export function ProductsGrid({ content, primaryColor = '#3B82F6', data, organization, sectionId }: ProductsGridProps) {
  const { ruta } = useRutaSitio()
  const separacion = separacionTarjetas(useEstiloTarjeta(content.product_card_style))
  const router = useRouter()
  const organizationSubdomain = organization?.subdomain || ''
  const branchId = data?.branchId ?? null
  const showBuyNow = organization?.website_settings?.show_buy_now_button !== false
  const [addedToCart, setAddedToCart] = useState<Set<number>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [vistos, setVistos] = useState<any[] | null>(null)
  const [totalRemoto, setTotalRemoto] = useState<number | null>(null)
  const [extra, setExtra] = useState<any[]>([])
  const cargando = useRef(false)
  const sentinel = useRef<HTMLDivElement>(null)
  const saltoFiltro = useRef(true)
  const irRef = useRef<(n: number) => void>(() => {})
  const listado = sectionId ? data?.listados?.[sectionId] : undefined
  const products = vistos ?? listado?.products ?? data?.products ?? []
  const categories = data?.categories || []
  const globalLista = useListaCarrusel()
  const movil = useEsMovilLista()
  const paginacion = resolverPaginacion(
    { legado: 'grilla', porPagina: 12 },
    globalLista.paginacion,
    (content as { paginacion?: unknown }).paginacion,
    movil,
  )
  // Categorías únicas de los productos
  const availableCategories = useMemo(
    () => categoriasDisponibles(products, categories, content.selected_category_ids),
    [products, categories, content.selected_category_ids],
  )

  // Base: las categorías elegidas en la sección. Encima, filtros y buscador del visitante (en
  // memoria, sobre lo ya cargado).
  const baseProducts = useMemo(() => {
    // El listado del servidor ya filtró categorías, hijas y agotados. Sin él, el
    // filtro sigue siendo el id exacto salvo que la sección pida subcategorías.
    if (listado) return products
    const fuente = unirProductosDeCategoria(products, data?.productosCategoria, content.selected_category_ids)
    const base = filtrarProductosPorCategorias(
      fuente,
      content.selected_category_ids,
      categories,
      incluirSubcategorias(content.include_subcategories, 'products_grid'),
    )
    const ordenados = ordenarListado(base, content.sort_order)
    return content.exclude_out_of_stock === true
      ? ordenados.filter((p: any) => !isOutOfStock(p))
      : ordenados
  }, [products, data?.productosCategoria, categories, content.selected_category_ids, content.include_subcategories, content.sort_order, content.exclude_out_of_stock, listado])
  const filtros = useFiltrosProductos(baseProducts, () => irRef.current(1))
  const filteredProducts = filtros.filtrados
  const selectedCategory = filtros.estado.categoria
  const onlyOffers = filtros.estado.soloOfertas
  const busqueda = filtros.estado.busqueda.trim()

  const ajusteLista = paginacion.activo && !listado
  const sonda = recorteListado(filteredProducts.length, 1, content, ajusteLista ? paginacion.porPagina : undefined)
  const lista = usePaginaLista(ajusteLista, sonda.paginas)
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

  const presentacion = leerPresentacion(content)
  const paginaCliente = ajusteLista ? lista.pagina : currentPage
  const recorteCliente = listado || ajusteLista ? null : recortePresentacion(filteredProducts.length, paginaCliente, presentacion)
  const recorte = recorteCliente ?? recorteListado(
    filteredProducts.length,
    paginaCliente,
    content,
    ajusteLista ? paginacion.porPagina : undefined,
  )
  const porPagina = ajusteLista
    ? paginacion.porPagina
    : presentacion?.perPage ?? pedidoServidor(content)?.limit ?? 12
  const paginasServidor = listado && presentacion?.pagination === 'pages'
    ? Math.max(1, Math.ceil((totalRemoto ?? listado.total) / porPagina))
    : null
  const totalPages = paginasServidor ?? (listado && presentacion?.pagination !== 'pages' ? 1 : recorte.paginas)
  const acumulable = ajusteLista && (paginacion.estilo === 'cargar_mas' || paginacion.estilo === 'infinito')
  const paginatedProducts = listado
    ? filteredProducts
    : acumulable
      ? filteredProducts.slice(0, recorte.hasta)
      : filteredProducts.slice(recorte.desde, recorte.hasta)
  irRef.current = (n: number) => {
    setCurrentPage(n)
    if (ajusteLista) lista.ir(n)
  }
  const barraNueva = !!(presentacion && (presentacion.chipStyle || presentacion.filterPosition || presentacion.filters || presentacion.showSort === false || presentacion.showCount === false || presentacion.chipMobile))
  const columnas = clasesColumnasListado(presentacion) ?? clasesColumnasProductos(content.columns)
  const claseRejilla = presentacion?.displayMode === 'list'
    ? 'flex flex-col gap-4'
    : presentacion?.displayMode === 'carousel'
      ? 'flex gap-4 overflow-x-auto pb-2'
      : presentacion?.displayMode === 'masonry'
        ? 'columns-2 gap-4 md:columns-3'
        : columnas
  const estiloTarjeta = content.product_card_style && typeof content.product_card_style === 'object'
    ? { ...content, ...(content.product_card_style as Record<string, unknown>) }
    : content
  const marcas = Array.from(new Set(products.map((p: any) => p.brand).filter((m: unknown): m is string => typeof m === 'string' && m.length > 0)))
  const verMas = presentacion?.pagination === 'load_more' || presentacion?.pagination === 'infinite'
  const mostrados = extra.length ? [...paginatedProducts, ...extra] : paginatedProducts
  const listaShell = listaDelInspector(content)
  const fuenteTarjetas = listaShell ? filteredProducts : mostrados
  const categoriasChips = presentacion?.chipSource === 'all'
    ? categories.map((c: any) => ({ id: c.id, name: c.name }))
    : presentacion?.chipSource === 'manual' && presentacion.chipCategoryIds?.length
      ? presentacion.chipCategoryIds.map((id) => categories.find((c: any) => c.id === id) || availableCategories.find((c: any) => c.id === id)).filter(Boolean)
      : availableCategories
  const opcionesAtributo = (() => {
    const vistosAtributos = new Map<string, string>()
    for (const p of products as any[]) {
      const grupos = p?.atributos
      if (!grupos || typeof grupos !== 'object') continue
      for (const [nombre, valores] of Object.entries(grupos)) {
        const lista = Array.isArray(valores) ? valores : typeof valores === 'string' ? [valores] : []
        for (const valor of lista) {
          if (typeof valor !== 'string' || !valor) continue
          vistosAtributos.set(`${nombre}::${valor}`, `${nombre}: ${valor}`)
        }
      }
    }
    return [...vistosAtributos.entries()].map(([id, etiqueta]) => ({ id, etiqueta }))
  })()

  const pedir = async (desde: number) => {
    const cuerpo: Record<string, unknown> = { ...content, desde }
    if (filtros.estado.categoria) cuerpo.categoria = filtros.estado.categoria
    if (filtros.estado.orden !== 'default') cuerpo.orden = filtros.estado.orden
    const res = await fetch('/api/catalogo/listado', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })
    if (!res.ok) return null
    const json = await res.json()
    return Array.isArray(json.products) ? json as { products: any[]; total: number } : null
  }

  const cargarMas = async () => {
    if (!listado || cargando.current) return
    const ya = products.length + extra.length
    if ((totalRemoto ?? listado.total) <= ya) return
    cargando.current = true
    try {
      const json = await pedir(ya)
      if (json?.products.length) setExtra((prev) => [...prev, ...json.products])
    } finally {
      cargando.current = false
    }
  }

  const irPagina = async (pagina: number) => {
    if (!(listado && presentacion?.pagination === 'pages')) {
      setCurrentPage(pagina)
      return
    }
    if (cargando.current) return
    cargando.current = true
    try {
      const json = await pedir((pagina - 1) * porPagina)
      if (!json) return
      setVistos(json.products)
      setTotalRemoto(json.total)
      setExtra([])
      setCurrentPage(pagina)
    } finally {
      cargando.current = false
    }
  }

  const hayListado = !!listado
  useEffect(() => {
    if (!hayListado) return
    if (saltoFiltro.current) {
      saltoFiltro.current = false
      return
    }
    let vivo = true
    void (async () => {
      const json = await pedir(0)
      if (!vivo || !json) return
      setVistos(json.products)
      setTotalRemoto(json.total)
      setExtra([])
      setCurrentPage(1)
    })()
    return () => { vivo = false }
  }, [filtros.estado.categoria, filtros.estado.orden, hayListado])

  useEffect(() => {
    if (presentacion?.pagination !== 'infinite') return
    const nodo = sentinel.current
    if (!nodo) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void cargarMas()
    }, { rootMargin: '240px' })
    io.observe(nodo)
    return () => io.disconnect()
  }, [presentacion?.pagination, mostrados.length])

  return (
    <div className={presentacion?.filterPosition === 'side' ? 'md:flex md:items-start md:gap-6' : undefined}>
      {content.title && (
        <h2 className="titulo-legado text-2xl md:text-3xl font-bold text-center mb-6 text-gray-900 dark:text-white">{content.title}</h2>
      )}

      {/* Filtros — respeta show_filters del editor (default: true para compatibilidad).
          Buscador — show_search (default: false, como antes de leerlo). */}
      {products.length > 0 && barraNueva && presentacion && (
        <BarraListado
          presentacion={presentacion}
          categorias={categoriasChips}
          estado={filtros.estado}
          cambiar={filtros.cambiar}
          total={totalRemoto ?? listado?.total ?? recorte.universo}
          primaryColor={primaryColor}
          mostrarFiltros={content.show_filters !== false}
          mostrarCategorias={content.show_categories !== false}
          marcas={marcas}
          atributos={opcionesAtributo}
        />
      )}
      {products.length > 0 && !barraNueva && (
        <BarraFiltrosProductos
          categorias={categoriasChips}
          estado={filtros.estado}
          cambiar={filtros.cambiar}
          total={recorte.universo}
          primaryColor={primaryColor}
          mostrarFiltros={content.show_filters !== false}
          mostrarBuscador={content.show_search === true}
          mostrarCategorias={content.show_categories !== false}
          content={content}
        />
      )}

      {(listaShell ? fuenteTarjetas : mostrados).length > 0 ? (
        <SiLista content={content} className={claseRejilla} style={separacion}>
          {(listaShell ? fuenteTarjetas : mostrados).map((product: any) => {
            const isAdded = addedToCart.has(product.id)
            return (
              <ProductCard
                key={product.id}
                product={product}
                primaryColor={primaryColor}
                variant="grid"
                cardStyle={estiloTarjeta}
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
        </SiLista>
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
      {!listaShell && !ajusteLista && verMas && (totalRemoto ?? listado?.total ?? 0) > mostrados.length && (
        <div className="mt-8 flex justify-center">
          <button type="button" onClick={cargarMas} className="rounded-full px-5 py-2 text-sm font-medium text-white" style={{ backgroundColor: primaryColor }}>Ver más</button>
          {presentacion?.pagination === 'infinite' && <div ref={sentinel} className="h-px w-full" aria-hidden="true" />}
        </div>
      )}
      {!listaShell && ajusteLista && (
        <Paginacion
          pagina={lista.pagina}
          totalPaginas={totalPages}
          totalItems={recorte.universo}
          porPagina={paginacion.porPagina}
          resuelta={paginacion}
          color={primaryColor}
          pathname={lista.pathname}
          search={lista.search}
          onIr={lista.ir}
        />
      )}
      {!listaShell && !ajusteLista && !verMas && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-8">
          <button
            onClick={() => void irPagina(Math.max(1, currentPage - 1))}
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
                  onClick={() => void irPagina(page)}
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
            onClick={() => void irPagina(Math.min(totalPages, currentPage + 1))}
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
