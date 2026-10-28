'use client'
import { capaPersonalizada, estiloTitulo, OPACIDAD_CAPA_POR_DEFECTO } from '@/lib/website/capaHero'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { BASE_CARRUSEL_HERO, resolverCarrusel } from '@/lib/website/v2/paginacionCarrusel'
import { ControlesCarrusel } from '@/components/site/carrusel/ControlesCarrusel'
import { useEsMovilLista, useListaCarrusel } from '@/components/site/listaCarrusel'
import { HeroBookingWidget } from './HeroBookingWidget'
import { HeroButtons, type HeroButtonItem } from './HeroButtons'
import { ajusteImagen, puntoFocal } from '@/lib/website/alturaHero'
import { enlaceDeImagen } from '@/lib/website/presentacionTienda'
import { heroSolapa, RESPALDO_HEADER_PX } from '@/lib/website/espacioHeader'

interface Slide {
  title?: string
  subtitle?: string
  image_url?: string
  image_url_mobile?: string
  video_url?: string
  cta_text?: string
  cta_url?: string
  link_url?: string
  buttons?: HeroButtonItem[]
}

interface HeroSliderProps {
  content: {
    title?: string
    subtitle?: string
    cta_text?: string
    cta_url?: string
    link_url?: string
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

/**
 * Resuelve la altura del slider según el campo `height`.
 * - 'auto': adaptar a imagen (object-contain, max-h configurable). Default.
 * - '50vh'/'70vh'/'100vh': min-height fijo con object-cover.
 * - 'custom': altura fija en px via style.
 */
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
    default: // 'auto' — sin min-height forzado, la imagen define la altura
      return ''
  }
}

/**
 * Determina si el modo "adaptar a imagen" está activo.
 * En este modo, las imágenes sin texto se muestran completas con object-contain.
 */
function isImageFitMode(height: string): boolean {
  return height === 'auto' || height === 'image'
}

/**
 * Resuelve la clase max-h para el modo "adaptar a imagen".
 */
function imageMaxHeightClass(maxH: string | undefined): string {
  switch (maxH) {
    case '50vh':
      return 'max-h-[50vh]'
    case '70vh':
      return 'max-h-[70vh]'
    case '100vh':
      return 'max-h-[100dvh]'
    default: // '85vh' o undefined
      return 'max-h-[85vh]'
  }
}

/**
 * Determina si un slide tiene contenido de texto/CTA que mostrar encima.
 */
function slideHasText(slide: Slide, showTitle: boolean, showCta: boolean, showBooking: boolean): boolean {
  return Boolean((showTitle && (slide.title || slide.subtitle)) || showCta || showBooking)
}

function esExterno(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href)
}

/** Capa clicable sobre la imagen. El texto deja pasar el clic; el botón no. */
function CapaEnlace({ href, etiqueta }: { href: string; etiqueta: string }) {
  if (!href) return null
  const clase = 'absolute inset-0 z-[1]'
  if (esExterno(href)) return <a href={href} className={clase} aria-label={etiqueta} />
  return <Link href={href} className={clase} aria-label={etiqueta} />
}

function EnvolturaEnlace({ href, children }: { href: string; children: React.ReactNode }) {
  if (!href) return <>{children}</>
  if (esExterno(href)) return <a href={href} className="block">{children}</a>
  return <Link href={href} className="block">{children}</Link>
}

/**
 * Parsea un valor booleano que puede venir como boolean, string ("true"/"false")
 * o undefined desde JSON de Supabase.
 * Default: si es undefined, retorna fallback.
 */
function parseBool(val: unknown, fallback: boolean): boolean {
  if (val === undefined || val === null) return fallback
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return val !== 'false' && val !== '0' && val !== ''
  return !!val
}

const ESTILO_PORTADA: Record<string, string> = { circulo: 'circle', cuadrado: 'square', minimo: 'minimal', chevron: 'chevron' }
const POSICION_PORTADA: Record<string, string> = { lados_dentro: 'inside', lados_fuera: 'outside', arriba_derecha: 'top-right', abajo: 'bottom' }
const PUNTOS_PORTADA: Record<string, string> = { puntos: 'dots', barra: 'bars', numeros: 'numbers' }
const PX_TAMANO: Record<string, number> = { sm: 32, md: 40, lg: 48 }

export function HeroSlider({ content, organization, primaryColor }: HeroSliderProps) {
  const globalLista = useListaCarrusel()
  const movil = useEsMovilLista()
  const carrusel = resolverCarrusel(BASE_CARRUSEL_HERO, globalLista.carrusel, (content as { carrusel?: unknown }).carrusel, movil)
  const showBooking = parseBool((content as any).show_booking_widget, organization?.website_settings?.show_hero_booking ?? false)
  const showOverlay = parseBool((content as any).show_overlay, true)
  // Paquete 5-nov D4: capa y título propios; sin guardar, negro 40 % y blanco como siempre.
  const capa = capaPersonalizada(content as any, OPACIDAD_CAPA_POR_DEFECTO.slider)
  const tituloEstilo = estiloTitulo(content as any)
  const showTitle = parseBool((content as any).show_title, true)
  const showCta = parseBool((content as any).show_cta, true)
  const fullWidth = parseBool((content as any).full_width, true)
  const borderRadius = Number((content as any).border_radius) || 0
  const shadowIntensity = Number((content as any).shadow_intensity) || 0
  const slides = content.slides || []

  // F3 — Altura configurable y solape con header
  // 'auto' = adaptar a imagen (default), '50vh'/'70vh'/'100vh' = pantalla fija,
  // 'custom' = px personalizados
  const height = (content as any).height || 'auto'
  const customHeight = Number((content as any).custom_height) || 0
  const imageMaxHeight = (content as any).image_max_height || '85vh'
  const overlapHeader = heroSolapa(organization?.website_settings, (content as any).overlap_header)

  const focal = puntoFocal((content as any).focal_point)
  const fitMovil = ajusteImagen((content as any).image_fit_mobile)
  const claseObjeto = fitMovil ? `object-${fitMovil} md:object-cover` : 'object-cover'
  const estiloObjeto: React.CSSProperties | undefined = focal ? { objectPosition: focal } : undefined
  const alturaMovil = (content as any).mobile_height as string | undefined
  const claseMovil = alturaMovil === '60vh'
    ? 'max-md:min-h-[60vh]'
    : alturaMovil === '100vh'
      ? 'max-md:min-h-[100dvh]'
      : alturaMovil === 'auto'
        ? 'max-md:min-h-[50vh]'
        : ''
  const heightClassStr = sliderHeightClass(height)
  const imageMaxHClass = imageMaxHeightClass(imageMaxHeight)
  const heightStyle: React.CSSProperties =
    height === 'custom' && customHeight > 0 ? { minHeight: `${customHeight}px` } : {}
  const overlapStyle: React.CSSProperties = overlapHeader
    ? { paddingTop: `var(--header-h, ${RESPALDO_HEADER_PX}px)` }
    : {}

  // CAROUSEL_FIELDS con defaults que preservan el comportamiento heredado
  const autoplay = carrusel.activo ? carrusel.autoplay : (content.autoplay ?? true)
  const intervalMs = carrusel.activo ? carrusel.segundos * 1000 : (Number(content.interval_ms) || 5000)
  const pauseOnHover = carrusel.activo ? carrusel.pausaHover : (content.pause_on_hover ?? true)
  const loop = carrusel.activo ? carrusel.loop : (content.loop ?? true)
  const transition = content.transition || 'slide'
  const transitionMs = Number(content.transition_ms) || 500
  // Panel «Carrusel» con las piezas de la portada (lo que se migró de las claves anteriores):
  // mismas flechas y puntos de siempre, con los valores elegidos en el panel.
  const portada = carrusel.activo && carrusel.controlesPortada === true
    && ESTILO_PORTADA[carrusel.estiloFlechas] != null && POSICION_PORTADA[carrusel.posicionFlechas] != null
    && (carrusel.indicador === 'ninguno' || PUNTOS_PORTADA[carrusel.indicador] != null)
  const showArrows = portada ? carrusel.flechas : carrusel.activo ? false : (content.show_arrows ?? false)
  const arrowStyle = portada ? ESTILO_PORTADA[carrusel.estiloFlechas] : (content.arrow_style || 'circle')
  const arrowPosition = portada ? POSICION_PORTADA[carrusel.posicionFlechas] : (content.arrow_position || 'inside')
  const arrowSize = portada ? (carrusel.tamanoFlechaPx ?? PX_TAMANO[carrusel.tamanoFlecha] ?? 40) : (Number(content.arrow_size) || 40)
  const arrowColor = portada ? carrusel.colorIcono : content.arrow_color
  const arrowBgColor = portada ? carrusel.fondoFlecha : content.arrow_bg_color
  const showDots = portada ? carrusel.indicador !== 'ninguno' : carrusel.activo ? false : (content.show_dots ?? true)
  const dotStyle = portada ? (PUNTOS_PORTADA[carrusel.indicador] ?? 'dots') : (content.dot_style || 'dots')
  const controlesNuevos = carrusel.activo && !portada
  const enableSwipe = carrusel.activo ? carrusel.arrastre : (content.enable_swipe ?? true)

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

  // --- Render vacío (sin slides) ---
  if (slides.length === 0) {
    const enlace = enlaceDeImagen(null, content, showCta)
    return (
      <div
        className={`relative min-h-[50vh] md:min-h-[70vh] flex items-center justify-center text-white text-center px-4 sm:px-6`}
        style={{ backgroundColor: primaryColor, ...overlapStyle, ...heightStyle }}
      >
        <CapaEnlace href={enlace} etiqueta={content.title || 'Ver más'} />
        <div className="relative z-10 pointer-events-none">
          {showTitle && content.title && <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4" style={tituloEstilo}>{content.title}</h1>}
          {showTitle && content.subtitle && <p className="text-lg md:text-xl opacity-90 mb-8">{content.subtitle}</p>}
          <div className="pointer-events-auto">
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

  // --- Renderiza el contenido de texto de un slide ---
  const renderSlideText = (slide: Slide) => {
    if (!slideHasText(slide, showTitle, showCta, showBooking)) return null
    return (
      <div className="relative z-10 pointer-events-none min-h-[50vh] md:min-h-[70vh] flex items-center justify-center text-white text-center px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          {showTitle && slide.title && (
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 drop-shadow-lg" style={tituloEstilo}>{slide.title}</h1>
          )}
          {showTitle && slide.subtitle && (
            <p className="text-lg md:text-xl opacity-90 mb-8 drop-shadow-md">{slide.subtitle}</p>
          )}
          <div className="pointer-events-auto">
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
      </div>
    )
  }

  /**
   * Renderiza un slide individual.
   *
   * Comportamiento heredado de producción:
   * - Sin texto: imagen completa con object-contain, max-h-[85vh], h-auto.
   *   La imagen define la altura natural del slide.
   * - Con texto: imagen como fondo (object-cover) con overlay + texto encima.
   *
   * Personalización F3: cuando height es 50vh/70vh/100vh/custom, se usa
   * modo full-screen con object-cover y min-height forzado.
   */
  const renderSlide = (slide: Slide, fullScreen: boolean, isFirst: boolean = false) => {
    const hasText = slideHasText(slide, showTitle, showCta, showBooking)
    const enlace = enlaceDeImagen(slide, content, showCta)
    const etiqueta = slide.title || content.title || 'Ver más'

    if (slide.video_url) {
      // Video siempre es full-screen con object-cover
      return (
        <div className={`relative ${fullScreen ? heightClassStr : 'min-h-[50vh] md:min-h-[70vh]'} overflow-hidden`} style={heightStyle}>
          <video
            src={slide.video_url}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          />
          {showOverlay && (capa ? <div className="absolute inset-0" style={capa} /> : <div className="absolute inset-0 bg-black/40" />)}
          <CapaEnlace href={enlace} etiqueta={etiqueta} />
          {renderSlideText(slide)}
        </div>
      )
    }

    const fotoSlide = slide.image_url || slide.image_url_mobile
    if (fotoSlide) {
      if (fullScreen || hasText) {
        // Modo full-screen o con texto: imagen como fondo con object-cover
        return (
          <div className={`relative ${fullScreen ? heightClassStr : 'min-h-[50vh] md:min-h-[70vh]'} overflow-hidden bg-gray-100 dark:bg-gray-800`} style={heightStyle}>
            <picture className="absolute inset-0 w-full h-full">
              {slide.image_url_mobile && (
                <source media="(max-width: 767px)" srcSet={slide.image_url_mobile} />
              )}
              <img src={fotoSlide} alt={slide.title || ''} className={`w-full h-full ${claseObjeto}`} style={estiloObjeto} loading={isFirst ? 'eager' : 'lazy'} fetchPriority={isFirst ? 'high' : 'low'} />
            </picture>
            {showOverlay && (capa ? <div className="absolute inset-0" style={capa} /> : <div className="absolute inset-0 bg-black/40" />)}
            <CapaEnlace href={enlace} etiqueta={etiqueta} />
            {renderSlideText(slide)}
          </div>
        )
      }

      // Modo imagen completa (sin texto): la imagen define la altura.
      // Comportamiento heredado de producción — se adapta a la imagen.
      // image_max_height controla el límite superior (default 85vh).
      return (
        <EnvolturaEnlace href={enlace}>
          <picture className="block w-full bg-gray-100 dark:bg-gray-800">
            {slide.image_url_mobile && (
              <source media="(max-width: 767px)" srcSet={slide.image_url_mobile} />
            )}
            <img
              src={fotoSlide}
              alt={slide.title || etiqueta}
              className={`w-full h-auto ${imageMaxHClass} ${fitMovil ? claseObjeto : 'object-contain'} mx-auto transition-opacity duration-700`}
              style={estiloObjeto}
              loading={isFirst ? 'eager' : 'lazy'}
              fetchPriority={isFirst ? 'high' : 'low'}
            />
          </picture>
        </EnvolturaEnlace>
      )
    }

    // Sin imagen ni video: fondo de color con texto
    return (
      <div className={`relative min-h-[50vh] md:min-h-[70vh] flex items-center justify-center text-white text-center px-4 sm:px-6`} style={{ backgroundColor: primaryColor, ...heightStyle }}>
        <CapaEnlace href={enlace} etiqueta={etiqueta} />
        <div className="relative z-10 pointer-events-none max-w-4xl mx-auto">
          {showTitle && slide.title && <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4" style={tituloEstilo}>{slide.title}</h1>}
          {showTitle && slide.subtitle && <p className="text-lg md:text-xl opacity-90 mb-8">{slide.subtitle}</p>}
          <div className="pointer-events-auto">
            {showBooking ? (
              <div className="mt-6"><HeroBookingWidget primaryColor={primaryColor || '#3B82F6'} /></div>
            ) : (
              <HeroButtons buttons={slide.buttons} ctaText={slide.cta_text} ctaUrl={slide.cta_url} primaryColor={primaryColor || '#3B82F6'} showCta={showCta} className="justify-center" />
            )}
          </div>
        </div>
      </div>
    )
  }

  // --- Modo slide (embla) ---
  if (transition === 'slide') {
    return (
      <div className={`relative w-full ${containerClass} ${claseMovil}`} style={{ ...overlapStyle, ...heightStyle }}>
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
                  {renderSlide(slide, !isImageFitMode(height), i === 0)}
                </div>
              ))}
            </div>
          </div>
          <SliderArrows show={showArrows} style={arrowStyle} position={arrowPosition} size={arrowSize} color={arrowColor} bgColor={arrowBgColor} onPrev={goPrev} onNext={goNext} />
          <SliderDots show={showDots} style={dotStyle} count={slides.length} current={current} onSelect={goTo} />
          {controlesNuevos && (
            <ControlesCarrusel
              resuelta={carrusel}
              forzar
              total={slides.length}
              actual={current}
              color={primaryColor}
              onAnterior={goPrev}
              onSiguiente={goNext}
              onIr={goTo}
              miniaturas={slides.map((s, i) => ({ src: String((s as { image?: string; image_url?: string }).image_url || (s as { image?: string }).image || ''), alt: String((s as { title?: string }).title || `Diapositiva ${i + 1}`) })).filter((m) => m.src)}
            />
          )}
        </div>
      </div>
    )
  }

  // --- Modo fade / zoom (crossfade manual) ---
  return (
    <div className={`relative w-full ${containerClass} ${claseMovil}`} style={{ ...overlapStyle, ...heightStyle }}>
      <div
        className="relative overflow-hidden"
        style={sliderStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className={`relative ${heightClassStr || 'min-h-[50vh] md:min-h-[70vh]'}`} style={heightStyle}>
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
              {renderSlide(slide, true, i === 0)}
            </div>
          ))}
        </div>
        <SliderArrows show={showArrows} style={arrowStyle} position={arrowPosition} size={arrowSize} color={arrowColor} bgColor={arrowBgColor} onPrev={goPrev} onNext={goNext} />
        <SliderDots show={showDots} style={dotStyle} count={slides.length} current={current} onSelect={goTo} />
        {controlesNuevos && (
          <ControlesCarrusel
            resuelta={carrusel}
            forzar
            total={slides.length}
            actual={current}
            color={primaryColor}
            onAnterior={goPrev}
            onSiguiente={goNext}
            onIr={goTo}
            miniaturas={slides.map((s, i) => ({ src: String((s as { image?: string; image_url?: string }).image_url || (s as { image?: string }).image || ''), alt: String((s as { title?: string }).title || `Diapositiva ${i + 1}`) })).filter((m) => m.src)}
          />
        )}
      </div>
    </div>
  )
}
