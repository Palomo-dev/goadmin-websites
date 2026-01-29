'use client'

import { SiteHeader } from '../SiteHeader'
import { SiteFooter } from '../SiteFooter'
import { HeroParking, ParkingZones, ParkingFeatures, ParkingPricing } from '../sections/parking'
import { ContactSection } from '../sections/ContactSection'
import type { OrganizationWithDetails } from '@/types/database'
import type { TemplateConfig } from '@/lib/templates'

interface ParkingZone {
  id: string
  name: string
  description?: string
  base_rate: number
  available_spots?: number
}

interface ParkingTemplateProps {
  organization: OrganizationWithDetails
  template: TemplateConfig
  primaryColor: string
  zones: ParkingZone[]
}

export function ParkingTemplate({ 
  organization, 
  template, 
  primaryColor, 
  zones
}: ParkingTemplateProps) {
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
        {/* Hero Parking */}
        <HeroParking 
          organizationName={organization.name}
          tagline={settings?.hero_subtitle || undefined}
          primaryColor={primaryColor}
          backgroundImage={settings?.hero_image_url || undefined}
          address={organization.address || undefined}
        />
        
        {/* Parking Zones */}
        <ParkingZones 
          zones={zones}
          primaryColor={primaryColor}
        />
        
        {/* Features */}
        <ParkingFeatures primaryColor={primaryColor} />
        
        {/* Pricing */}
        <ParkingPricing primaryColor={primaryColor} />
        
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
