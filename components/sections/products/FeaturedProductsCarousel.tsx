'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ProductCard, getProductImageUrl, getProductPrice, getProductComparePrice } from './ProductCard'
import { getCartKey } from '@/lib/utils'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { BarraFiltrosProductos, SinResultadosFiltros, useFiltrosProductos } from './BarraFiltrosProductos'
import { categoriasDisponibles } from '@/lib/products/filtrosProductos'
import { atributosCarrusel, leerOpcionesCarrusel } from '@/lib/carrusel/opcionesCarrusel'
import { desplazar } from '@/lib/carrusel/desplazamiento'
import { useAutoplayCarrusel } from '@/lib/carrusel/useCarrusel'

/**
 * Lo que hacía el carrusel antes de leer los interruptores «Reproducción automática», «Bucle
 * infinito» y «Deslizar con el dedo»: quieto, se detiene en los bordes y se desliza con el dedo
 * (desplazamiento nativo). Con la clave ausente se mantiene.
 */
const HOY = { autoplay: false, intervaloMs: 5000, bucle: false, pausarAlPasar: true, flechas: true, puntos: true, deslizar: true }

/** Las flechas aparecen al pasar el puntero; con el teclado, al recibir el foco. */
const FOCO_FLECHA = 'focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 dark:focus-visible:ring-white'

interface FeaturedProductsCarouselProps {
  content: Record<string, any>
  primaryColor?: string
  data?: { products?: any[]; categories?: any[]; branchId?: number | null }
  organization?: { subdomain?: string; website_settings?: any }
}

export function FeaturedProductsCarousel({ content, primaryColor = '#3B82F6', data, organization }: FeaturedProductsCarouselProps) {
  const { ruta } = useRutaSitio()
  const router = useRouter()
  const organizationSubdomain = organization?.subdomain || ''
  const branchId = data?.branchId ?? null
  const showBuyNow = organization?.website_settings?.show_buy_now_button !== false
  const allProducts = data?.products || []
  const maxItems = content.max_items || 8
  // Filtros y buscador del visitante sobre los ya cargados; el límite va después.
  const filtros = useFiltrosProductos(allProducts)
  const products = filtros.filtrados.slice(0, maxItems)

  // slides_per_view responsive: puede ser número o { desktop, tablet, mobile }
  const spv = content.slides_per_view
  const spvDesktop = (typeof spv === 'object' ? spv?.desktop : spv) || 4
  const spvTablet = (typeof spv === 'object' ? spv?.tablet : spv) || Math.min(3, spvDesktop)
  const spvMobile = (typeof spv === 'object' ? spv?.mobile : spv) || Math.min(2, spvDesktop)
  const cardWidthClass = `flex-shrink-0 w-[calc(${100 / spvMobile}%-${spvMobile > 1 ? '8px' : '0px'})] sm:w-[calc(${100 / spvTablet}%-${spvTablet > 1 ? '11px' : '0px'})] lg:w-[calc(${100 / spvDesktop}%-${spvDesktop > 1 ? '12px' : '0px'})] snap-start`

  const [addedToCart, setAddedToCart] = useState<Set<number>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [activePage, setActivePage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
    const scrollWidth = el.scrollWidth - el.clientWidth
    if (scrollWidth <= 0) { setTotalPages(1); setActivePage(0); return }
    const pages = Math.ceil(products.length / 2)
    setTotalPages(pages)
    setActivePage(Math.round((el.scrollLeft / scrollWidth) * (pages - 1)))
  }, [products.length])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateScrollState()
    el.addEventListener('scroll', updateScrollState, { passive: true })
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', updateScrollState); ro.disconnect() }
  }, [updateScrollState])

  const o = leerOpcionesCarrusel(content, HOY)
  const scroll = (dir: 'left' | 'right') => desplazar(scrollRef.current, dir === 'left' ? 'anterior' : 'siguiente', o.bucle, 0.8)
  const autoplay = useAutoplayCarrusel({
    activo: o.autoplay && products.length > 1,
    intervaloMs: o.intervaloMs,
    pausarAlPasar: o.pausarAlPasar,
    avanzar: () => desplazar(scrollRef.current, 'siguiente', o.bucle, 0.8),
  })
  // Con bucle, la flecha sigue en el borde para dar la vuelta (si hay algo que desplazar).
  const hayDesborde = canScrollLeft || canScrollRight
  const flechaIzq = canScrollLeft || (o.bucle && hayDesborde)
  const flechaDer = canScrollRight || (o.bucle && hayDesborde)

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
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-8">{content.subtitle}</p>
      )}

      {/* «Mostrar filtros» y «Mostrar buscador»: ausentes = sin barra, como antes de leerlos. */}
      {allProducts.length > 0 && (
        <BarraFiltrosProductos
          categorias={categoriasDisponibles(allProducts, data?.categories, content.selected_category_ids)}
          estado={filtros.estado}
          cambiar={filtros.cambiar}
          total={filtros.filtrados.length}
          primaryColor={primaryColor}
          mostrarFiltros={content.show_filters === true}
          mostrarBuscador={content.show_search === true}
          mostrarCategorias={content.show_categories !== false}
        />
      )}

      {products.length > 0 ? (
        <div className="relative group/carousel" aria-roledescription="carrusel" {...atributosCarrusel(o)} {...autoplay}>
          {flechaIzq && (
            <button
              type="button"
              onClick={() => scroll('left')}
              className={`absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-lg border dark:border-gray-700 flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity -translate-x-1/2 hover:scale-110 ${FOCO_FLECHA}`}
              style={{ color: primaryColor }}
              aria-label="Anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {flechaDer && (
            <button
              type="button"
              onClick={() => scroll('right')}
              className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-lg border dark:border-gray-700 flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity translate-x-1/2 hover:scale-110 ${FOCO_FLECHA}`}
              style={{ color: primaryColor }}
              aria-label="Siguiente"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
          <div
            ref={scrollRef}
            onScroll={updateScrollState}
            className={`flex gap-4 ${o.deslizar ? 'overflow-x-auto' : 'overflow-x-hidden touch-pan-y'} pb-4 snap-x snap-mandatory scrollbar-hide scroll-smooth`}
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {products.map((product: any) => {
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
                  className={cardWidthClass}
                />
              )
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center gap-1.5 mt-3">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const el = scrollRef.current
                    if (!el) return
                    const scrollWidth = el.scrollWidth - el.clientWidth
                    el.scrollTo({ left: (i / (totalPages - 1)) * scrollWidth, behavior: 'smooth' })
                  }}
                  className={`rounded-full transition-all ${i === activePage ? 'w-6 h-2' : 'w-2 h-2 bg-gray-300 dark:bg-gray-600'}`}
                  style={i === activePage ? { backgroundColor: primaryColor } : {}}
                  aria-label={`Ir a página ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      ) : filtros.activos ? (
        <SinResultadosFiltros onLimpiar={filtros.limpiar} primaryColor={primaryColor} />
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">⭐</p>
          <p>No hay productos destacados aún</p>
        </div>
      )}
    </div>
  )
}
