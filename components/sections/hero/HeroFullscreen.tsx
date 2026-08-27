import { HeroBookingWidget } from './HeroBookingWidget'
import { HeroButtons, type HeroButtonItem } from './HeroButtons'

interface HeroFullscreenProps {
  content: {
    title?: string
    subtitle?: string
    cta_text?: string
    cta_url?: string
    image_url?: string | null
    image_url_mobile?: string | null
    // F3.2 — campos nuevos del catálogo
    height?: string
    custom_height?: number
    overlay_opacity?: number
    overlay_color?: string
    content_position?: string
    text_align?: 'left' | 'center' | 'right'
    buttons?: HeroButtonItem[]
  }
  organization: any
  primaryColor?: string
}

// ============================================================
// Helpers de posición (F3.2)
// ============================================================

/** Convierte content_position (grilla 3×3) en clases de flex. */
function positionClasses(pos: string): string {
  switch (pos) {
    case 'top-left':
      return 'items-start justify-start'
    case 'top-center':
      return 'items-start justify-center'
    case 'top-right':
      return 'items-start justify-end'
    case 'middle-left':
      return 'items-center justify-start'
    case 'middle-right':
      return 'items-center justify-end'
    case 'bottom-left':
      return 'items-end justify-start'
    case 'bottom-center':
      return 'items-end justify-center'
    case 'bottom-right':
      return 'items-end justify-end'
    // middle-center (default)
    default:
      return 'items-center justify-center'
  }
}

/** Convierte text_align en clases. */
function textAlignClass(align?: string): string {
  switch (align) {
    case 'left':
      return 'text-left'
    case 'right':
      return 'text-right'
    default:
      return 'text-center'
  }
}

/** Resuelve la altura del hero según el campo `height`. */
function heightClass(height?: string): string {
  switch (height) {
    case '50vh':
      return 'min-h-[50vh]'
    case '70vh':
      return 'min-h-[70vh]'
    case '100vh':
      return 'min-h-[100dvh]'
    case 'custom':
      return '' // se aplica via style
    // auto o undefined: comportamiento heredado
    default:
      return ''
  }
}

export function HeroFullscreen({ content, organization, primaryColor }: HeroFullscreenProps) {
  const title = content.title || organization.name
  const subtitle = content.subtitle || organization.description || ''
  const ctaText = content.cta_text || 'Contáctanos'
  const ctaUrl = content.cta_url || '/contacto'
  const imageUrl = content.image_url || null
  const imageUrlMobile = content.image_url_mobile || null
  const showBooking = (content as any).show_booking_widget ?? organization.website_settings?.show_hero_booking ?? false
  const showOverlay = (content as any).show_overlay !== false
  const showTitle = (content as any).show_title !== false
  const showCta = (content as any).show_cta !== false
  const overlapHeader = (content as any).overlap_header !== false

  // F3.2 — campos nuevos con defaults que preservan el aspecto actual
  const height = (content as any).height || 'auto'
  const customHeight = Number((content as any).custom_height) || 0
  const overlayOpacity = content.overlay_opacity != null ? content.overlay_opacity / 100 : null
  const overlayColor = content.overlay_color || primaryColor || '#1A1A2E'
  const contentPosition = content.content_position || 'middle-center'
  const textAlign = content.text_align || 'center'
  const buttons = content.buttons

  // Solape con el header usando la variable CSS --header-h (F1)
  const overlapStyle: React.CSSProperties = overlapHeader
    ? { marginTop: 'calc(-1 * var(--header-h, 0px))', paddingTop: 'var(--header-h, 0px)' }
    : {}

  // Altura: si es custom, usar style; si no, clase
  const heightStyle: React.CSSProperties =
    height === 'custom' && customHeight > 0 ? { minHeight: `${customHeight}px` } : {}

  // Comportamiento heredado: si height es 'auto' y hay booking, usar min-h auto
  const isAutoHeight = height === 'auto'
  const bookingHeightClass = showBooking && isAutoHeight
    ? 'min-h-[auto] py-20 md:min-h-[720px] md:py-0'
    : heightClass(height) || (showBooking ? 'min-h-[auto] py-20 md:min-h-[720px] md:py-0' : 'min-h-[50vh] md:min-h-[70vh]')

  const pos = positionClasses(contentPosition)
  const alignClass = textAlignClass(textAlign)
  return (
    <div
      className={`relative ${bookingHeightClass} flex ${pos} text-white`}
      style={{ ...overlapStyle, ...heightStyle }}
    >
      {imageUrl && (
        <>
          {imageUrlMobile ? (
            <picture className="absolute inset-0 w-full h-full">
              <source media="(max-width: 767px)" srcSet={imageUrlMobile} />
              <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            </picture>
          ) : (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${imageUrl})` }}
            />
          )}
        </>
      )}
      {showOverlay && (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: overlayColor,
            // Si overlay_opacity está definido, usarlo; si no, preservar 0.7 con imagen / 1 sin imagen (heredado)
            opacity: overlayOpacity != null ? overlayOpacity : imageUrl ? 0.7 : 1,
          }}
        />
      )}
      <div className={`relative z-10 ${showBooking ? 'max-w-4xl' : 'max-w-3xl'} mx-auto px-4 sm:px-6 py-8 ${alignClass}`}>
        {showTitle && (
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
            {title}
          </h1>
        )}
        {showTitle && subtitle && (
          <p className="text-lg md:text-xl mb-8 opacity-90">
            {subtitle}
          </p>
        )}

        {showBooking ? (
          <HeroBookingWidget primaryColor={primaryColor || '#3B82F6'} />
        ) : (
          <HeroButtons
            buttons={buttons}
            ctaText={ctaText}
            ctaUrl={ctaUrl}
            primaryColor={primaryColor || '#8B6914'}
            showCta={showCta}
            layout={alignClass === 'text-center' ? 'row' : 'row'}
            className={alignClass === 'text-center' ? 'justify-center' : alignClass === 'text-left' ? 'justify-start' : 'justify-end'}
          />
        )}
      </div>
    </div>
  )
}
