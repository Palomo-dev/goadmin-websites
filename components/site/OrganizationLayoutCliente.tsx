'use client'

import { useState, useEffect, useRef } from 'react'
import SiteHeader from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { ZonaGlobalPreview } from './ZonaGlobalPreview'
import { useAjustesVivosPreview, type ItemMenuVivo } from './useAjustesVivosPreview'
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
import type { DatosSedeLayout } from '@/lib/outlet/sedeLayout'
import { prefijarArbolNav, prefijarItemsNav, quitarPrefijo } from '@/lib/outlet/rutaSitio'
import { RutaSitioProvider } from '@/lib/outlet/RutaSitioContext'
import { SelectorSede } from './header/SelectorSede'
import { MobileCTABar, rutaConBarraMovil } from './restaurant/MobileCTABar'
import { usePathname } from 'next/navigation'

/** Menú en edición del ERP → la forma de árbol que pinta el encabezado (solo preview). */
function arbolDesdeMenuVivo(items: ItemMenuVivo[], organizationId: number, nivel = 0): WebsitePageWithChildren[] {
  return items.map((item, i) => ({
    id: item.id,
    organization_id: organizationId,
    slug: item.ruta.replace(/^\/+/, ''),
    title: item.texto,
    is_published: true,
    show_in_header: true,
    show_in_footer: false,
    header_order: i,
    footer_order: 0,
    parent_page_id: null,
    level: nivel,
    children: arbolDesdeMenuVivo(item.hijos, organizationId, nivel + 1),
  }) as unknown as WebsitePageWithChildren)
}

export interface OrganizationLayoutProps {
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
  /** Lo pone el envoltorio de servidor (OrganizationLayout); las rutas no lo pasan. */
  datosSede?: DatosSedeLayout
}

export function OrganizationLayoutCliente({
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
  branchId,
  datosSede,
}: OrganizationLayoutProps) {
  const [cartOpen, setCartOpen] = useState(false)
  // Solo en el lienzo del editor (?preview=1): ajustes y menú en edición, sin guardar.
  // Fuera del preview `vivos` es null y todo queda exactamente como antes.
  const vivos = useAjustesVivosPreview()
  const settingsGuardados = (effectiveSettings ?? organization.website_settings) as any
  const settings = vivos ? { ...(settingsGuardados ?? {}), ...vivos.ajustes } : settingsGuardados
  const organizacionEncabezado = vivos
    ? { ...organization, website_settings: { ...((organization.website_settings as any) ?? {}), ...vivos.ajustes } }
    : organization
  const arbolVivo = vivos?.menuEncabezado ? arbolDesdeMenuVivo(vivos.menuEncabezado, organization.id) : null
  const subdomain = organization.subdomain || ''
  const effectiveShowCurrencyCode = showCurrencyCode ?? settings?.show_currency_code ?? false
  const effectiveCurrencyPosition = currencyPosition ?? settings?.currency_position ?? 'left'
  const rootRef = useRef<HTMLDivElement>(null)

  // Sede servida por prefijo de ruta (/sede-norte/...): navegación, logo y pie con el prefijo.
  // Sin prefijo (todos los sitios hoy) los árboles son los mismos objetos de antes.
  const prefijo = datosSede?.prefijoSede ?? ''
  const navEncabezado = prefijarArbolNav(arbolVivo ?? headerNav, prefijo)
  const arbolEncabezado = prefijarArbolNav(arbolVivo ?? headerNavTree, prefijo)
  const megaMenu = prefijarItemsNav(megaMenuItems, prefijo)
  const navPie = prefijarArbolNav(footerNav, prefijo)
  const arbolPie = prefijarArbolNav(footerNavTree, prefijo)
  const sedesSelector = datosSede?.sedesSelector ?? []
  const pathname = usePathname() ?? '/'
  // Barra «Reservar · Cómo llegar · Pedir»: no con la barra de pestañas del encabezado móvil
  // (ocupa el mismo sitio) ni donde ya hay barra propia (checkout, carrito, detalle, pedido).
  const barraMovil = !frozenReason && datosSede?.barraMovil && settings?.mobile_menu_style !== 'tabs'
    && rutaConBarraMovil(quitarPrefijo(pathname, prefijo))
    ? datosSede.barraMovil
    : null

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
    <RutaSitioProvider prefijo={prefijo} horarioSede={datosSede?.horarioPie ?? null}>
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
          organization={organizacionEncabezado as OrganizationWithDetails}
          primaryColor={primaryColor}
          template={template}
          showCart={showCart}
          onCartClick={() => setCartOpen(true)}
          headerNav={navEncabezado}
          headerNavTree={arbolEncabezado}
          menuCategories={menuCategories}
          megaMenuItems={megaMenu}
          branchId={branchId}
        />
        </ZonaGlobalPreview>
      )}

      {/* Sede (Figma «Elegir la sede»): chip «Sede X ▾» bajo el encabezado, a la derecha.
          Solo con 2 o más sedes publicadas (hoy ninguna organización las tiene). */}
      {!frozenReason && sedesSelector.length >= 2 && (
        <div className="border-b border-gray-100 dark:border-gray-800">
          <div className="container mx-auto flex justify-end px-4 py-2">
            <SelectorSede
              sedes={sedesSelector}
              actualId={datosSede?.sedeActualId ?? outlet?.branchId ?? null}
              subdomain={subdomain}
              primaryColor={primaryColor}
              prefijoActual={prefijo}
            />
          </div>
        </div>
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
          footerNav={navPie}
          footerNavTree={arbolPie}
          menuCategories={menuCategories}
          menus={menus}
          horarioSede={datosSede?.horarioPie ?? null}
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
      
      {/* Barra fija móvil del restaurante: «Reservar · Cómo llegar · Pedir» */}
      {barraMovil && <MobileCTABar acciones={barraMovil} primaryColor={primaryColor} />}

      {/* Chat Widget (oculto si la cuenta está congelada) */}
      {!frozenReason && settings?.chat_widget_enabled && settings?.chat_widget_public_key && (
        <ChatWidget publicKey={settings.chat_widget_public_key} />
      )}

      {/* Tracking de visitas web (page views) */}
      <VisitTracker organizationId={organization.id} />

      {/* AddToCart (Meta Pixel / gtag) para cualquier camino que agregue al carrito */}
      <CartEventTracker organizationSubdomain={subdomain} branchId={branchId} />
    </div>
    </RutaSitioProvider>
    </CurrencyProvider>
  )
}
