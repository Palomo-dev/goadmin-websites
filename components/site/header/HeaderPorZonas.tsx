'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { Globe, Heart, Phone, Search, ShoppingCart, User } from 'lucide-react'
import {
  HeaderLogo,
  SearchBarInline,
  buildNavItems,
  getLucideIcon,
  type HeaderVariantProps,
  type NavItem,
  variablesEncabezado,
  estiloBarraEncabezado,
  marcaFondoEncabezado,
  CLASE_FONDO_ENCABEZADO,
} from './HeaderShared'
import { BuscadorCromo } from './BuscadorCromo'
import { CartIndicator } from '../CartIndicator'
import { CurrencySelector } from '../CurrencySelector'
import { MENU_MOVIL, zonasConMenus, type BotonHeader, type ConstructorEncabezado, type ElementoZona, type IconoElemento, type MegaItem, type ZonaHeader } from '@/lib/website/constructorEncabezado'
import { ContenedorIcono, trazoContenedor, type ColoresCaja } from './ContenedorIcono'
import { MenuBarra, MenusMovil } from './MenusEncabezado'

const FILA_TOP = ['topbar_left', 'topbar_center', 'topbar_right'] as const
const FILA = ['header_left', 'header_center', 'header_right'] as const
const MENU = ['menu_left', 'menu_center', 'menu_right'] as const

/**
 * Header armado por zonas. Solo se monta si hay zonas o menús propios.
 * Sin eso, el sitio sigue con la variante de hoy.
 */
export function HeaderPorZonas({
  organization, primaryColor, navTree, settings, showCart, onCartClick, branchId, menuCategories, constructor,
}: HeaderVariantProps & { constructor: ConstructorEncabezado }) {
  const zonas = constructor.menus?.length ? zonasConMenus(constructor) : constructor.zonas
  const hayBarra = !!zonas?.mobile_bottom?.length
  useEffect(() => {
    if (!hayBarra) return
    document.body.classList.add('con-barra-constructor')
    return () => document.body.classList.remove('con-barra-constructor')
  }, [hayBarra])
  if (!zonas) return null
  const nav = buildNavItems(navTree)
  return (
    <header className="sticky top-0 z-40 w-full" style={variablesEncabezado(settings)} data-header-zonas="">
      <FilaZonas nombres={FILA_TOP} zonas={zonas} className="hidden text-sm md:flex" fondo={false}>
        {(el) => <Elemento key={el.id} el={el} nav={nav} organization={organization} primaryColor={primaryColor} settings={settings} showCart={showCart} onCartClick={onCartClick} branchId={branchId} menuCategories={menuCategories} constructor={constructor} dispositivo="desktop" />}
      </FilaZonas>
      <div className={CLASE_FONDO_ENCABEZADO} style={estiloBarraEncabezado(settings, 'bottom')} {...marcaFondoEncabezado(settings)}>
        <FilaZonas nombres={FILA} zonas={zonas} className="hidden md:flex" fondo={false}>
          {(el) => <Elemento key={el.id} el={el} nav={nav} organization={organization} primaryColor={primaryColor} settings={settings} showCart={showCart} onCartClick={onCartClick} branchId={branchId} menuCategories={menuCategories} constructor={constructor} dispositivo="desktop" />}
        </FilaZonas>
        <FilaMovil
          zonas={zonas}
          semilla={!constructor.zonas}
          cierre={(zonas.mobile_header ?? zonas.header_left ?? []).some((el) => el.menuId === MENU_MOVIL) ? null : (
            <MenusMovil menus={constructor.menus ?? []} mega={constructor.mega} categorias={menuCategories} primaryColor={primaryColor} />
          )}
        >
          {(el) => <Elemento key={el.id} el={el} nav={nav} organization={organization} primaryColor={primaryColor} settings={settings} showCart={showCart} onCartClick={onCartClick} branchId={branchId} menuCategories={menuCategories} constructor={constructor} dispositivo="mobile" />}
        </FilaMovil>
      </div>
      <FilaZonas nombres={MENU} zonas={zonas} className="hidden border-t md:flex" fondo>
        {(el) => <Elemento key={el.id} el={el} nav={nav} organization={organization} primaryColor={primaryColor} settings={settings} showCart={showCart} onCartClick={onCartClick} branchId={branchId} menuCategories={menuCategories} constructor={constructor} dispositivo="desktop" />}
      </FilaZonas>
      {zonas.mobile_bottom && (
        <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t bg-white py-2 md:hidden" data-barra-constructor="">
          {zonas.mobile_bottom.filter((el) => el.mobile).map((el) => (
            <Elemento key={el.id} el={el} nav={nav} organization={organization} primaryColor={primaryColor} settings={settings} showCart={showCart} onCartClick={onCartClick} branchId={branchId} menuCategories={menuCategories} constructor={constructor} dispositivo="mobile" />
          ))}
        </nav>
      )}
    </header>
  )
}

function FilaZonas({
  nombres, zonas, className, children,
}: {
  nombres: readonly ZonaHeader[]
  zonas: NonNullable<ConstructorEncabezado['zonas']>
  className: string
  fondo: boolean
  children: (el: ElementoZona) => ReactNode
}) {
  const hay = nombres.some((n) => zonas[n]?.length)
  if (!hay) return null
  return (
    <div className={`mx-auto w-full max-w-7xl items-center gap-3 px-4 ${className}`}>
      {nombres.map((nombre) => (
        <div key={nombre} className={`flex min-w-0 flex-1 items-center gap-2 ${nombre.endsWith('center') ? 'justify-center' : nombre.endsWith('right') ? 'justify-end' : ''}`}>
          {(zonas[nombre] ?? []).filter((el) => el.desktop).map(children)}
        </div>
      ))}
    </div>
  )
}

function FilaMovil({
  zonas, semilla, cierre, children,
}: {
  zonas: NonNullable<ConstructorEncabezado['zonas']>
  semilla: boolean
  cierre?: ReactNode
  children: (el: ElementoZona) => ReactNode
}) {
  const fila = (zonas.mobile_header ?? zonas.header_left ?? []).filter((el) => el.mobile)
  if (!fila.length && !cierre) return null
  const nodos = fila.map(children)
  return (
    <div className="flex items-center gap-2 px-4 md:hidden" style={{ minHeight: 56 }}>
      {semilla ? (
        <>
          {nodos[0]}
          <span className="ml-auto flex items-center gap-1">{nodos.slice(1)}</span>
        </>
      ) : (
        <>
          {nodos}
          {cierre}
        </>
      )}
    </div>
  )
}

function Elemento(props: {
  el: ElementoZona
  nav: NavItem[]
  organization: HeaderVariantProps['organization']
  primaryColor: string
  settings: HeaderVariantProps['settings']
  showCart?: boolean
  onCartClick?: () => void
  branchId?: number | null
  menuCategories?: HeaderVariantProps['menuCategories']
  constructor: ConstructorEncabezado
  dispositivo: 'desktop' | 'mobile'
}) {
  const { el, nav, organization, primaryColor, settings, showCart, onCartClick, branchId, menuCategories, constructor, dispositivo } = props
  const icono = constructor.iconos?.[el.type]
  const colores: ColoresCaja = {
    primary: primaryColor,
    accent: settings?.accent_color || primaryColor,
    secondary: settings?.secondary_color || '#1E40AF',
  }
  const menuPropio = el.menuId ? constructor.menus?.find((m) => m.id === el.menuId) : undefined
  let nodo: ReactNode = null
  if (el.type === 'logo') nodo = <HeaderLogo organization={organization} primaryColor={primaryColor} height={settings?.logo_height || 40} />
  else if (el.type === 'menu' && el.menuId === MENU_MOVIL) nodo = <MenusMovil menus={constructor.menus ?? []} mega={constructor.mega} categorias={menuCategories} primaryColor={primaryColor} />
  else if (el.type === 'menu' && menuPropio) nodo = <MenuBarra menu={menuPropio} mega={constructor.mega} categorias={menuCategories} primaryColor={primaryColor} />
  else if (el.type === 'menu') nodo = <MenuZona nav={nav} mega={constructor.mega} categorias={menuCategories} primaryColor={primaryColor} movil={dispositivo === 'mobile'} />
  else if (el.type === 'search' && constructor.buscador) nodo = <BuscadorCromo presentacion={constructor.buscador} primaryColor={primaryColor} className="w-full" lupaEnCampo={dispositivo === 'mobile'} categorias={(menuCategories ?? []).map((c) => ({ id: c.id, name: c.name, slug: c.slug }))} />
  else if (el.type === 'search') nodo = <SearchBarInline primaryColor={primaryColor} organizationId={organization.id} className="w-full" size="sm" />
  else if (el.type === 'cart' && showCart !== false) nodo = constructor.contenedor ? (
    <CartIndicator contenedor={constructor.contenedor} colores={colores} primaryColor={primaryColor} onClick={onCartClick} organizationSubdomain={organization.subdomain || ''} branchId={branchId} icon={getLucideIcon(icono?.icon, ShoppingCart)} />
  ) : (
    <CajaIcono icono={icono} primary={primaryColor}>
      <CartIndicator primaryColor={icono?.color || primaryColor} onClick={onCartClick} organizationSubdomain={organization.subdomain || ''} branchId={branchId} icon={getLucideIcon(icono?.icon, Search)} relleno={icono?.weight === 'relleno'} />
    </CajaIcono>
  )
  else if (el.type === 'account') nodo = constructor.contenedor ? (
    <Link href="/mi-cuenta" aria-label="Cuenta"><ContenedorIcono base={constructor.contenedor} clave="account" colores={colores}><User style={trazoContenedor(constructor.contenedor, 'account')} /></ContenedorIcono></Link>
  ) : <Link href="/mi-cuenta" aria-label="Cuenta"><CajaIcono icono={icono} primary={primaryColor}><User style={estiloTrazo(icono)} /></CajaIcono></Link>
  else if (el.type === 'favorites') nodo = constructor.contenedor ? (
    <Link href="/favoritos" aria-label={icono?.label || 'Favoritos'}><ContenedorIcono base={constructor.contenedor} clave="favorites" colores={colores}><Heart style={trazoContenedor(constructor.contenedor, 'favorites')} /></ContenedorIcono></Link>
  ) : <Link href="/favoritos" aria-label={icono?.label || 'Favoritos'}><CajaIcono icono={icono} primary={primaryColor}><Heart style={estiloTrazo(icono)} /></CajaIcono></Link>
  else if (el.type === 'whatsapp') nodo = <a href={enlaceWhatsapp(settings, constructor)}><CajaIcono icono={icono} primary={primaryColor}>WhatsApp</CajaIcono></a>
  else if (el.type === 'phone' && organization.phone) nodo = <a href={`tel:${organization.phone}`}><CajaIcono icono={icono} primary={primaryColor}><Phone style={estiloTrazo(icono)} /></CajaIcono></a>
  else if (el.type === 'text') nodo = <span className="text-sm">{el.label}</span>
  else if (el.type === 'button') {
    const boton = constructor.botones?.find((b) => b.id === el.buttonId) ?? constructor.botones?.[0]
    nodo = boton ? <BotonVisual boton={boton} primaryColor={primaryColor} onCart={onCartClick} /> : null
  }
  else if (el.type === 'currency') nodo = constructor.contenedor ? (
    <CurrencySelector primaryColor={primaryColor} icon={getLucideIcon(icono?.icon, Globe)} contenedor={constructor.contenedor} colores={colores} />
  ) : <CurrencySelector primaryColor={icono?.color || primaryColor} icon={getLucideIcon(icono?.icon, Globe)} relleno={icono?.weight === 'relleno'} />
  else if (el.type === 'social') nodo = <Redes settings={settings} />
  if (!nodo) return null
  return <span className={!el.tablet ? 'inline-flex md:max-lg:hidden' : 'contents'}>{nodo}</span>
}

function enlacesColumna(col: MegaItem['columnas'][number], categorias: HeaderVariantProps['menuCategories']) {
  if (col.links.length) return col.links
  const padre = categorias?.find((c) => c.id === col.categoryId)
  return (padre?.children ?? []).slice(0, 12).map((h) => ({ label: h.name, href: `/categorias/${h.slug}` }))
}

function MenuZona({ nav, mega, categorias, primaryColor, movil }: { nav: NavItem[]; mega: MegaItem[] | null; categorias: HeaderVariantProps['menuCategories']; primaryColor: string; movil: boolean }) {
  const [abierto, setAbierto] = useState<string | null>(null)
  return (
    <nav className={movil ? 'flex flex-col' : 'flex items-center gap-4'}>
      {nav.map((item) => {
        const bloque = mega?.find((m) => m.href === item.href)
        if (!bloque) return <Link key={item.href} href={item.href} className="text-sm font-medium">{item.name}</Link>
        if (movil) {
          return (
            <details key={item.href}>
              <summary className="cursor-pointer text-sm font-medium">{item.name}</summary>
              {bloque.columnas.map((col) => (
                <div key={col.title} className="pl-3">
                  <p className="text-xs font-semibold">{col.title}</p>
                  {col.text && <p className="text-sm">{col.text}</p>}
                  {enlacesColumna(col, categorias).map((l) => <Link key={l.href} href={l.href} className="block py-1 text-sm">{l.label}</Link>)}
                  {col.products && <p className="text-xs text-gray-500">Productos de la categoría</p>}
                </div>
              ))}
            </details>
          )
        }
        const visible = abierto === item.href
        return (
          <div key={item.href} className="relative" onMouseEnter={() => bloque.open === 'hover' && setAbierto(item.href)} onMouseLeave={() => bloque.open === 'hover' && setAbierto(null)}>
            <button type="button" className="text-sm font-medium" onClick={() => bloque.open === 'click' && setAbierto(visible ? null : item.href)}>{item.name}</button>
            {visible && (
              <div
                className={`absolute left-0 top-full z-50 mt-2 grid gap-4 p-4 ${bloque.animation === 'slide' ? 'animate-in slide-in-from-top-2' : ''}`}
                style={{
                  width: bloque.width === 'full' ? '70vw' : 280 * bloque.columns,
                  gridTemplateColumns: `repeat(${bloque.columns}, minmax(0,1fr))`,
                  background: bloque.background || '#fff',
                  borderRadius: bloque.radius,
                  boxShadow: bloque.shadow ? '0 16px 40px rgba(0,0,0,.12)' : undefined,
                }}
                data-mega=""
              >
                {bloque.columnas.slice(0, bloque.columns).map((col) => (
                  <div key={col.title} className={bloque.dividers ? 'border-r pr-3 last:border-0' : ''}>
                    <p className="mb-2 text-sm font-semibold" style={{ color: primaryColor }}>{col.title}</p>
                    {col.image && <a href={col.imageHref || '#'}><img src={col.image} alt="" className="mb-2 h-20 w-full object-cover" /></a>}
                    {col.text && <p className="mb-2 text-sm">{col.text}</p>}
                    {enlacesColumna(col, categorias).map((l) => <Link key={l.href} href={l.href} className="block py-1 text-sm">{l.label}</Link>)}
                    {col.products && <p className="text-xs text-gray-500">Productos de la categoría</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

function BotonVisual({ boton, primaryColor, onCart }: { boton: BotonHeader; primaryColor: string; onCart?: () => void }) {
  const [modal, setModal] = useState(false)
  const [hover, setHover] = useState(false)
  const forma = boton.shape === 'pill' || boton.shape === 'circle' ? '999px' : boton.shape === 'square' ? '0' : boton.shape === 'semi' ? '6px' : '10px'
  const base = boton.style === 'outline'
    ? { border: `1px solid ${boton.color || primaryColor}`, color: boton.color || primaryColor, background: hover && boton.hover ? boton.hover : 'transparent' }
    : boton.style === 'ghost'
      ? { color: boton.color || primaryColor, background: hover && boton.hover ? boton.hover : 'transparent' }
      : { background: hover && boton.hover ? boton.hover : boton.style === 'gradient' ? `linear-gradient(90deg, ${boton.color || primaryColor}, ${boton.textColor || '#111'})` : (boton.color || primaryColor), color: boton.textColor || '#fff' }
  const estilo: CSSProperties = { ...base, borderRadius: forma }
  const clase = `inline-flex items-center gap-1 px-3 font-medium ${boton.size === 'sm' ? 'h-8 text-xs' : boton.size === 'lg' ? 'h-12 text-base' : 'h-10 text-sm'}`
  const marca = boton.icon ? <span aria-hidden="true">{boton.icon}</span> : null
  const contenido = boton.style === 'icon_only'
    ? (marca || '•')
    : <>{boton.iconSide !== 'right' && marca}{boton.text}{boton.iconSide === 'right' && marca}</>
  const eventos = { className: clase, style: estilo, onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false) }
  const nodo = boton.action === 'cart' ? <button type="button" {...eventos} onClick={onCart}>{contenido}</button>
    : boton.action === 'search' ? <button type="button" {...eventos} onClick={() => document.querySelector<HTMLInputElement>('[data-buscador] input')?.focus()}>{contenido}</button>
    : boton.action === 'menu' ? <button type="button" {...eventos} onClick={() => document.querySelector<HTMLButtonElement>('[aria-label="Abrir menú"]')?.click()}>{contenido}</button>
    : boton.action === 'modal' ? <button type="button" {...eventos} onClick={() => setModal(true)}>{contenido}</button>
    : boton.action === 'whatsapp' ? <a {...eventos} href={`https://wa.me/?text=${encodeURIComponent(boton.message || boton.text)}`}>{contenido}</a>
    : boton.action === 'call' ? <a {...eventos} href={`tel:${boton.href || ''}`}>{contenido}</a>
    : boton.action === 'download' ? <a {...eventos} href={boton.href || '#'} download>{contenido}</a>
    : boton.action === 'category' ? <Link {...eventos} href={boton.href || '/categorias'}>{contenido}</Link>
    : <Link {...eventos} href={boton.href || '/'}>{contenido}</Link>
  return (
    <>
      {nodo}
      {modal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40" onClick={() => setModal(false)}>
          <div className="max-w-sm rounded-xl bg-white p-4" onClick={(e) => e.stopPropagation()}>{boton.message || boton.text}</div>
        </div>
      )}
    </>
  )
}

function CajaIcono({ icono, primary, children }: { icono?: IconoElemento; primary: string; children: ReactNode }) {
  const tam = icono?.size ?? 20
  const caja = icono?.container === 'circle' ? 'rounded-full' : icono?.container === 'rounded' ? 'rounded-lg' : icono?.container === 'square' ? 'rounded-none' : ''
  const [hover, setHover] = useState(false)
  const estilo: CSSProperties = {
    color: hover && icono?.hover ? icono.hover : icono?.color || primary,
    background: icono?.background,
    border: icono?.border ? `1px solid ${icono.border}` : undefined,
  }
  return (
    <span
      className={`inline-flex items-center justify-center gap-1 p-1 ${icono?.labelPos === 'side' ? 'flex-row' : 'flex-col'} ${caja}`}
      style={estilo}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span className="inline-flex" style={{ width: tam, height: tam }}>{children}</span>
      {icono?.label && <span className="text-[10px] leading-none">{icono.label}</span>}
    </span>
  )
}

function estiloTrazo(icono?: IconoElemento): CSSProperties {
  return {
    width: icono?.size ?? 20,
    height: icono?.size ?? 20,
    strokeWidth: icono?.stroke ?? 2,
    fill: icono?.weight === 'relleno' ? 'currentColor' : icono?.weight === 'duotono' ? 'currentColor' : 'none',
    fillOpacity: icono?.weight === 'duotono' ? 0.28 : icono?.weight === 'relleno' ? 1 : 0,
  }
}

function Redes({ settings }: { settings: HeaderVariantProps['settings'] }) {
  const redes = settings?.social_links && typeof settings.social_links === 'object' ? settings.social_links as Record<string, unknown> : {}
  const lista = Object.entries(redes).filter(([, href]) => typeof href === 'string' && /^https?:\/\//i.test(href)).slice(0, 5)
  if (!lista.length) return null
  return <span className="flex gap-2 text-xs">{lista.map(([nombre, href]) => <a key={nombre} href={String(href)} target="_blank" rel="noopener noreferrer">{nombre}</a>)}</span>
}

function enlaceWhatsapp(settings: HeaderVariantProps['settings'], constructor: ConstructorEncabezado) {
  const mensaje = constructor.botones?.find((b) => b.action === 'whatsapp')?.message
  const n = (settings as { whatsapp_number?: string } | null)?.whatsapp_number
  const base = n ? `https://wa.me/${String(n).replace(/\D/g, '')}` : 'https://wa.me/'
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base
}
