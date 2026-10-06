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
import GoogleTagManager from './GoogleTagManager'
import TikTokPixel from './TikTokPixel'
import type { PixelesSitio } from '@/lib/seo/pixelesSitio'
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
import { atributosTema, urlGoogleFonts, type TemaPublico } from '@/lib/website/v2/temaPublico'

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
  /** Estilo general del sitio V2 (OrganizationLayout). `null`/ausente = legacy, como siempre. */
  temaSitio?: TemaPublico | null
  /** Píxeles tipados de Sitio web › Analítica (OrganizationLayout). Ausentes = los de hoy. */
  pixeles?: PixelesSitio | null
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
  temaSitio,
  pixeles,
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
  
  // Píxeles: el id tipado de Analítica (ERP) es el punto de verdad; sin él, el de la integración
  // (lo de hoy). La etiqueta de conversión de Google Ads solo se conserva si es del mismo id.
  const pixelMeta = pixeles?.metaPixelId ?? metaPixelId ?? null
  const adsTipado = pixeles?.googleAdsId ?? null
  const googleAds = adsTipado
    ? { conversionId: adsTipado, conversionLabel: googleAdsConfig?.conversionId === adsTipado ? googleAdsConfig.conversionLabel : undefined }
    : googleAdsConfig ?? null

  const temaVars = atributosTema(temaSitio ?? null)
  const hojaFuentesTema = temaSitio ? urlGoogleFonts([temaSitio.fuenteTitulos, temaSitio.fuenteCuerpo]) : null

  // CSS Variables para colores personalizados
  const secondaryColor = settings?.secondary_color || organization.secondary_color || '#1E40AF'
  const cssVariables = {
    '--primary-color': primaryColor,
    '--secondary-color': secondaryColor,
    '--accent-color': settings?.accent_color || primaryColor,
    '--font-heading': template.fonts.heading,
    '--font-body': template.fonts.body,
    // Fondo y texto del modo: los usan las referencias `marca:fondo` / `marca:texto` del estilo
    // por sección y el fondo «Alterno». El tema V2 los reemplaza abajo si los define.
    '--background-color': isDark ? '#111827' : '#ffffff',
    '--text-color': isDark ? '#ffffff' : '#111827',
    // Estilo general del sitio V2 (Diseño › Estilo del sitio). Legacy: sin variables nuevas.
    ...temaVars.variables,
  } as React.CSSProperties
  
  return (
    <CurrencyProvider showCurrencyCode={effectiveShowCurrencyCode} currencyPosition={effectiveCurrencyPosition}>
    <RutaSitioProvider prefijo={prefijo} horarioSede={datosSede?.horarioPie ?? null}>
    <div
      ref={rootRef}
      className={`min-h-screen flex flex-col ${isDark ? 'dark bg-gray-900 text-white' : 'bg-white text-gray-900'}`}
      style={cssVariables}
      {...temaVars.datos}
      suppressHydrationWarning
    >
      {hojaFuentesTema && <link rel="stylesheet" href={hojaFuentesTema} />}
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

      {/* Sede (Figma 02-componentes 27:214, chip «Sede X ▾» con «Ver todas las sedes y horarios»):
          franja propia bajo el encabezado, a la derecha, igual en las 6 variantes de encabezado y en
          móvil. El Figma dibuja el chip como componente suelto, sin fijar su sitio dentro de cada
          variante; meterlo dentro de los 6 encabezados queda como decisión de producto.
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
              hrefTodas={datosSede?.hrefTodasSedes ?? null}
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
      {pixelMeta && <MetaPixel pixelId={pixelMeta} />}

      {/* Custom Scripts (Meta Pixel, Google Analytics, chat widgets, etc.)
          Inyectados client-side vía useEffect para que el Event Setup Tool
          de Meta pueda detectar los pixels (necesita que los scripts se
          ejecuten DESPUÉS de que Meta instale su interceptor en el iframe). */}
      {settings?.custom_scripts && <CustomScripts scripts={settings.custom_scripts} />}
      
      {/* Google Ads Tag (gtag.js) */}
      {googleAds && <GoogleAdsTag conversionId={googleAds.conversionId} conversionLabel={googleAds.conversionLabel} />}

      {/* Google Tag Manager y TikTok Pixel (Sitio web › Analítica) */}
      {pixeles?.gtmId && <GoogleTagManager containerId={pixeles.gtmId} />}
      {pixeles?.tiktokPixelId && <TikTokPixel pixelId={pixeles.tiktokPixelId} />}
      
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
