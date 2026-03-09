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
  const imageUrl = content.image_url || organization.website_settings?.hero_image_url
  const isHotel = organization.type_id === 2

  return (
    <div className={`relative ${isHotel ? 'min-h-[720px]' : 'min-h-[70vh]'} flex items-center justify-center text-center text-white -mx-4 md:-mx-6 lg:-mx-8 -mt-16 md:-mt-24`}>
      {imageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${imageUrl})` }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: primaryColor || '#1A1A2E', opacity: imageUrl ? 0.7 : 1 }}
      />
      <div className={`relative z-10 ${isHotel ? 'max-w-4xl' : 'max-w-3xl'} mx-auto px-6`}>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-lg md:text-xl mb-8 opacity-90">
            {subtitle}
          </p>
        )}

        {isHotel ? (
          <HeroBookingWidget primaryColor={primaryColor || '#3B82F6'} />
        ) : (
          <Link
            href={ctaUrl}
            className="inline-block px-8 py-3 rounded-lg text-lg font-semibold transition-transform hover:scale-105"
            style={{ backgroundColor: primaryColor || '#8B6914', color: '#FFFFFF' }}
          >
            {ctaText}
          </Link>
        )}
      </div>
    </div>
  )
}
