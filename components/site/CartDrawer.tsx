'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { X, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react'
import { CountdownBanner, type CountdownConfig } from './CountdownBanner'
import { Price } from './CurrencyProvider'

interface CartItem {
  id: number
  name: string
  price: number
  comparePrice?: number | null
  quantity: number
  imageUrl?: string | null
  variantAttributes?: Record<string, string> | null
}

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
  primaryColor: string
  organizationSubdomain: string
  shippingSettings?: {
    shippingFlatRate: number
    freeShippingThreshold: number
    enableShipping: boolean
  }
  taxSettings?: {
    name: string
    rate: number
    taxIncluded: boolean
  } | null
  countdownConfig?: CountdownConfig
  cartButtonConfig?: {
    mode: 'dynamic' | 'fixed'
    texts: string[]
  }
}

export function CartDrawer({ isOpen, onClose, primaryColor, organizationSubdomain, shippingSettings, taxSettings, countdownConfig, cartButtonConfig }: CartDrawerProps) {
  const [items, setItems] = useState<CartItem[]>([])
  const [checkoutButtonText] = useState(() => {
    const texts = cartButtonConfig?.texts?.length ? cartButtonConfig.texts : ['Comprar Ahora', 'Aprovechar Oferta', 'Obtener Descuento', 'Comprar con Descuento']
    if (cartButtonConfig?.mode === 'fixed') return texts[0]
    return texts[Math.floor(Math.random() * texts.length)]
  })
  
  const cartKey = `cart_${organizationSubdomain}`
  
  useEffect(() => {
    const loadCart = () => {
      try {
        const cart = JSON.parse(localStorage.getItem(cartKey) || '[]')
        setItems(cart)
      } catch {
        setItems([])
      }
    }
    
    loadCart()
    
    window.addEventListener('cart-updated', loadCart)
    window.addEventListener('storage', loadCart)
    
    return () => {
      window.removeEventListener('cart-updated', loadCart)
      window.removeEventListener('storage', loadCart)
    }
  }, [cartKey])
  
  const updateQuantity = (id: number, delta: number) => {
    const updatedItems = items.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta)
        return { ...item, quantity: newQty }
      }
      return item
    })
    setItems(updatedItems)
    localStorage.setItem(cartKey, JSON.stringify(updatedItems))
    window.dispatchEvent(new CustomEvent('cart-updated'))
  }
  
  const removeItem = (id: number) => {
    const updatedItems = items.filter(item => item.id !== id)
    setItems(updatedItems)
    localStorage.setItem(cartKey, JSON.stringify(updatedItems))
    window.dispatchEvent(new CustomEvent('cart-updated'))
  }
  
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = taxSettings && taxSettings.rate > 0 && !taxSettings.taxIncluded
    ? Math.round(subtotal * taxSettings.rate / 100)
    : 0
  
  if (!isOpen) return null
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 z-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" style={{ color: primaryColor }} />
            Tu Carrito
            {items.length > 0 && (
              <span 
                className="px-2 py-0.5 text-xs rounded-full text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {items.reduce((sum, i) => sum + i.quantity, 0)}
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 mb-4">Tu carrito está vacío</p>
              <Button onClick={onClose} variant="outline">
                Continuar Comprando
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex gap-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <div 
                    className="w-20 h-20 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                    style={{ backgroundColor: `${primaryColor}10` }}
                  >
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl">📦</span>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate">{item.name}</h4>
                    {item.variantAttributes && Object.keys(item.variantAttributes).length > 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {Object.entries(item.variantAttributes).map(([k, v]) => (
                          <span key={k} className="mr-2"><span className="capitalize font-medium">{k}:</span> {v}</span>
                        ))}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      {item.comparePrice && item.comparePrice > item.price && (
                        <Price value={Number(item.comparePrice)} className="text-xs text-gray-400 line-through" />
                      )}
                      <Price value={Number(item.price)} className="text-sm font-bold" style={{ color: primaryColor }} />
                    </div>
                    
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-8 h-8 rounded-full bg-white dark:bg-gray-700 border dark:border-gray-600 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-600"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-8 h-8 rounded-full bg-white dark:bg-gray-700 border dark:border-gray-600 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-600"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t dark:border-gray-700 p-4 space-y-4">
            <div className="flex items-center justify-between text-sm text-gray-900 dark:text-white">
              <span>Subtotal</span>
              <Price value={subtotal} />
            </div>
            {tax > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">{taxSettings!.name} ({taxSettings!.rate}%)</span>
                <Price value={tax} />
              </div>
            )}
            {taxSettings?.taxIncluded && taxSettings.rate > 0 && (
              <p className="text-xs text-gray-400">{taxSettings.name} incluido en el precio</p>
            )}

            {/* Envío */}
            {shippingSettings?.enableShipping && (
              <>
                {shippingSettings.freeShippingThreshold > 0 && subtotal < shippingSettings.freeShippingThreshold ? (
                  <>
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm">
                      <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                        <span>¡Te faltan</span>
                        <Price value={shippingSettings.freeShippingThreshold - subtotal} className="font-bold" style={{ color: primaryColor }} />
                        <span>para envío gratis!</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Envío</span>
                      <Price value={shippingSettings.shippingFlatRate} className="font-medium text-gray-900 dark:text-white" />
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Envío</span>
                    <span className="font-medium text-green-600 dark:text-green-400">Gratis</span>
                  </div>
                )}
              </>
            )}

            {/* Countdown */}
            {countdownConfig?.countdown_enabled && countdownConfig?.countdown_show_in_cart && (
              <CountdownBanner config={countdownConfig} primaryColor={primaryColor} variant="inline" />
            )}

            {/* Total */}
            <div className="flex items-center justify-between text-xl font-bold text-gray-900 dark:text-white pt-2 border-t dark:border-gray-700">
              <span>Total</span>
              <Price value={subtotal + tax + (shippingSettings?.enableShipping && shippingSettings.freeShippingThreshold > 0 && subtotal < shippingSettings.freeShippingThreshold ? shippingSettings.shippingFlatRate : 0)} style={{ color: primaryColor }} />
            </div>
            
            <Link href="/checkout" onClick={onClose}>
              <Button 
                className="w-full h-12 font-semibold"
                style={{ backgroundColor: primaryColor }}
              >
                {checkoutButtonText}
              </Button>
            </Link>

            <Link href="/carrito" onClick={onClose}>
              <Button variant="outline" className="w-full h-10 dark:border-gray-600 dark:text-white">
                Ver carrito completo
              </Button>
            </Link>
            
            <button
              onClick={onClose}
              className="w-full text-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              Continuar Comprando
            </button>
          </div>
        )}
      </div>
    </>
  )
}
