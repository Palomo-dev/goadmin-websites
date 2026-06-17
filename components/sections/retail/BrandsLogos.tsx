'use client'

import { useRef, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

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
  }
  primaryColor?: string
}

const SIZE_CLASSES = {
  sm: 'h-8 md:h-10',
  md: 'h-10 md:h-14',
  lg: 'h-14 md:h-20',
}

export function BrandsLogos({ content }: BrandsLogosProps) {
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
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-8">{content.subtitle}</p>
      )}
      {items.length > 0 ? (
        layout === 'carousel' ? (
          <BrandsCarousel items={items} sizeClass={sizeClass} grayscaleClass={grayscaleClass} />
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

function BrandsCarousel({ items, sizeClass, grayscaleClass }: {
  items: Array<{ id?: string; name: string; logo_url?: string; url?: string }>
  sizeClass: string
  grayscaleClass: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1)
  }

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (el) el.addEventListener('scroll', checkScroll)
    return () => { if (el) el.removeEventListener('scroll', checkScroll) }
  }, [items])

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.6
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  return (
    <div className="relative group">
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 shadow-md rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      <div
        ref={scrollRef}
        className="flex items-center gap-8 md:gap-12 overflow-x-auto scrollbar-hide py-4 px-2"
        style={{ scrollbarWidth: 'none' }}
      >
        {items.map((item, i) => (
          <div key={item.id || i} className="flex-shrink-0">
            <BrandLogo item={item} sizeClass={sizeClass} grayscaleClass={grayscaleClass} />
          </div>
        ))}
      </div>
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 shadow-md rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
