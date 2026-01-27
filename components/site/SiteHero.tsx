import Image from 'next/image'
import { Button } from '@/components/ui/button'
import type { OrganizationWithDetails, WebsiteSettings } from '@/types/database'
import type { BusinessTypeConfig } from '@/types/organization'

interface SiteHeroProps {
  organization: OrganizationWithDetails
  settings: WebsiteSettings | null
  businessType: BusinessTypeConfig
  primaryColor: string
}

export function SiteHero({ organization, settings, businessType, primaryColor }: SiteHeroProps) {
  const title = settings?.hero_title || organization.name
  const subtitle = settings?.hero_subtitle || organization.description || `Bienvenido a ${organization.name}`
  const ctaText = settings?.hero_cta_text || businessType.primaryAction.label
  const heroImage = settings?.hero_image_url
  
  return (
    <section className="relative overflow-hidden">
      {/* Background */}
      <div 
        className="absolute inset-0 bg-gradient-to-br opacity-10"
        style={{ 
          background: `linear-gradient(135deg, ${primaryColor}20 0%, ${primaryColor}05 100%)` 
        }}
      />
      
      {/* Hero Image Background */}
      {heroImage && (
        <div className="absolute inset-0">
          <Image
            src={heroImage}
            alt={title}
            fill
            className="object-cover opacity-20"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-white/70" />
        </div>
      )}
      
      <div className="container mx-auto px-4 py-20 md:py-32 relative">
        <div className="max-w-3xl">
          {/* Badge del tipo de negocio */}
          <div 
            className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium mb-6"
            style={{ 
              backgroundColor: `${primaryColor}15`,
              color: primaryColor 
            }}
          >
            <span className="mr-2">{businessType.icon}</span>
            {businessType.name}
          </div>
          
          {/* Título */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            {title}
          </h1>
          
          {/* Subtítulo */}
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            {subtitle}
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              size="lg"
              className="text-lg px-8 py-6 hover:opacity-90"
              style={{ backgroundColor: primaryColor }}
            >
              {ctaText}
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="text-lg px-8 py-6"
              style={{ borderColor: primaryColor, color: primaryColor }}
            >
              Conocer más
            </Button>
          </div>
          
          {/* Info adicional */}
          {organization.address && (
            <div className="mt-12 flex items-center text-gray-500">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{organization.address}{organization.city && `, ${organization.city}`}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Decorative element */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-1"
        style={{ backgroundColor: primaryColor }}
      />
    </section>
  )
}
