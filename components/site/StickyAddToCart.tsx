'use client'

import { useState, useEffect } from 'react'
import { ShoppingCart, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StickyAddToCartProps {
  productId: number
  productName: string
  price: number
  comparePrice?: number | null
  imageUrl?: string | null
  primaryColor: string
  isParent?: boolean
}

export function StickyAddToCart({
  productId,
  productName,
  price,
  comparePrice,
  imageUrl,
  primaryColor,
  isParent = false
}: StickyAddToCartProps) {
  const [added, setAdded] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      // Mostrar sticky bar cuando se scrollea más de 400px
      setVisible(window.scrollY > 400)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleAddToCart = () => {
    if (isParent) return
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
          ...(imageUrl && { imageUrl }),
          ...(comparePrice && { comparePrice: Number(comparePrice) })
        })
      }

      localStorage.setItem(cartKey, JSON.stringify(existingCart))
      window.dispatchEvent(new CustomEvent('cart-updated'))
      setAdded(true)
      setTimeout(() => setAdded(false), 2000)
    } catch (e) {}
  }

  if (isParent) return null

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t shadow-[0_-4px_20px_rgba(0,0,0,0.1)] transition-transform duration-300 lg:hidden ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="container mx-auto px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{productName}</p>
          <div className="flex items-center gap-2">
            {comparePrice && comparePrice > price && (
              <span className="text-xs text-gray-400 line-through">${comparePrice.toLocaleString()}</span>
            )}
            <span className="text-lg font-bold" style={{ color: primaryColor }}>
              ${price.toLocaleString()}
            </span>
            {comparePrice && comparePrice > price && (
              <span className="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                -{Math.round((1 - price / comparePrice) * 100)}%
              </span>
            )}
          </div>
        </div>
        <Button
          size="lg"
          onClick={handleAddToCart}
          className={`px-6 transition-all ${added ? 'bg-green-500 hover:bg-green-600' : ''}`}
          style={!added ? { backgroundColor: primaryColor } : {}}
        >
          {added ? (
            <><Check className="h-5 w-5 mr-2" /> Agregado</>
          ) : (
            <><ShoppingCart className="h-5 w-5 mr-2" /> Agregar</>
          )}
        </Button>
      </div>
    </div>
  )
}
