'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Heart, Phone, Search } from 'lucide-react'
import {
  HeaderLogo,
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
import type { BotonHeader, ConstructorEncabezado, ElementoZona, IconoElemento, MegaItem, ZonaHeader } from '@/lib/website/constructorEncabezado'

const FILA_TOP = ['topbar_left', 'topbar_center', 'topbar_right'] as const
const FILA = ['header_left', 'header_center', 'header_right'] as const
const MENU = ['menu_left', 'menu_center', 'menu_right'] as const

/**
 * Header armado por zonas. Solo se monta si `header_builder.zones` trae elementos.
 */
export function HeaderPorZonas({
  organization, primaryColor, navTree, settings, showCart, onCartClick, branchId, menuCategories, constructor,
}: HeaderVariantProps & { constructor: ConstructorEncabezado }) {
  const zonas = constructor.zonas
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
        <div className="flex items-center gap-2 px-4 md:hidden" style={{ minHeight: 56 }}>
          {(zonas.mobile_header ?? zonas.header_left ?? []).filter((el) => el.mobile).map((el) => (
            <Elemento key={el.id} el={el} nav={nav} organization={organization} primaryColor={primaryColor} settings={settings} showCart={showCart} onCartClick={onCartClick} branchId={branchId} menuCategories={menuCategories} constructor={constructor} dispositivo="mobile" />
          ))}
        </div>
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
  const { el, nav, organization, primaryColor, settings, showCart, onCartClick, branchId, constructor, dispositivo } = props
  const icono = constructor.iconos?.[el.type]
  if (el.type === 'logo') return <HeaderLogo organization={organization} primaryColor={primaryColor} height={settings?.logo_height || 40} />
  if (el.type === 'menu') return <MenuZona nav={nav} mega={constructor.mega} primaryColor={primaryColor} movil={dispositivo === 'mobile'} />
  if (el.type === 'search' && constructor.buscador) return <BuscadorCromo presentacion={constructor.buscador} primaryColor={primaryColor} className="w-full" />
  if (el.type === 'search') return <span className="text-sm">Buscar</span>
  if (el.type === 'cart' && showCart !== false) {
    return <CartIndicator primaryColor={icono?.color || primaryColor} onClick={onCartClick} organizationSubdomain={organization.subdomain || ''} branchId={branchId} icon={getLucideIcon(icono?.icon, Search)} />
  }
  if (el.type === 'account') return <Link href="/mi-cuenta" className={claseIcono(icono)} aria-label="Cuenta">Cuenta</Link>
  if (el.type === 'favorites') return <Link href="/favoritos" className={claseIcono(icono)} aria-label={icono?.label || 'Favoritos'}><Heart className="h-5 w-5" />{icono?.label && <span className="text-xs">{icono.label}</span>}</Link>
  if (el.type === 'whatsapp') return <a href={enlaceWhatsapp(settings)} className={claseIcono(icono)}>WhatsApp</a>
  if (el.type === 'phone') return organization.phone ? <a href={`tel:${organization.phone}`} className={claseIcono(icono)}><Phone className="h-4 w-4" />{el.label || organization.phone}</a> : null
  if (el.type === 'text') return <span className="text-sm">{el.label}</span>
  if (el.type === 'button') {
    const boton = constructor.botones?.find((b) => b.id === el.buttonId) ?? constructor.botones?.[0]
    return boton ? <BotonVisual boton={boton} primaryColor={primaryColor} onCart={onCartClick} /> : null
  }
  if (el.type === 'currency' || el.type === 'social') return <span className="text-xs">{el.label || (el.type === 'currency' ? 'Moneda' : 'Redes')}</span>
  return <Search className="h-5 w-5" aria-hidden />
}

function MenuZona({ nav, mega, primaryColor, movil }: { nav: NavItem[]; mega: MegaItem[] | null; primaryColor: string; movil: boolean }) {
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
                  {col.links.map((l) => <Link key={l.href} href={l.href} className="block py-1 text-sm">{l.label}</Link>)}
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
                    {col.links.map((l) => <Link key={l.href} href={l.href} className="block py-1 text-sm">{l.label}</Link>)}
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
  const forma = boton.shape === 'pill' || boton.shape === 'circle' ? '999px' : boton.shape === 'square' ? '0' : boton.shape === 'semi' ? '6px' : '10px'
  const estilo: React.CSSProperties = boton.style === 'outline'
    ? { border: `1px solid ${boton.color || primaryColor}`, color: boton.color || primaryColor, borderRadius: forma }
    : boton.style === 'ghost'
      ? { color: boton.color || primaryColor, borderRadius: forma }
      : { background: boton.style === 'gradient' ? `linear-gradient(90deg, ${boton.color || primaryColor}, ${boton.textColor || '#111'})` : (boton.color || primaryColor), color: boton.textColor || '#fff', borderRadius: forma }
  const clase = `inline-flex items-center gap-1 px-3 font-medium ${boton.size === 'sm' ? 'h-8 text-xs' : boton.size === 'lg' ? 'h-12 text-base' : 'h-10 text-sm'}`
  const contenido = boton.style === 'icon_only' ? (boton.icon || '•') : boton.text
  if (boton.action === 'cart') return <button type="button" className={clase} style={estilo} onClick={onCart}>{contenido}</button>
  if (boton.action === 'whatsapp') return <a className={clase} style={estilo} href={`https://wa.me/?text=${encodeURIComponent(boton.message || boton.text)}`}>{contenido}</a>
  if (boton.action === 'call') return <a className={clase} style={estilo} href={`tel:${boton.href || ''}`}>{contenido}</a>
  if (boton.action === 'download') return <a className={clase} style={estilo} href={boton.href || '#'} download>{contenido}</a>
  return <Link href={boton.href || '/'} className={clase} style={estilo}>{contenido}</Link>
}

function claseIcono(icono: IconoElemento | undefined) {
  const caja = icono?.container === 'circle' ? 'rounded-full' : icono?.container === 'rounded' ? 'rounded-md' : icono?.container === 'square' ? 'rounded-none' : ''
  return `inline-flex items-center gap-1 p-2 text-sm ${caja}`
}

function enlaceWhatsapp(settings: HeaderVariantProps['settings']) {
  const n = (settings as { whatsapp_number?: string } | null)?.whatsapp_number
  return n ? `https://wa.me/${String(n).replace(/\D/g, '')}` : 'https://wa.me/'
}
