import Link from 'next/link'
import { HeroBookingWidget } from './HeroBookingWidget'

interface HeroMinimalProps {
  content: {
    title?: string
    subtitle?: string
    cta_text?: string
    cta_url?: string
  }
  organization?: any
  primaryColor?: string
}

export function HeroMinimal({ content, organization, primaryColor }: HeroMinimalProps) {
  const showBooking = (content as any).show_booking_widget ?? organization?.website_settings?.show_hero_booking ?? false

  return (
    <div className="text-center py-4">
      <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: primaryColor }}>
        {content.title || 'Título'}
      </h1>
      {content.subtitle && (
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-6">
          {content.subtitle}
        </p>
      )}
      {showBooking ? (
        <div className="mt-6 max-w-4xl mx-auto">
          <HeroBookingWidget primaryColor={primaryColor || '#3B82F6'} />
        </div>
      ) : content.cta_text && content.cta_url ? (
        <Link
          href={content.cta_url}
          className="inline-block mt-4 px-8 py-3 rounded-lg text-white font-semibold transition-transform hover:scale-105"
          style={{ backgroundColor: primaryColor || '#8B6914' }}
        >
          {content.cta_text}
        </Link>
      ) : null}
    </div>
  )
}
