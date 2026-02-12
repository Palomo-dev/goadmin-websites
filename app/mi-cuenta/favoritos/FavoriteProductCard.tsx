'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface FavoriteProductCardProps {
  productId: number
  name: string
  description?: string
  price?: number
  imagePath?: string
  customerId: string
  organizationId: number
  primaryColor: string
}

export function FavoriteProductCard({
  productId,
  name,
  description,
  price,
  imagePath,
  customerId,
  organizationId,
  primaryColor,
}: FavoriteProductCardProps) {
  const router = useRouter()
  const [removing, setRemoving] = useState(false)
  const [removed, setRemoved] = useState(false)

  async function handleRemove() {
    setRemoving(true)
    try {
      await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, organizationId, productId, action: 'remove' }),
      })
      setRemoved(true)
      setTimeout(() => router.refresh(), 300)
    } catch {
      setRemoving(false)
    }
  }

  function handleAddToCart() {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]')
    const existing = cart.find((item: any) => item.id === productId)
    if (existing) {
      existing.quantity += 1
    } else {
      cart.push({ id: productId, name, price: price || 0, quantity: 1, imagePath })
    }
    localStorage.setItem('cart', JSON.stringify(cart))
    window.dispatchEvent(new Event('cart-updated'))
  }

  if (removed) return null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

  return (
    <div className="bg-white rounded-xl border overflow-hidden flex transition-opacity" style={{ opacity: removing ? 0.5 : 1 }}>
      {/* Imagen */}
      {imagePath && (
        <div className="w-24 h-24 flex-shrink-0 bg-gray-100">
          <img
            src={`${supabaseUrl}/storage/v1/object/public/${imagePath}`}
            alt={name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
        <div>
          <h3 className="font-semibold text-sm truncate">{name}</h3>
          {description && <p className="text-xs text-gray-500 line-clamp-1">{description}</p>}
          {price != null && (
            <p className="text-sm font-bold mt-1" style={{ color: primaryColor }}>
              ${Number(price).toLocaleString('es-CO')}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handleAddToCart}
            className="text-xs font-medium px-3 py-1 rounded-lg text-white"
            style={{ backgroundColor: primaryColor }}
          >
            + Carrito
          </button>
          <button
            onClick={handleRemove}
            disabled={removing}
            className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
          >
            Quitar ❤️
          </button>
        </div>
      </div>
    </div>
  )
}
