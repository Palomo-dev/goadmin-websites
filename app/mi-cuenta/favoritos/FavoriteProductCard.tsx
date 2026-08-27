'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProductCard } from '@/components/sections/products/ProductCard'

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
  const fullImageUrl = imagePath ? `${supabaseUrl}/storage/v1/object/public/${imagePath}` : undefined

  // ProductCard espera un objeto product con la estructura estándar.
  const product = {
    id: productId,
    name,
    description,
    product_prices: price != null ? [{ price }] : [],
  }

  return (
    <ProductCard
      product={product}
      primaryColor={primaryColor}
      variant="compact"
      onAddToCart={handleAddToCart}
      onRemoveFavorite={handleRemove}
      removing={removing}
      showDescription
      imageUrl={fullImageUrl}
    />
  )
}
