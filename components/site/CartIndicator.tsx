'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'

interface CartIndicatorProps {
  primaryColor: string
  /** 'drawer' abre el drawer lateral (default), 'redirect' navega a /checkout */
  cartBehavior?: 'drawer' | 'redirect'
  onClick?: () => void
}

export function CartIndicator({ primaryColor, cartBehavior = 'drawer', onClick }: CartIndicatorProps) {
  const [itemCount, setItemCount] = useState(0)
  
  useEffect(() => {
    const updateCount = () => {
      try {
        const host = window.location.hostname
        const subdomain = host.split('.')[0]
        const cartKey = `cart_${subdomain}`
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
  }, [])

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
        href="/checkout"
        className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <ShoppingCart className="h-6 w-6 text-gray-700" />
        {badge}
      </Link>
    )
  }

  // Por defecto: abrir el drawer
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
    >
      <ShoppingCart className="h-6 w-6 text-gray-700" />
      {badge}
    </button>
  )
}
