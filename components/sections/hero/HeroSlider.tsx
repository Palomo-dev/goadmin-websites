'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { HeroBookingWidget } from './HeroBookingWidget'

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
      image_url_mobile?: string
      cta_text?: string
      cta_url?: string
    }>
  }
  organization?: any
  primaryColor?: string
}

export function HeroSlider({ content, organization, primaryColor }: HeroSliderProps) {
  const showBooking = (content as any).show_booking_widget ?? organization?.website_settings?.show_hero_booking ?? false
  const showOverlay = (content as any).show_overlay !== false
  const showTitle = (content as any).show_title !== false
  const showCta = (content as any).show_cta !== false
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
        className="min-h-[50vh] md:min-h-[70vh] flex items-center justify-center text-white text-center px-4 sm:px-6"
        style={{ backgroundColor: primaryColor }}
      >
        <div>
          {showTitle && content.title && <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4">{content.title}</h1>}
          {showTitle && content.subtitle && <p className="text-lg md:text-xl opacity-90 mb-8">{content.subtitle}</p>}
          {showBooking ? (
            <div className="mt-6"><HeroBookingWidget primaryColor={primaryColor || '#3B82F6'} /></div>
          ) : showCta && content.cta_text && content.cta_url ? (
            <Link href={content.cta_url} className="inline-block px-8 py-3 bg-white rounded-lg font-medium" style={{ color: primaryColor }}>
              {content.cta_text}
            </Link>
          ) : null}
        </div>
      </div>
    )
  }

  const slide = slides[current]
  const hasTextContent = (showTitle && (slide.title || slide.subtitle)) || (showCta && slide.cta_text && slide.cta_url) || showBooking

  return (
    <div className="relative w-full overflow-hidden">
      {slide.image_url ? (
        <>
          {/* Modo imagen completa: si no hay texto, mostrar la imagen completa sin recorte */}
          {!hasTextContent ? (
            <picture className="block w-full">
              {slide.image_url_mobile && (
                <source media="(max-width: 767px)" srcSet={slide.image_url_mobile} />
              )}
              <img
                src={slide.image_url}
                alt={slide.title || ''}
                className="w-full h-auto max-h-[85vh] object-contain mx-auto transition-opacity duration-700"
              />
            </picture>
          ) : (
            /* Modo con texto: imagen como fondo con overlay */
            <div className="relative min-h-[50vh] md:min-h-[70vh]">
              <picture className="absolute inset-0 w-full h-full">
                {slide.image_url_mobile && (
                  <source media="(max-width: 767px)" srcSet={slide.image_url_mobile} />
                )}
                <img src={slide.image_url} alt="" className="w-full h-full object-cover transition-opacity duration-700" />
              </picture>
              {showOverlay && <div className="absolute inset-0 bg-black/40" />}
              <div className="relative z-10 min-h-[50vh] md:min-h-[70vh] flex items-center justify-center text-white text-center px-4 sm:px-6">
                <div className="max-w-4xl mx-auto">
                  {showTitle && slide.title && <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 drop-shadow-lg">{slide.title}</h1>}
                  {showTitle && slide.subtitle && <p className="text-lg md:text-xl opacity-90 mb-8 drop-shadow-md">{slide.subtitle}</p>}
                  {showBooking ? (
                    <div className="mt-6"><HeroBookingWidget primaryColor={primaryColor || '#3B82F6'} /></div>
                  ) : showCta && slide.cta_text && slide.cta_url ? (
                    <Link href={slide.cta_url} className="inline-block px-8 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity shadow-lg" style={{ backgroundColor: primaryColor }}>
                      {slide.cta_text}
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="min-h-[50vh] md:min-h-[70vh] flex items-center justify-center text-white text-center px-4 sm:px-6" style={{ backgroundColor: primaryColor }}>
          <div className="max-w-4xl mx-auto">
            {showTitle && slide.title && <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4">{slide.title}</h1>}
            {showTitle && slide.subtitle && <p className="text-lg md:text-xl opacity-90 mb-8">{slide.subtitle}</p>}
            {showBooking ? (
              <div className="mt-6"><HeroBookingWidget primaryColor={primaryColor || '#3B82F6'} /></div>
            ) : showCta && slide.cta_text && slide.cta_url ? (
              <Link href={slide.cta_url} className="inline-block px-8 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: primaryColor }}>
                {slide.cta_text}
              </Link>
            ) : null}
          </div>
        </div>
      )}
      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="w-3 h-3 rounded-full transition-all shadow-md"
              style={{ backgroundColor: i === current ? 'white' : 'rgba(255,255,255,0.5)', transform: i === current ? 'scale(1.2)' : 'scale(1)' }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
