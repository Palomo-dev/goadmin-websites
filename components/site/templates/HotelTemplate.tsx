'use client'

import { SiteHeader } from '../SiteHeader'
import { SiteFooter } from '../SiteFooter'
import { HeroBooking, RoomTypes, Amenities, WhyChooseUs } from '../sections/hotel'
import { GallerySection } from '../sections/GallerySection'
import { ContactSection } from '../sections/ContactSection'
import type { OrganizationWithDetails } from '@/types/database'
import type { TemplateConfig } from '@/lib/templates'

interface SpaceType {
  id: string
  name: string
  description?: string
  base_rate: number
  max_occupancy: number
  amenities?: Record<string, boolean>
}

interface HotelTemplateProps {
  organization: OrganizationWithDetails
  template: TemplateConfig
  primaryColor: string
  spaceTypes?: SpaceType[]
  spaces?: any[]
}

export function HotelTemplate({ 
  organization, 
  template, 
  primaryColor, 
  spaceTypes,
  spaces
}: HotelTemplateProps) {
  const settings = organization.website_settings as any
  
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader 
        organization={organization} 
        primaryColor={primaryColor} 
        template={template}
        showCart={false}
      />
      
      <main>
        {/* Hero with Booking */}
        <HeroBooking 
          organizationName={organization.name}
          tagline={settings?.hero_subtitle || undefined}
          primaryColor={primaryColor}
          backgroundImage={settings?.hero_image || undefined}
          location={organization.address || undefined}
        />
        
        {/* Room Types */}
        <RoomTypes 
          spaces={spaces}
          spaceTypes={spaceTypes}
          primaryColor={primaryColor}
        />
        
        {/* Why Choose Us */}
        <WhyChooseUs 
          primaryColor={primaryColor}
          organizationName={organization.name}
        />
        
        {/* Amenities */}
        <Amenities primaryColor={primaryColor} />
        
        {/* Gallery */}
        <GallerySection 
          primaryColor={primaryColor}
          images={[]}
        />
        
        {/* Contact */}
        <ContactSection 
          organization={organization}
          primaryColor={primaryColor}
          settings={settings}
        />
      </main>
      
      <SiteFooter 
        organization={organization} 
        settings={settings} 
        primaryColor={primaryColor}
        template={template}
      />
    </div>
  )
}
