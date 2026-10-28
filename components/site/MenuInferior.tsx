'use client'

/**
 * Menú inferior del celular v2 (lib/website/menuInferior.ts): pestañas tipo app o botones de
 * acción, con los botones que el sitio eligió (texto, ícono, acción y destino).
 *
 * Solo se pinta con `mobile_header.bottom_nav.v === 2`. Sin eso la tienda sigue con su barra de
 * siempre (BarraPestanas, MobileBottomNav, MobileCTABar o BarraMovilGiro).
 * - Pestañas: el mismo aspecto de BarraPestanas (fondo y color del encabezado, 56 px).
 * - Acciones: el mismo aspecto de BarraMovilGiro (primero relleno con el color de la marca).
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarCheck, CalendarDays, Heart, Home, LayoutGrid, Link2, MapPin, Menu, MessageCircle, Package, Percent,
  Phone, Search, ShoppingBag, ShoppingCart, Sparkles, Star, Tag, Truck, User,
} from 'lucide-react'
import type { BotonMenu, DestinoBoton, DestinosTienda, IconoMenu, MenuInferior as Menu2 } from '@/lib/website/menuInferior'
import { botonesVisibles } from '@/lib/website/menuInferior'
import { textoSobreAcentoSiHex } from '@/lib/website/v2/textoSobreAcento'
import { CLASE_FONDO_ENCABEZADO, estiloBarraEncabezado, marcaFondoEncabezado, variablesEncabezado, useTemaMenuMovil, type HeaderVariantProps } from './header/HeaderShared'
import { ModalCategorias, useUnidadesCarrito } from './header/mobile/MobileTabs'
import { ProductSearch } from './ProductSearch'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'

const ICONO: Record<IconoMenu, typeof Home> = {
  home: Home, grid: LayoutGrid, search: Search, bag: ShoppingBag, cart: ShoppingCart, user: User, menu: Menu,
  phone: Phone, whatsapp: MessageCircle, 'map-pin': MapPin, calendar: CalendarDays, 'calendar-check': CalendarCheck,
  package: Package, truck: Truck, tag: Tag, percent: Percent, star: Star, heart: Heart, sparkles: Sparkles, link: Link2,
}

type Props = Pick<HeaderVariantProps, 'organization' | 'primaryColor' | 'navTree' | 'settings' | 'menuCategories' | 'branchId'> & {
  menu: Menu2
  destinos: DestinosTienda
  onCartClick?: () => void
  /** Botones de acción: false en rutas con barra propia (checkout, carrito, detalle…). */
  rutaAdmiteAcciones: boolean
}

export function MenuInferior({ menu, destinos, organization, primaryColor, navTree, settings, menuCategories, branchId, onCartClick, rutaAdmiteAcciones }: Props) {
  const { ruta } = useRutaSitio()
  const pathname = usePathname() ?? '/'
  const [categorias, setCategorias] = useState(false)
  const [buscar, setBuscar] = useState(false)
  const unidades = useUnidadesCarrito(organization.subdomain || '', branchId)
  const temaMenu = useTemaMenuMovil(primaryColor)
  const corte = ((settings as { mobile_breakpoint?: number | null } | null | undefined)?.mobile_breakpoint ?? 768) - 0.02
  const botones = menu.enabled && (menu.variant === 'tabs' || rutaAdmiteAcciones) ? botonesVisibles(menu, destinos) : []
  const visible = botones.length > 0

  useEffect(() => {
    if (!visible) return
    document.body.classList.add('con-barra-movil')
    return () => document.body.classList.remove('con-barra-movil')
  }, [visible])
  if (!visible) return null

  const alPulsar = (d: DestinoBoton) => {
    if (d.tipo !== 'evento') return
    if (d.evento === 'search') setBuscar(true)
    else if (d.evento === 'categories') setCategorias(true)
    else if (d.evento === 'cart') onCartClick?.()
    else document.querySelector<HTMLButtonElement>('header button[aria-label="Abrir menú"]')?.click()
  }
  const href = (d: DestinoBoton) => (d.tipo === 'ruta' ? ruta(d.href) : d.tipo === 'externo' ? d.href : '')
  const activo = (d: DestinoBoton) => d.tipo === 'ruta' && (d.href === '/' ? pathname === ruta('/') || pathname === '/' : pathname.startsWith(ruta(d.href)))
  const conTexto = menu.style.labels !== 'never'
  const ocultarEscritorio = `@media (min-width:${corte + 0.02}px){[data-menu-inferior]{display:none!important}}`

  const extras = (
    <>
      {categorias && <ModalCategorias settings={settings} primaryColor={primaryColor} navTree={navTree} menuCategories={menuCategories} onClose={() => setCategorias(false)} />}
      {buscar && <ProductSearch primaryColor={primaryColor} abierto sinDisparador pantallaCompleta alCerrar={() => setBuscar(false)} />}
    </>
  )

  const enlace = (b: BotonMenu, d: DestinoBoton, clase: string, estilo: React.CSSProperties | undefined, contenido: React.ReactNode, aria?: string) => {
    const etiqueta = aria ?? (conTexto ? undefined : b.label || undefined)
    if (d.tipo === 'evento') return <button type="button" onClick={() => alPulsar(d)} className={clase} style={estilo} aria-label={etiqueta ?? b.label}>{contenido}</button>
    if (d.tipo === 'externo') {
      const nueva = /^https?:\/\//i.test(d.href)
      return <a href={d.href} {...(nueva ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className={clase} style={estilo} aria-label={etiqueta}>{contenido}</a>
    }
    return <Link href={href(d)} className={clase} style={estilo} aria-label={etiqueta}>{contenido}</Link>
  }

  if (menu.variant === 'actions') {
    const textoPrincipal = textoSobreAcentoSiHex(primaryColor) ?? '#ffffff'
    const principalId = menu.style.primaryId ?? botones[0].boton.id
    return (
      <>
        <style>{ocultarEscritorio}</style>
        <div data-menu-inferior="" className="h-[calc(4.5rem+env(safe-area-inset-bottom))]" aria-hidden="true" />
        <nav
          aria-label="Acciones rápidas"
          data-menu-inferior="acciones"
          className="fixed inset-x-0 bottom-0 z-40 px-3 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]"
          style={{
            backgroundColor: menu.style.background ?? 'var(--background-color, #ffffff)',
            color: menu.style.inactive ?? 'var(--text-color, #111827)',
            borderTop: '1px solid color-mix(in srgb, var(--text-color, #111827) 12%, transparent)',
          }}
        >
          <ul className="mx-auto flex max-w-md items-stretch gap-2">
            {botones.map(({ boton: b, destino: d }) => {
              const Icono = ICONO[b.icon]
              const principal = b.id === principalId
              const fondo = menu.style.active ?? primaryColor
              const clase = 'flex min-h-[44px] flex-1 items-center justify-center gap-1.5 px-2 text-[13px] font-semibold transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'
              const estilo: React.CSSProperties = principal
                ? { backgroundColor: fondo, color: textoSobreAcentoSiHex(fondo) ?? textoPrincipal, borderRadius: 'var(--radio-boton, 6px)', outlineColor: primaryColor }
                : { border: '1px solid color-mix(in srgb, currentColor 85%, transparent)', borderRadius: 'var(--radio-boton, 6px)', outlineColor: primaryColor }
              return (
                <li key={b.id} className="flex flex-1">
                  {enlace(b, d, clase, estilo, <>
                    <Icono className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    {conTexto && <span className="truncate">{b.label}</span>}
                  </>)}
                </li>
              )
            })}
          </ul>
        </nav>
        {extras}
      </>
    )
  }

  const colorActivo = menu.style.active
  const colorInactivo = menu.style.inactive ?? 'var(--hdr-mobile-icon)'
  return (
    <div className="contents" style={variablesEncabezado(settings, temaMenu)}>
      <style>{`@media (max-width: ${corte}px) { body { padding-bottom: 3.5rem; } }${ocultarEscritorio}`}</style>
      <nav
        aria-label="Menú inferior"
        data-menu-inferior="pestanas"
        className={`fixed bottom-0 left-0 right-0 z-40 ${CLASE_FONDO_ENCABEZADO}`}
        style={{ ...estiloBarraEncabezado(settings, 'top'), ...(menu.style.background ? { background: menu.style.background } : {}), color: colorInactivo }}
        {...marcaFondoEncabezado(settings)}
      >
        <div className="grid h-14" style={{ gridTemplateColumns: `repeat(${botones.length}, minmax(0, 1fr))` }}>
          {botones.map(({ boton: b, destino: d }) => {
            const Icono = ICONO[b.icon]
            const centro = b.id === menu.style.centerId
            const esActivo = activo(d)
            const color = esActivo && colorActivo ? colorActivo : colorInactivo
            const insignia = b.action === 'cart' && unidades > 0 && (
              <span className="absolute -top-2 -right-2.5 min-w-[16px] h-4 px-1 rounded-full text-white text-[10px] leading-4 font-bold text-center" style={{ backgroundColor: primaryColor }}>
                {unidades > 99 ? '99+' : unidades}
              </span>
            )
            const contenido = centro ? (
              <span className="flex flex-col items-center justify-center gap-0.5 h-full">
                <span className="relative -mt-5 flex h-12 w-12 items-center justify-center rounded-full shadow-lg" style={{ backgroundColor: colorActivo ?? primaryColor, color: textoSobreAcentoSiHex(colorActivo ?? primaryColor) ?? '#ffffff' }}>
                  <Icono className="h-6 w-6" aria-hidden="true" />{insignia}
                </span>
                {conTexto && <span className="text-[10px] font-medium" style={{ color }}>{b.label}</span>}
              </span>
            ) : (
              <span className="flex flex-col items-center justify-center gap-0.5 h-full hover:opacity-80 transition-opacity" style={{ color }}>
                <span className="relative"><Icono className="h-5 w-5" aria-hidden="true" />{insignia}</span>
                {conTexto && <span className="text-[10px] font-medium">{b.label}</span>}
              </span>
            )
            const aria = b.action === 'cart' && unidades > 0 ? `${b.label || 'Carrito'}, ${unidades}` : undefined
            return <span key={b.id} className="flex items-center justify-center" aria-current={esActivo ? 'page' : undefined}>{enlace(b, d, 'flex h-full w-full items-center justify-center', undefined, contenido, aria)}</span>
          })}
        </div>
      </nav>
      {extras}
    </div>
  )
}
