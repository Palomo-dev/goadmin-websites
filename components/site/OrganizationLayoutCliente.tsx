'use client'

import { useState, useEffect, useRef } from 'react'
import SiteHeader from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { ZonaGlobalPreview } from './ZonaGlobalPreview'
import { useAjustesVivosPreview, type ItemMenuVivo } from './useAjustesVivosPreview'
import { CartDrawer } from './CartDrawer'
import { CountdownBanner } from './CountdownBanner'
import { CartEventTracker } from './CartEventTracker'
import { PixelesSitio as PixelesDelSitio } from './PixelesSitio'
import type { PixelesSitio } from '@/lib/seo/pixelesSitio'
import type { BloqueCodigo } from '@/lib/website/ajustesSitio'
import { ChatWidget } from './ChatWidget'
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
import { TemaColoresProvider } from './TemaColoresContext'
import { EncabezadoPieProvider, type ValorEncabezadoPie } from './EncabezadoPieContext'
import { BarraMovilGiro } from './BarraMovilGiro'
import { ModoMesaProvider } from './ModoMesaContext'
import { PasosMesaProvider, type PasosMesaServidor } from './PasosMesaContext'
import { variablesColorMesa } from '@/lib/restaurant/modoMesa'
import { textoSobreAcentoSiHex } from '@/lib/website/v2/textoSobreAcento'
import { contraste } from '@/lib/website/v2/contrasteColor'
import { EncabezadoMesa } from './header/EncabezadoMesa'
import { PieMesa } from './footer/PieMesa'
import { EXTRAS_VACIOS, opcionesEncabezadoPie, type AccionBarra, type ExtrasEncabezadoPie } from '@/lib/website/encabezadoPie'

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

/** Acciones de la barra `auto` del restaurante en el orden de las láminas: Reservar · Cómo llegar · Llamar · Pedir. */
function accionesDeBarraAuto(a: NonNullable<DatosSedeLayout['barraMovil']>): AccionBarra[] {
  const lista: AccionBarra[] = []
  if (a.reservar) lista.push({ accion: 'reservar', href: a.reservar })
  else if (a.pedir) lista.push({ accion: 'pedir', href: a.pedir })
  if (a.comoLlegar) lista.push({ accion: 'como_llegar', href: a.comoLlegar })
  if (a.llamar) lista.push({ accion: 'llamar', href: a.llamar })
  if (a.reservar && a.pedir) lista.push({ accion: 'pedir', href: a.pedir })
  return lista
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
  /** Código a medida del ERP (OrganizationLayout). Ausente o vacío = nada nuevo. */
  codigoPropio?: BloqueCodigo[] | null
  /** Datos de las opciones nuevas del encabezado y del pie (OrganizationLayout). Ausentes = lo de hoy. */
  extrasShell?: ExtrasEncabezadoPie | null
  /**
   * Página Carta QR (lib/restaurant/modoMesa.ts): encabezado mínimo, sin barra móvil del sitio y
   * con el pie reducido a «Carta con tecnología GO Admin». Ausente o `false` = el layout de siempre.
   */
  modoMesa?: boolean
  /**
   * Carta QR por pasos (lib/restaurant/pasosMesa.ts): el paso que pidió la URL y los que existen.
   * Solo con `modoMesa`. Ausente = sin pasos (todas las secciones apiladas, como siempre).
   */
  pasosMesa?: PasosMesaServidor | null
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
  codigoPropio,
  extrasShell,
  modoMesa = false,
  pasosMesa = null,
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
  // Encabezado y pie por plantilla (lib/website/encabezadoPie.ts): todo en su default = lo de hoy.
  const opcionesShell = opcionesEncabezadoPie(settings)
  const extras = extrasShell ?? EXTRAS_VACIOS
  // Selector de sede: dentro del encabezado si el sitio lo pidió; si no, la franja de siempre.
  const selectorEnEncabezado = opcionesShell.selectorSedeEnEncabezado && sedesSelector.length >= 2
  const valorEncabezadoPie: ValorEncabezadoPie = {
    opciones: opcionesShell,
    extras,
    selector: selectorEnEncabezado
      ? {
          sedes: sedesSelector,
          actualId: datosSede?.sedeActualId ?? outlet?.branchId ?? null,
          subdomain,
          prefijoActual: prefijo,
          hrefTodas: datosSede?.hrefTodasSedes ?? null,
        }
      : null,
    tipo: organization.type_id ?? null,
  }
  // Barra fija del celular: no con la barra de pestañas del encabezado móvil (ocupa el mismo
  // sitio) ni donde ya hay barra propia (checkout, carrito, detalle, pedido).
  // En modo mesa la barra del sitio (Reservar / Pedir) no va: la mesa tiene su propia barra.
  const rutaAdmiteBarra = !frozenReason && !modoMesa && settings?.mobile_menu_style !== 'tabs'
    && rutaConBarraMovil(quitarPrefijo(pathname, prefijo))
  // `auto` (default): la de hoy, «Reservar · Llamar · Cómo llegar · Pedir» del restaurante.
  const barraMovil = rutaAdmiteBarra && opcionesShell.barraMovil === 'auto' && datosSede?.barraMovil
    ? datosSede.barraMovil
    : null
  // Lista de acciones (cualquier giro); `ninguna` → sin barra.
  const barraMovilLista = rutaAdmiteBarra && Array.isArray(opcionesShell.barraMovil) && extras.barraMovil && extras.barraMovil.length > 0
    ? extras.barraMovil
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
  
  // Panel «Encabezado» / «Pie de página»: color de texto fijo, fijo al bajar y separadores. Solo
  // atributos cuando difieren del default (app/globals.css); sin ellos, todo como siempre.
  const atributosShell: Record<string, string> = {}
  if (opcionesShell.colorTextoEncabezado) atributosShell['data-encabezado-texto'] = ''
  if (!opcionesShell.fijo) atributosShell['data-encabezado-no-fijo'] = ''
  if (opcionesShell.pie.colorTexto) atributosShell['data-pie-texto'] = ''
  if (!opcionesShell.pie.separadores) atributosShell['data-pie-sin-separadores'] = ''
  if (modoMesa) atributosShell['data-modo-mesa'] = ''

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
  
  // En el lienzo del editor, el estilo general en edición (fuentes, redondeo, botón, movimiento)
  // reemplaza al guardado; se pinta con las mismas funciones que el sitio publicado.
  const temaEfectivo = vivos?.tema ?? temaSitio ?? null
  const temaVars = atributosTema(temaEfectivo)
  const hojaFuentesTema = temaEfectivo ? urlGoogleFonts([temaEfectivo.fuenteTitulos, temaEfectivo.fuenteCuerpo]) : null
  // Sitio V2 con tema y `auto`: las MISMAS acciones de la barra del restaurante, con el estilo de
  // las láminas (fondo del tema, «Reservar» relleno y el resto en contorno). Legacy (sin tema): la
  // barra de siempre, sin cambios.
  const temaConColores = 'data-tema-colores' in temaVars.datos
  const barraAutoConTema = barraMovil && temaConColores ? accionesDeBarraAuto(barraMovil) : null
  const barraMovilGiro = barraMovilLista ?? barraAutoConTema

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
    // Texto sobre el primario y primario legible como texto, para las secciones de la Carta QR.
    // Sin consumidores fuera de ellas; con colores no hex no se emite nada.
    ...variablesColorMesa(primaryColor, temaEfectivo, { sobre: textoSobreAcentoSiHex, contraste }),
    ...(opcionesShell.colorTextoEncabezado ? { '--encabezado-texto': opcionesShell.colorTextoEncabezado } : {}),
    ...(opcionesShell.pie.colorTexto ? { '--pie-texto': opcionesShell.pie.colorTexto } : {}),
  } as React.CSSProperties
  
  return (
    <CurrencyProvider showCurrencyCode={effectiveShowCurrencyCode} currencyPosition={effectiveCurrencyPosition}>
    <RutaSitioProvider prefijo={prefijo} horarioSede={datosSede?.horarioPie ?? null}>
    <TemaColoresProvider value={'data-tema-colores' in temaVars.datos}>
    <EncabezadoPieProvider value={valorEncabezadoPie}>
    <ModoMesaProvider value={modoMesa}>
    <PasosMesaProvider value={modoMesa ? pasosMesa : null}>
    <div
      ref={rootRef}
      className={`min-h-screen flex flex-col ${isDark ? 'dark bg-gray-900 text-white' : 'bg-white text-gray-900'}`}
      style={cssVariables}
      {...temaVars.datos}
      {...atributosShell}
      // Raíz del sitio: aquí se reserva el alto de la barra «Ver pedido de la mesa» con el fondo
      // del sitio (app/globals.css, `body[data-barra-pedido-mesa] [data-raiz-sitio]`).
      data-raiz-sitio=""
      suppressHydrationWarning
    >
      {hojaFuentesTema && <link rel="stylesheet" href={hojaFuentesTema} />}
      {/* Header específico según tipo (oculto si la cuenta está congelada) */}
      {!frozenReason && modoMesa ? (
        <ZonaGlobalPreview zona="header">
          <EncabezadoMesa organization={organizacionEncabezado as OrganizationWithDetails} primaryColor={primaryColor} />
        </ZonaGlobalPreview>
      ) : !frozenReason ? (
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
      ) : null}

      {/* Sede (Figma 02-componentes 27:214, chip «Sede X ▾» con «Ver todas las sedes y horarios»):
          franja propia bajo el encabezado, a la derecha, igual en las 6 variantes de encabezado y en
          móvil. El Figma dibuja el chip como componente suelto, sin fijar su sitio dentro de cada
          variante; meterlo dentro de los 6 encabezados queda como decisión de producto.
          Solo con 2 o más sedes publicadas (hoy ninguna organización las tiene).
          data-franja-sede: en un sitio V2 con tema, app/globals.css le pone el borde y el fondo del
          tema; sin tema el atributo no tiene regla y la franja queda como siempre. */}
      {!frozenReason && !modoMesa && sedesSelector.length >= 2 && !selectorEnEncabezado && (
        <div className="border-b border-gray-100 dark:border-gray-800" data-franja-sede="">
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
      {!frozenReason && !modoMesa && settings?.countdown_enabled && settings?.countdown_show_in_header && (
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
      {!frozenReason && modoMesa ? (
        <ZonaGlobalPreview zona="footer">
          <PieMesa mostrarMarca={settings?.show_powered_by !== false} />
        </ZonaGlobalPreview>
      ) : !frozenReason ? (
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
      ) : null}
      
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
      
      {/* Píxeles y scripts propios: misma regla que /checkout (lib/seo/reglaPixeles.ts). Los
          scripts propios se inyectan client-side después de Meta, para el Event Setup Tool. */}
      <PixelesDelSitio
        pixeles={pixeles}
        integracion={{ metaPixelId, googleAds: googleAdsConfig }}
        customScripts={settings?.custom_scripts ?? null}
        analyticsId={settings?.analytics_id ?? null}
        codigoPropio={codigoPropio}
        prefijoSede={prefijo}
      />
      
      {/* CSS Personalizado */}
      {settings?.custom_css && (
        <style dangerouslySetInnerHTML={{ __html: settings.custom_css }} />
      )}
      
      {/* Barra fija móvil del restaurante: «Reservar · Cómo llegar · Pedir» */}
      {barraMovil && !barraAutoConTema && <MobileCTABar acciones={barraMovil} primaryColor={primaryColor} />}
      {/* Barra fija del celular con la lista de acciones del sitio (cualquier giro) */}
      {barraMovilGiro && <BarraMovilGiro acciones={barraMovilGiro} primaryColor={primaryColor} />}

      {/* Chat Widget (oculto si la cuenta está congelada) */}
      {!frozenReason && settings?.chat_widget_enabled && settings?.chat_widget_public_key && (
        <ChatWidget publicKey={settings.chat_widget_public_key} />
      )}

      {/* Tracking de visitas web (page views) */}
      <VisitTracker organizationId={organization.id} />

      {/* AddToCart (Meta Pixel / gtag) para cualquier camino que agregue al carrito */}
      <CartEventTracker organizationSubdomain={subdomain} branchId={branchId} />
    </div>
    </PasosMesaProvider>
    </ModoMesaProvider>
    </EncabezadoPieProvider>
    </TemaColoresProvider>
    </RutaSitioProvider>
    </CurrencyProvider>
  )
}
