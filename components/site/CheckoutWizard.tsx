'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Trash2, Plus, Minus, CreditCard, Truck, Check, ShoppingBag, Banknote, Building2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { OrderTypeSelector, type OrderType } from '@/components/site/OrderTypeSelector'
import { TipSelector } from '@/components/site/TipSelector'
import { ScheduleSelector } from '@/components/site/ScheduleSelector'

interface CartModifier {
  typeId: number
  typeName: string
  valueId: number
  valueName: string
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
  variantAttributes?: Record<string, string> | null
}

interface WebsitePaymentMethod {
  code: string
  name: string
  description?: string | null
  icon?: string | null
  requiresReference: boolean
  connectionId?: string | null
  type: 'native' | 'gateway'
}

interface CheckoutSettings {
  taxRate: number
  taxName: string
  taxIncluded: boolean
  shippingFlatRate: number
  freeShippingThreshold: number
  enableShipping: boolean
  availableDeliveryTypes?: string[]
}

interface CheckoutWizardProps {
  organizationId: number
  primaryColor: string
  paymentMethods: WebsitePaymentMethod[]
  checkoutSettings?: CheckoutSettings
  isRestaurant?: boolean
}

const METHOD_ICONS: Record<string, string> = {
  cash: '💵',
  transfer: '🏦',
  card: '💳',
  wompi_co: '💳',
  mp_checkout: '🟦',
  payu_co: '💚',
  stripe_payments: '💳',
  paypal_checkout: '🅿️',
  wompi: '💳',
}

const DEFAULT_SETTINGS: CheckoutSettings = {
  taxRate: 0,
  taxName: 'IVA',
  taxIncluded: false,
  shippingFlatRate: 10000,
  freeShippingThreshold: 100000,
  enableShipping: true,
  availableDeliveryTypes: ['pickup', 'delivery_own', 'delivery_third_party'],
}

export function CheckoutWizard({ organizationId, primaryColor, paymentMethods: availableMethods, checkoutSettings, isRestaurant = false }: CheckoutWizardProps) {
  const settings = { ...DEFAULT_SETTINGS, ...checkoutSettings }
  const [step, setStep] = useState(1)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [orderComplete, setOrderComplete] = useState(false)
  const [orderNumber, setOrderNumber] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  // Restaurant-specific states
  const [orderType, setOrderType] = useState<OrderType>('delivery')
  const [tipAmount, setTipAmount] = useState(0)
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledAt, setScheduledAt] = useState<string | null>(null)
  const [dineInTable, setDineInTable] = useState<string | null>(null)

  // Coupon states
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<{ id: string; code: string; name: string; discount_type: string; discount_value: number } | null>(null)
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)

  // Promotion states
  const [appliedPromotions, setAppliedPromotions] = useState<{ id: string; name: string; discount: number; promotion_type: string }[]>([])
  const [promoDiscount, setPromoDiscount] = useState(0)

  // Dynamic shipping states
  const [dynamicShippingRates, setDynamicShippingRates] = useState<{ id: string; name: string; cost: number; service_level: string; carrier_name: string | null }[]>([])
  const [selectedShippingRate, setSelectedShippingRate] = useState<string | null>(null)
  const [dynamicShippingCost, setDynamicShippingCost] = useState<number | null>(null)

  const [customerData, setCustomerData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    notes: ''
  })

  // 'gateway_code' o 'cash' o 'transfer'
  const [paymentMethod, setPaymentMethod] = useState<string>(
    availableMethods.length > 0 ? availableMethods[0].code : 'cash'
  )

  useEffect(() => {
    try {
      const host = window.location.hostname
      const subdomain = host.split('.')[0]
      const savedCart = localStorage.getItem(`cart_${subdomain}`)
      if (savedCart) {
        setCartItems(JSON.parse(savedCart))
      }
      // QR dine-in: leer mesa de localStorage
      if (isRestaurant) {
        const table = localStorage.getItem(`dine_in_table_${subdomain}`)
        if (table) {
          setDineInTable(table)
          setOrderType('dine_in')
        }
      }
    } catch (err) {
      console.error('Error loading cart:', err)
    }
  }, [])

  const updateQuantity = (id: number | string, delta: number) => {
    setCartItems(items => {
      const updated = items.map(item => {
        if (item.id === id) {
          return { ...item, quantity: Math.max(0, item.quantity + delta) }
        }
        return item
      }).filter(item => item.quantity > 0)

      const host = window.location.hostname
      const subdomain = host.split('.')[0]
      localStorage.setItem(`cart_${subdomain}`, JSON.stringify(updated))
      window.dispatchEvent(new CustomEvent('cart-updated'))
      return updated
    })
  }

  const removeItem = (id: number | string) => {
    setCartItems(items => {
      const updated = items.filter(item => item.id !== id)
      const host = window.location.hostname
      const subdomain = host.split('.')[0]
      localStorage.setItem(`cart_${subdomain}`, JSON.stringify(updated))
      window.dispatchEvent(new CustomEvent('cart-updated'))
      return updated
    })
  }

  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const tax = settings.taxRate > 0 && !settings.taxIncluded
    ? Math.round(subtotal * settings.taxRate / 100)
    : 0
  // Shipping solo aplica para delivery (o retail sin isRestaurant)
  const hasDeliveryOption = !settings.availableDeliveryTypes || settings.availableDeliveryTypes.includes('delivery_own') || settings.availableDeliveryTypes.includes('delivery_third_party')
  const needsShipping = isRestaurant ? orderType === 'delivery' : hasDeliveryOption
  const flatShipping = settings.enableShipping && needsShipping
    ? (settings.freeShippingThreshold > 0 && subtotal >= settings.freeShippingThreshold ? 0 : settings.shippingFlatRate)
    : 0
  // Usar shipping dinámico si hay tarifas, sino fallback a flat rate
  const shipping = dynamicShippingCost !== null && needsShipping ? dynamicShippingCost : flatShipping
  const total = subtotal + tax + shipping + tipAmount - couponDiscount - promoDiscount

  // Dynamic shipping rates based on city
  useEffect(() => {
    if (!organizationId || !needsShipping) return
    const city = customerData.city.trim()
    if (city.length < 3) {
      setDynamicShippingRates([])
      setDynamicShippingCost(null)
      setSelectedShippingRate(null)
      return
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch('/api/shipping/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId, city })
        })
        const data = await res.json()
        if (data.rates && data.rates.length > 0) {
          setDynamicShippingRates(data.rates)
          // Auto-seleccionar la más económica
          const cheapest = data.cheapest
          if (cheapest) {
            setSelectedShippingRate(cheapest.id)
            setDynamicShippingCost(cheapest.cost)
          }
        } else {
          setDynamicShippingRates([])
          setDynamicShippingCost(null)
          setSelectedShippingRate(null)
        }
      } catch {
        setDynamicShippingRates([])
        setDynamicShippingCost(null)
      }
    }, 500) // Debounce 500ms
    return () => clearTimeout(timeout)
  }, [customerData.city, organizationId, needsShipping])

  // Auto-check promotions when cart changes
  useEffect(() => {
    if (cartItems.length === 0 || !organizationId) return
    const checkPromos = async () => {
      try {
        const res = await fetch('/api/promotions/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId,
            items: cartItems.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity, categoryId: (i as any).categoryId })),
            subtotal
          })
        })
        const data = await res.json()
        setAppliedPromotions(data.promotions || [])
        setPromoDiscount(data.totalDiscount || 0)
      } catch {
        setAppliedPromotions([])
        setPromoDiscount(0)
      }
    }
    checkPromos()
  }, [cartItems, organizationId, subtotal])

  // Coupon validation
  const validateCoupon = async () => {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    setCouponError(null)
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim(), organizationId, subtotal })
      })
      const data = await res.json()
      if (data.valid) {
        setAppliedCoupon(data.coupon)
        setCouponDiscount(data.discount)
        setCouponError(null)
      } else {
        setCouponError(data.error || 'Cupón inválido')
        setAppliedCoupon(null)
        setCouponDiscount(0)
      }
    } catch {
      setCouponError('Error al validar cupón')
    } finally {
      setCouponLoading(false)
    }
  }

  const removeCoupon = () => {
    setAppliedCoupon(null)
    setCouponDiscount(0)
    setCouponCode('')
    setCouponError(null)
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setSubmitting(true)
    setPaymentError(null)

    try {
      // 1. Crear la orden
      const orderPayload: any = {
        organizationId,
        customer: customerData,
        items: cartItems.map(item => ({
          id: item.productId || item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          sku: (item as any).sku || null,
          ...(item.modifiers && item.modifiers.length > 0 && { modifiers: item.modifiers }),
          ...(item.notes && { notes: item.notes })
        })),
        subtotal,
        shipping,
        total,
        paymentMethod
      }

      // Campos de restaurante
      if (isRestaurant) {
        orderPayload.deliveryType = orderType
        if (tipAmount > 0) orderPayload.tipAmount = tipAmount
        if (isScheduled && scheduledAt) {
          orderPayload.isScheduled = true
          orderPayload.scheduledAt = scheduledAt
        }
        if (orderType === 'delivery') {
          orderPayload.deliveryAddress = {
            address: customerData.address,
            city: customerData.city
          }
        }
        if (dineInTable) {
          orderPayload.tableName = dineInTable
        }
      }

      // Cupón aplicado
      if (appliedCoupon && couponDiscount > 0) {
        orderPayload.couponCode = appliedCoupon.code
        orderPayload.couponId = appliedCoupon.id
        orderPayload.couponDiscount = couponDiscount
      }

      // Promociones automáticas
      if (promoDiscount > 0) {
        orderPayload.promoDiscount = promoDiscount
        orderPayload.promotionIds = appliedPromotions.map(p => p.id)
      }

      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      })

      const orderData = await orderRes.json()

      if (!orderRes.ok || !orderData.orderNumber) {
        if (orderRes.status === 409 && orderData.details) {
          setPaymentError(`Stock insuficiente:\n${orderData.details.join('\n')}`)
        } else {
          setPaymentError(orderData.error || 'Error al crear la orden')
        }
        setSubmitting(false)
        return
      }

      const createdOrderNumber = orderData.orderNumber

      // 2. Si es pago online (pasarela), iniciar checkout con la pasarela
      const selectedMethod = availableMethods.find(m => m.code === paymentMethod)
      const isOnlineGateway = selectedMethod?.type === 'gateway'

      if (isOnlineGateway) {
        const initRes = await fetch('/api/checkout/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderNumber: createdOrderNumber,
            gateway: paymentMethod,
            returnUrl: `${window.location.origin}/checkout/resultado`
          })
        })

        const initData = await initRes.json()

        if (initRes.ok && initData.checkoutUrl) {
          // Limpiar carrito antes de redirigir
          const host = window.location.hostname
          const subdomain = host.split('.')[0]
          localStorage.removeItem(`cart_${subdomain}`)
          window.dispatchEvent(new CustomEvent('cart-updated'))

          // Redirigir a la pasarela de pago
          window.location.href = initData.checkoutUrl
          return
        } else {
          setPaymentError(initData.error || 'Error al iniciar el pago. Intenta de nuevo.')
          setSubmitting(false)
          return
        }
      }

      // 3. Si es pago offline (cash/transfer), mostrar confirmación
      setOrderNumber(createdOrderNumber)
      setOrderComplete(true)

      const host = window.location.hostname
      const subdomain = host.split('.')[0]
      localStorage.removeItem(`cart_${subdomain}`)
      window.dispatchEvent(new CustomEvent('cart-updated'))
      setCartItems([])
    } catch (error) {
      console.error('Error creating order:', error)
      setPaymentError('Error de conexión. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  // --- ESTADOS ESPECIALES ---

  if (orderComplete) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: `${primaryColor}20` }}
        >
          <Check className="h-10 w-10" style={{ color: primaryColor }} />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">¡Pedido Realizado!</h1>
        <p className="text-gray-600 mb-2">
          Tu pedido <strong>{orderNumber}</strong> ha sido recibido exitosamente.
        </p>
        <p className="text-gray-500 mb-8 text-sm">
          Te enviaremos un correo de confirmación a <strong>{customerData.email}</strong> con los detalles de tu compra.
        </p>

        <div className="flex gap-4 justify-center">
          <Link href="/">
            <Button variant="outline">Volver al inicio</Button>
          </Link>
          <Link href="/productos">
            <Button style={{ backgroundColor: primaryColor }}>
              Seguir comprando
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (cartItems.length === 0) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <ShoppingBag className="h-20 w-20 mx-auto text-gray-300 mb-6" />
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Tu carrito está vacío</h1>
        <p className="text-gray-600 mb-8">Agrega productos para comenzar tu compra</p>
        <Link href="/productos">
          <Button style={{ backgroundColor: primaryColor }}>
            Ver productos
          </Button>
        </Link>
      </div>
    )
  }

  // --- WIZARD PRINCIPAL ---

  // Construir opciones de pago desde los métodos habilitados para website
  const paymentOptions = availableMethods.map(m => ({
    id: m.code,
    icon: <span className="text-xl">{m.icon || METHOD_ICONS[m.code] || '💰'}</span>,
    label: m.name,
    description: m.description || null,
  }))

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <Link
          href="/productos"
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Seguir comprando
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                step >= s ? 'text-white' : 'bg-gray-200 text-gray-500'
              }`}
              style={step >= s ? { backgroundColor: primaryColor } : {}}
            >
              {step > s ? <Check className="h-5 w-5" /> : s}
            </div>
            {s < 3 && (
              <div
                className={`w-20 h-1 mx-2 ${step > s ? '' : 'bg-gray-200'}`}
                style={step > s ? { backgroundColor: primaryColor } : {}}
              />
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* STEP 1: Carrito */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Tu Carrito</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {cartItems.map((item) => (
                    <div key={item.id} className="py-4 border-b last:border-0">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0"
                          style={{ backgroundColor: `${primaryColor}10` }}
                        >
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-2xl">📦</span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-gray-900 text-sm sm:text-base line-clamp-2">{item.name}</h3>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(item.id)}
                              className="text-red-400 hover:text-red-600 flex-shrink-0 h-7 w-7 p-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          {item.variantAttributes && Object.keys(item.variantAttributes).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {Object.entries(item.variantAttributes).map(([k, v]) => (
                                <span key={k} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                  <span className="capitalize font-medium">{k}:</span> {v}
                                </span>
                              ))}
                            </div>
                          )}
                          {item.modifiers && item.modifiers.length > 0 && (
                            <p className="text-xs text-gray-400 truncate mt-0.5">
                              {item.modifiers.map(m => m.valueName).join(', ')}
                            </p>
                          )}
                          {item.notes && (
                            <p className="text-xs text-gray-400 italic truncate mt-0.5">📝 {item.notes}</p>
                          )}

                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-1.5">
                              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => updateQuantity(item.id, -1)}>
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-7 text-center font-semibold text-sm">{item.quantity}</span>
                              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => updateQuantity(item.id, 1)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                              <span className="text-xs text-gray-400 ml-1">
                                {item.comparePrice && item.comparePrice > item.price && (
                                  <span className="line-through mr-1">${item.comparePrice.toLocaleString()}</span>
                                )}
                                ${item.price.toLocaleString()} c/u
                              </span>
                            </div>
                            <p className="font-bold text-sm sm:text-base" style={{ color: primaryColor }}>
                              ${(item.price * item.quantity).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Banner dine-in QR */}
                {dineInTable && (
                  <div className="mt-4 flex items-center gap-2 rounded-lg p-3 text-sm font-medium"
                    style={{ backgroundColor: `${primaryColor}10`, color: primaryColor }}
                  >
                    🍽️ Pidiendo desde <strong>{dineInTable}</strong>
                  </div>
                )}

                {/* Restaurant: Tipo de pedido + Programar */}
                {isRestaurant && (
                  <div className="mt-6 space-y-5 border-t pt-5">
                    <OrderTypeSelector
                      value={orderType}
                      onChange={setOrderType}
                      primaryColor={primaryColor}
                      enableDelivery={!settings.availableDeliveryTypes || settings.availableDeliveryTypes.includes('delivery_own') || settings.availableDeliveryTypes.includes('delivery_third_party')}
                      enablePickup={!settings.availableDeliveryTypes || settings.availableDeliveryTypes.includes('pickup')}
                    />
                    <ScheduleSelector
                      isScheduled={isScheduled}
                      scheduledAt={scheduledAt}
                      onScheduledChange={setIsScheduled}
                      onTimeChange={setScheduledAt}
                      primaryColor={primaryColor}
                    />
                  </div>
                )}

                <Button
                  className="w-full mt-6"
                  style={{ backgroundColor: primaryColor }}
                  onClick={() => setStep(2)}
                >
                  Continuar
                </Button>
              </CardContent>
            </Card>
          )}

          {/* STEP 2: Datos del cliente */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {isRestaurant
                    ? (orderType === 'delivery' ? 'Datos de Entrega' : 'Tus Datos')
                    : 'Datos de Envío'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                      <Input
                        required
                        value={customerData.firstName}
                        onChange={(e) => setCustomerData({ ...customerData, firstName: e.target.value })}
                        placeholder="Juan"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                      <Input
                        required
                        value={customerData.lastName}
                        onChange={(e) => setCustomerData({ ...customerData, lastName: e.target.value })}
                        placeholder="Pérez"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <Input
                      type="email"
                      required
                      value={customerData.email}
                      onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                      placeholder="tu@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                    <Input
                      type="tel"
                      required
                      value={customerData.phone}
                      onChange={(e) => setCustomerData({ ...customerData, phone: e.target.value })}
                      placeholder="+57 300 123 4567"
                    />
                  </div>

                  {/* Dirección: siempre para retail, solo para delivery en restaurante */}
                  {(!isRestaurant || orderType === 'delivery') && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                        <Input
                          required
                          value={customerData.address}
                          onChange={(e) => setCustomerData({ ...customerData, address: e.target.value })}
                          placeholder="Calle 123 #45-67"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                        <Input
                          required
                          value={customerData.city}
                          onChange={(e) => setCustomerData({ ...customerData, city: e.target.value })}
                          placeholder="Medellín"
                        />
                      </div>

                      {/* Dynamic shipping rate selector */}
                      {dynamicShippingRates.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Método de envío</label>
                          <div className="space-y-2">
                            {dynamicShippingRates.map((rate) => (
                              <label
                                key={rate.id}
                                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                                  selectedShippingRate === rate.id
                                    ? 'border-2 bg-opacity-5'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                                style={selectedShippingRate === rate.id ? { borderColor: primaryColor, backgroundColor: `${primaryColor}08` } : {}}
                              >
                                <div className="flex items-center gap-3">
                                  <input
                                    type="radio"
                                    name="shippingRate"
                                    checked={selectedShippingRate === rate.id}
                                    onChange={() => { setSelectedShippingRate(rate.id); setDynamicShippingCost(rate.cost) }}
                                    className="w-4 h-4"
                                    style={{ accentColor: primaryColor }}
                                  />
                                  <div>
                                    <p className="text-sm font-medium">{rate.name}</p>
                                    <p className="text-xs text-gray-500">
                                      {rate.carrier_name && `${rate.carrier_name} · `}
                                      {rate.service_level === 'express' ? '⚡ Express' : rate.service_level === 'same_day' ? '🏃 Mismo día' : rate.service_level === 'economy' ? '📦 Económico' : '🚚 Estándar'}
                                    </p>
                                  </div>
                                </div>
                                <span className="font-semibold text-sm">${rate.cost.toLocaleString()}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                    <Input
                      value={customerData.notes}
                      onChange={(e) => setCustomerData({ ...customerData, notes: e.target.value })}
                      placeholder={isRestaurant ? 'Instrucciones especiales...' : 'Instrucciones especiales de entrega...'}
                    />
                  </div>

                  {/* Restaurant: Propina */}
                  {isRestaurant && (
                    <div className="border-t pt-4">
                      <TipSelector
                        subtotal={subtotal}
                        value={tipAmount}
                        onChange={setTipAmount}
                        primaryColor={primaryColor}
                      />
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>
                      Atrás
                    </Button>
                    <Button
                      type="button"
                      className="flex-1"
                      style={{ backgroundColor: primaryColor }}
                      onClick={() => setStep(3)}
                      disabled={
                        !customerData.firstName || !customerData.email || !customerData.phone ||
                        (!isRestaurant || orderType === 'delivery' ? !customerData.address : false)
                      }
                    >
                      Continuar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* STEP 3: Método de pago */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Método de Pago</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {paymentOptions.map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setPaymentMethod(method.id)}
                      className={`w-full p-4 rounded-lg border-2 flex items-center gap-4 transition-colors text-left ${
                        paymentMethod === method.id
                          ? 'border-current'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      style={paymentMethod === method.id ? { borderColor: primaryColor, color: primaryColor } : {}}
                    >
                      {method.icon}
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-900 block">{method.label}</span>
                        {method.description && (
                          <span className="text-xs text-gray-500 block mt-0.5">{method.description}</span>
                        )}
                      </div>
                      {paymentMethod === method.id && (
                        <Check className="h-5 w-5 flex-shrink-0" style={{ color: primaryColor }} />
                      )}
                    </button>
                  ))}
                </div>

                {paymentError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {paymentError}
                  </div>
                )}

                <div className="flex gap-3 pt-6">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(2)}>
                    Atrás
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    style={{ backgroundColor: primaryColor }}
                    onClick={() => handleSubmit()}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      `Pagar $${total.toLocaleString()}`
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Order Summary Sidebar */}
        <div>
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Tipo de pedido (restaurante) */}
                {isRestaurant && (
                  <div className="flex items-center gap-2 text-xs font-medium rounded-lg p-2 mb-2"
                    style={{ backgroundColor: `${primaryColor}10`, color: primaryColor }}
                  >
                    {orderType === 'delivery' ? '🛵 Domicilio' : orderType === 'pickup' ? '🏪 Recoger' : '🍽️ Comer aquí'}
                    {isScheduled && scheduledAt && (
                      <span className="text-gray-500 ml-auto">
                        {new Date(scheduledAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                    )}
                  </div>
                )}

                {cartItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <div className="text-gray-600 flex-1 min-w-0">
                      <span className="truncate block">{item.name} x{item.quantity}</span>
                      {item.variantAttributes && Object.keys(item.variantAttributes).length > 0 && (
                        <span className="text-xs text-gray-400 block truncate">
                          {Object.entries(item.variantAttributes).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                        </span>
                      )}
                      {item.modifiers && item.modifiers.length > 0 && (
                        <span className="text-xs text-gray-400 block truncate">
                          {item.modifiers.map(m => m.valueName).join(', ')}
                        </span>
                      )}
                    </div>
                    <span className="font-medium ml-2 flex-shrink-0">${(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}

                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span>${subtotal.toLocaleString()}</span>
                  </div>
                  {tax > 0 && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-600">{settings.taxName} ({settings.taxRate}%)</span>
                      <span>${tax.toLocaleString()}</span>
                    </div>
                  )}
                  {settings.taxIncluded && settings.taxRate > 0 && (
                    <p className="text-xs text-gray-400 mt-1">{settings.taxName} incluido en el precio</p>
                  )}
                  {needsShipping && settings.enableShipping && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-600">{isRestaurant ? 'Domicilio' : 'Envío'}</span>
                      <span>{shipping === 0 ? 'Gratis' : `$${shipping.toLocaleString()}`}</span>
                    </div>
                  )}
                  {tipAmount > 0 && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-600">Propina</span>
                      <span>${tipAmount.toLocaleString()}</span>
                    </div>
                  )}
                  {couponDiscount > 0 && appliedCoupon && (
                    <div className="flex justify-between text-sm mt-1 text-green-600">
                      <span className="flex items-center gap-1">
                        🎟️ {appliedCoupon.code}
                        <button onClick={removeCoupon} className="text-red-400 hover:text-red-600 text-xs ml-1">✕</button>
                      </span>
                      <span>-${couponDiscount.toLocaleString()}</span>
                    </div>
                  )}
                  {appliedPromotions.map((promo) => (
                    <div key={promo.id} className="flex justify-between text-sm mt-1 text-green-600">
                      <span className="truncate flex-1 mr-2">🏷️ {promo.name}</span>
                      <span className="flex-shrink-0">-${promo.discount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                {/* Coupon input */}
                {!appliedCoupon && (
                  <div className="border-t pt-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Código de cupón"
                        value={couponCode}
                        onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(null) }}
                        onKeyDown={(e) => e.key === 'Enter' && validateCoupon()}
                        className="text-sm h-9 font-mono"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={validateCoupon}
                        disabled={couponLoading || !couponCode.trim()}
                        className="h-9 px-3 flex-shrink-0"
                      >
                        {couponLoading ? '...' : 'Aplicar'}
                      </Button>
                    </div>
                    {couponError && (
                      <p className="text-xs text-red-500 mt-1">{couponError}</p>
                    )}
                  </div>
                )}

                <div className="border-t pt-3">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span style={{ color: primaryColor }}>${total.toLocaleString()}</span>
                  </div>
                </div>

                {needsShipping && settings.enableShipping && shipping === 0 && settings.freeShippingThreshold > 0 && (
                  <p className="text-xs text-green-600 text-center mt-2">
                    ¡Envío gratis por compras mayores a ${settings.freeShippingThreshold.toLocaleString()}!
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
