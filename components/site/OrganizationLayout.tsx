'use client'

import { useState } from 'react'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { CartDrawer } from './CartDrawer'
import type { OrganizationWithDetails } from '@/types/database'
import type { TemplateConfig } from '@/lib/templates'

interface OrganizationLayoutProps {
  organization: OrganizationWithDetails
  template: TemplateConfig
  primaryColor: string
  children: React.ReactNode
}

export function OrganizationLayout({
  organization,
  template,
  primaryColor,
  children
}: OrganizationLayoutProps) {
  const [cartOpen, setCartOpen] = useState(false)
  const settings = organization.website_settings as any
  const subdomain = organization.subdomain || ''
  
  // Determinar si mostrar carrito según tipo de organización
  const orgType = organization.organization_types?.name || ''
  const showCart = orgType === 'retail'
  
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
      />
      
      {/* Cart Drawer solo para retail */}
      {showCart && (
        <CartDrawer 
          isOpen={cartOpen}
          onClose={() => setCartOpen(false)}
          primaryColor={primaryColor}
          organizationSubdomain={subdomain}
        />
      )}
      
      {/* CSS Personalizado */}
      {settings?.custom_css && (
        <style dangerouslySetInnerHTML={{ __html: settings.custom_css }} />
      )}
    </div>
  )
}
