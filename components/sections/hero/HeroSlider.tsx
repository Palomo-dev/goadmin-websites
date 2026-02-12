'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface HeroSliderProps {
  content: {
    title?: string
    subtitle?: string
    cta_text?: string
    cta_url?: string
    slides?: Array<{
      title?: string
      subtitle?: string
      image_url?: string
      cta_text?: string
      cta_url?: string
    }>
  }
  primaryColor?: string
}

export function HeroSlider({ content, primaryColor }: HeroSliderProps) {
  const slides = content.slides || []
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (slides.length <= 1) return
    const timer = setInterval(() => {
      setCurrent(prev => (prev + 1) % slides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [slides.length])

  if (slides.length === 0) {
    return (
      <div
        className="min-h-[70vh] flex items-center justify-center text-white text-center px-4"
        style={{ backgroundColor: primaryColor }}
      >
        <div>
          {content.title && <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">{content.title}</h1>}
          {content.subtitle && <p className="text-lg md:text-xl opacity-90 mb-8">{content.subtitle}</p>}
          {content.cta_text && content.cta_url && (
            <Link href={content.cta_url} className="inline-block px-8 py-3 bg-white rounded-lg font-medium" style={{ color: primaryColor }}>
              {content.cta_text}
            </Link>
          )}
        </div>
      </div>
    )
  }

  const slide = slides[current]

  return (
    <div className="relative min-h-[70vh] overflow-hidden">
      {slide.image_url ? (
        <img src={slide.image_url} alt="" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700" />
      ) : (
        <div className="absolute inset-0" style={{ backgroundColor: primaryColor }} />
      )}
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 min-h-[70vh] flex items-center justify-center text-white text-center px-4">
        <div className="max-w-4xl mx-auto">
          {slide.title && <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">{slide.title}</h1>}
          {slide.subtitle && <p className="text-lg md:text-xl opacity-90 mb-8">{slide.subtitle}</p>}
          {slide.cta_text && slide.cta_url && (
            <Link href={slide.cta_url} className="inline-block px-8 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: primaryColor }}>
              {slide.cta_text}
            </Link>
          )}
        </div>
      </div>
      {slides.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="w-3 h-3 rounded-full transition-colors"
              style={{ backgroundColor: i === current ? 'white' : 'rgba(255,255,255,0.4)' }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
