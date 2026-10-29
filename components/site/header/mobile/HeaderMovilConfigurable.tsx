'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { buscadorMovil, barraSuperiorMovil } from '@/lib/website/opcionUnica';
import Link from 'next/link'
import { Search, X } from 'lucide-react'
import { headerSobreHero } from '@/lib/website/espacioHeader'
import {
  HeaderLogo,
  HeaderActions,
  HeaderTopbar,
  HeaderCTAMovil,
  SearchBarInline,
  buildNavItems,
  BloqueMonedaMovil,
  getLucideIcon,
  type HeaderVariantProps,
  type NavItem,
  CLASE_FONDO_ENCABEZADO,
  variablesEncabezado,
  estiloBarraEncabezado,
  marcaFondoEncabezado,
  posicionMovil,
  GlifoMenu,
} from '../HeaderShared'
import { FilaSedeMovil } from '../SelectorSedeEncabezado'
import { MobileMenuShell } from './MobileMenuShell'
import { MobileBottomNav, useUnidadesBarra } from './MobileBottomNav'
import type { IconosMovil, PresentacionMovil } from '@/lib/website/menuMovil'
import { BarraPestanas } from './MobileTabs'
import { leerMenuInferior } from '@/lib/website/menuInferior'
import { ProductSearch } from '../../ProductSearch'

/**
 * Header de celular cuando hay estilo, panel, disposición o íconos nuevos.
 * La variante de hoy (drawer, fullscreen, bottom_sheet, tabs) no llega aquí.
 */
export function HeaderMovilConfigurable({
  organization,
  primaryColor,
  navTree,
  settings,
  showCart,
  onCartClick,
  menuCategories,
  branchId,
  presentacion,
}: HeaderVariantProps & { presentacion: PresentacionMovil }) {
  const [abierto, setAbierto] = useState(false)
  const [buscar, setBuscar] = useState(false)
  const [oculto, setOculto] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const layout = presentacion.layout
  const iconos = presentacion.iconos
  // Color de los íconos: uno solo para todos los encabezados del celular (header_mobile_icon_color);
  // el `icons.color` viejo del configurable sigue mandando si estaba guardado.
  const colorIconos = iconos?.color
    ? { color: iconos.color }
    : (settings as Record<string, unknown> | undefined)?.header_mobile_icon_color ? { color: 'var(--hdr-mobile-icon)' } : undefined
  const unidades = useUnidadesBarra(organization.subdomain || '', branchId)
  const navItems = buildNavItems(navTree)
  const organizationId = organization.id
  const buscador = presentacion.buscador ?? buscadorMovil(settings as Record<string, unknown>)
  const SearchIconComp = getLucideIcon(settings?.search_icon as string, Search)
  const altoLogo = layout?.logoSize ?? Math.max(36, Math.round((settings?.logo_height || 48) * 0.85))
  // «Sobre portada» es una sola opción para computador y celular; el `transparent_hero` del celular se respeta.
  const transparenteHero = !!layout?.transparentHero || headerSobreHero(settings as Parameters<typeof headerSobreHero>[0])
  const transparente = transparenteHero && !scrolled
  // Con «tabs» el botón de menú no se pinta: sin menú inferior guardado van las pestañas de la
  // plantilla (MobileTabs), para que el celular nunca se quede sin navegación (QA 28-oct P1).
  const barra = presentacion.barra
  // Menú inferior v2 guardado: lo pinta MenuInferior (OrganizationLayoutCliente), no estas barras.
  const menuV2 = leerMenuInferior(settings) !== null
  const pestanasPlantilla = !menuV2 && !barra && presentacion.estilo === 'tabs'
  const showMenu = iconos?.showMenu !== false && presentacion.estilo !== 'none' && presentacion.estilo !== 'tabs'

  useEffect(() => {
    if (!layout?.hideOnScroll && !transparenteHero) return
    let ultimo = window.scrollY
    const al = () => {
      const y = window.scrollY
      if (layout?.hideOnScroll) setOculto(y > ultimo && y > 64)
      if (transparenteHero) setScrolled(y > 24)
      ultimo = y
    }
    window.addEventListener('scroll', al, { passive: true })
    return () => window.removeEventListener('scroll', al)
  }, [layout?.hideOnScroll, transparenteHero])

  const logo = (
    <div className={alineacionLogo(layout?.logo)}>
      <HeaderLogo organization={organization} primaryColor={primaryColor} height={altoLogo} fondoOscuro={transparente} />
    </div>
  )
  const menuBtn = showMenu ? (
    <button
      type="button"
      onClick={() => setAbierto(true)}
      aria-label="Abrir menú"
      className={claseIcono(iconos)}
      style={colorIconos}
    >
      <GlifoMenu glifo={iconos?.menu ?? 'lines3'} />
    </button>
  ) : null
  const acciones = (
    <div className="flex items-center gap-2">
      <HeaderActions
        settings={iconos?.style === 'circle' && settings ? { ...settings, header_icons_circle: true } as NonNullable<HeaderVariantProps['settings']> : settings}
        showCart={iconos?.showCart === false ? false : showCart}
        onCartClick={onCartClick}
        searchStyle={buscador === 'bar' || buscador === 'hidden' ? 'hidden' : 'icon'}
        organizationId={organizationId}
        primaryColor={primaryColor}
        organizationSubdomain={organization.subdomain || ''}
        showSearchIcon={iconos?.showSearch !== false && (buscador === 'icon' || buscador === 'fullscreen')}
        isMobile
        mostrarCuentaMovil={iconos?.showAccount === true}
        branchId={branchId}
      />
      <HeaderCTAMovil settings={settings} primaryColor={primaryColor} />
    </div>
  )

  // «Buscar» del menú inferior: el mismo panel del buscador del encabezado (ProductSearch).
  // Antes solo abría con el buscador a pantalla completa y en los demás casos no hacía nada.
  const [panelBuscar, setPanelBuscar] = useState(false)
  const abrirBuscar = () => {
    if (buscador === 'fullscreen') setBuscar(true)
    else setPanelBuscar(true)
  }

  return (
    <>
      <header
        className={`sticky top-0 z-40 w-full transition-transform duration-200 ${oculto ? '-translate-y-full' : ''}`}
        style={{ ...variablesEncabezado(settings), ...posicionMovil(settings) }}
        data-header-movil={presentacion.estilo}
      >
        {barraSuperiorMovil(settings as Record<string, unknown>) && <HeaderTopbar organization={organization} settings={settings} forceVisible />}
        <div
          className={transparente ? '' : CLASE_FONDO_ENCABEZADO}
          style={transparente ? undefined : estiloBarraEncabezado(settings, 'bottom')}
          {...(transparente ? {} : marcaFondoEncabezado(settings))}
        >
          <div className="px-4">
            <div className="flex items-center gap-2" style={{ minHeight: layout?.headerHeight ?? Math.max(56, altoLogo + 16) }}>
              {fila(layout?.arrangement ?? 'logo-acciones-menu', logo, acciones, menuBtn)}
            </div>
            {buscador === 'bar' && (
              <div className="pb-3">
                <SearchBarInline primaryColor={primaryColor} organizationId={organizationId} className="w-full" size="sm" icon={SearchIconComp} />
              </div>
            )}
          </div>
        </div>
        <FilaSedeMovil primaryColor={primaryColor} />
      </header>

      <MobileMenuShell abierto={abierto} onCerrar={() => setAbierto(false)} estilo={presentacion.estilo} panel={presentacion.panel}>
        <ContenidoMenu
          navItems={navItems}
          menuCategories={menuCategories}
          settings={settings}
          organization={organization}
          primaryColor={primaryColor}
          panel={presentacion.panel}
          onCerrar={() => setAbierto(false)}
        />
      </MobileMenuShell>

      {buscar && (
        <div className="fixed inset-0 z-[70] bg-white p-4 dark:bg-gray-950">
          <div className="mb-3 flex justify-end">
            <button type="button" aria-label="Cerrar búsqueda" onClick={() => setBuscar(false)} className="p-2"><X className="h-5 w-5" /></button>
          </div>
          <SearchBarInline primaryColor={primaryColor} organizationId={organizationId} className="w-full" icon={SearchIconComp} />
        </div>
      )}

      {panelBuscar && (
        <ProductSearch primaryColor={primaryColor} icon={SearchIconComp} abierto sinDisparador pantallaCompleta alCerrar={() => setPanelBuscar(false)} />
      )}
      {pestanasPlantilla && (
        <BarraPestanas organization={organization} primaryColor={primaryColor} navTree={navTree} settings={settings} onCartClick={onCartClick} menuCategories={menuCategories} branchId={branchId} />
      )}
      {barra && !menuV2 && (
        <MobileBottomNav
          barra={barra}
          primaryColor={primaryColor}
          unidades={unidades}
          onMenu={() => setAbierto(true)}
          onSearch={abrirBuscar}
          onCart={onCartClick}
        />
      )}
    </>
  )
}

function fila(disposicion: string, logo: ReactNode, acciones: ReactNode, menu: ReactNode) {
  if (disposicion === 'menu-logo-acciones') {
    return <div className="flex w-full items-center gap-2">{menu}<div className="min-w-0 flex-1">{logo}</div>{acciones}</div>
  }
  if (disposicion === 'logo-sobre-acciones') {
    return (
      <div className="flex w-full flex-col gap-2 py-2">
        <div className="flex justify-center">{logo}</div>
        <div className="flex items-center justify-between">{menu}{acciones}</div>
      </div>
    )
  }
  if (disposicion === 'acciones-sobre-logo') {
    return (
      <div className="flex w-full flex-col gap-2 py-2">
        <div className="flex items-center justify-between">{menu}{acciones}</div>
        <div className="flex justify-center">{logo}</div>
      </div>
    )
  }
  return <div className="flex w-full items-center justify-between gap-2">{logo}<div className="flex items-center gap-2">{acciones}{menu}</div></div>
}

function alineacionLogo(logo: string | undefined) {
  if (logo === 'center') return 'flex justify-center'
  if (logo === 'right') return 'flex justify-end'
  return 'flex justify-start'
}

function claseIcono(iconos: IconosMovil | null) {
  const base = 'p-2 text-gray-700 dark:text-gray-300'
  if (iconos?.style === 'circle') return `${base} rounded-full bg-black/5`
  if (iconos?.style === 'border') return `${base} rounded-full border border-current`
  return `${base} rounded-lg hover:bg-[var(--header-hover)]`
}


function ContenidoMenu({
  navItems, menuCategories, settings, organization, primaryColor, panel, onCerrar,
}: {
  navItems: NavItem[]
  menuCategories?: HeaderVariantProps['menuCategories']
  settings: HeaderVariantProps['settings']
  organization: HeaderVariantProps['organization']
  primaryColor: string
  panel: PresentacionMovil['panel']
  onCerrar: () => void
}) {
  const categorias = panel?.categories === 'list'
  const items: NavItem[] = [...navItems]
  if (menuCategories && menuCategories.length > 0 && settings?.show_categories_in_header) {
    const hijos = menuCategories.map((c) => ({ name: c.name, href: `/categorias/${c.slug}` }))
    if (categorias) items.push(...hijos)
    else items.push({ name: 'Categorías', href: '/categorias', children: hijos })
  }
  const tel = organization.phone
  const mail = organization.email
  const redes = redesDe(settings?.social_links)
  return (
    <>
      <div className="flex items-center justify-between p-4">
        {panel?.showLogo ? <HeaderLogo organization={organization} primaryColor={primaryColor} height={36} /> : <span className="font-bold">Menú</span>}
        <button type="button" aria-label="Cerrar menú" onClick={onCerrar} className="p-2"><X className="h-5 w-5" /></button>
      </div>
      {panel?.showSearch && (
        <div className="px-4 pb-2">
          <SearchBarInline primaryColor={primaryColor} organizationId={organization.id} className="w-full" size="sm" />
        </div>
      )}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {items.map((item) => (
          <ItemNav key={item.name} item={item} onCerrar={onCerrar} />
        ))}
      </nav>
      {panel?.showContact && (tel || mail) && (
        <div className="space-y-1 border-t px-4 py-3 text-sm">
          {tel && <a href={`tel:${tel}`} className="block">{tel}</a>}
          {mail && <a href={`mailto:${mail}`} className="block">{mail}</a>}
        </div>
      )}
      {panel?.showSocial && redes.length > 0 && (
        <div className="flex gap-3 border-t px-4 py-3 text-sm">
          {redes.map((r) => <a key={r.href} href={r.href} target="_blank" rel="noopener noreferrer">{r.nombre}</a>)}
        </div>
      )}
      <BloqueMonedaMovil primaryColor={primaryColor} settings={settings} className="border-t p-4" />
    </>
  )
}

function ItemNav({ item, onCerrar }: { item: NavItem; onCerrar: () => void }) {
  if (item.children && item.children.length > 0) {
    return (
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2.5 font-medium">{item.name}</summary>
        <div className="space-y-1 pl-4">
          {item.children.map((h) => (
            <Link key={h.href} href={h.href} onClick={onCerrar} className="block rounded-lg px-3 py-2 text-sm">{h.name}</Link>
          ))}
        </div>
      </details>
    )
  }
  return <Link href={item.href} onClick={onCerrar} className="block rounded-lg px-3 py-2.5 font-medium">{item.name}</Link>
}

function redesDe(valor: unknown): { nombre: string; href: string }[] {
  if (!valor || typeof valor !== 'object') return []
  return Object.entries(valor as Record<string, unknown>)
    .filter(([, href]) => typeof href === 'string' && /^https?:\/\//i.test(href))
    .slice(0, 6)
    .map(([nombre, href]) => ({ nombre, href: href as string }))
}
