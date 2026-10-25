'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProductCard, getProductImageUrl, getProductPrice, getProductComparePrice } from './ProductCard'
import { getCartKey } from '@/lib/utils'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { BarraFiltrosProductos, SinResultadosFiltros, useFiltrosProductos } from './BarraFiltrosProductos'
import { ordenarListado, recorteListado, columnasEscritorio } from '@/lib/products/limiteListado'
import { PaginacionListado } from './PaginacionListado'
import { categoriasDisponibles, filtrarProductosPorCategorias, incluirSubcategorias, unirProductosDeCategoria } from '@/lib/products/filtrosProductos'
import { separacionTarjetas } from '@/lib/website/tarjetaProducto'
import { useEstiloTarjeta } from '@/components/site/TarjetaProductoContext'
import { SiLista } from '../ListRenderer'
import { listaDelInspector } from '@/lib/website/cascaronSeccion'

interface ProductsListProps {
  content: Record<string, any>
  primaryColor?: string
  data?: Record<string, any>
  organization?: { subdomain?: string; website_settings?: any }
}

export function ProductsList({ content, primaryColor = '#3B82F6', data, organization }: ProductsListProps) {
  const { ruta } = useRutaSitio()
  const separacion = separacionTarjetas(useEstiloTarjeta(content.product_card_style))
  const router = useRouter()
  const organizationSubdomain = organization?.subdomain || ''
  const branchId = (data?.branchId as number | null | undefined) ?? null
  const showBuyNow = organization?.website_settings?.show_buy_now_button !== false
  const allProducts = (data?.products || []) as any[]
  const [paginaListado, setPaginaListado] = useState(1)
  // Sin `include_subcategories` el filtro sigue siendo el id exacto (lo de hoy).
  const filtered = filtrarProductosPorCategorias(
    unirProductosDeCategoria(allProducts, data?.productosCategoria, content.selected_category_ids),
    content.selected_category_ids,
    data?.categories,
    incluirSubcategorias(content.include_subcategories, 'products_list'),
  )

  const sorted = ordenarListado(filtered, content.sort_order)
  const filtros = useFiltrosProductos(sorted, () => setPaginaListado(1))
  const listaPropia = listaDelInspector(content)
  const recorte = recorteListado(filtros.filtrados.length, paginaListado, { max_items: content.products_limit ? undefined : 12, show_pagination: false, ...content, columns: content.columns ?? content.desktop_columns ?? 1, rows: content.rows ?? content.desktop_rows, ...(listaPropia ? { pagination: 'none' } : {}) })
  const products = filtros.filtrados.slice(recorte.desde, recorte.hasta)

  const [addedToCart, setAddedToCart] = useState<Set<number>>(new Set())

  const addToCart = (product: any) => {
    const price = getProductPrice(product)
    if (price === null) return
    const host = typeof window !== 'undefined' ? window.location.hostname : ''
    const sub = organizationSubdomain || host.split('.')[0]
    const cartKey = getCartKey(sub, branchId)
    const cart = JSON.parse(localStorage.getItem(cartKey) || '[]')
    const idx = cart.findIndex((item: any) => item.id === product.id)
    if (idx >= 0) {
      cart[idx].quantity += 1
    } else {
      const imgUrl = getProductImageUrl(product)
      const cp = getProductComparePrice(product)
      cart.push({ id: product.id, name: product.name, price, quantity: 1, ...(imgUrl && { imageUrl: imgUrl }), ...(cp && { comparePrice: cp }) })
    }
    localStorage.setItem(cartKey, JSON.stringify(cart))
    window.dispatchEvent(new CustomEvent('cart-updated'))
    setAddedToCart((prev) => new Set(prev).add(product.id))
    setTimeout(() => {
      setAddedToCart((prev) => { const n = new Set(prev); n.delete(product.id); return n })
    }, 1500)
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

      {/* «Mostrar filtros» y «Mostrar buscador»: ausentes = sin barra, como antes de leerlos. */}
      {sorted.length > 0 && (
        <BarraFiltrosProductos
          categorias={categoriasDisponibles(sorted, data?.categories, content.selected_category_ids)}
          estado={filtros.estado}
          cambiar={filtros.cambiar}
          total={filtros.filtrados.length}
          primaryColor={primaryColor}
          mostrarFiltros={content.show_filters === true}
          mostrarBuscador={content.show_search === true}
          mostrarCategorias={content.show_categories !== false}
          content={content}
        />
      )}

      {products.length > 0 ? (
        (() => {
          const cols = columnasEscritorio(content.columns ?? content.desktop_columns, 1)
          const visibleProducts = products
          const isGrid = cols > 1
          return (
            <SiLista
              content={content}
              className={isGrid ? 'grid gap-4 max-w-6xl mx-auto' : separacion ? 'flex flex-col gap-4 max-w-4xl mx-auto' : 'space-y-4 max-w-4xl mx-auto'}
              style={isGrid ? { gridTemplateColumns: `repeat(${Math.min(cols, 4)}, minmax(0, 1fr))`, ...separacion } : separacion}
            >
              {visibleProducts.map((product: any) => {
                const isAdded = addedToCart.has(product.id)
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    primaryColor={primaryColor}
                    variant="list"
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
            </SiLista>
          )
        })()
      ) : filtros.activos ? (
        <SinResultadosFiltros onLimpiar={filtros.limpiar} primaryColor={primaryColor} />
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">📦</p>
          <p>No hay productos disponibles</p>
        </div>
      )}
      {!listaPropia && <PaginacionListado recorte={recorte} pagina={paginaListado} onPagina={setPaginaListado} content={content} color={primaryColor} />}
    </div>
  )
}
