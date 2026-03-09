'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ShoppingCart, Check, Plus } from 'lucide-react'
import { trackMetaAddToCart } from '@/components/site/MetaPixelEvents'

interface AddToCartButtonProps {
  productId: number
  productName: string
  price: number
  imageUrl?: string | null
  primaryColor: string
  variant?: 'full' | 'icon' | 'compact'
  className?: string
}

export function AddToCartButton({ 
  productId, 
  productName, 
  price, 
  imageUrl,
  primaryColor, 
  variant = 'full',
  className = ''
}: AddToCartButtonProps) {
  const [added, setAdded] = useState(false)

  const handleAddToCart = () => {
    try {
      const host = window.location.hostname
      const subdomain = host.split('.')[0]
      const cartKey = `cart_${subdomain}`
      const existingCart = JSON.parse(localStorage.getItem(cartKey) || '[]')

      const existingIndex = existingCart.findIndex((item: any) => item.id === productId)

      if (existingIndex >= 0) {
        existingCart[existingIndex].quantity += 1
      } else {
        existingCart.push({
          id: productId,
          name: productName,
          price: Number(price),
          quantity: 1,
          ...(imageUrl && { imageUrl })
        })
      }

      localStorage.setItem(cartKey, JSON.stringify(existingCart))
      window.dispatchEvent(new CustomEvent('cart-updated'))

      // Meta Pixel: AddToCart
      trackMetaAddToCart(String(productId), productName, Number(price))

      // Feedback visual
      setAdded(true)
      setTimeout(() => setAdded(false), 1500)
    } catch (err) {
      console.error('Error adding to cart:', err)
    }
  }

  if (variant === 'full') {
    return (
      <Button
        size="lg"
        className={`w-full text-lg py-6 transition-all ${added ? 'bg-green-500 hover:bg-green-600' : ''} ${className}`}
        style={!added ? { backgroundColor: primaryColor } : {}}
        onClick={handleAddToCart}
      >
        {added ? (
          <>
            <Check className="h-5 w-5 mr-2" />
            ¡Agregado al carrito!
          </>
        ) : (
          <>
            <ShoppingCart className="h-5 w-5 mr-2" />
            Agregar al carrito
          </>
        )}
      </Button>
    )
  }

  if (variant === 'compact') {
    return (
      <Button
        size="sm"
        className={`transition-all ${added ? 'bg-green-500 hover:bg-green-600' : ''} ${className}`}
        style={!added ? { backgroundColor: primaryColor } : {}}
        onClick={handleAddToCart}
      >
        {added ? (
          <>
            <Check className="h-4 w-4 mr-1" />
            Agregado
          </>
        ) : (
          <>
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </>
        )}
      </Button>
    )
  }

  // variant === 'icon'
  return (
    <Button
      size="icon"
      className={`transition-all ${added ? 'bg-green-500 hover:bg-green-600' : ''} ${className}`}
      style={!added ? { backgroundColor: primaryColor } : {}}
      onClick={handleAddToCart}
    >
      {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
    </Button>
  )
}
