'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'

interface CategoriesGridProps {
  content: {
    title?: string
    subtitle?: string
    show_count?: boolean
    max_items?: number
    shape?: 'square' | 'round'
    desktop_layout?: 'grid' | 'carousel' | 'list'
    desktop_columns?: number
    desktop_rows?: number
    mobile_layout?: 'grid' | 'list' | 'carousel'
    selected_category_ids?: number[]
  }
  primaryColor?: string
  data?: { categories?: any[] }
}

function getGridClass(count: number): string {
  if (count <= 2) return 'grid-cols-2'
  if (count === 3) return 'grid-cols-2 sm:grid-cols-3'
  if (count === 4) return 'grid-cols-2 lg:grid-cols-4'
  if (count === 5) return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
  return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
}

function CategoryCard({ cat, isRound, showCount, primaryColor }: {
  cat: any; isRound: boolean; showCount?: boolean; primaryColor?: string
}) {
  return (
    <Link
      href={`/categorias/${cat.slug}`}
      className={`block group relative overflow-hidden bg-gray-100 hover:shadow-lg transition-shadow ${
        isRound ? 'rounded-full aspect-square' : 'rounded-xl aspect-[4/3]'
      }`}
    >
      {cat.image_url ? (
        <img
          src={cat.image_url}
          alt={cat.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          loading="lazy"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ backgroundColor: `${primaryColor || '#8B6914'}15` }}
        >
          <span className="text-4xl">🏷️</span>
        </div>
      )}
      <div className={`absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-center ${isRound ? 'p-2' : 'p-4'}`}>
        <div className={isRound ? 'text-center' : ''}>
          <h3 className={`text-white font-semibold ${isRound ? 'text-sm' : 'text-lg'}`}>{cat.name}</h3>
          {showCount && cat.product_count != null && (
            <span className="text-white/80 text-sm">{cat.product_count} productos</span>
          )}
        </div>
      </div>
    </Link>
  )
}

function MobileListCard({ cat, isRound, showCount, primaryColor }: {
  cat: any; isRound: boolean; showCount?: boolean; primaryColor?: string
}) {
  return (
    <Link
      href={`/categorias/${cat.slug}`}
      className="group flex items-center gap-4 rounded-xl p-3 bg-gray-50 dark:bg-gray-800/50 hover:shadow-md transition-shadow"
    >
      <div className={`w-16 h-16 shrink-0 overflow-hidden ${isRound ? 'rounded-full' : 'rounded-lg'}`}>
        {cat.image_url ? (
          <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor || '#8B6914'}15` }}>
            <span className="text-2xl">🏷️</span>
          </div>
        )}
      </div>
      <div>
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">{cat.name}</h3>
        {showCount && cat.product_count != null && (
          <span className="text-sm text-gray-500">{cat.product_count} productos</span>
        )}
      </div>
    </Link>
  )
}

export function CategoriesGrid({ content, primaryColor, data }: CategoriesGridProps) {
  const maxItems = content.max_items || 0
  const shape = content.shape || 'square'
  const desktopLayout = content.desktop_layout || 'grid'
  const desktopColumns = content.desktop_columns || 0
  const desktopRows = content.desktop_rows || 0
  const mobileLayout = content.mobile_layout || 'grid'
  const isRound = shape === 'round'
  const allCategories = data?.categories || []
  const selectedIds = content.selected_category_ids || []
  const filteredCategories = selectedIds.length > 0
    ? selectedIds
        .map((id: number) => allCategories.find((c: any) => c.id === id))
        .filter(Boolean)
    : allCategories
  const categories = maxItems > 0 ? filteredCategories.slice(0, maxItems) : filteredCategories

  // Carousel refs (desktop y mobile)
  const scrollRef = useRef<HTMLDivElement>(null)
  const mobileScrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [mobileCurrentIndex, setMobileCurrentIndex] = useState(0)
  const [mobileCanScrollLeft, setMobileCanScrollLeft] = useState(false)
  const [mobileCanScrollRight, setMobileCanScrollRight] = useState(false)

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || desktopLayout !== 'carousel') return
    updateScrollButtons()
    el.addEventListener('scroll', updateScrollButtons, { passive: true })
    const ro = new ResizeObserver(updateScrollButtons)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', updateScrollButtons); ro.disconnect() }
  }, [desktopLayout, updateScrollButtons, categories.length])

  // Mobile carousel scroll tracking
  const updateMobileScroll = useCallback(() => {
    const el = mobileScrollRef.current
    if (!el) return
    setMobileCanScrollLeft(el.scrollLeft > 4)
    setMobileCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
    // Calcular índice actual basado en scroll
    const itemWidth = isRound ? 130 : 160
    const idx = Math.round(el.scrollLeft / (itemWidth + 16))
    setMobileCurrentIndex(Math.min(idx, categories.length - 1))
  }, [categories.length, isRound])

  useEffect(() => {
    const el = mobileScrollRef.current
    if (!el || mobileLayout !== 'carousel') return
    updateMobileScroll()
    el.addEventListener('scroll', updateMobileScroll, { passive: true })
    const ro = new ResizeObserver(updateMobileScroll)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', updateMobileScroll); ro.disconnect() }
  }, [mobileLayout, updateMobileScroll, categories.length])

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.8
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  const scrollMobile = (dir: 'left' | 'right') => {
    const el = mobileScrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.7
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  const scrollMobileToIndex = (index: number) => {
    const el = mobileScrollRef.current
    if (!el) return
    const itemWidth = isRound ? 130 : 160
    el.scrollTo({ left: index * (itemWidth + 16), behavior: 'smooth' })
  }

  const isDesktopCarousel = desktopLayout === 'carousel'
  const isDesktopList = desktopLayout === 'list'
  const isMobileList = mobileLayout === 'list'
  const isMobileCarousel = mobileLayout === 'carousel'
  // Grid class: usa columnas custom si se configuraron, sino auto
  const desktopGrid = desktopColumns > 0
    ? `grid-cols-${desktopColumns}`
    : getGridClass(maxItems || categories.length)

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-10">{content.subtitle}</p>
      )}
      {categories.length > 0 ? (
        <>
          {/* === Móvil: Lista === */}
          {isMobileList && (
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {categories.map((cat: any) => (
                <MobileListCard key={cat.id} cat={cat} isRound={isRound} showCount={content.show_count} primaryColor={primaryColor} />
              ))}
            </div>
          )}

          {/* === Móvil: Carrusel con flechas y puntos === */}
          {isMobileCarousel && (
            <div className="md:hidden relative">
              {/* Flecha izquierda */}
              {mobileCanScrollLeft && (
                <button
                  onClick={() => scrollMobile('left')}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg flex items-center justify-center"
                  aria-label="Anterior"
                >
                  <svg className="w-4 h-4 text-gray-700 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
              )}
              <div
                ref={mobileScrollRef}
                className="overflow-x-auto scrollbar-hide scroll-smooth"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <div className="flex gap-4 px-1 pb-2 items-start">
                  {categories.map((cat: any) => (
                    <div key={cat.id} className={`flex-shrink-0 ${isRound ? 'w-[130px]' : 'w-[160px]'}`}>
                      <CategoryCard cat={cat} isRound={isRound} showCount={content.show_count} primaryColor={primaryColor} />
                    </div>
                  ))}
                </div>
              </div>
              {/* Flecha derecha */}
              {mobileCanScrollRight && (
                <button
                  onClick={() => scrollMobile('right')}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg flex items-center justify-center"
                  aria-label="Siguiente"
                >
                  <svg className="w-4 h-4 text-gray-700 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              )}
              {/* Puntos de navegación */}
              {categories.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-3">
                  {categories.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => scrollMobileToIndex(i)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        i === mobileCurrentIndex
                          ? 'w-4 bg-gray-800 dark:bg-white'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                      aria-label={`Ir a categoría ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* === Móvil: Grid === */}
          {!isMobileList && !isMobileCarousel && (
            <div className={`grid grid-cols-2 gap-4 md:hidden`}>
              {categories.map((cat: any) => (
                <CategoryCard key={cat.id} cat={cat} isRound={isRound} showCount={content.show_count} primaryColor={primaryColor} />
              ))}
            </div>
          )}

          {/* === Escritorio: Carrusel con flechas === */}
          {isDesktopCarousel && (
            <div className="hidden md:block relative group/carousel">
              {canScrollLeft && (
                <button
                  onClick={() => scroll('left')}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 transition-all -ml-4"
                  aria-label="Anterior"
                >
                  <svg className="w-5 h-5 text-gray-700 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
              )}
              <div
                ref={scrollRef}
                className="flex gap-6 overflow-x-auto scrollbar-hide scroll-smooth items-start"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {categories.map((cat: any) => (
                  <div key={cat.id} className={`flex-shrink-0 ${isRound ? 'w-[180px]' : 'w-[220px]'}`}>
                    <CategoryCard cat={cat} isRound={isRound} showCount={content.show_count} primaryColor={primaryColor} />
                  </div>
                ))}
              </div>
              {canScrollRight && (
                <button
                  onClick={() => scroll('right')}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 transition-all -mr-4"
                  aria-label="Siguiente"
                >
                  <svg className="w-5 h-5 text-gray-700 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              )}
            </div>
          )}

          {/* === Escritorio: Lista === */}
          {isDesktopList && (
            <div className="hidden md:grid grid-cols-1 gap-4 max-w-3xl mx-auto">
              {categories.map((cat: any) => (
                <MobileListCard key={cat.id} cat={cat} isRound={isRound} showCount={content.show_count} primaryColor={primaryColor} />
              ))}
            </div>
          )}

          {/* === Escritorio: Grid === */}
          {!isDesktopCarousel && !isDesktopList && (
            <div
              className={`hidden md:grid gap-6 ${desktopColumns <= 0 ? desktopGrid : ''}`}
              style={desktopColumns > 0 ? { gridTemplateColumns: `repeat(${desktopColumns}, minmax(0, 1fr))` } : undefined}
            >
              {(desktopRows > 0
                ? categories.slice(0, desktopColumns * desktopRows)
                : categories
              ).map((cat: any) => (
                <CategoryCard key={cat.id} cat={cat} isRound={isRound} showCount={content.show_count} primaryColor={primaryColor} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">🏷️</p>
          <p>No hay categorías disponibles aún</p>
        </div>
      )}
    </div>
  )
}
