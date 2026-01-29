'use client'

import { SiteHeader } from '../SiteHeader'
import { SiteFooter } from '../SiteFooter'
import { HeroTransport, FleetShowcase, TransportServices, BookingCTA } from '../sections/transport'
import { ContactSection } from '../sections/ContactSection'
import type { OrganizationWithDetails } from '@/types/database'
import type { TemplateConfig } from '@/lib/templates'

interface Vehicle {
  id: string
  name: string
  description?: string
  capacity?: number
  base_rate?: number
}

interface TransportTemplateProps {
  organization: OrganizationWithDetails
  template: TemplateConfig
  primaryColor: string
  vehicles: Vehicle[]
}

export function TransportTemplate({ 
  organization, 
  template, 
  primaryColor, 
  vehicles
}: TransportTemplateProps) {
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
        {/* Hero Transport */}
        <HeroTransport 
          organizationName={organization.name}
          tagline={settings?.hero_subtitle || undefined}
          primaryColor={primaryColor}
          backgroundImage={settings?.hero_image_url || undefined}
          phone={organization.phone || undefined}
        />
        
        {/* Services */}
        <TransportServices primaryColor={primaryColor} />
        
        {/* Fleet Showcase */}
        <FleetShowcase 
          vehicles={vehicles}
          primaryColor={primaryColor}
        />
        
        {/* Booking CTA */}
        <BookingCTA 
          primaryColor={primaryColor}
          phone={organization.phone || undefined}
          whatsapp={settings?.social_links?.whatsapp || undefined}
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
