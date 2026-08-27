'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { HeroBookingWidget } from './HeroBookingWidget'
import { HeroButtons, type HeroButtonItem } from './HeroButtons'

interface Slide {
  title?: string
  subtitle?: string
  image_url?: string
  image_url_mobile?: string
  video_url?: string
  cta_text?: string
  cta_url?: string
  buttons?: HeroButtonItem[]
}

interface HeroSliderProps {
  content: {
    title?: string
    subtitle?: string
    cta_text?: string
    cta_url?: string
    slides?: Slide[]
    buttons?: HeroButtonItem[]
    // Altura configurable (full-screen) — F3
    height?: string
    custom_height?: number
    // Solape con header — F3
    overlap_header?: boolean
    // CAROUSEL_FIELDS
    autoplay?: boolean
    interval_ms?: number
    pause_on_hover?: boolean
    loop?: boolean
    transition?: 'slide' | 'fade' | 'zoom'
    transition_ms?: number
    show_arrows?: boolean
    arrow_style?: 'circle' | 'square' | 'minimal' | 'chevron'
    arrow_position?: 'inside' | 'outside' | 'top-right' | 'bottom'
    arrow_size?: number
    arrow_color?: string
    arrow_bg_color?: string
    show_dots?: boolean
    dot_style?: 'dots' | 'bars' | 'numbers'
    enable_swipe?: boolean
    slides_per_view?: number | { desktop: number; tablet: number; mobile: number }
  }
  organization?: any
  primaryColor?: string
}

// ============================================================
// Helpers de flechas y dots (F3.3)
// ============================================================

function arrowShapeClass(style: string): string {
  switch (style) {
    case 'square':
      return 'rounded-none'
    case 'minimal':
      return 'rounded-none bg-transparent shadow-none'
    case 'chevron':
      return 'rounded-none bg-transparent shadow-none border-0'
    default: // circle
      return 'rounded-full'
  }
}

function arrowPositionClass(position: string): string {
  switch (position) {
    case 'outside':
      return '-translate-x-0'
    case 'top-right':
      return 'top-4 right-4 bottom-auto left-auto -translate-x-0 flex-row gap-2'
    case 'bottom':
      return 'bottom-4 left-1/2 -translate-x-1/2 top-auto right-auto flex-row gap-2'
    default: // inside
      return ''
  }
}

function SliderArrows({
  show,
  style,
  position,
  size,
  color,
  bgColor,
  onPrev,
  onNext,
}: {
  show: boolean
  style: string
  position: string
  size: number
  color?: string
  bgColor?: string
  onPrev: () => void
  onNext: () => void
}) {
  if (!show) return null

  const btnStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    color: color || '#FFFFFF',
    backgroundColor: bgColor || (style === 'minimal' || style === 'chevron' ? 'transparent' : 'rgba(0,0,0,0.4)'),
  }

  if (position === 'top-right' || position === 'bottom') {
    return (
      <div className={`absolute z-20 flex ${arrowPositionClass(position)}`}>
        <button onClick={onPrev} className={`flex items-center justify-center transition-all hover:scale-110 ${arrowShapeClass(style)}`} style={btnStyle} aria-label="Anterior">
          <ChevronLeft size={size * 0.5} />
        </button>
        <button onClick={onNext} className={`flex items-center justify-center transition-all hover:scale-110 ${arrowShapeClass(style)}`} style={btnStyle} aria-label="Siguiente">
          <ChevronRight size={size * 0.5} />
        </button>
      </div>
    )
  }

  // inside / outside (a los lados)
  const sideClass = position === 'outside' ? '-left-2 -right-2' : 'left-2 right-2'
  return (
    <>
      <button
        onClick={onPrev}
        className={`absolute top-1/2 -translate-y-1/2 ${sideClass.split(' ')[0]} z-20 flex items-center justify-center transition-all hover:scale-110 ${arrowShapeClass(style)}`}
        style={btnStyle}
        aria-label="Anterior"
      >
        <ChevronLeft size={size * 0.5} />
      </button>
      <button
        onClick={onNext}
        className={`absolute top-1/2 -translate-y-1/2 ${sideClass.split(' ')[1]} z-20 flex items-center justify-center transition-all hover:scale-110 ${arrowShapeClass(style)}`}
        style={btnStyle}
        aria-label="Siguiente"
      >
        <ChevronRight size={size * 0.5} />
      </button>
    </>
  )
}

function SliderDots({
  show,
  style,
  count,
  current,
  onSelect,
}: {
  show: boolean
  style: string
  count: number
  current: number
  onSelect: (i: number) => void
}) {
  if (!show || count <= 1) return null

  if (style === 'bars') {
    return (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
        {Array.from({ length: count }).map((_, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className="h-1 transition-all rounded-full"
            style={{
              width: i === current ? 32 : 12,
              backgroundColor: i === current ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
            }}
            aria-label={`Ir al slide ${i + 1}`}
          />
        ))}
      </div>
    )
  }

  if (style === 'numbers') {
    return (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
        {Array.from({ length: count }).map((_, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className="w-7 h-7 rounded-full text-xs font-semibold transition-all"
            style={{
              backgroundColor: i === current ? '#FFFFFF' : 'rgba(255,255,255,0.3)',
              color: i === current ? '#000000' : '#FFFFFF',
            }}
            aria-label={`Ir al slide ${i + 1}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    )
  }

  // dots (default)
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          className="w-3 h-3 rounded-full transition-all shadow-md"
          style={{
            backgroundColor: i === current ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
            transform: i === current ? 'scale(1.2)' : 'scale(1)',
          }}
          aria-label={`Ir al slide ${i + 1}`}
        />
      ))}
    </div>
  )
}

// ============================================================
// HeroSlider — orquestador
// ============================================================

/** Resuelve la altura del slider según el campo `height` (full-screen configurable). */
function sliderHeightClass(h: string): string {
  switch (h) {
    case '50vh':
      return 'min-h-[50vh]'
    case '70vh':
      return 'min-h-[70vh]'
    case '100vh':
      return 'min-h-[100dvh]'
    case 'custom':
      return '' // se aplica via style
    default: // auto
      return 'min-h-[50vh] md:min-h-[70vh]'
  }
}

export function HeroSlider({ content, organization, primaryColor }: HeroSliderProps) {
  const showBooking = (content as any).show_booking_widget ?? organization?.website_settings?.show_hero_booking ?? false
  const showOverlay = (content as any).show_overlay !== false
  const showTitle = (content as any).show_title !== false
  const showCta = (content as any).show_cta !== false
  const fullWidth = (content as any).full_width !== false
  const borderRadius = Number((content as any).border_radius) || 0
  const shadowIntensity = Number((content as any).shadow_intensity) || 0
  const slides = content.slides || []

  // F3 — Altura configurable (full-screen) y solape con header
  const height = (content as any).height || 'auto'
  const customHeight = Number((content as any).custom_height) || 0
  const overlapHeader = (content as any).overlap_header !== false

  const heightClassStr = sliderHeightClass(height)
  const heightStyle: React.CSSProperties =
    height === 'custom' && customHeight > 0 ? { minHeight: `${customHeight}px` } : {}
  const overlapStyle: React.CSSProperties = overlapHeader
    ? { marginTop: 'calc(-1 * var(--header-h, 0px))', paddingTop: 'var(--header-h, 0px)' }
    : {}

  // CAROUSEL_FIELDS con defaults que preservan el comportamiento actual
  const autoplay = content.autoplay ?? true
  const intervalMs = Number(content.interval_ms) || 5000
  const pauseOnHover = content.pause_on_hover ?? true
  const loop = content.loop ?? true
  const transition = content.transition || 'slide'
  const transitionMs = Number(content.transition_ms) || 500
  const showArrows = content.show_arrows ?? false
  const arrowStyle = content.arrow_style || 'circle'
  const arrowPosition = content.arrow_position || 'inside'
  const arrowSize = Number(content.arrow_size) || 40
  const arrowColor = content.arrow_color
  const arrowBgColor = content.arrow_bg_color
  const showDots = content.show_dots ?? true
  const dotStyle = content.dot_style || 'dots'
  const enableSwipe = content.enable_swipe ?? true

  const [current, setCurrent] = useState(0)
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop,
    watchDrag: enableSwipe && transition === 'slide',
  })
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isPausedRef = useRef(false)

  // --- Modo embla (transition: slide) ---
  const onSelect = useCallback(() => {
    if (emblaApi) setCurrent(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    onSelect()
    emblaApi.on('select', onSelect)
    emblaApi.on('reInit', onSelect)
    return () => {
      emblaApi.off('select', onSelect)
      emblaApi.off('reInit', onSelect)
    }
  }, [emblaApi, onSelect])

  // --- Autoplay (común a slide y fade/zoom) ---
  useEffect(() => {
    if (!autoplay || slides.length <= 1) return

    const tick = () => {
      if (isPausedRef.current) return
      if (transition === 'slide' && emblaApi) {
        emblaApi.scrollNext()
      } else {
        setCurrent((prev) => {
          if (loop) return (prev + 1) % slides.length
          return prev + 1 < slides.length ? prev + 1 : 0
        })
      }
    }

    autoplayRef.current = setInterval(tick, intervalMs)
    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current)
    }
  }, [autoplay, intervalMs, slides.length, transition, emblaApi, loop])

  // --- Pausa on hover ---
  const handleMouseEnter = useCallback(() => {
    if (pauseOnHover) isPausedRef.current = true
  }, [pauseOnHover])
  const handleMouseLeave = useCallback(() => {
    if (pauseOnHover) isPausedRef.current = false
  }, [pauseOnHover])

  // --- Navegación manual ---
  const goPrev = useCallback(() => {
    if (transition === 'slide' && emblaApi) emblaApi.scrollPrev()
    else setCurrent((p) => (p - 1 + slides.length) % slides.length)
  }, [emblaApi, transition, slides.length])
  const goNext = useCallback(() => {
    if (transition === 'slide' && emblaApi) emblaApi.scrollNext()
    else setCurrent((p) => (p + 1) % slides.length)
  }, [emblaApi, transition, slides.length])
  const goTo = useCallback(
    (i: number) => {
      if (transition === 'slide' && emblaApi) emblaApi.scrollTo(i)
      else setCurrent(i)
    },
    [emblaApi, transition],
  )

  // --- Render vacío ---
  if (slides.length === 0) {
    return (
      <div
        className={`${heightClassStr} flex items-center justify-center text-white text-center px-4 sm:px-6`}
        style={{ backgroundColor: primaryColor, ...overlapStyle, ...heightStyle }}
      >
        <div>
          {showTitle && content.title && <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4">{content.title}</h1>}
          {showTitle && content.subtitle && <p className="text-lg md:text-xl opacity-90 mb-8">{content.subtitle}</p>}
          {showBooking ? (
            <div className="mt-6"><HeroBookingWidget primaryColor={primaryColor || '#3B82F6'} /></div>
          ) : (
            <HeroButtons
              buttons={content.buttons}
              ctaText={content.cta_text}
              ctaUrl={content.cta_url}
              primaryColor={primaryColor || '#3B82F6'}
              showCta={showCta}
              className="justify-center"
            />
          )}
        </div>
      </div>
    )
  }

  const containerClass = fullWidth ? '' : 'max-w-7xl mx-auto px-4 sm:px-6'
  const sliderStyle: React.CSSProperties = {
    borderRadius: borderRadius > 0 ? `${borderRadius}px` : undefined,
    boxShadow:
      shadowIntensity > 0
        ? `0 ${Math.ceil(shadowIntensity / 3)}px ${shadowIntensity}px rgba(0,0,0,${Math.min(shadowIntensity / 100 + 0.1, 0.6)})`
        : undefined,
  }

  // Renderiza el contenido de un slide (texto + CTA)
  const renderSlideContent = (slide: Slide) => {
    const hasText = (showTitle && (slide.title || slide.subtitle)) || showCta || showBooking
    if (!hasText) return null
    return (
      <div className={`relative z-10 ${heightClassStr} flex items-center justify-center text-white text-center px-4 sm:px-6`}>
        <div className="max-w-4xl mx-auto">
          {showTitle && slide.title && (
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 drop-shadow-lg">{slide.title}</h1>
          )}
          {showTitle && slide.subtitle && (
            <p className="text-lg md:text-xl opacity-90 mb-8 drop-shadow-md">{slide.subtitle}</p>
          )}
          {showBooking ? (
            <div className="mt-6">
              <HeroBookingWidget primaryColor={primaryColor || '#3B82F6'} />
            </div>
          ) : (
            <HeroButtons
              buttons={slide.buttons}
              ctaText={slide.cta_text}
              ctaUrl={slide.cta_url}
              primaryColor={primaryColor || '#3B82F6'}
              showCta={showCta}
              className="justify-center"
            />
          )}
        </div>
      </div>
    )
  }

  // --- Modo slide (embla) ---
  if (transition === 'slide') {
    return (
      <div className={`relative w-full ${containerClass}`} style={{ ...overlapStyle, ...heightStyle }}>
        <div
          className="relative overflow-hidden"
          style={sliderStyle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="embla__viewport" ref={emblaRef}>
            <div className="flex">
              {slides.map((slide, i) => (
                <div key={i} className="flex-[0_0_100%] min-w-0 relative">
                  {slide.video_url ? (
                    <>
                      <video
                        src={slide.video_url}
                        className="absolute inset-0 w-full h-full object-cover"
                        autoPlay
                        muted
                        loop
                        playsInline
                      />
                      {showOverlay && <div className="absolute inset-0 bg-black/40" />}
                      {renderSlideContent(slide)}
                    </>
                  ) : slide.image_url ? (
                    <>
                      <picture className="absolute inset-0 w-full h-full">
                        {slide.image_url_mobile && (
                          <source media="(max-width: 767px)" srcSet={slide.image_url_mobile} />
                        )}
                        <img src={slide.image_url} alt={slide.title || ''} className="w-full h-full object-cover" />
                      </picture>
                      {showOverlay && <div className="absolute inset-0 bg-black/40" />}
                      {renderSlideContent(slide)}
                    </>
                  ) : (
                    <div className={`${heightClassStr} flex items-center justify-center text-white text-center px-4 sm:px-6`} style={{ backgroundColor: primaryColor }}>
                      <div className="max-w-4xl mx-auto">
                        {showTitle && slide.title && <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4">{slide.title}</h1>}
                        {showTitle && slide.subtitle && <p className="text-lg md:text-xl opacity-90 mb-8">{slide.subtitle}</p>}
                        {showBooking ? (
                          <div className="mt-6"><HeroBookingWidget primaryColor={primaryColor || '#3B82F6'} /></div>
                        ) : (
                          <HeroButtons buttons={slide.buttons} ctaText={slide.cta_text} ctaUrl={slide.cta_url} primaryColor={primaryColor || '#3B82F6'} showCta={showCta} className="justify-center" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <SliderArrows show={showArrows} style={arrowStyle} position={arrowPosition} size={arrowSize} color={arrowColor} bgColor={arrowBgColor} onPrev={goPrev} onNext={goNext} />
          <SliderDots show={showDots} style={dotStyle} count={slides.length} current={current} onSelect={goTo} />
        </div>
      </div>
    )
  }

  // --- Modo fade / zoom (crossfade manual) ---
  return (
    <div className={`relative w-full ${containerClass}`} style={{ ...overlapStyle, ...heightStyle }}>
      <div
        className="relative overflow-hidden"
        style={sliderStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className={`relative ${heightClassStr}`} style={heightStyle}>
          {slides.map((slide, i) => (
            <div
              key={i}
              className="absolute inset-0"
              style={{
                opacity: i === current ? 1 : 0,
                transition: `opacity ${transitionMs}ms ease${transition === 'zoom' ? ', transform ' + transitionMs + 'ms ease' : ''}`,
                transform: transition === 'zoom' && i === current ? 'scale(1.05)' : 'scale(1)',
                pointerEvents: i === current ? 'auto' : 'none',
              }}
            >
              {slide.video_url ? (
                <>
                  <video
                    src={slide.video_url}
                    className="absolute inset-0 w-full h-full object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                  {showOverlay && <div className="absolute inset-0 bg-black/40" />}
                  {renderSlideContent(slide)}
                </>
              ) : slide.image_url ? (
                <>
                  <picture className="absolute inset-0 w-full h-full">
                    {slide.image_url_mobile && (
                      <source media="(max-width: 767px)" srcSet={slide.image_url_mobile} />
                    )}
                    <img src={slide.image_url} alt={slide.title || ''} className="w-full h-full object-cover" />
                  </picture>
                  {showOverlay && <div className="absolute inset-0 bg-black/40" />}
                  {renderSlideContent(slide)}
                </>
              ) : (
                <div className={`${heightClassStr} flex items-center justify-center text-white text-center px-4 sm:px-6`} style={{ backgroundColor: primaryColor }}>
                  <div className="max-w-4xl mx-auto">
                    {showTitle && slide.title && <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4">{slide.title}</h1>}
                    {showTitle && slide.subtitle && <p className="text-lg md:text-xl opacity-90 mb-8">{slide.subtitle}</p>}
                    {showBooking ? (
                      <div className="mt-6"><HeroBookingWidget primaryColor={primaryColor || '#3B82F6'} /></div>
                    ) : (
                      <HeroButtons buttons={slide.buttons} ctaText={slide.cta_text} ctaUrl={slide.cta_url} primaryColor={primaryColor || '#3B82F6'} showCta={showCta} className="justify-center" />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <SliderArrows show={showArrows} style={arrowStyle} position={arrowPosition} size={arrowSize} color={arrowColor} bgColor={arrowBgColor} onPrev={goPrev} onNext={goNext} />
        <SliderDots show={showDots} style={dotStyle} count={slides.length} current={current} onSelect={goTo} />
      </div>
    </div>
  )
}
