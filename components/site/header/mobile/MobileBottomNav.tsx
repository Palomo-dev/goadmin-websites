'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Heart, Home, LayoutGrid, Link2, MessageCircle, Search, ShoppingBag, ShoppingCart, Tag, User } from 'lucide-react'
import type { BarraApp, ItemBarra } from '@/lib/website/menuMovil'
import { contarUnidadesCarrito } from '@/lib/cart'

const ICONO: Record<string, typeof Home> = {
  home: Home,
  grid: LayoutGrid,
  search: Search,
  bag: ShoppingBag,
  cart: ShoppingCart,
  user: User,
  heart: Heart,
  tag: Tag,
  whatsapp: MessageCircle,
  link: Link2,
}

/**
 * Barra inferior tipo app. Solo si `mobile_header.bottom_nav.enabled` es true.
 * Reserva alto en la raíz del sitio y sube el chat para no taparlos.
 */
export function MobileBottomNav({
  barra,
  primaryColor,
  unidades,
  onMenu,
  onSearch,
  onCart,
}: {
  barra: BarraApp
  primaryColor: string
  unidades: number
  onMenu: () => void
  onSearch: () => void
  onCart?: () => void
}) {
  const pathname = usePathname() || '/'
  const alto = barra.float ? '5.75rem' : '4.25rem'
  useEffect(() => {
    document.body.classList.add('con-barra-app')
    document.body.style.setProperty('--barra-app-h', alto)
    return () => {
      document.body.classList.remove('con-barra-app')
      document.body.style.removeProperty('--barra-app-h')
    }
  }, [alto])

  const activo = barra.active || primaryColor
  const inactivo = barra.inactive || '#6b7280'
  const fondo = barra.background || 'var(--background-color, #ffffff)'

  return (
    <nav
      aria-label="Barra de la tienda"
      data-barra-app=""
      className={`fixed z-40 lg:hidden ${barra.float ? 'inset-x-3 bottom-3 rounded-2xl' : 'inset-x-0 bottom-0'}`}
      style={{
        backgroundColor: fondo,
        borderTop: barra.border ? '1px solid rgba(0,0,0,0.08)' : undefined,
        borderRadius: barra.radius ? barra.radius : undefined,
        boxShadow: barra.shadow ? '0 -8px 24px rgba(0,0,0,0.12)' : undefined,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <ul className="mx-auto flex max-w-lg items-end justify-around px-1 pt-1">
        {barra.items.map((item) => {
          const central = barra.centerId === item.id
          const encendido = item.href ? pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)) : false
          const color = encendido || central ? activo : inactivo
          const Icono = ICONO[item.icon] ?? Home
          const cuerpo = (
            <>
              <span className="relative">
                <Icono className={central ? 'h-6 w-6' : 'h-5 w-5'} aria-hidden="true" />
                {item.kind === 'cart' && unidades > 0 && (
                  <span className="absolute -right-2 -top-2 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] leading-4 text-white">{unidades}</span>
                )}
              </span>
              {item.showLabel && <span className="max-w-16 truncate text-[10px] leading-tight">{item.label}</span>}
              {encendido && barra.indicator === 'dot' && <span className="h-1 w-1 rounded-full" style={{ background: activo }} />}
              {encendido && barra.indicator === 'line' && <span className="h-0.5 w-4 rounded-full" style={{ background: activo }} />}
            </>
          )
          const clase = `flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 ${barra.indicator === 'pill' && encendido ? 'rounded-full' : ''} ${central ? '-mt-4 h-14 w-14 flex-none rounded-full text-white shadow-lg' : ''}`
          const estilo = central
            ? { backgroundColor: activo, color: '#fff' }
            : { color, backgroundColor: barra.indicator === 'pill' && encendido ? `${activo}22` : undefined }
          return (
            <li key={item.id} className="flex flex-1 justify-center">
              <BotonItem item={item} clase={clase} estilo={estilo} onMenu={onMenu} onSearch={onSearch} onCart={onCart}>
                {cuerpo}
              </BotonItem>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function BotonItem({
  item, clase, estilo, onMenu, onSearch, onCart, children,
}: {
  item: ItemBarra
  clase: string
  estilo: CSSProperties
  onMenu: () => void
  onSearch: () => void
  onCart?: () => void
  children: ReactNode
}) {
  if (item.action === 'menu') {
    return <button type="button" className={clase} style={estilo} onClick={onMenu}>{children}</button>
  }
  if (item.action === 'search') {
    return <button type="button" className={clase} style={estilo} onClick={onSearch}>{children}</button>
  }
  if (item.action === 'cart') {
    return <button type="button" className={clase} style={estilo} onClick={onCart}>{children}</button>
  }
  const href = item.kind === 'whatsapp' && item.href && !item.href.startsWith('http') && !item.href.startsWith('/')
    ? `https://wa.me/${item.href.replace(/\D/g, '')}`
    : item.href || '/'
  const externo = href.startsWith('http')
  if (externo) {
    return <a href={href} className={clase} style={estilo} target="_blank" rel="noopener noreferrer">{children}</a>
  }
  return <Link href={href} className={clase} style={estilo}>{children}</Link>
}

export function useUnidadesBarra(subdomain: string, branchId?: number | null) {
  const [unidades, setUnidades] = useState(0)
  useEffect(() => {
    const leer = () => {
      const clave = subdomain || (typeof window !== 'undefined' ? window.location.hostname.split('.')[0] : '')
      setUnidades(contarUnidadesCarrito(clave, branchId))
    }
    leer()
    window.addEventListener('cart-updated', leer)
    window.addEventListener('storage', leer)
    return () => {
      window.removeEventListener('cart-updated', leer)
      window.removeEventListener('storage', leer)
    }
  }, [subdomain, branchId])
  return unidades
}
