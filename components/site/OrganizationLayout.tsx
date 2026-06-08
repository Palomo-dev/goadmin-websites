'use client'

import { useState, useEffect } from 'react'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { CartDrawer } from './CartDrawer'
import { CountdownBanner } from './CountdownBanner'
import MetaPixel from './MetaPixel'
import GoogleAdsTag from './GoogleAdsTag'
import GoogleAnalytics from './GoogleAnalytics'
import CustomScripts from './CustomScripts'
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
  googleAdsConfig?: { conversionId: string; conversionLabel?: string } | null
}

export function OrganizationLayout({
  organization,
  template,
  primaryColor,
  children,
  headerNav,
  footerNav,
  metaPixelId,
  googleAdsConfig
}: OrganizationLayoutProps) {
  const [cartOpen, setCartOpen] = useState(false)
  const settings = organization.website_settings as any
  const subdomain = organization.subdomain || ''
  
  // Theme mode: light | dark | auto
  const themeMode: string = settings?.theme_mode || 'light'
  const [isDark, setIsDark] = useState(themeMode === 'dark')

  useEffect(() => {
    if (themeMode === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      setIsDark(mq.matches)
      const handler = (e: MediaQueryListEvent) => setIsDark(e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
    setIsDark(themeMode === 'dark')
  }, [themeMode])

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
      className={`min-h-screen flex flex-col ${isDark ? 'dark bg-gray-950 text-white' : 'bg-white text-gray-900'}`}
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
      
      {/* Countdown Banner (debajo del header) */}
      {settings?.countdown_enabled && settings?.countdown_show_in_header && (
        <CountdownBanner
          config={settings}
          primaryColor={primaryColor}
          variant="banner"
        />
      )}

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
          shippingSettings={{
            shippingFlatRate: settings?.shipping_flat_rate || 0,
            freeShippingThreshold: settings?.free_shipping_threshold || 0,
            enableShipping: settings?.enable_shipping ?? true
          }}
          countdownConfig={settings?.countdown_enabled ? settings : undefined}
        />
      )}
      
      {/* Meta Pixel (Facebook) */}
      {metaPixelId && <MetaPixel pixelId={metaPixelId} />}
      
      {/* Google Ads Tag (gtag.js) */}
      {googleAdsConfig && <GoogleAdsTag conversionId={googleAdsConfig.conversionId} conversionLabel={googleAdsConfig.conversionLabel} />}
      
      {/* Google Analytics GA4 */}
      {settings?.analytics_id && <GoogleAnalytics measurementId={settings.analytics_id} />}
      
      {/* CSS Personalizado */}
      {settings?.custom_css && (
        <style dangerouslySetInnerHTML={{ __html: settings.custom_css }} />
      )}
      
      {/* Scripts Personalizados */}
      {settings?.custom_scripts && <CustomScripts scripts={settings.custom_scripts} />}
    </div>
  )
}
