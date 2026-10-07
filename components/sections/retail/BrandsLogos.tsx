'use client'

import { useRef, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { atributosCarrusel, leerOpcionesCarrusel, type OpcionesCarrusel } from '@/lib/carrusel/opcionesCarrusel'
import { desplazar } from '@/lib/carrusel/desplazamiento'
import { useAutoplayCarrusel } from '@/lib/carrusel/useCarrusel'
import { PuntosCarrusel } from '@/components/site/carrusel/ControlesCarrusel'

interface BrandsLogosProps {
  content: {
    title?: string
    subtitle?: string
    layout?: 'carousel' | 'grid' | 'flex'
    logo_size?: 'sm' | 'md' | 'lg'
    grayscale?: boolean
    items?: Array<{
      id?: string
      name: string
      logo_url?: string
      url?: string
    }>
    // CAROUSEL_FIELDS: solo actúan con la distribución «Carrusel».
    autoplay?: boolean
    interval_ms?: number
    loop?: boolean
    pause_on_hover?: boolean
    show_arrows?: boolean
    show_dots?: boolean
    enable_swipe?: boolean
  }
  primaryColor?: string
}

const SIZE_CLASSES = {
  sm: 'h-8 md:h-10',
  md: 'h-10 md:h-14',
  lg: 'h-14 md:h-20',
}

export function BrandsLogos({ content, primaryColor }: BrandsLogosProps) {
  const items = content.items || []
  const layout = content.layout || 'flex'
  const logoSize = content.logo_size || 'md'
  const grayscale = content.grayscale !== false
  const sizeClass = SIZE_CLASSES[logoSize] || SIZE_CLASSES.md

  const grayscaleClass = grayscale
    ? 'grayscale hover:grayscale-0 opacity-60 hover:opacity-100'
    : ''

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-8">{content.subtitle}</p>
      )}
      {items.length > 0 ? (
        layout === 'carousel' ? (
          <BrandsCarousel items={items} sizeClass={sizeClass} grayscaleClass={grayscaleClass} opciones={leerOpcionesCarrusel(content as Record<string, unknown>, HOY_CARRUSEL)} primaryColor={primaryColor} />
        ) : layout === 'grid' ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-6 items-center justify-items-center">
            {items.map((item, i) => (
              <BrandLogo key={item.id || i} item={item} sizeClass={sizeClass} grayscaleClass={grayscaleClass} />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {items.map((item, i) => (
              <BrandLogo key={item.id || i} item={item} sizeClass={sizeClass} grayscaleClass={grayscaleClass} />
            ))}
          </div>
        )
      ) : (
        <div className="text-center text-gray-400 py-8 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-3xl mb-2">🏢</p>
          <p>Sin marcas registradas aún</p>
        </div>
      )}
    </div>
  )
}

function BrandLogo({ item, sizeClass, grayscaleClass }: {
  item: { name: string; logo_url?: string; url?: string }
  sizeClass: string
  grayscaleClass: string
}) {
  const inner = item.logo_url ? (
    <img src={item.logo_url} alt={item.name} className={`${sizeClass} w-auto object-contain`} loading="lazy" />
  ) : (
    <span className="text-gray-400 font-medium text-lg">{item.name}</span>
  )

  return (
    <div className={`transition-all duration-300 ${grayscaleClass}`}>
      {item.url ? (
        <a href={item.url} target="_blank" rel="noopener noreferrer">{inner}</a>
      ) : inner}
    </div>
  )
}

/**
 * Lo que hacía la distribución «Carrusel» antes de leer los interruptores: fila con desplazamiento
 * (se desliza con el dedo), flechas al pasar el puntero, sin avance automático, sin bucle y sin
 * puntos. Con la clave ausente se mantiene.
 */
const HOY_CARRUSEL: OpcionesCarrusel = { autoplay: false, intervaloMs: 5000, bucle: false, pausarAlPasar: true, flechas: true, puntos: false, deslizar: true }

const FOCO = 'focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 dark:focus-visible:ring-white'

function BrandsCarousel({ items, sizeClass, grayscaleClass, opciones: o, primaryColor }: {
  items: Array<{ id?: string; name: string; logo_url?: string; url?: string }>
  sizeClass: string
  grayscaleClass: string
  opciones: OpcionesCarrusel
  primaryColor?: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [pagina, setPagina] = useState(0)
  const [paginas, setPaginas] = useState(1)

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1)
    const total = el.clientWidth > 0 ? Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth - 0.01)) : 1
    setPaginas(total)
    setPagina(Math.min(total - 1, Math.round((el.scrollLeft / Math.max(1, el.scrollWidth - el.clientWidth)) * (total - 1))))
  }

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (el) el.addEventListener('scroll', checkScroll)
    return () => { if (el) el.removeEventListener('scroll', checkScroll) }
  }, [items])

  const scroll = (dir: 'left' | 'right') => desplazar(scrollRef.current, dir === 'left' ? 'anterior' : 'siguiente', o.bucle, 0.6)

  const autoplay = useAutoplayCarrusel({
    activo: o.autoplay && items.length > 1,
    intervaloMs: o.intervaloMs,
    pausarAlPasar: o.pausarAlPasar,
    avanzar: () => desplazar(scrollRef.current, 'siguiente', o.bucle, 0.6),
  })

  const irAPagina = (i: number) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ left: (i / Math.max(1, paginas - 1)) * (el.scrollWidth - el.clientWidth), behavior: 'smooth' })
  }

  // Con bucle, la flecha sigue en el borde para dar la vuelta (si hay algo que desplazar).
  const hayDesborde = canScrollLeft || canScrollRight
  const flechaIzq = o.flechas && (canScrollLeft || (o.bucle && hayDesborde))
  const flechaDer = o.flechas && (canScrollRight || (o.bucle && hayDesborde))

  return (
    <div className="relative group" aria-roledescription="carrusel" {...atributosCarrusel(o)} {...autoplay}>
      {flechaIzq && (
        <button
          type="button"
          aria-label="Marcas anteriores"
          onClick={() => scroll('left')}
          className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 shadow-md rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity ${FOCO}`}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      <div
        ref={scrollRef}
        className={`flex items-center gap-8 md:gap-12 ${o.deslizar ? 'overflow-x-auto' : 'overflow-x-hidden touch-pan-y'} scrollbar-hide py-4 px-2`}
        style={{ scrollbarWidth: 'none' }}
      >
        {items.map((item, i) => (
          <div key={item.id || i} className="flex-shrink-0">
            <BrandLogo item={item} sizeClass={sizeClass} grayscaleClass={grayscaleClass} />
          </div>
        ))}
      </div>
      {flechaDer && (
        <button
          type="button"
          aria-label="Más marcas"
          onClick={() => scroll('right')}
          className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 shadow-md rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity ${FOCO}`}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      {o.puntos && (
        <PuntosCarrusel total={paginas} actual={pagina} onSelect={irAPagina} color={primaryColor} etiqueta={(i) => `Ir a la página ${i + 1} de marcas`} className="mt-2" />
      )}
    </div>
  )
}
