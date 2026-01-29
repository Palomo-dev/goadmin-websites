'use client'

import { SiteHeader } from '../SiteHeader'
import { SiteFooter } from '../SiteFooter'
import { HeroRestaurant, MenuPreview, Specialties, ReservationCTA } from '../sections/restaurant'
import { GallerySection } from '../sections/GallerySection'
import { ContactSection } from '../sections/ContactSection'
import type { OrganizationWithDetails } from '@/types/database'
import type { TemplateConfig } from '@/lib/templates'

interface Product {
  id: number
  name: string
  description?: string
  category_id?: number
  product_prices?: { price: number }[]
}

interface Category {
  id: number
  name: string
  slug: string
}

interface RestaurantTemplateProps {
  organization: OrganizationWithDetails
  template: TemplateConfig
  primaryColor: string
  products: Product[]
  categories: Category[]
}

export function RestaurantTemplate({ 
  organization, 
  template, 
  primaryColor, 
  products,
  categories
}: RestaurantTemplateProps) {
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
        {/* Hero Restaurant */}
        <HeroRestaurant 
          organizationName={organization.name}
          tagline={settings?.hero_subtitle || undefined}
          primaryColor={primaryColor}
          backgroundImage={settings?.hero_image || undefined}
          phone={organization.phone || undefined}
          address={organization.address || undefined}
        />
        
        {/* Specialties */}
        <Specialties 
          primaryColor={primaryColor}
          organizationName={organization.name}
        />
        
        {/* Menu Preview */}
        <MenuPreview 
          products={products}
          categories={categories}
          primaryColor={primaryColor}
        />
        
        {/* Gallery */}
        <GallerySection 
          primaryColor={primaryColor}
          images={[]}
        />
        
        {/* Reservation CTA */}
        <ReservationCTA 
          primaryColor={primaryColor}
          phone={organization.phone || undefined}
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
