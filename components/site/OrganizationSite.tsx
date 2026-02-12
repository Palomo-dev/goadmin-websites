import type { OrganizationWithDetails } from '@/types/database'
import type { BusinessTypeConfig } from '@/types/organization'
import { getTemplate, getTemplateByBusinessType } from '@/lib/templates'
import { 
  RetailTemplate, 
  HotelTemplate, 
  RestaurantTemplate, 
  GymTemplate,
  TransportTemplate,
  ParkingTemplate,
  SaasTemplate
} from './templates'
import { SiteHeader } from './SiteHeader'
import { SiteHero } from './SiteHero'
import { SiteFooter } from './SiteFooter'
import { ProductsSection } from './sections/ProductsSection'
import { ServicesSection } from './sections/ServicesSection'
import { ContactSection } from './sections/ContactSection'
import { GallerySection } from './sections/GallerySection'
import { TestimonialsSection } from './sections/TestimonialsSection'
import { FaqSection } from './sections/FaqSection'

interface OrganizationSiteProps {
  organization: OrganizationWithDetails
  businessType: BusinessTypeConfig
  products?: any[]
  categories?: any[]
  spaceTypes?: any[]
  membershipPlans?: any[]
  gymClasses?: any[]
  reservationCounts?: Record<number, number>
}

export function OrganizationSite({ 
  organization, 
  businessType,
  products = [],
  categories = [],
  spaceTypes = [],
  membershipPlans = [],
  gymClasses = [],
  reservationCounts = {}
}: OrganizationSiteProps) {
  const settings = organization.website_settings
  
  // Obtener configuración del template - priorizar el configurado, sino usar el del tipo de negocio
  const template = settings?.template_id 
    ? getTemplate(settings.template_id) 
    : getTemplateByBusinessType(organization.type_id)
  
  // Colores del sitio
  const primaryColor = settings?.primary_color || organization.primary_color || '#3B82F6'
  
  // Renderizar template según tipo de organización
  const orgType = businessType.type
  
  // Templates específicos por tipo de negocio
  if (orgType === 'retail') {
    return (
      <RetailTemplate
        organization={organization}
        template={template}
        primaryColor={primaryColor}
        products={products}
        categories={categories}
      />
    )
  }
  
  if (orgType === 'hotel') {
    return (
      <HotelTemplate
        organization={organization}
        template={template}
        primaryColor={primaryColor}
        spaceTypes={spaceTypes}
      />
    )
  }
  
  if (orgType === 'restaurant') {
    return (
      <RestaurantTemplate
        organization={organization}
        template={template}
        primaryColor={primaryColor}
        products={products}
        categories={categories}
      />
    )
  }
  
  if (orgType === 'gym') {
    return (
      <GymTemplate
        organization={organization}
        template={template}
        primaryColor={primaryColor}
        membershipPlans={membershipPlans}
        gymClasses={gymClasses}
        reservationCounts={reservationCounts}
      />
    )
  }
  
  if (orgType === 'transport') {
    return (
      <TransportTemplate
        organization={organization}
        template={template}
        primaryColor={primaryColor}
        vehicles={spaceTypes as any}
      />
    )
  }
  
  if (orgType === 'parking') {
    return (
      <ParkingTemplate
        organization={organization}
        template={template}
        primaryColor={primaryColor}
        zones={spaceTypes as any}
      />
    )
  }
  
  if (orgType === 'saas') {
    return (
      <SaasTemplate
        organization={organization}
        template={template}
        primaryColor={primaryColor}
        products={products}
      />
    )
  }
  
  // Template genérico para otros tipos
  const secondaryColor = settings?.secondary_color || organization.secondary_color || '#1E40AF'
  
  const cssVariables = {
    '--primary-color': primaryColor,
    '--secondary-color': secondaryColor,
    '--accent-color': settings?.accent_color || primaryColor,
    '--font-heading': template.fonts.heading,
    '--font-body': template.fonts.body,
  } as React.CSSProperties
  
  return (
    <div 
      className="min-h-screen bg-white"
      style={cssVariables}
    >
      <SiteHeader 
        organization={organization}
        primaryColor={primaryColor}
        template={template}
      />
      
      <SiteHero 
        organization={organization}
        settings={settings}
        businessType={businessType}
        primaryColor={primaryColor}
      />
      
      <main>
        {(settings?.show_products !== false) && (
          <ProductsSection 
            organizationId={organization.id}
            businessType={businessType}
            primaryColor={primaryColor}
          />
        )}
        
        {(settings?.show_services !== false) && (
          <ServicesSection 
            organizationId={organization.id}
            businessType={businessType}
            primaryColor={primaryColor}
          />
        )}
        
        {(settings?.show_gallery !== false) && settings?.gallery_images && (
          <GallerySection 
            images={settings.gallery_images as any[]}
            primaryColor={primaryColor}
          />
        )}
        
        {(settings?.show_testimonials !== false) && settings?.testimonials && (
          <TestimonialsSection 
            testimonials={settings.testimonials as any[]}
            primaryColor={primaryColor}
          />
        )}
        
        {(settings?.show_faq !== false) && settings?.faq_items && (
          <FaqSection 
            items={settings.faq_items as any[]}
            primaryColor={primaryColor}
          />
        )}
        
        {(settings?.show_contact !== false) && (
          <ContactSection 
            organization={organization}
            settings={settings}
            primaryColor={primaryColor}
          />
        )}
      </main>
      
      <SiteFooter 
        organization={organization}
        settings={settings}
        primaryColor={primaryColor}
        template={template}
      />
      
      {settings?.custom_css && (
        <style dangerouslySetInnerHTML={{ __html: settings.custom_css }} />
      )}
    </div>
  )
}
