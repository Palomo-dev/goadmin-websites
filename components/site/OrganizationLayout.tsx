'use client'

import { useState } from 'react'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { CartDrawer } from './CartDrawer'
import MetaPixel from './MetaPixel'
import type { OrganizationWithDetails, WebsitePage } from '@/types/database'
import type { TemplateConfig } from '@/lib/templates'

interface OrganizationLayoutProps {
  organization: OrganizationWithDetails
  template: TemplateConfig
  primaryColor: string
  children: React.ReactNode
  headerNav?: WebsitePage[]
  footerNav?: WebsitePage[]
  metaPixelId?: string | null
}

export function OrganizationLayout({
  organization,
  template,
  primaryColor,
  children,
  headerNav,
  footerNav,
  metaPixelId
}: OrganizationLayoutProps) {
  const [cartOpen, setCartOpen] = useState(false)
  const settings = organization.website_settings as any
  const subdomain = organization.subdomain || ''
  
  // El carrito está disponible para todos los tipos de organización
  const showCart = true
  
  // CSS Variables para colores personalizados
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
      className="min-h-screen bg-white flex flex-col"
      style={cssVariables}
    >
      {/* Header específico según tipo */}
      <SiteHeader 
        organization={organization}
        primaryColor={primaryColor}
        template={template}
        showCart={showCart}
        onCartClick={() => setCartOpen(true)}
        headerNav={headerNav}
      />
      
      {/* Contenido de la página */}
      <main className="flex-grow">
        {children}
      </main>
      
      {/* Footer */}
      <SiteFooter 
        organization={organization}
        settings={settings}
        primaryColor={primaryColor}
        template={template}
        footerNav={footerNav}
      />
      
      {/* Cart Drawer disponible para todos */}
      {showCart && (
        <CartDrawer 
          isOpen={cartOpen}
          onClose={() => setCartOpen(false)}
          primaryColor={primaryColor}
          organizationSubdomain={subdomain}
        />
      )}
      
      {/* Meta Pixel (Facebook) */}
      {metaPixelId && <MetaPixel pixelId={metaPixelId} />}
      
      {/* CSS Personalizado */}
      {settings?.custom_css && (
        <style dangerouslySetInnerHTML={{ __html: settings.custom_css }} />
      )}
    </div>
  )
}
