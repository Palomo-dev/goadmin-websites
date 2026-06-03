import Link from 'next/link'
import { HeroBookingWidget } from './HeroBookingWidget'

interface HeroFullscreenProps {
  content: {
    title?: string
    subtitle?: string
    cta_text?: string
    cta_url?: string
    image_url?: string | null
  }
  organization: any
  primaryColor?: string
}

export function HeroFullscreen({ content, organization, primaryColor }: HeroFullscreenProps) {
  const title = content.title || organization.name
  const subtitle = content.subtitle || organization.description || ''
  const ctaText = content.cta_text || 'Contáctanos'
  const ctaUrl = content.cta_url || '/contacto'
  const imageUrl = content.image_url || null
  const showBooking = (content as any).show_booking_widget ?? organization.website_settings?.show_hero_booking ?? false
  const showOverlay = (content as any).show_overlay !== false
  const showTitle = (content as any).show_title !== false
  const showCta = (content as any).show_cta !== false

  return (
    <div className={`relative ${showBooking ? 'min-h-[auto] py-20 md:min-h-[720px] md:py-0' : 'min-h-[50vh] md:min-h-[70vh]'} flex items-center justify-center text-center text-white -mx-4 sm:-mx-6 lg:-mx-8 -mt-16 md:-mt-24`}>
      {imageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${imageUrl})` }}
        />
      )}
      {showOverlay && (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: primaryColor || '#1A1A2E', opacity: imageUrl ? 0.7 : 1 }}
        />
      )}
      <div className={`relative z-10 ${showBooking ? 'max-w-4xl' : 'max-w-3xl'} mx-auto px-4 sm:px-6`}>
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
        ) : showCta ? (
          <Link
            href={ctaUrl}
            className="inline-block px-8 py-3 rounded-lg text-lg font-semibold transition-transform hover:scale-105"
            style={{ backgroundColor: primaryColor || '#8B6914', color: '#FFFFFF' }}
          >
            {ctaText}
          </Link>
        ) : null}
      </div>
    </div>
  )
}
