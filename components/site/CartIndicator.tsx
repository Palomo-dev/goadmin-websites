'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ShoppingCart, type LucideIcon } from 'lucide-react'
import { getCartKey } from '@/lib/utils'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { IconoConCirculo, propsTrazoIcono } from './header/IconoEncabezado'

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
}

export function CartIndicator({ primaryColor, cartBehavior = 'drawer', onClick, organizationSubdomain, icon: IconProp, branchId, heredarColor = false, relleno = false, circulo = false }: CartIndicatorProps) {
  const { ruta } = useRutaSitio()
  const Icon = IconProp || ShoppingCart
  const trazo = propsTrazoIcono(relleno)
  const claseIcono = circulo || heredarColor ? 'h-6 w-6 text-current' : 'h-6 w-6 text-gray-700 dark:text-gray-300'
  const icono = (
    <IconoConCirculo circulo={circulo} primaryColor={primaryColor}>
      <Icon className={claseIcono} {...trazo} />
    </IconoConCirculo>
  )
  const [itemCount, setItemCount] = useState(0)
  
  useEffect(() => {
    const updateCount = () => {
      try {
        const subdomain = organizationSubdomain || window.location.hostname.split('.')[0]
        const cartKey = getCartKey(subdomain, branchId)
        const cart = JSON.parse(localStorage.getItem(cartKey) || '[]')
        const count = cart.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
        setItemCount(count)
      } catch {
        setItemCount(0)
      }
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

  const badge = itemCount > 0 && (
    <span 
      className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center"
      style={{ backgroundColor: primaryColor }}
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
