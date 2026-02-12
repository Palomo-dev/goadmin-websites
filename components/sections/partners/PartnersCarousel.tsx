'use client'

import { useState, useEffect } from 'react'

interface PartnersCarouselProps {
  content: Record<string, any>
  primaryColor?: string
}

export function PartnersCarousel({ content, primaryColor = '#3B82F6' }: PartnersCarouselProps) {
  const title = content.title || 'Nuestros Aliados'
  const items = content.items || []
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (items.length <= 4) return
    const interval = setInterval(() => {
      setOffset((prev) => (prev + 1) % items.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [items.length])

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {title && <h2 className="text-3xl font-bold text-center mb-10">{title}</h2>}
        <div className="flex gap-8 items-center justify-center overflow-hidden">
          {items.slice(offset, offset + 5).map((item: any, i: number) => (
            <div key={i} className="flex-shrink-0">
              {item.logo_url ? (
                <img src={item.logo_url} alt={item.name} className="h-12 object-contain grayscale hover:grayscale-0 transition-all" />
              ) : (
                <span className="text-gray-400 font-medium">{item.name}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
