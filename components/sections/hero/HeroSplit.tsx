import Link from 'next/link'
import { HeroBookingWidget } from './HeroBookingWidget'
import { HeroButtons, type HeroButtonItem } from './HeroButtons'

interface HeroSplitProps {
  content: {
    title?: string
    subtitle?: string
    cta_text?: string
    cta_url?: string
    cta_secondary_text?: string
    cta_secondary_url?: string
    image_url?: string
    // F3.5 — campos nuevos
    content_position?: string
    buttons?: HeroButtonItem[]
  }
  primaryColor?: string
  organization?: any
}

/** Alineación vertical del contenido según content_position. */
function verticalAlignClass(pos: string): string {
  switch (pos) {
    case 'top-left':
    case 'top-center':
    case 'top-right':
      return 'self-start'
    case 'bottom-left':
    case 'bottom-center':
    case 'bottom-right':
      return 'self-end'
    default:
      return 'self-center'
  }
}

export function HeroSplit({ content, primaryColor, organization }: HeroSplitProps) {
  const imageUrl = content.image_url || organization?.logo_url
  const showTitle = (content as any).show_title !== false
  const showCta = (content as any).show_cta !== false
  const contentPosition = content.content_position || 'middle-center'
  const alignClass = verticalAlignClass(contentPosition)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-center py-8 md:py-0 md:min-h-[60vh]">
      <div className={alignClass}>
        {showTitle && content.title && (
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-4 dark:text-white">{content.title}</h1>
        )}
        {showTitle && content.subtitle && (
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8">{content.subtitle}</p>
        )}
        {((content as any).show_booking_widget ?? organization?.website_settings?.show_hero_booking ?? false) ? (
          <HeroBookingWidget primaryColor={primaryColor || '#3B82F6'} />
        ) : content.buttons && content.buttons.length > 0 ? (
          // F3.5 — repeater de botones
          <HeroButtons
            buttons={content.buttons}
            primaryColor={primaryColor || '#3B82F6'}
            showCta={showCta}
            className="flex-wrap"
          />
        ) : showCta ? (
          <div className="flex flex-wrap gap-4">
            {content.cta_text && content.cta_url && (
              <Link
                href={content.cta_url}
                className="px-8 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
                style={{ backgroundColor: primaryColor }}
              >
                {content.cta_text}
              </Link>
            )}
            {content.cta_secondary_text && content.cta_secondary_url && (
              <Link
                href={content.cta_secondary_url}
                className="px-8 py-3 rounded-lg font-medium border-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                style={{ borderColor: primaryColor, color: primaryColor }}
              >
                {content.cta_secondary_text}
              </Link>
            )}
          </div>
        ) : null}
      </div>
      <div className="order-first md:order-last">
        {imageUrl ? (
          <img src={imageUrl} alt={content.title || ''} className="w-full rounded-2xl shadow-lg" loading="eager" />
        ) : (
          <div className="w-full aspect-square rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${primaryColor}10` }}>
            <span className="text-8xl opacity-30">🏢</span>
          </div>
        )}
      </div>
    </div>
  )
}
