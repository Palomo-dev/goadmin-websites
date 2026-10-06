'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  ShoppingBag, Trash2, Plus, Minus, ArrowLeft, ArrowRight,
  Package, ShieldCheck, Truck, CreditCard, Tag
} from 'lucide-react'
import { getCartKey } from '@/lib/utils'
import { useCartPromotions, promotionsForItem, promotionBadgeLabel } from '@/lib/hooks/useCartPromotions'
import { isParentProduct } from '@/components/sections/products/ProductCard'
import { calcularImpuestoPedido } from '@/lib/orders/impuestoPedido'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

interface CartModifier {
  modifierId: number
  valueName: string
  extraPrice?: number
}

interface NewCartModifier {
  modifierId: number
  name: string
  extraPrice: number
}

interface CartItem {
  id: number | string
  productId?: number
  name: string
  price: number
  comparePrice?: number | null
  quantity: number
  imageUrl?: string | null
  notes?: string
  modifiers?: CartModifier[]
  newModifiers?: NewCartModifier[]
  variantAttributes?: Record<string, string> | null
}

interface CartSettings {
  taxRate: number
  taxName: string
  taxIncluded: boolean
  shippingFlatRate: number
  freeShippingThreshold: number
  enableShipping: boolean
}

interface SuggestedProduct {
  id: number
  uuid: string
  name: string
  description?: string
  is_parent?: boolean
  has_variants?: boolean
  variant_count?: number
  product_prices?: { price: number }[]
  product_images?: any[]
}

interface CartPageClientProps {
  primaryColor: string
  organizationSubdomain: string
  organizationId: number
  cartSettings: CartSettings
  suggestedProducts: SuggestedProduct[]
  branchId?: number | null
}

function getProductImageUrl(product: SuggestedProduct): string | null {
  if (!product.product_images || product.product_images.length === 0) return null
  const primary = product.product_images.find((img: any) => img.is_primary)
  const image = primary || product.product_images[0]
  const path = image.storage_path || image.shared_images?.storage_path
  if (!path) return null
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`
}

export function CartPageClient({
  primaryColor,
  organizationSubdomain,
  organizationId,
  cartSettings,
  suggestedProducts,
  branchId
}: CartPageClientProps) {
  const { ruta } = useRutaSitio()
  const [items, setItems] = useState<CartItem[]>([])
  const [checkoutButtonText] = useState(() => {
    const options = ['Comprar Ahora', 'Aprovechar Oferta', 'Obtener Descuento', 'Comprar con Descuento']
    return options[Math.floor(Math.random() * options.length)]
  })
  const cartKey = getCartKey(organizationSubdomain, branchId)
  const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`

  // Promociones automáticas (mismo motor que el drawer, el checkout y /api/orders)
  const { promotions, totalDiscount: promoDiscount, itemDiscounts } = useCartPromotions({ organizationId, branchId, items })

  useEffect(() => {
    const loadCart = () => {
      try {
        setItems(JSON.parse(localStorage.getItem(cartKey) || '[]'))
      } catch {
        setItems([])
      }
    }
    loadCart()
    window.addEventListener('cart-updated', loadCart)
    return () => window.removeEventListener('cart-updated', loadCart)
  }, [cartKey])

  const saveCart = (updated: CartItem[]) => {
    setItems(updated)
    localStorage.setItem(cartKey, JSON.stringify(updated))
    window.dispatchEvent(new CustomEvent('cart-updated'))
  }

  const updateQuantity = (id: number | string, delta: number) => {
    saveCart(
      items.map(item =>
        item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
      )
    )
  }

  const removeItem = (id: number | string) => {
    saveCart(items.filter(item => item.id !== id))
  }

  const clearCart = () => {
    saveCart([])
  }

  const addSuggested = (product: SuggestedProduct) => {
    const price = product.product_prices?.[0]?.price || 0
    const existing = items.find(i => i.id === product.id)
    if (existing) {
      saveCart(items.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i))
    } else {
      const imgUrl = getProductImageUrl(product)
      saveCart([...items, { id: product.id, name: product.name, price: Number(price), quantity: 1, imageUrl: imgUrl }])
    }
  }

  // Cálculos
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
  // Impuesto con la regla que cobra /api/orders (lib/orders/impuestoPedido.ts): sobre la base con
  // las promociones; solo se suma al total si no va incluido en el precio.
  const tax = calcularImpuestoPedido({
    brutos: items.map((item) => item.price * item.quantity),
    descuento: promoDiscount,
    tasa: cartSettings.taxRate,
    incluido: cartSettings.taxIncluded,
  }).sumaAlTotal
  const shipping = cartSettings.enableShipping
    ? (cartSettings.freeShippingThreshold > 0 && subtotal >= cartSettings.freeShippingThreshold ? 0 : cartSettings.shippingFlatRate)
    : 0
  // Mismo cálculo que el checkout y el servidor: impuesto sobre la base con descuento.
  const total = Math.max(0, subtotal + tax + shipping - promoDiscount)

  // Progreso para envío gratis
  const freeShippingProgress = cartSettings.freeShippingThreshold > 0
    ? Math.min(100, (subtotal / cartSettings.freeShippingThreshold) * 100)
    : 100
  const remainingForFreeShipping = Math.max(0, cartSettings.freeShippingThreshold - subtotal)

  // Carrito vacío
  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto text-center">
          <ShoppingBag className="h-20 w-20 mx-auto text-gray-300 dark:text-gray-600 mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Tu carrito está vacío</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8">Agrega productos para comenzar tu compra</p>
          <Link href={ruta('/productos')}>
            <Button style={{ backgroundColor: primaryColor }} className="px-8 h-12 text-base">
              <ShoppingBag className="h-5 w-5 mr-2" />
              Ver productos
            </Button>
          </Link>
        </div>

        {/* Productos sugeridos */}
        {suggestedProducts.length > 0 && (
          <div className="mt-16">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 text-center">Te puede interesar</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {suggestedProducts.slice(0, 4).map(product => (
                <SuggestedCard key={product.id} product={product} primaryColor={primaryColor} onAdd={() => addSuggested(product)} />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Carrito de Compras</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{totalItems} {totalItems === 1 ? 'producto' : 'productos'}</p>
        </div>
        <button
          onClick={clearCart}
          className="text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400 font-medium"
        >
          Vaciar carrito
        </button>
      </div>

      {/* Barra de envío gratis */}
      {cartSettings.enableShipping && cartSettings.freeShippingThreshold > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border dark:border-gray-700">
          {remainingForFreeShipping > 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              <Truck className="h-4 w-4 inline mr-1" />
              ¡Te faltan <strong style={{ color: primaryColor }}>${remainingForFreeShipping.toLocaleString('es-CO')}</strong> para envío gratis!
            </p>
          ) : (
            <p className="text-sm text-green-600 dark:text-green-400 font-medium mb-2">
              <Truck className="h-4 w-4 inline mr-1" />
              ¡Tienes envío gratis!
            </p>
          )}
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${freeShippingProgress}%`, backgroundColor: freeShippingProgress >= 100 ? '#22c55e' : primaryColor }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Lista de productos */}
        <div className="lg:col-span-2 space-y-4">
          {items.map(item => (
            <div
              key={item.id}
              className="flex gap-4 p-4 bg-white dark:bg-gray-800/50 rounded-xl border dark:border-gray-700 hover:shadow-sm transition-shadow"
            >
              {/* Imagen */}
              <Link href={ruta(`/productos/${item.productId || item.id}`)} className="shrink-0">
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 relative">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-8 w-8 text-gray-300 dark:text-gray-500" />
                    </div>
                  )}
                </div>
              </Link>

              {/* Info */}
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <Link href={ruta(`/productos/${item.productId || item.id}`)}>
                    <h3 className="font-semibold text-gray-900 dark:text-white hover:underline line-clamp-2">{item.name}</h3>
                  </Link>
                  {item.variantAttributes && Object.keys(item.variantAttributes).length > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {Object.entries(item.variantAttributes).map(([k, v]) => (
                        <span key={k} className="mr-2"><span className="capitalize font-medium">{k}:</span> {v}</span>
                      ))}
                    </p>
                  )}
                  {item.modifiers && item.modifiers.length > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {item.modifiers.map(m => m.valueName).join(', ')}
                    </p>
                  )}
                  {item.newModifiers && item.newModifiers.length > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {item.newModifiers.map(m => `${m.name}${m.extraPrice > 0 ? ` (+$${m.extraPrice.toLocaleString('es-CO')})` : ''}`).join(', ')}
                    </p>
                  )}
                  {item.notes && (
                    <p className="text-xs text-gray-400 italic mt-0.5">📝 {item.notes}</p>
                  )}
                  {promotionsForItem(promotions, item.id).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {promotionsForItem(promotions, item.id).map(p => (
                        <span
                          key={p.id}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          title={p.name}
                        >
                          <Tag className="w-3 h-3" />
                          {promotionBadgeLabel(p, fmt)}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {item.comparePrice && item.comparePrice > item.price && (
                      <span className="text-sm text-gray-400 line-through">${Number(item.comparePrice).toLocaleString('es-CO')}</span>
                    )}
                    <p className="text-sm font-medium" style={{ color: primaryColor }}>
                      ${Number(item.price).toLocaleString('es-CO')} c/u
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3">
                  {/* Controles de cantidad */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-8 h-8 rounded-full border dark:border-gray-600 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-10 text-center font-semibold text-gray-900 dark:text-white">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-8 h-8 rounded-full border dark:border-gray-600 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Subtotal + eliminar */}
                  <div className="flex items-center gap-3">
                    {(itemDiscounts[String(item.id)] || 0) > 0 ? (
                      <span className="text-right">
                        <span className="block text-xs text-gray-400 line-through">
                          ${(item.price * item.quantity).toLocaleString('es-CO')}
                        </span>
                        <span className="font-bold text-green-600 dark:text-green-400">
                          {fmt(item.price * item.quantity - (itemDiscounts[String(item.id)] || 0))}
                        </span>
                      </span>
                    ) : (
                      <span className="font-bold text-gray-900 dark:text-white">
                        ${(item.price * item.quantity).toLocaleString('es-CO')}
                      </span>
                    )}
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Link volver */}
          <Link
            href={ruta('/productos')}
            className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mt-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Continuar comprando
          </Link>
        </div>

        {/* Resumen lateral */}
        <div>
          <Card className="sticky top-20 dark:bg-gray-800/50 dark:border-gray-700">
            <CardContent className="p-6">
              <h2 className="font-bold text-lg text-gray-900 dark:text-white mb-4">Resumen del pedido</h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-gray-600 dark:text-gray-300">
                  <span>Subtotal ({totalItems} {totalItems === 1 ? 'producto' : 'productos'})</span>
                  <span className="font-medium">${subtotal.toLocaleString('es-CO')}</span>
                </div>
                {tax > 0 && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-300">
                    <span>{cartSettings.taxName} ({cartSettings.taxRate}%)</span>
                    <span>${tax.toLocaleString('es-CO')}</span>
                  </div>
                )}
                {cartSettings.taxIncluded && cartSettings.taxRate > 0 && (
                  <p className="text-xs text-gray-400">{cartSettings.taxName} incluido en el precio</p>
                )}
                {promotions.map(promo => (
                  <div key={promo.id} className="flex justify-between text-green-600 dark:text-green-400">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <Tag className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{promo.name}</span>
                    </span>
                    <span className="font-medium flex-shrink-0 ml-2">-{fmt(promo.discount)}</span>
                  </div>
                ))}
                {cartSettings.enableShipping && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-300">
                    <span>Envío estimado</span>
                    <span className={shipping === 0 ? 'text-green-600 font-medium' : ''}>
                      {shipping === 0 ? 'Gratis' : `$${shipping.toLocaleString('es-CO')}`}
                    </span>
                  </div>
                )}
                <div className="border-t dark:border-gray-600 pt-3">
                  <div className="flex justify-between font-bold text-lg text-gray-900 dark:text-white">
                    <span>Total</span>
                    <span style={{ color: primaryColor }}>${total.toLocaleString('es-CO')}</span>
                  </div>
                  {promoDiscount > 0 && (
                    <p className="text-xs text-green-600 dark:text-green-400 text-right mt-1">
                      Estás ahorrando <strong>{fmt(promoDiscount)}</strong> con promociones
                    </p>
                  )}
                </div>
              </div>

              <Link href={ruta('/checkout')} className="block mt-6">
                <Button
                  className="w-full h-12 font-semibold text-base"
                  style={{ backgroundColor: primaryColor }}
                >
                  {checkoutButtonText}
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </Link>

              {/* Trust badges */}
              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <ShieldCheck className="h-4 w-4 text-green-500" />
                  Compra segura y protegida
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <CreditCard className="h-4 w-4 text-blue-500" />
                  Múltiples métodos de pago
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Truck className="h-4 w-4 text-orange-500" />
                  Envío a todo el país
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Productos sugeridos */}
      {suggestedProducts.length > 0 && (
        <div className="mt-16">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Te puede interesar</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {suggestedProducts
              .filter(p => !items.some(i => i.id === p.id))
              .slice(0, 4)
              .map(product => (
                <SuggestedCard key={product.id} product={product} primaryColor={primaryColor} onAdd={() => addSuggested(product)} />
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// --- Tarjeta de producto sugerido ---

function SuggestedCard({
  product,
  primaryColor,
  onAdd
}: {
  product: SuggestedProduct
  primaryColor: string
  onAdd: () => void
}) {
  const { ruta } = useRutaSitio()
  const price = product.product_prices?.[0]?.price
  const imgUrl = getProductImageUrl(product)

  return (
    <Card className="group overflow-hidden dark:bg-gray-800/50 dark:border-gray-700">
      <Link href={ruta(`/productos/${product.uuid}`)}>
        <div className="aspect-square relative bg-gray-100 dark:bg-gray-700 overflow-hidden">
          {imgUrl ? (
            <Image src={imgUrl} alt={product.name} fill className="object-cover group-hover:scale-105 transition-transform" sizes="(max-width: 768px) 50vw, 25vw" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-10 w-10 text-gray-300 dark:text-gray-500" />
            </div>
          )}
        </div>
      </Link>
      <CardContent className="p-3">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">{product.name}</h3>
        <div className="flex items-center justify-between mt-2">
          {price && (
            <span className="text-sm font-bold" style={{ color: primaryColor }}>
              ${Number(price).toLocaleString('es-CO')}
            </span>
          )}
          {isParentProduct(product) ? (
            // Padre con variantes: no se agrega a ciegas, se elige talla/color en el detalle.
            <Link href={ruta(`/productos/${product.uuid}`)}>
              <Button size="sm" variant="outline" className="h-7 text-xs dark:border-gray-600">
                Elegir
              </Button>
            </Link>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs dark:border-gray-600"
              onClick={(e) => { e.preventDefault(); onAdd() }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Agregar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
