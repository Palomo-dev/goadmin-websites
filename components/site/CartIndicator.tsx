'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ShoppingCart, type LucideIcon } from 'lucide-react'
import { contarUnidadesCarrito } from '@/lib/cart'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { IconoConCirculo, propsTrazoIcono } from './header/IconoEncabezado'
import { ContenedorIcono, trazoContenedor, type ColoresCaja } from './header/ContenedorIcono'
import { contenedorDe, type ContenedorIconos } from '@/lib/website/constructorEncabezado'

interface CartIndicatorProps {
  primaryColor: string
  /** 'drawer' abre el drawer lateral (default), 'redirect' navega a /checkout */
  cartBehavior?: 'drawer' | 'redirect'
  onClick?: () => void
  organizationSubdomain?: string
  /** Icono personalizado (del editor). Default: ShoppingCart */
  icon?: LucideIcon
  branchId?: number | null
  /** El ícono hereda `--header-fg` de la barra. */
  heredarColor?: boolean
  /** Relleno del icono (el trazo se queda). */
  relleno?: boolean
  /** Círculo del color de la marca detrás del icono. */
  circulo?: boolean
  /** Caja nueva. Sin ella se conserva el círculo de acento. */
  contenedor?: ContenedorIconos | null
  colores?: ColoresCaja
}

export function CartIndicator({ primaryColor, cartBehavior = 'drawer', onClick, organizationSubdomain, icon: IconProp, branchId, heredarColor = false, relleno = false, circulo = false, contenedor = null, colores }: CartIndicatorProps) {
  const { ruta } = useRutaSitio()
  const Icon = IconProp || ShoppingCart
  const trazo = propsTrazoIcono(relleno)
  const claseIcono = circulo || heredarColor ? 'h-6 w-6 text-current' : 'h-6 w-6 text-gray-700 dark:text-gray-300'
  const caja = contenedor ? contenedorDe(contenedor, 'cart') : null
  const icono = caja ? (
    <ContenedorIcono base={contenedor!} clave="cart" colores={colores || { primary: primaryColor, accent: primaryColor, secondary: primaryColor }}>
      <Icon style={trazoContenedor(contenedor!, 'cart', relleno)} />
    </ContenedorIcono>
  ) : (
    <IconoConCirculo circulo={circulo} primaryColor={primaryColor}>
      <Icon className={claseIcono} {...trazo} />
    </IconoConCirculo>
  )
  const [itemCount, setItemCount] = useState(0)
  
  useEffect(() => {
    const updateCount = () => {
      const subdomain = organizationSubdomain || window.location.hostname.split('.')[0]
      setItemCount(contarUnidadesCarrito(subdomain, branchId))
    }
    
    // Initial load
    updateCount()
    
    // Listen for cart updates
    window.addEventListener('cart-updated', updateCount)
    window.addEventListener('storage', updateCount)
    
    return () => {
      window.removeEventListener('cart-updated', updateCount)
      window.removeEventListener('storage', updateCount)
    }
  }, [organizationSubdomain, branchId])

  const pos = caja?.badgePosition
  const forma = caja?.badgeShape
  const claseBadge = forma || pos
    ? `absolute ${pos === 'top-left' ? '-top-1 -left-1' : '-top-1 -right-1'} ${forma === 'pill' ? 'h-5 min-w-5 rounded-full px-1.5' : 'w-5 h-5 rounded-full'} text-white text-xs font-bold flex items-center justify-center`
    : 'absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center'
  const badge = itemCount > 0 && (
    <span
      className={claseBadge}
      style={{ backgroundColor: caja?.badgeColor || primaryColor }}
    >
      {itemCount > 99 ? '99+' : itemCount}
    </span>
  )

  // Si el comportamiento es 'redirect', navegar directamente a /checkout
  if (cartBehavior === 'redirect') {
    return (
      <Link 
        href={ruta('/checkout')}
        className="relative p-2 rounded-full hover:bg-[var(--header-hover)] transition-colors"
      >
        {icono}
        {badge}
      </Link>
    )
  }

  // Por defecto: abrir el drawer
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative p-2 rounded-full hover:bg-[var(--header-hover)] transition-colors"
    >
      {icono}
      {badge}
    </button>
  )
}
