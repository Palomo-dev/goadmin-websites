'use client'

import { SiteHeader } from '../SiteHeader'
import { SiteFooter } from '../SiteFooter'
import { HeroSaas, SaasFeatures, SaasPricing, SaasTestimonials, SaasCTA } from '../sections/saas'
import { ContactSection } from '../sections/ContactSection'
import type { OrganizationWithDetails } from '@/types/database'
import type { TemplateConfig } from '@/lib/templates'

interface Product {
  id: number
  name: string
  description?: string
  product_prices?: { price: number }[]
}

interface SaasTemplateProps {
  organization: OrganizationWithDetails
  template: TemplateConfig
  primaryColor: string
  products: Product[]
}

export function SaasTemplate({ 
  organization, 
  template, 
  primaryColor, 
  products
}: SaasTemplateProps) {
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
        {/* Hero SaaS */}
        <HeroSaas 
          organizationName={organization.name}
          tagline={settings?.hero_subtitle || undefined}
          primaryColor={primaryColor}
          backgroundImage={settings?.hero_image_url || undefined}
        />
        
        {/* Features */}
        <SaasFeatures primaryColor={primaryColor} />
        
        {/* Pricing */}
        <SaasPricing 
          products={products}
          primaryColor={primaryColor}
        />
        
        {/* Testimonials */}
        <SaasTestimonials primaryColor={primaryColor} />
        
        {/* CTA */}
        <SaasCTA 
          primaryColor={primaryColor}
          organizationName={organization.name}
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
