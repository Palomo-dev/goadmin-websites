import type { OrganizationWithDetails } from '@/types/database'
import type { BusinessTypeConfig } from '@/types/organization'
import { getTemplate } from '@/lib/templates'
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
}

export function OrganizationSite({ organization, businessType }: OrganizationSiteProps) {
  const settings = organization.website_settings
  const orgType = organization.organization_types
  
  // Obtener configuración del template
  const template = getTemplate(settings?.template_id || 'modern')
  
  // Colores del sitio
  const primaryColor = settings?.primary_color || organization.primary_color || '#3B82F6'
  const secondaryColor = settings?.secondary_color || organization.secondary_color || '#1E40AF'
  
  // CSS Variables para colores personalizados
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
      {/* Header */}
      <SiteHeader 
        organization={organization}
        primaryColor={primaryColor}
      />
      
      {/* Hero Section */}
      <SiteHero 
        organization={organization}
        settings={settings}
        businessType={businessType}
        primaryColor={primaryColor}
      />
      
      {/* Secciones dinámicas según configuración */}
      <main>
        {/* Productos (para retail, restaurantes) */}
        {(settings?.show_products !== false) && (
          <ProductsSection 
            organizationId={organization.id}
            businessType={businessType}
            primaryColor={primaryColor}
          />
        )}
        
        {/* Servicios (para hoteles, gyms, etc.) */}
        {(settings?.show_services !== false) && (
          <ServicesSection 
            organizationId={organization.id}
            businessType={businessType}
            primaryColor={primaryColor}
          />
        )}
        
        {/* Galería */}
        {(settings?.show_gallery !== false) && settings?.gallery_images && (
          <GallerySection 
            images={settings.gallery_images as any[]}
            primaryColor={primaryColor}
          />
        )}
        
        {/* Testimonios */}
        {(settings?.show_testimonials !== false) && settings?.testimonials && (
          <TestimonialsSection 
            testimonials={settings.testimonials as any[]}
            primaryColor={primaryColor}
          />
        )}
        
        {/* FAQ */}
        {(settings?.show_faq !== false) && settings?.faq_items && (
          <FaqSection 
            items={settings.faq_items as any[]}
            primaryColor={primaryColor}
          />
        )}
        
        {/* Contacto */}
        {(settings?.show_contact !== false) && (
          <ContactSection 
            organization={organization}
            settings={settings}
            primaryColor={primaryColor}
          />
        )}
      </main>
      
      {/* Footer */}
      <SiteFooter 
        organization={organization}
        settings={settings}
        primaryColor={primaryColor}
      />
      
      {/* CSS Personalizado */}
      {settings?.custom_css && (
        <style dangerouslySetInnerHTML={{ __html: settings.custom_css }} />
      )}
    </div>
  )
}
