import { HeroBookingWidget } from './HeroBookingWidget'

interface HeroMinimalProps {
  content: {
    title?: string
    subtitle?: string
  }
  organization?: any
  primaryColor?: string
}

export function HeroMinimal({ content, organization, primaryColor }: HeroMinimalProps) {
  const showBooking = organization?.website_settings?.show_hero_booking === true

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
      {showBooking && (
        <div className="mt-6 max-w-4xl mx-auto">
          <HeroBookingWidget primaryColor={primaryColor || '#3B82F6'} />
        </div>
      )}
    </div>
  )
}
