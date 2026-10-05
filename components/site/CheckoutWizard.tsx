'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Trash2, Plus, Minus, CreditCard, Truck, Check, ShoppingBag, Banknote, Building2, Loader2, MapPin, ChevronDown, AlertTriangle, Wallet, Tag } from 'lucide-react'
import Link from 'next/link'
import { OrderTypeSelector, type OrderType } from '@/components/site/OrderTypeSelector'
import { TipSelector } from '@/components/site/TipSelector'
import { ScheduleSelector } from '@/components/site/ScheduleSelector'
import { CountdownBanner } from '@/components/site/CountdownBanner'
import PhoneCountryInput from './PhoneCountryInput'
import LocationCheckoutFields from './LocationCheckoutFields'
import { useCurrency } from './CurrencyProvider'
import { getCartKey } from '@/lib/utils'
import { useCartPromotions, promotionsForItem, promotionBadgeLabel } from '@/lib/hooks/useCartPromotions'
import { trackMetaPurchase } from '@/components/site/MetaPixelEvents'
import { mensajeErrorPedido } from '@/lib/checkout/respuesta-pedido'

interface CartModifier {
  typeId: number
  typeName: string
  valueId: number
  valueName: string
}

interface NewCartModifier {
  groupId: number
  groupName: string
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

interface WebsitePaymentMethod {
  code: string
  name: string
  description?: string | null
  icon?: string | null
  requiresReference: boolean
  connectionId?: string | null
  type: 'native' | 'gateway'
}

interface TrustBadge {
  icon: string
  text: string
}

interface CountdownConfig {
  countdown_enabled?: boolean
  countdown_mode?: 'custom' | 'daily_reset'
  countdown_end_date?: string
  countdown_timezone?: string
  countdown_reset_hour?: number
  countdown_title?: string
  countdown_show_in_cart?: boolean
}

interface CheckoutSettings {
  checkoutMode?: 'steps' | 'one_page'
  taxRate: number
  taxName: string
  taxIncluded: boolean
  shippingFlatRate: number
  freeShippingThreshold: number
  enableShipping: boolean
  availableDeliveryTypes?: string[]
  shippingTitle?: string
  shippingDescription?: string
  showTrustBadges?: boolean
  trustBadges?: TrustBadge[]
  showStockWarning?: boolean
  showPaymentLogos?: boolean
  showCountdown?: boolean
  countdownConfig?: CountdownConfig
}

interface CheckoutWizardProps {
  organizationId: number
  primaryColor: string
  paymentMethods: WebsitePaymentMethod[]
  checkoutSettings?: CheckoutSettings
  isRestaurant?: boolean
  organizationSubdomain?: string
  branchId?: number | null
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
  bold_link: '🟠',
}

// Códigos que corresponden a Wompi (pasarela colombiana)
const WOMPI_CODES = new Set(['wompi', 'wompi_co'])

// Ícono de Wompi: billetera verde sobre fondo verde claro, cuadrado redondeado
function WompiIcon() {
  return (
    <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0 border border-green-200 dark:border-green-800">
      <Wallet className="w-5 h-5 text-green-600 dark:text-green-400" />
    </div>
  )
}

const DEFAULT_SETTINGS: CheckoutSettings = {
  checkoutMode: 'steps',
  taxRate: 0,
  taxName: 'IVA',
  taxIncluded: false,
  shippingFlatRate: 10000,
  freeShippingThreshold: 100000,
  enableShipping: true,
  availableDeliveryTypes: ['pickup', 'delivery_own', 'delivery_third_party'],
  shippingTitle: 'Envío',
  shippingDescription: '',
}

export function CheckoutWizard({ organizationId, primaryColor, paymentMethods: availableMethods, checkoutSettings, isRestaurant = false, organizationSubdomain, branchId }: CheckoutWizardProps) {
  const settings = { ...DEFAULT_SETTINGS, ...checkoutSettings }
  const isOnePage = settings.checkoutMode === 'one_page'
  const { formatPrice: fmtPrice, currency: displayCurrency, baseCurrency, loading } = useCurrency()
  const showCurrencyNotice = !loading && displayCurrency !== baseCurrency && baseCurrency === 'COP'
  const [currencyNoticeDismissed, setCurrencyNoticeDismissed] = useState(false)
  const [step, setStep] = useState(1)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ cart: true, customer: true, payment: true })
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [orderComplete, setOrderComplete] = useState(false)
  const [orderNumber, setOrderNumber] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  // Urgencia: generar número pseudo-aleatorio estable por producto
  const getUrgencyNumber = (id: number | string) => {
    const seed = typeof id === 'string' ? id.charCodeAt(0) * 7 + id.length : Number(id) * 13
    return (seed % 20) + 1
  }
  const urgencyMessages = [
    (n: number) => `¡Solo quedan ${n}!`,
    (n: number) => `¡Últimas ${n} unidades disponibles!`,
    (n: number) => `⚡ Quedan ${n} — ¡no te quedes sin el tuyo!`,
    (n: number) => `🔥 ¡Solo ${n}! Otros lo están comprando ahora`,
    (n: number) => `⏰ ¡Apúrate! Solo quedan ${n} en stock`,
    (n: number) => `🚀 ${n} disponibles — se agotan rápido`,
    (n: number) => `❗ Casi agotado: quedan ${n}`,
    (n: number) => `💨 ¡Últimas ${n}! Alta demanda`,
    (n: number) => `🛒 ${n} personas lo tienen en su carrito`,
    (n: number) => `📦 Stock limitado: ${n} restantes`,
  ]

  // Delivery type state (aplica a restaurant y retail)
  const hasPickup = !settings.availableDeliveryTypes || settings.availableDeliveryTypes.includes('pickup')
  const hasDelivery = !settings.availableDeliveryTypes || settings.availableDeliveryTypes.includes('delivery_own') || settings.availableDeliveryTypes.includes('delivery_third_party')
  const defaultOrderType: OrderType = hasDelivery ? 'delivery' : 'pickup'
  const [orderType, setOrderType] = useState<OrderType>(defaultOrderType)
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

  // Promociones automáticas: mismo hook que el drawer y /carrito, y mismo
  // motor que /api/orders, así el total que ve el cliente es el que se cobra.
  // La sucursal sigue la misma regla que el envío del pedido (outlet explícito
  // o la que traiga el carrito).
  const promoBranchId = typeof branchId === 'number'
    ? branchId
    : (typeof (cartItems[0] as any)?.branchId === 'number' ? (cartItems[0] as any).branchId as number : null)
  const {
    promotions: appliedPromotions,
    totalDiscount: promoDiscount,
    itemDiscounts: promoItemDiscounts,
  } = useCartPromotions({ organizationId, branchId: promoBranchId, items: cartItems })

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
    notes: '',
    countryCode: '',
    stateCode: '',
    stateName: '',
    department: ''
  })

  // Persistir customerData en localStorage
  const customerStorageKey = `checkout_customer_${organizationSubdomain}`
  useEffect(() => {
    try {
      const saved = localStorage.getItem(customerStorageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        setCustomerData(prev => ({ ...prev, ...parsed }))
      }
    } catch {}
  }, [customerStorageKey])

  useEffect(() => {
    if (customerData.firstName || customerData.email || customerData.phone) {
      try {
        const { notes, ...toSave } = customerData
        localStorage.setItem(customerStorageKey, JSON.stringify(toSave))
      } catch {}
    }
  }, [customerData, customerStorageKey])

  // Datos de usuario autenticado
  const [savedAddresses, setSavedAddresses] = useState<Array<{ id: number; label: string; address_line1: string; city: string; department?: string; country_code?: string; is_default?: boolean }>>([])
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [customerId, setCustomerId] = useState<number | null>(null)

  // 'gateway_code' o 'cash' o 'transfer'
  const [paymentMethod, setPaymentMethod] = useState<string>(
    availableMethods.length > 0 ? availableMethods[0].code : 'cash'
  )

  useEffect(() => {
    try {
      const subdomain = organizationSubdomain || ''
      // F5: carrito separado por outlet cuando hay branchId.
      const cartKey = getCartKey(subdomain, branchId)
      const savedCart = localStorage.getItem(cartKey)
      if (savedCart) {
        setCartItems(JSON.parse(savedCart))
      }

      // Fallback: leer carrito y datos del cliente desde query params (enviados por chat widget)
      const urlParams = new URLSearchParams(window.location.search)
      const cartParam = urlParams.get('cart')
      const customerParam = urlParams.get('customer')
      if (cartParam) {
        try {
          const cartFromUrl = JSON.parse(cartParam)
          if (Array.isArray(cartFromUrl) && cartFromUrl.length > 0) {
            setCartItems(cartFromUrl)
            localStorage.setItem(cartKey, JSON.stringify(cartFromUrl))
          }
        } catch {}
      }
      if (customerParam) {
        try {
          const customerFromUrl = JSON.parse(customerParam)
          if (customerFromUrl && typeof customerFromUrl === 'object') {
            setCustomerData(prev => ({ ...prev, ...customerFromUrl }))
            localStorage.setItem(`checkout_customer_${subdomain}`, JSON.stringify(customerFromUrl))
          }
        } catch {}
      }
      // Limpiar query params de la URL sin recargar
      if (cartParam || customerParam) {
        const cleanUrl = window.location.pathname
        window.history.replaceState({}, '', cleanUrl)
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


  // Precargar datos del usuario autenticado via API server-side
  useEffect(() => {
    const loadAuthData = async () => {
      try {
        const res = await fetch(`/api/customer/me?organizationId=${organizationId}`)
        if (!res.ok) return
        const data = await res.json()
        if (!data.authenticated) return

        setIsAuthenticated(true)
        if (data.customerId) setCustomerId(data.customerId)

        setCustomerData((prev: any) => ({
          ...prev,
          firstName: data.firstName || prev.firstName,
          lastName: data.lastName || prev.lastName,
          email: data.email || prev.email,
          phone: data.phone || prev.phone,
          address: data.address || prev.address,
          city: data.city || prev.city,
        }))

        if (data.addresses && data.addresses.length > 0) {
          setSavedAddresses(data.addresses)
          const defaultAddr = data.addresses.find((a: any) => a.is_default) || data.addresses[0]
          if (defaultAddr) {
            setCustomerData((prev: any) => ({
              ...prev,
              address: defaultAddr.address_line1 || prev.address,
              city: defaultAddr.city || prev.city,
              countryCode: defaultAddr.country_code || prev.countryCode,
              stateName: defaultAddr.department || prev.stateName,
              department: defaultAddr.department || prev.department,
            }))
          }
        }
      } catch (err) {
        console.error('Error loading auth data:', err)
      }
    }
    loadAuthData()
  }, [organizationId])

  const updateQuantity = (id: number | string, delta: number) => {
    setCartItems(items => {
      const updated = items.map(item => {
        if (item.id === id) {
          return { ...item, quantity: Math.max(0, item.quantity + delta) }
        }
        return item
      }).filter(item => item.quantity > 0)

      const subdomain = organizationSubdomain || ''
      // F5: carrito separado por outlet cuando hay branchId.
      const cartKey = getCartKey(subdomain, branchId)
      localStorage.setItem(cartKey, JSON.stringify(updated))
      window.dispatchEvent(new CustomEvent('cart-updated'))
      return updated
    })
  }

  const removeItem = (id: number | string) => {
    setCartItems(items => {
      const updated = items.filter(item => item.id !== id)
      const subdomain = organizationSubdomain || ''
      // F5: carrito separado por outlet cuando hay branchId.
      const cartKey = getCartKey(subdomain, branchId)
      localStorage.setItem(cartKey, JSON.stringify(updated))
      window.dispatchEvent(new CustomEvent('cart-updated'))
      return updated
    })
  }

  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const tax = settings.taxRate > 0 && !settings.taxIncluded
    ? Math.round(subtotal * settings.taxRate / 100)
    : 0
  // Shipping solo aplica cuando el tipo seleccionado es delivery
  const needsShipping = orderType === 'delivery' && hasDelivery
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
          body: JSON.stringify({ organizationId, city, subtotal })
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
  }, [customerData.city, organizationId, needsShipping, subtotal])

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
      // F5: branchId explícito del outlet activo. Si es undefined (sitio global
      // sin outlet), se omite y el backend usa el fallback.
      const finalBranchId = branchId ?? (cartItems.length > 0 ? (cartItems[0] as any).branchId : undefined)
      const orderPayload: any = {
        organizationId,
        ...(typeof finalBranchId === 'number' ? { branchId: finalBranchId } : {}),
        customer: customerData,
        ...(customerId ? { customerId } : {}),
        items: cartItems.map(item => ({
          id: item.productId || item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          sku: (item as any).sku || null,
          ...(item.modifiers && item.modifiers.length > 0 ? { modifiers: item.modifiers } : {}),
          ...(item.newModifiers && item.newModifiers.length > 0 ? { newModifiers: item.newModifiers } : {}),
          ...(item.notes ? { notes: item.notes } : {})
        })),
        subtotal,
        shipping,
        total,
        paymentMethod
      }

      // Tipo de entrega (aplica a todos los tipos de org)
      orderPayload.deliveryType = orderType
      if (orderType === 'delivery') {
        orderPayload.deliveryAddress = {
          address: customerData.address,
          city: customerData.city,
          country: customerData.countryCode,
          state: customerData.stateName,
          state_code: customerData.stateCode,
          department: customerData.department
        }
      }

      // Campos exclusivos de restaurante
      if (isRestaurant) {
        if (tipAmount > 0) orderPayload.tipAmount = tipAmount
        if (isScheduled && scheduledAt) {
          orderPayload.isScheduled = true
          orderPayload.scheduledAt = scheduledAt
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
        setPaymentError(mensajeErrorPedido(orderRes.status, orderData))
        setSubmitting(false)
        return
      }

      const createdOrderNumber = orderData.orderNumber

      // Auto-guardar dirección como principal si el usuario está autenticado y no tiene direcciones
      if (isAuthenticated && savedAddresses.length === 0 && customerData.address) {
        fetch('/api/customer/address', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId,
            address_line: customerData.address,
            city: customerData.city,
            country_code: customerData.countryCode,
            department: customerData.department,
            label: 'Principal',
            is_default: true
          })
        }).catch(() => {})
      }

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
          localStorage.removeItem(getCartKey(organizationSubdomain || '', branchId))
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

      // Meta Pixel Purchase: estos pedidos terminan aquí y nunca llegan a
      // /checkout/resultado (donde se dispara para las pasarelas). Sin esto,
      // una tienda contraentrega no registraba ninguna compra en Meta.
      trackMetaPurchase({
        orderNumber: createdOrderNumber,
        value: total,
        contents: cartItems.map(item => ({
          id: (item as any).sku || String(item.productId || String(item.id).split(/[_:-]/)[0]),
          quantity: item.quantity,
        })),
        numItems: cartItems.reduce((s, i) => s + i.quantity, 0),
      })

      localStorage.removeItem(getCartKey(organizationSubdomain || '', branchId))
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
  const paymentOptions = availableMethods.map(m => {
    const isWompi = WOMPI_CODES.has(m.code)
    return {
      id: m.code,
      icon: isWompi ? <WompiIcon /> : <span className="text-xl">{m.icon || METHOD_ICONS[m.code] || '💰'}</span>,
      label: m.name,
      description: m.description || null,
      isWompi,
    }
  })

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Validación para one-page: permitir submit solo si tiene datos requeridos
  const canSubmitOnePage = customerData.firstName && customerData.email && customerData.phone &&
    !!customerData.countryCode &&
    (isRestaurant && orderType !== 'delivery' ? true : !!customerData.address)

  return (
    <div className="container mx-auto px-4 py-12">
      <p className="text-xs text-gray-300 uppercase tracking-widest mb-6">Checkout</p>

      {/* Aviso de moneda: los precios son referenciales, el pago se cobra en COP */}
      {showCurrencyNotice && !currencyNoticeDismissed && (
        <div className="mb-6 rounded-lg border border-yellow-400 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-yellow-600" />
            <span>
              Los precios mostrados en <strong>{displayCurrency}</strong> son solo referenciales.
              El pago se efectuará en pesos colombianos (<strong>COP</strong>) al momento de procesar la transacción.
            </span>
          </span>
          <button
            onClick={() => setCurrencyNoticeDismissed(true)}
            className="flex-shrink-0 text-yellow-600 hover:text-yellow-800 transition-colors"
            aria-label="Cerrar aviso"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      )}

      {/* Countdown Banner en checkout */}
      {settings.showCountdown && settings.countdownConfig && (
        <div className="mb-6">
          <CountdownBanner
            config={{ ...settings.countdownConfig, countdown_enabled: true }}
            primaryColor={primaryColor}
            variant="inline"
          />
        </div>
      )}

      {/* Progress Steps - solo en modo steps */}
      {!isOnePage && (
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
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* STEP 1: Carrito */}
          {(isOnePage || step === 1) && (
            <Card className={isOnePage ? 'mb-6' : ''}>
              <CardHeader className={isOnePage ? 'cursor-pointer select-none' : ''} onClick={isOnePage ? () => toggleSection('cart') : undefined}>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {isOnePage && <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center text-white" style={{ backgroundColor: primaryColor }}>1</span>}
                    Tu Carrito
                  </span>
                  {isOnePage && <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${openSections.cart ? 'rotate-180' : ''}`} />}
                </CardTitle>
              </CardHeader>
              {(!isOnePage || openSections.cart) && (
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
                          {item.newModifiers && item.newModifiers.length > 0 && (
                            <p className="text-xs text-gray-400 truncate mt-0.5">
                              {item.newModifiers.map(m => `${m.name}${m.extraPrice > 0 ? ` (+${fmtPrice(m.extraPrice)})` : ''}`).join(', ')}
                            </p>
                          )}
                          {item.notes && (
                            <p className="text-xs text-gray-400 italic truncate mt-0.5">📝 {item.notes}</p>
                          )}
                          {settings.showStockWarning && (item.productId || item.id) && (
                            <p className="text-xs text-orange-600 font-medium mt-1 animate-pulse">
                              {urgencyMessages[(typeof item.id === 'string' ? item.id.length : Number(item.id)) % urgencyMessages.length](getUrgencyNumber(item.productId || item.id))}
                            </p>
                          )}
                          {promotionsForItem(appliedPromotions, item.id).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {promotionsForItem(appliedPromotions, item.id).map(promo => (
                                <span
                                  key={promo.id}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700"
                                  title={promo.name}
                                >
                                  <Tag className="h-3 w-3" />
                                  {promotionBadgeLabel(promo, fmtPrice)}
                                </span>
                              ))}
                            </div>
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
                                  <span className="line-through mr-1">{fmtPrice(item.comparePrice)}</span>
                                )}
                                {fmtPrice(item.price)} c/u
                              </span>
                            </div>
                            {(promoItemDiscounts[String(item.id)] || 0) > 0 ? (
                              <div className="text-right">
                                <span className="block text-xs text-gray-400 line-through">{fmtPrice(item.price * item.quantity)}</span>
                                <span className="font-bold text-sm sm:text-base text-green-600">
                                  {fmtPrice(item.price * item.quantity - (promoItemDiscounts[String(item.id)] || 0))}
                                </span>
                              </div>
                            ) : (
                              <p className="font-bold text-sm sm:text-base" style={{ color: primaryColor }}>
                                {fmtPrice(item.price * item.quantity)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Promociones aplicadas al carrito */}
                {appliedPromotions.length > 0 && (
                  <div className="mt-4 rounded-lg bg-green-50 border border-green-100 p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wide flex items-center gap-1">
                      <Tag className="h-3.5 w-3.5" /> Promociones aplicadas
                    </p>
                    {appliedPromotions.map(promo => (
                      <div key={promo.id} className="flex items-start justify-between gap-3 text-sm text-green-700">
                        <div className="min-w-0">
                          <span className="font-medium block truncate">{promo.name}</span>
                          {promo.description && <span className="text-xs text-green-600/80 block line-clamp-2">{promo.description}</span>}
                        </div>
                        <span className="font-semibold flex-shrink-0">-{fmtPrice(promo.discount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Banner dine-in QR */}
                {dineInTable && (
                  <div className="mt-4 flex items-center gap-2 rounded-lg p-3 text-sm font-medium"
                    style={{ backgroundColor: `${primaryColor}10`, color: primaryColor }}
                  >
                    🍽️ Pidiendo desde <strong>{dineInTable}</strong>
                  </div>
                )}

                {/* Tipo de pedido: se muestra si hay más de 1 opción */}
                {(hasPickup && hasDelivery) && (
                  <div className="mt-6 space-y-5 border-t pt-5">
                    <OrderTypeSelector
                      value={orderType}
                      onChange={setOrderType}
                      primaryColor={primaryColor}
                      enableDelivery={hasDelivery}
                      enablePickup={hasPickup}
                      enableDineIn={false}
                    />
                    {isRestaurant && (
                      <ScheduleSelector
                        isScheduled={isScheduled}
                        scheduledAt={scheduledAt}
                        onScheduledChange={setIsScheduled}
                        onTimeChange={setScheduledAt}
                        primaryColor={primaryColor}
                      />
                    )}
                  </div>
                )}
                {/* Solo restaurant: programar pedido (cuando solo hay 1 tipo de entrega) */}
                {isRestaurant && !(hasPickup && hasDelivery) && (
                  <div className="mt-6 space-y-5 border-t pt-5">
                    <ScheduleSelector
                      isScheduled={isScheduled}
                      scheduledAt={scheduledAt}
                      onScheduledChange={setIsScheduled}
                      onTimeChange={setScheduledAt}
                      primaryColor={primaryColor}
                    />
                  </div>
                )}

                {!isOnePage && (
                  <Button
                    className="w-full mt-6"
                    style={{ backgroundColor: primaryColor }}
                    onClick={() => setStep(2)}
                  >
                    Continuar
                  </Button>
                )}
              </CardContent>
              )}
            </Card>
          )}

          {/* STEP 2: Datos del cliente */}
          {(isOnePage || step === 2) && (
            <Card className={isOnePage ? 'mb-6' : ''}>
              <CardHeader className={isOnePage ? 'cursor-pointer select-none' : ''} onClick={isOnePage ? () => toggleSection('customer') : undefined}>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {isOnePage && <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center text-white" style={{ backgroundColor: primaryColor }}>2</span>}
                    {isRestaurant
                      ? (orderType === 'delivery' ? 'Datos de Entrega' : 'Tus Datos')
                      : 'Datos de Envío'}
                  </span>
                  {isOnePage && <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${openSections.customer ? 'rotate-180' : ''}`} />}
                </CardTitle>
              </CardHeader>
              {(!isOnePage || openSections.customer) && (
              <CardContent>
                <form className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nombre <span className="text-red-400">*</span></label>
                      <Input
                        required
                        value={customerData.firstName}
                        onChange={(e) => setCustomerData({ ...customerData, firstName: e.target.value })}
                        placeholder="Juan"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Apellido <span className="text-red-400">*</span></label>
                      <Input
                        required
                        value={customerData.lastName}
                        onChange={(e) => setCustomerData({ ...customerData, lastName: e.target.value })}
                        placeholder="Pérez"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-400">*</span></label>
                    <Input
                      type="email"
                      required
                      value={customerData.email}
                      onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                      placeholder="tu@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono <span className="text-red-400">*</span></label>
                    <PhoneCountryInput
                      value={customerData.phone}
                      onChange={(value) => setCustomerData({ ...customerData, phone: value })}
                      countryCode={customerData.countryCode}
                      primaryColor={primaryColor}
                    />
                  </div>

                  {/* Dirección: siempre para retail, solo para delivery en restaurante */}
                  {(!isRestaurant || orderType === 'delivery') && (
                    <>
                      {/* Selector de direcciones guardadas */}
                      {savedAddresses.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Direcciones guardadas</label>
                          <div className="space-y-2">
                            {savedAddresses.map((addr) => (
                              <button
                                key={addr.id}
                                type="button"
                                onClick={() => setCustomerData(prev => ({
                                  ...prev,
                                  address: addr.address_line1,
                                  city: addr.city || '',
                                  countryCode: (addr as any).country_code || prev.countryCode,
                                  stateName: (addr as any).department || prev.stateName,
                                  department: (addr as any).department || prev.department,
                                }))}
                                className={`w-full text-left p-3 rounded-lg border transition-colors flex items-start gap-2 ${
                                  customerData.address === addr.address_line1
                                    ? 'border-2'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                                style={customerData.address === addr.address_line1 ? { borderColor: primaryColor, backgroundColor: `${primaryColor}08` } : {}}
                              >
                                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: primaryColor }} />
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {addr.label || 'Dirección'}
                                    {addr.is_default && <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">Principal</span>}
                                  </p>
                                  <p className="text-xs text-gray-500">{addr.address_line1}{addr.city ? `, ${addr.city}` : ''}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                          <p className="text-xs text-gray-400 mt-2">O escribe una dirección diferente abajo</p>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Dirección <span className="text-red-400">*</span></label>
                        <Input
                          required
                          value={customerData.address}
                          onChange={(e) => setCustomerData({ ...customerData, address: e.target.value })}
                          placeholder="Calle 123 #45-67"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación <span className="text-red-400">*</span></label>
                        <LocationCheckoutFields
                          countryCode={customerData.countryCode}
                          stateCode={customerData.stateCode}
                          stateName={customerData.stateName}
                          city={customerData.city}
                          onChange={(data) => setCustomerData({
                            ...customerData,
                            countryCode: data.countryCode,
                            stateCode: data.stateCode,
                            stateName: data.stateName,
                            city: data.city,
                            department: data.stateName
                          })}
                          primaryColor={primaryColor}
                          fallbackCities={['Bogotá','Medellín','Cali','Barranquilla','Cartagena','Cúcuta','Bucaramanga','Pereira','Santa Marta','Ibagué','Pasto','Manizales','Neiva','Villavicencio','Armenia','Valledupar','Montería','Sincelejo','Popayán','Tunja','Riohacha','Florencia','Quibdó','Yopal','Mocoa','Leticia','San Andrés','Arauca','Mitú','Puerto Carreño','Inírida','Envigado','Bello','Itagüí','Sabaneta','Rionegro','Soacha','Chía','Zipaquirá','Fusagasugá','Girardot','Tuluá','Palmira','Buenaventura','Barrancabermeja','Sogamoso','Duitama','Girón','Piedecuesta','Soledad','Malambo','Dosquebradas','Apartadó','Turbo','Lorica','Magangué','Aguachica','Ocaña','Pamplona','Tumaco','Ipiales','Cartago','Buga','Jamundí']}
                        />
                      </div>

                      {/* Botón guardar dirección para usuarios autenticados */}
                      {isAuthenticated && customerData.address && customerData.city && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/customer/address', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  organizationId,
                                  address_line: customerData.address,
                                  city: customerData.city,
                                  country_code: customerData.countryCode,
                                  department: customerData.department,
                                  label: 'Principal',
                                  is_default: true
                                })
                              })
                              if (res.ok) {
                                const data = await res.json()
                                if (data.address) {
                                  setSavedAddresses(prev => [data.address, ...prev.map((a: any) => ({ ...a, is_default: false }))])
                                }
                              }
                            } catch {}
                          }}
                          className="flex items-center gap-1.5 text-sm font-medium hover:underline"
                          style={{ color: primaryColor }}
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          Guardar como dirección principal
                        </button>
                      )}

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
                                <span className="font-semibold text-sm">{fmtPrice(rate.cost)}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notas <span className="text-gray-400 font-normal">(opcional)</span></label>
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

                  {!isOnePage && (
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
                  )}
                </form>
              </CardContent>
              )}
            </Card>
          )}

          {/* STEP 3: Método de pago */}
          {(isOnePage || step === 3) && (
            <Card className={isOnePage ? 'mb-6' : ''}>
              <CardHeader className={isOnePage ? 'cursor-pointer select-none' : ''} onClick={isOnePage ? () => toggleSection('payment') : undefined}>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {isOnePage && <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center text-white" style={{ backgroundColor: primaryColor }}>3</span>}
                    Método de Pago
                  </span>
                  {isOnePage && <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${openSections.payment ? 'rotate-180' : ''}`} />}
                </CardTitle>
              </CardHeader>
              {(!isOnePage || openSections.payment) && (
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

                {isOnePage ? (
                  <Button
                    type="button"
                    className="w-full mt-6"
                    style={{ backgroundColor: primaryColor }}
                    onClick={() => handleSubmit()}
                    disabled={submitting || !canSubmitOnePage}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      `Pagar ${fmtPrice(total)}`
                    )}
                  </Button>
                ) : (
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
                        `Pagar ${fmtPrice(total)}`
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
              )}
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
                {/* Tipo de pedido */}
                {(hasDelivery || hasPickup) && (
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
                      <span className="truncate block">
                        {item.name} x{item.quantity}
                        {promotionsForItem(appliedPromotions, item.id).length > 0 && (
                          <Tag className="inline h-3 w-3 ml-1 text-green-600 align-[-1px]" aria-label="Con promoción" />
                        )}
                      </span>
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
                      {item.newModifiers && item.newModifiers.length > 0 && (
                        <span className="text-xs text-gray-400 block truncate">
                          {item.newModifiers.map(m => `${m.name}${m.extraPrice > 0 ? ` (+${fmtPrice(m.extraPrice)})` : ''}`).join(', ')}
                        </span>
                      )}
                    </div>
                    {(promoItemDiscounts[String(item.id)] || 0) > 0 ? (
                      <span className="ml-2 flex-shrink-0 text-right">
                        <span className="block text-xs text-gray-400 line-through">{fmtPrice(item.price * item.quantity)}</span>
                        <span className="font-medium text-green-600">{fmtPrice(item.price * item.quantity - (promoItemDiscounts[String(item.id)] || 0))}</span>
                      </span>
                    ) : (
                      <span className="font-medium ml-2 flex-shrink-0">{fmtPrice(item.price * item.quantity)}</span>
                    )}
                  </div>
                ))}

                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span>{fmtPrice(subtotal)}</span>
                  </div>
                  {tax > 0 && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-600">{settings.taxName} ({settings.taxRate}%)</span>
                      <span>{fmtPrice(tax)}</span>
                    </div>
                  )}
                  {settings.taxIncluded && settings.taxRate > 0 && (
                    <p className="text-xs text-gray-400 mt-1">{settings.taxName} incluido en el precio</p>
                  )}
                  {needsShipping && settings.enableShipping && (
                    <div className="mt-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{settings.shippingTitle || (isRestaurant ? 'Domicilio' : 'Envío')}</span>
                        <span>{shipping === 0 ? 'Gratis' : fmtPrice(shipping)}</span>
                      </div>
                      {settings.shippingDescription && (
                        <p className="text-xs text-gray-400 mt-0.5">{settings.shippingDescription}</p>
                      )}
                    </div>
                  )}
                  {tipAmount > 0 && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-600">Propina</span>
                      <span>{fmtPrice(tipAmount)}</span>
                    </div>
                  )}
                  {couponDiscount > 0 && appliedCoupon && (
                    <div className="flex justify-between text-sm mt-1 text-green-600">
                      <span className="flex items-center gap-1">
                        🎟️ {appliedCoupon.code}
                        <button onClick={removeCoupon} className="text-red-400 hover:text-red-600 text-xs ml-1">✕</button>
                      </span>
                      <span>-{fmtPrice(couponDiscount)}</span>
                    </div>
                  )}
                  {appliedPromotions.map((promo) => (
                    <div key={promo.id} className="flex justify-between text-sm mt-1 text-green-600">
                      <span className="flex items-center gap-1 truncate flex-1 mr-2" title={promo.description || promo.name}>
                        <Tag className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{promo.name}</span>
                      </span>
                      <span className="flex-shrink-0">-{fmtPrice(promo.discount)}</span>
                    </div>
                  ))}
                </div>

                {/* Coupon input */}
                {!appliedCoupon && (
                  <div className="border-t pt-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Código de cupón (opcional)"
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
                    <span style={{ color: primaryColor }}>{fmtPrice(total)}</span>
                  </div>
                  {(promoDiscount + couponDiscount) > 0 && (
                    <p className="text-xs text-green-600 text-right mt-1">
                      Estás ahorrando <strong>{fmtPrice(promoDiscount + couponDiscount)}</strong>
                    </p>
                  )}
                </div>

                {needsShipping && settings.enableShipping && shipping === 0 && settings.freeShippingThreshold > 0 && (
                  <p className="text-xs text-green-600 text-center mt-2">
                    ¡Envío gratis por compras mayores a {fmtPrice(settings.freeShippingThreshold)}!
                  </p>
                )}

                {/* Trust Badges */}
                {settings.showTrustBadges && settings.trustBadges && settings.trustBadges.length > 0 && (
                  <div className="border-t pt-3 mt-3 space-y-2">
                    {settings.trustBadges.map((badge, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="text-sm">{badge.icon}</span>
                        <span>{badge.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Payment Logos */}
                {settings.showPaymentLogos && (
                  <div className="border-t pt-3 mt-3">
                    <p className="text-xs text-gray-400 mb-2">Métodos de pago aceptados</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-gray-100 rounded px-2 py-1 text-xs font-semibold text-blue-700">VISA</span>
                      <span className="bg-gray-100 rounded px-2 py-1 text-xs font-semibold text-red-600">Mastercard</span>
                      <span className="bg-gray-100 rounded px-2 py-1 text-xs font-semibold text-blue-500">PSE</span>
                      <span className="bg-gray-100 rounded px-2 py-1 text-xs font-semibold text-green-600">Nequi</span>
                      <span className="bg-gray-100 rounded px-2 py-1 text-xs font-semibold text-gray-600">💵 Efectivo</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky bottom bar - solo en one-page */}
      {isOnePage && cartItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_12px_rgba(0,0,0,0.1)] z-40 px-4 py-3">
          <div className="container mx-auto flex items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              Total: <span className="text-lg font-bold text-gray-900">{fmtPrice(total)}</span>
              {promoDiscount > 0 && (
                <span className="block text-xs text-green-600">Ahorras {fmtPrice(promoDiscount)} en promociones</span>
              )}
            </div>
            <Button
              type="button"
              className="px-8 h-11 font-semibold"
              style={{ backgroundColor: primaryColor }}
              onClick={() => handleSubmit()}
              disabled={submitting || !canSubmitOnePage}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                `Pagar ${fmtPrice(total)}`
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Spacer para el sticky bar */}
      {isOnePage && cartItems.length > 0 && <div className="h-20" />}
    </div>
  )
}
