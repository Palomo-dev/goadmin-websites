'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCartKey } from '@/lib/utils'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'

interface OrderItem {
  product_id: number
  product_name: string
  quantity: number
  unit_price: number
  modifiers?: any
  notes?: string
}

interface ReorderButtonProps {
  items: OrderItem[]
  className?: string
  size?: 'sm' | 'md'
  primaryColor?: string
  organizationSubdomain?: string
  branchId?: number | null
}

export function ReorderButton({ items, className, size = 'md', primaryColor, organizationSubdomain, branchId }: ReorderButtonProps) {
  const { ruta } = useRutaSitio()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleReorder = () => {
    if (items.length === 0) return
    setLoading(true)

    try {
      const subdomain = organizationSubdomain || window.location.hostname.split('.')[0]
      const cartKey = getCartKey(subdomain, branchId)

      // Construir items para el carrito
      const cartItems = items.map((item) => ({
        id: item.product_id,
        name: item.product_name,
        price: Number(item.unit_price),
        quantity: item.quantity,
        ...(item.modifiers && { modifiers: item.modifiers }),
        ...(item.notes && { notes: item.notes }),
      }))

      // Obtener carrito existente y agregar/actualizar items
      const existing = JSON.parse(localStorage.getItem(cartKey) || '[]')
      for (const newItem of cartItems) {
        const existingIdx = existing.findIndex((e: any) => e.id === newItem.id)
        if (existingIdx >= 0) {
          existing[existingIdx].quantity += newItem.quantity
        } else {
          existing.push(newItem)
        }
      }

      localStorage.setItem(cartKey, JSON.stringify(existing))
      window.dispatchEvent(new CustomEvent('cart-updated'))

      router.push(ruta('/checkout'))
    } catch (err) {
      console.error('Error re-ordering:', err)
    } finally {
      setLoading(false)
    }
  }

  const btnSize = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'

  return (
    <button
      onClick={handleReorder}
      disabled={loading || items.length === 0}
      className={`inline-flex items-center gap-1.5 font-medium rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50 ${btnSize} ${className || ''}`}
      style={{ backgroundColor: primaryColor || '#8B5CF6' }}
    >
      {loading ? (
        <span className="animate-spin">⟳</span>
      ) : (
        <span>🔄</span>
      )}
      Pedir de nuevo
    </button>
  )
}
