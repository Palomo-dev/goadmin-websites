'use client'

import { useState, useEffect, useRef } from 'react'
import SiteHeader from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { ZonaGlobalPreview } from './ZonaGlobalPreview'
import { CartDrawer } from './CartDrawer'
import { CountdownBanner } from './CountdownBanner'
import MetaPixel from './MetaPixel'
import { CartEventTracker } from './CartEventTracker'
import GoogleAdsTag from './GoogleAdsTag'
import GoogleAnalytics from './GoogleAnalytics'
import { ChatWidget } from './ChatWidget'
import CustomScripts from './CustomScripts'
import { VisitTracker } from './VisitTracker'
import { CurrencyProvider } from './CurrencyProvider'
import { FrozenAccountNotice } from './FrozenAccountNotice'
import type { FrozenReason } from '@/lib/get-org-context'
import type { OrganizationWithDetails, WebsitePage, WebsitePageWithChildren, WebsiteMenuWithItems, WebsiteSettings } from '@/types/database'
import type { TemplateConfig, NavItem } from '@/lib/templates'
import type { MenuCategory } from './header/HeaderShared'
import type { ResolvedOutlet } from '@/lib/outlet/resolver'

interface OrganizationLayoutProps {
  organization: OrganizationWithDetails
  template: TemplateConfig
  primaryColor: string
  children: React.ReactNode
  headerNav?: WebsitePage[]
  headerNavTree?: WebsitePageWithChildren[]
  menuCategories?: MenuCategory[]
  megaMenuItems?: NavItem[]
  footerNav?: WebsitePage[]
  footerNavTree?: WebsitePageWithChildren[]
  menus?: WebsiteMenuWithItems[]
  metaPixelId?: string | null
  googleAdsConfig?: { conversionId: string; conversionLabel?: string } | null
  taxSettings?: { name: string; rate: number; taxIncluded: boolean } | null
  frozenReason?: FrozenReason
  showCurrencyCode?: boolean
  currencyPosition?: 'left' | 'right'
  effectiveSettings?: WebsiteSettings | null
  outlet?: ResolvedOutlet | null
  branchId?: number | null
}

export function OrganizationLayout({
  organization,
  template,
  primaryColor,
  children,
  headerNav,
  headerNavTree,
  menuCategories,
  megaMenuItems,
  footerNav,
  footerNavTree,
  menus,
  metaPixelId,
  googleAdsConfig,
  taxSettings,
  frozenReason,
  showCurrencyCode,
  currencyPosition,
  effectiveSettings,
  outlet,
  branchId
}: OrganizationLayoutProps) {
  const [cartOpen, setCartOpen] = useState(false)
  const settings = (effectiveSettings ?? organization.website_settings) as any
  const subdomain = organization.subdomain || ''
  const effectiveShowCurrencyCode = showCurrencyCode ?? settings?.show_currency_code ?? false
  const effectiveCurrencyPosition = currencyPosition ?? settings?.currency_position ?? 'left'
  const rootRef = useRef<HTMLDivElement>(null)

  // Medir la altura real del header y exponerla como --header-h
  // para que los heros con overlap_header puedan solaparlo correctamente
  useEffect(() => {
    if (frozenReason) return
    const root = rootRef.current
    if (!root) return
    const header = root.querySelector('header')
    if (!header) return
    const updateHeaderH = () => {
      const h = header.getBoundingClientRect().height
      root.style.setProperty('--header-h', `${h}px`)
    }
    updateHeaderH()
    const observer = new ResizeObserver(updateHeaderH)
    observer.observe(header)
    return () => observer.disconnect()
  }, [frozenReason])
  
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
    <CurrencyProvider showCurrencyCode={effectiveShowCurrencyCode} currencyPosition={effectiveCurrencyPosition}>
    <div
      ref={rootRef}
      className={`min-h-screen flex flex-col ${isDark ? 'dark bg-gray-900 text-white' : 'bg-white text-gray-900'}`}
      style={cssVariables}
      suppressHydrationWarning
    >
      {/* Header específico según tipo (oculto si la cuenta está congelada) */}
      {!frozenReason && (
        <ZonaGlobalPreview zona="header">
        <SiteHeader
          organization={organization}
          primaryColor={primaryColor}
          template={template}
          showCart={showCart}
          onCartClick={() => setCartOpen(true)}
          headerNav={headerNav}
          headerNavTree={headerNavTree}
          menuCategories={menuCategories}
          megaMenuItems={megaMenuItems}
          branchId={branchId}
        />
        </ZonaGlobalPreview>
      )}
      
      {/* Countdown Banner (debajo del header, oculto si está congelada) */}
      {!frozenReason && settings?.countdown_enabled && settings?.countdown_show_in_header && (
        <CountdownBanner
          config={settings}
          primaryColor={primaryColor}
          variant="banner"
        />
      )}

      {/* Contenido de la página */}
      <main className="flex-grow">
        {frozenReason ? (
          <FrozenAccountNotice
            reason={frozenReason}
            primaryColor={primaryColor}
            organizationName={organization.name}
            organizationEmail={organization.email}
            organizationPhone={organization.phone}
          />
        ) : (
          children
        )}
      </main>
      
      {/* Footer (oculto si la cuenta está congelada) */}
      {!frozenReason && (
        <ZonaGlobalPreview zona="footer">
        <SiteFooter
          organization={organization}
          settings={settings}
          primaryColor={primaryColor}
          template={template}
          footerNav={footerNav}
          footerNavTree={footerNavTree}
          menuCategories={menuCategories}
          menus={menus}
        />
        </ZonaGlobalPreview>
      )}
      
      {/* Cart Drawer (oculto si la cuenta está congelada) */}
      {!frozenReason && showCart && (
        <CartDrawer 
          isOpen={cartOpen}
          onClose={() => setCartOpen(false)}
          primaryColor={primaryColor}
          organizationSubdomain={subdomain}
          organizationId={organization.id}
          shippingSettings={{
            shippingFlatRate: settings?.shipping_flat_rate || 0,
            freeShippingThreshold: settings?.free_shipping_threshold || 0,
            enableShipping: settings?.enable_shipping ?? true
          }}
          taxSettings={taxSettings}
          countdownConfig={settings?.countdown_enabled ? settings : undefined}
          cartButtonConfig={{
            mode: settings?.cart_button_mode || 'dynamic',
            texts: settings?.cart_button_texts || ['Comprar Ahora', 'Aprovechar Oferta', 'Obtener Descuento', 'Comprar con Descuento']
          }}
          branchId={branchId}
        />
      )}
      
      {/* Meta Pixel (Facebook) */}
      {metaPixelId && <MetaPixel pixelId={metaPixelId} />}

      {/* Custom Scripts (Meta Pixel, Google Analytics, chat widgets, etc.)
          Inyectados client-side vía useEffect para que el Event Setup Tool
          de Meta pueda detectar los pixels (necesita que los scripts se
          ejecuten DESPUÉS de que Meta instale su interceptor en el iframe). */}
      {settings?.custom_scripts && <CustomScripts scripts={settings.custom_scripts} />}
      
      {/* Google Ads Tag (gtag.js) */}
      {googleAdsConfig && <GoogleAdsTag conversionId={googleAdsConfig.conversionId} conversionLabel={googleAdsConfig.conversionLabel} />}
      
      {/* Google Analytics GA4 */}
      {settings?.analytics_id && <GoogleAnalytics measurementId={settings.analytics_id} />}
      
      {/* CSS Personalizado */}
      {settings?.custom_css && (
        <style dangerouslySetInnerHTML={{ __html: settings.custom_css }} />
      )}
      
      {/* Chat Widget (oculto si la cuenta está congelada) */}
      {!frozenReason && settings?.chat_widget_enabled && settings?.chat_widget_public_key && (
        <ChatWidget publicKey={settings.chat_widget_public_key} />
      )}

      {/* Tracking de visitas web (page views) */}
      <VisitTracker organizationId={organization.id} />

      {/* AddToCart (Meta Pixel / gtag) para cualquier camino que agregue al carrito */}
      <CartEventTracker organizationSubdomain={subdomain} branchId={branchId} />
    </div>
    </CurrencyProvider>
  )
}
