'use client'

import { filtrarMetodosPorSede } from '@/lib/payments/metodosPorSucursal'
import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Trash2, Plus, Minus, CreditCard, Truck, Check, ShoppingBag, Banknote, Building2, Loader2, MapPin, ChevronDown, AlertTriangle, Wallet, Tag } from 'lucide-react'
import Link from 'next/link'
import { OrderTypeSelector, type OrderType, type OpcionDomicilio } from '@/components/site/OrderTypeSelector'
import { gruposActivos, resumenDomicilio, tarifasDelGrupo, textoDias, type GrupoEnvio } from '@/lib/shipping/opcionesDomicilio'
import { barraEnvioGratis, detalleZona, envioDeZona, llegadaZona, type CotizacionPublica } from '@/lib/shipping/domicilioZonas'
import { TipSelector } from '@/components/site/TipSelector'
import { ScheduleSelector } from '@/components/site/ScheduleSelector'
import { OrderConfirmation, type ResumenPedidoConfirmado } from '@/components/site/OrderConfirmation'
import type { HorarioSemana } from '@/lib/restaurant/horario'
import { momentoPedido, validarMomentoPedido } from '@/lib/restaurant/ventanaPedido'
import { idProductoCarrito, impuestoParaLineas } from '@/lib/orders/impuestoProducto'
import { useTarifasCarrito } from '@/lib/orders/useTarifasCarrito'
import { etiquetaMesa } from '@/lib/orders/nombreMesa'
import { SelectorSede, type SedeSelector } from '@/components/site/header/SelectorSede'
import { conPrefijo } from '@/lib/outlet/rutaSitio'
import { leerMesaGuardada, limpiar as limpiarMesa, type MesaGuardada } from '@/lib/restaurant/useMesaQR'
import { ContadorColumnas } from '@/components/site/ContadorColumnas'
import { ContadoresDe } from '@/components/site/ContadorPublico'
import { conversionManda } from '@/lib/website/conversion'
import { avisoStock, type ConversionSitio } from '@/lib/website/conversion'
import PhoneCountryInput from './PhoneCountryInput'
import LocationCheckoutFields from './LocationCheckoutFields'
import { useCurrency } from './CurrencyProvider'
import { getCartKey } from '@/lib/utils'
import { useCartPromotions, promotionsForItem, promotionBadgeLabel } from '@/lib/hooks/useCartPromotions'
import { subtotalParaEnvioGratis } from '@/lib/shipping/envioGratisDescontado'
import { DescuentosPorPromocion, PromoDeLinea } from './checkout/PromocionesResumen'
import { sedeDePedidoWeb } from '@/lib/orders/pedidoWeb'
import { trackMetaPurchase } from '@/components/site/MetaPixelEvents'
import { abrirBoldDesdeUrl, cargarLibreriaBold } from '@/lib/payments/boldCheckoutCliente'
import { aplicarPreciosNuevos, esCuponNoValido, mensajeErrorPedido, mensajePreciosCambiados, preciosCambiados } from '@/lib/checkout/respuesta-pedido'
import { DetalleContraentrega, MotivoContraentrega, ResumenPagoContraentrega, textoBotonAnticipo, useContraentrega } from '@/components/site/contraentrega/OpcionContraentrega'

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
  /** Existencias reales. Sin este dato no se muestra el aviso. */
  stock?: number | null
}

interface WebsitePaymentMethod {
  code: string
  name: string
  description?: string | null
  icon?: string | null
  requiresReference: boolean
  connectionId?: string | null
  type: 'native' | 'gateway'
  /** Sucursales donde se acepta (null/ausente = todas). */
  branchIds?: number[] | null
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
  stockWarningThreshold?: number
  stockWarningTemplate?: string
  conversion?: ConversionSitio | null
  conversionFines?: Record<string, string | null> | null
  showPaymentLogos?: boolean
  showCountdown?: boolean
  countdownConfig?: CountdownConfig
}

/** Sede del pedido (restaurante): la misma que usa /api/orders para validar el horario. */
export interface SedePedidoCheckout {
  id: number
  nombre: string
  direccion: string | null
  horario: HorarioSemana | null
  zona: string
}

interface CheckoutWizardProps {
  organizationId: number
  primaryColor: string
  paymentMethods: WebsitePaymentMethod[]
  checkoutSettings?: CheckoutSettings
  isRestaurant?: boolean
  organizationSubdomain?: string
  branchId?: number | null
  sedePedido?: SedePedidoCheckout | null
  /** Sedes publicadas con su `href` base (lib/outlet/sedeLayout.ts): «Cambiar sede» y el aviso del carrito de otra sede. */
  sedesSelector?: SedeSelector[]
  /** Sede de la petición (`null` en el sitio principal): la del carrito que se está cobrando. */
  sedeActualId?: number | null
  /**
   * Sede por defecto de /api/orders (sedePorDefectoPedido) cuando el cliente no eligió sede.
   * Solo filtra los métodos de pago por sede; no se manda al servidor ni cambia carta ni promociones.
   */
  sedePorDefectoId?: number | null
  /** `''` o `'/<slug>'` si la sede se sirve por prefijo de ruta (rutaSitio). */
  prefijoSede?: string
  /** Carta o catálogo de esta sede, con su prefijo: «Seguir pidiendo» de la confirmación. */
  rutaSeguirPidiendo?: string
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
// Mercado Pago: el ERP lo enlaza como 'mp'; 'mp_checkout' es el código viejo del conector.
const MERCADOPAGO_CODES = new Set(['mp', 'mp_checkout'])
// Bold: 'bold_link' es el método del link de pago (el único de Bold que va en la tienda).
const BOLD_CODES = new Set(['bold', 'bold_link'])

// Ícono de pasarela: billetera sobre fondo claro, cuadrado redondeado.
// Wompi en verde, Mercado Pago en azul y Bold en rojo (sus colores), sin usar sus logos.
const ESTILO_PASARELA = {
  verde: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400',
  azul: 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400',
  rojo: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400',
} as const

function IconoPasarela({ tono }: { tono: keyof typeof ESTILO_PASARELA }) {
  const estilo = ESTILO_PASARELA[tono]
  return (
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border ${estilo}`}>
      <Wallet className="w-5 h-5" aria-hidden="true" />
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

function AvisoStockLinea({ activo, stock, umbral, plantilla }: { activo: boolean; stock?: number | null; umbral: number; plantilla: string }) {
  if (!activo) return null
  const texto = avisoStock(stock, umbral, plantilla)
  if (!texto) return null
  return <p className="text-xs text-orange-600 font-medium mt-1">{texto}</p>
}

export function CheckoutWizard({ organizationId, primaryColor, paymentMethods: todosLosMetodos, checkoutSettings, isRestaurant = false, organizationSubdomain, branchId, sedePedido = null, sedesSelector = [], sedeActualId = null, sedePorDefectoId = null, prefijoSede = '', rutaSeguirPidiendo }: CheckoutWizardProps) {
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
  const [resumenPedido, setResumenPedido] = useState<ResumenPedidoConfirmado | null>(null)
  // Sitio principal sin sede: carritos guardados en sitios de sede (el carrito es por sede).
  const [carritosDeSede, setCarritosDeSede] = useState<{ sede: SedeSelector; unidades: number }[]>([])
  // Delivery type state (aplica a restaurant y retail)
  const hasPickup = !settings.availableDeliveryTypes || settings.availableDeliveryTypes.includes('pickup')
  const hasDelivery = !settings.availableDeliveryTypes || settings.availableDeliveryTypes.includes('delivery_own') || settings.availableDeliveryTypes.includes('delivery_third_party')
  const defaultOrderType: OrderType = hasDelivery ? 'delivery' : 'pickup'
  // «Domicilio» (lo lleva la tienda) y «Transportadora» (lib/shipping/opcionesDomicilio.ts): con
  // los dos activos en «Cómo reciben el pedido», el cliente elige; cada uno con su tiempo y precio.
  const gruposDomicilio: GrupoEnvio[] = hasDelivery ? gruposActivos(settings.availableDeliveryTypes) : []
  const [grupoEnvio, setGrupoEnvio] = useState<GrupoEnvio>(gruposDomicilio[0] ?? 'own')
  // «Comer aquí»: con una mesa escaneada, o si el negocio lo activó en sus tipos de entrega.
  const dineInEnAjustes = !!settings.availableDeliveryTypes?.includes('dine_in')
  const [orderType, setOrderType] = useState<OrderType>(defaultOrderType)
  const [tipAmount, setTipAmount] = useState(0)
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledAt, setScheduledAt] = useState<string | null>(null)
  // Mesa del QR (contrato de B, lib/restaurant/useMesaQR.ts: sessionStorage con caducidad y sede).
  // Sin QR, si el negocio ofrece «Comer aquí», el cliente escribe su mesa; el servidor la valida.
  const [mesa, setMesa] = useState<MesaGuardada | null>(null)
  const [mesaManual, setMesaManual] = useState('')
  const hasDineIn = isRestaurant && (dineInEnAjustes || !!mesa)
  // Sin «Comer aquí» la cuenta es la de siempre (recoger + domicilio).
  const opcionesEntrega = [hasPickup, hasDineIn].filter(Boolean).length + (hasDelivery ? Math.max(1, gruposDomicilio.length) : 0)

  // Coupon states
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<{ id: string; code: string; name: string; discount_type: string; discount_value: number } | null>(null)
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)

  // Promociones automáticas: mismo hook que el drawer y /carrito, y mismo
  // motor que /api/orders. La sede es la del pedido (outlet, mesa o la que
  // ya resolvió la página), nunca la sucursal pegada al primer ítem.
  const sedePromocion = sedeDePedidoWeb(undefined, {
    outletId: typeof branchId === 'number' ? branchId : null,
    sedeElegidaId: orderType === 'dine_in' && typeof mesa?.sede === 'number'
      ? mesa.sede
      : (typeof sedePedido?.id === 'number' ? sedePedido.id : (typeof sedeActualId === 'number' ? sedeActualId : null)),
  })
  // Métodos de pago habilitados en la sede del pedido (branch_ids del ERP; NULL = todas).
  // Sin sede elegida, la misma sede por defecto con la que /api/orders valida (si no, el servidor
  // rechazaría con 422 un método que aquí se ofrecía).
  const sedeMetodos = sedePromocion ?? sedePorDefectoId
  const availableMethods = useMemo(() => filtrarMetodosPorSede(todosLosMetodos, sedeMetodos), [todosLosMetodos, sedeMetodos])
  // 'gateway_code' o 'cash' o 'transfer'
  const [paymentMethod, setPaymentMethod] = useState<string>(
    availableMethods.length > 0 ? availableMethods[0].code : 'cash'
  )
  // Bold elegido: su librería se carga mientras la persona termina el formulario, para que
  // «Pagar» abra el pago de Bold al instante (sin la página intermedia).
  useEffect(() => {
    if (BOLD_CODES.has(paymentMethod)) cargarLibreriaBold().catch(() => {})
  }, [paymentMethod])
  // Si la sede cambia y el método elegido no está habilitado en la nueva
  // (branch_ids del ERP), se pasa al primero permitido. Sin métodos por sede
  // configurados la lista no cambia y esto no hace nada.
  useEffect(() => {
    if (availableMethods.length === 0) return
    if (!availableMethods.some((m) => m.code === paymentMethod)) setPaymentMethod(availableMethods[0].code)
  }, [availableMethods, paymentMethod])

  const {
    promotions: appliedPromotions,
    totalDiscount: promoDiscount,
    itemDiscounts: promoItemDiscounts,
    volumeHints: promoVolumeHints,
  } = useCartPromotions({ organizationId, branchId: sedePromocion, items: cartItems, paymentMethod })

  // Dynamic shipping states
  const [dynamicShippingRates, setDynamicShippingRates] = useState<{ id: string; name: string; cost: number; service_level: string; carrier_name: string | null; grupo?: GrupoEnvio; dias?: number | null }[]>([])
  const [selectedShippingRate, setSelectedShippingRate] = useState<string | null>(null)
  const [dynamicShippingCost, setDynamicShippingCost] = useState<number | null>(null)
  // Domicilio por zona (logística Fase 1, Figma 2830:75378): la cotización del servidor
  // (/api/shipping/quote). `null` = la tienda no tiene zonas: todo queda como antes.
  const [cotZona, setCotZona] = useState<CotizacionPublica | null>(null)

  const [customerData, setCustomerData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    // Barrio: con zonas de domicilio, ubica la dirección (logística Fase 1).
    barrio: '',
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

      // Sitio principal (sin sede en la URL): ¿hay pedidos empezados en el sitio de alguna sede?
      // El checkout global no los ve (otra clave de carrito); se avisa en vez de cobrar otro.
      if (typeof branchId !== 'number' && sedesSelector.length > 0) {
        const conItems: { sede: SedeSelector; unidades: number }[] = []
        // Solo sedes con sitio propio (href no vacío): el sitio principal es este mismo checkout.
        for (const sede of sedesSelector.filter((s) => s.href !== '')) {
          try {
            const crudo = localStorage.getItem(getCartKey(subdomain, sede.id))
            const lista = crudo ? JSON.parse(crudo) : []
            const unidades = Array.isArray(lista) ? lista.reduce((n: number, i: any) => n + (Number(i?.quantity) || 0), 0) : 0
            if (unidades > 0) conItems.push({ sede, unidades })
          } catch { /* carrito ilegible: se ignora */ }
        }
        setCarritosDeSede(conItems)
      }

      // QR de mesa: vigente y de la sede de este checkout (leerMesaGuardada borra la clave antigua
      // de localStorage que dejaba la mesa pegada para siempre).
      if (isRestaurant) {
        const guardada = leerMesaGuardada(subdomain, branchId)
        if (guardada) {
          setMesa(guardada)
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
  // Envío gratis medido DESPUÉS de promociones y cupón (lib/shipping/envioGratisDescontado.ts), con
  // la misma regla que cobra /api/orders. Solo decide el envío gratis; el resto usa `subtotal`.
  const subtotalEnvioGratis = subtotalParaEnvioGratis(subtotal, couponDiscount + promoDiscount)
  // Impuesto con la misma regla que cobra /api/orders. Cada producto usa su tarifa
  // (product_tax_relations); hasta que llega, o si no tiene, la predeterminada.
  const tarifasCarrito = useTarifasCarrito(cartItems.map((item) => idProductoCarrito(item) ?? 0).filter((id) => id > 0))
  const predeterminado = { tasa: settings.taxRate, incluido: settings.taxIncluded, nombre: settings.taxName }
  const impuestoVisto = impuestoParaLineas({
    brutos: cartItems.map((item) => item.price * item.quantity),
    descuento: couponDiscount + promoDiscount,
    predeterminado,
    tarifas: tarifasCarrito
      ? cartItems.map((item) => {
          const id = idProductoCarrito(item)
          return id != null ? tarifasCarrito.get(id) ?? null : null
        })
      : null,
  })
  const tax = impuestoVisto.resumen.suma
  const impuestoIncluido = impuestoVisto.resumen.incluido
  const etiquetaImpuesto = impuestoVisto.resumen.tasa != null
    ? `${impuestoVisto.resumen.nombre} (${impuestoVisto.resumen.tasa}%)`
    : impuestoVisto.resumen.nombre
  // Shipping solo aplica cuando el tipo seleccionado es delivery
  const needsShipping = orderType === 'delivery' && hasDelivery
  const flatShipping = settings.enableShipping && needsShipping
    ? (settings.freeShippingThreshold > 0 && subtotalEnvioGratis >= settings.freeShippingThreshold ? 0 : settings.shippingFlatRate)
    : 0
  // Domicilio propio con zonas: lo que dice la zona (fuera de cobertura no hay domicilio: 0 y el
  // envío queda bloqueado). Sin zonas: envío dinámico si hay tarifas, si no la tarifa plana.
  const envioZona = needsShipping && grupoEnvio === 'own' && cotZona ? envioDeZona(cotZona) : null
  const shipping = envioZona
    ? (envioZona.ok ? envioZona.costo : 0)
    : dynamicShippingCost !== null && needsShipping ? dynamicShippingCost : flatShipping
  const barraGratis = envioZona?.ok && cotZona ? barraEnvioGratis(cotZona) : null
  const bloqueoZona = envioZona && !envioZona.ok
    ? (envioZona.codigo === 'PEDIDO_MINIMO_DOMICILIO'
        ? `El pedido mínimo para domicilio en tu zona es ${fmtPrice(cotZona?.pedido_minimo ?? 0)}: te faltan ${fmtPrice(cotZona?.falta_para_minimo ?? 0)}.`
        : 'Tu dirección está fuera de nuestras zonas de domicilio. Elige otra dirección, transportadora o recoger.')
    : null
  const total = subtotal + tax + shipping + tipAmount - couponDiscount - promoDiscount
  // Contraentrega con condiciones (lib/contraentrega): lo que pinta la opción «Efectivo» a domicilio.
  // Sin condiciones en la sede, `ce.estado` es null y el checkout queda como hoy.
  const ce = useContraentrega({
    habilitado: orderType === 'delivery' && availableMethods.some((m) => m.code === 'cash'),
    branchId: typeof sedeMetodos === 'number' ? sedeMetodos : null,
    tipoEntrega: orderType === 'delivery' ? (grupoEnvio === 'third_party' ? 'delivery_third_party' : 'delivery_own') : orderType === 'dine_in' ? 'dine_in' : 'pickup',
    items: cartItems.map((i) => ({ productId: Number(idProductoCarrito(i)), cantidad: i.quantity })),
    subtotalProductos: Math.max(0, total - shipping - tipAmount),
    envio: shipping,
    total,
    direccion: { ciudad: customerData.city, pais: customerData.countryCode, departamento: customerData.stateCode, barrio: customerData.barrio },
  })
  const ceBloqueada = paymentMethod === 'cash' && !!ce.estado && !ce.estado.disponible
  const textoPagar = (paymentMethod === 'cash' ? textoBotonAnticipo(ce.estado, ce.pasarela, fmtPrice) : null) ?? `Pagar ${fmtPrice(total)}`
  // Acciones de la opción apagada (pantalla 09 E y F): solo existen con condiciones en la sede.
  const quitarNoAplican = (productIds: number[]) => {
    const ids = new Set(productIds)
    cartItems.filter((item) => ids.has(Number(idProductoCarrito(item)))).forEach((item) => removeItem(item.id))
  }
  const cambiarDireccionContraentrega = () => {
    if (isOnePage) {
      setOpenSections((prev) => ({ ...prev, customer: true }))
      setTimeout(() => {
        const campo = document.querySelector<HTMLInputElement>('input[placeholder="Calle 123 #45-67"]')
        if (campo) {
          campo.scrollIntoView({ behavior: 'smooth', block: 'center' })
          campo.focus()
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      }, 0)
    } else {
      setStep(2)
    }
  }

  // Tarifas de Transporte › Tarifas de envío («Web»), por ciudad. Se piden desde el principio (sin
  // ciudad, las de cualquier destino) para que las tarjetas de domicilio muestren precio y tiempo.
  useEffect(() => {
    if (!organizationId || !hasDelivery) return
    const escrita = customerData.city.trim()
    const city = escrita.length >= 3 ? escrita : ''
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch('/api/shipping/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // El subtotal de esta ruta solo decide el envío gratis de cada tarifa: va el descontado.
          body: JSON.stringify({ organizationId, city, subtotal: subtotalEnvioGratis })
        })
        const data = await res.json()
        setDynamicShippingRates(Array.isArray(data.rates) ? data.rates : [])
      } catch {
        setDynamicShippingRates([])
      }
    }, 500) // Debounce 500ms
    return () => clearTimeout(timeout)
  }, [customerData.city, organizationId, hasDelivery, subtotalEnvioGratis])

  // Domicilio por zona: el servidor ubica la dirección (municipio DANE por país, departamento y
  // ciudad; barrio) y responde si la tienda tiene zonas. Informativo: /api/orders vuelve a cotizar.
  const conDomicilioPropio = hasDelivery && gruposDomicilio.includes('own')
  // Cambia si cambian los productos o cantidades: la cotización vuelve a sumar el peso.
  const clavePesoCarrito = cartItems.map((item) => `${idProductoCarrito(item) ?? 0}x${item.quantity}`).join(',')
  useEffect(() => {
    if (!organizationId || !conDomicilioPropio) {
      setCotZona(null)
      return
    }
    let vigente = true
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch('/api/shipping/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(sedePromocion != null ? { branchId: sedePromocion } : {}),
            subtotal,
            // Envío gratis de la zona con promociones y cupón ya descontados (el mínimo, con `subtotal`).
            subtotalEnvioGratis,
            // Productos del carrito: el servidor suma su peso para las reglas de despacho por peso.
            items: cartItems.map((item) => ({ product_id: idProductoCarrito(item), cantidad: item.quantity })),
            direccion: {
              ciudad: customerData.city,
              pais: customerData.countryCode,
              departamento: customerData.stateCode,
              barrio: customerData.barrio,
            },
          }),
        })
        const data = await res.json()
        if (vigente) setCotZona(data?.usaZonas && data.cotizacion ? (data.cotizacion as CotizacionPublica) : null)
      } catch {
        if (vigente) setCotZona(null)
      }
    }, 500)
    return () => {
      vigente = false
      clearTimeout(timeout)
    }
  }, [organizationId, conDomicilioPropio, sedePromocion, subtotal, subtotalEnvioGratis, clavePesoCarrito, customerData.city, customerData.countryCode, customerData.stateCode, customerData.barrio])

  // Tarifas del domicilio elegido (con un solo tipo activo, todas). Se elige la más económica,
  // salvo que el cliente ya tenga una de ese grupo; sin tarifas, la plana de los ajustes.
  const tarifasGrupo = tarifasDelGrupo(dynamicShippingRates, grupoEnvio, gruposDomicilio)
  const claveTarifasGrupo = tarifasGrupo.map((t) => `${t.id}:${t.cost}`).join('|')
  useEffect(() => {
    if (tarifasGrupo.length === 0) {
      setSelectedShippingRate(null)
      setDynamicShippingCost(null)
      return
    }
    const actual = tarifasGrupo.find((t) => t.id === selectedShippingRate)
    const elegida = actual ?? tarifasGrupo.reduce((a, b) => (b.cost < a.cost ? b : a))
    setSelectedShippingRate(elegida.id)
    setDynamicShippingCost(elegida.cost)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveTarifasGrupo])

  // Tarjetas «Domicilio» / «Transportadora» con su tiempo y su precio (como en el diseño aprobado).
  const fechaCorta = (fecha: string) =>
    new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${fecha}T12:00:00Z`))
  const opcionesDomicilio: OpcionDomicilio[] = gruposDomicilio.map((g) => {
    if (g === 'own' && cotZona) {
      const e = envioDeZona(cotZona)
      return {
        grupo: g,
        titulo: 'Domicilio',
        detalle: detalleZona(cotZona),
        tiempo: e.ok ? llegadaZona(cotZona, fechaCorta) : null,
        precio: !e.ok ? '—' : e.costo === 0 ? 'Gratis' : fmtPrice(e.costo),
      }
    }
    const r = resumenDomicilio(
      g,
      tarifasDelGrupo(dynamicShippingRates, g, gruposDomicilio),
      { activo: settings.enableShipping, tarifa: settings.shippingFlatRate, umbralGratis: settings.freeShippingThreshold },
      subtotalEnvioGratis,
      gruposDomicilio,
    )
    return {
      grupo: g,
      titulo: r.titulo,
      detalle: r.detalle,
      tiempo: r.tiempo,
      precio: r.costo === 0 ? 'Gratis' : `${r.desde ? 'desde ' : ''}${fmtPrice(r.costo)}`,
    }
  })
  const etiquetaDomicilio = gruposDomicilio.length > 1 && grupoEnvio === 'third_party' ? 'Transportadora' : 'Domicilio'

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
    // Fuera de cobertura o bajo el mínimo de la zona: el servidor también lo rechaza (422).
    if (bloqueoZona) {
      setPaymentError(bloqueoZona)
      return
    }
    setSubmitting(true)
    setPaymentError(null)

    try {
      // 1. Crear la orden
      // La misma sede con la que se calcularon las promociones. Sin ella, el
      // servidor usa la sede por defecto del pedido web.
      const orderPayload: any = {
        organizationId,
        ...(sedePromocion != null ? { branchId: sedePromocion } : {}),
        customer: customerData,
        ...(customerId ? { customerId } : {}),
        items: cartItems.map(item => ({
          id: item.productId || item.id,
          // Id de la línea en el carrito: /api/orders lo devuelve si el precio cambió.
          lineId: item.id,
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
        // Tarifa elegida de /api/shipping/calculate: el servidor recalcula el envío con ella (sin
        // tarifa dinámica, null = tarifa plana de los ajustes).
        shippingRateId: needsShipping && !envioZona && dynamicShippingCost !== null ? selectedShippingRate : null,
        total,
        paymentMethod,
        // Contraentrega con anticipo: la pasarela que eligió el cliente (el servidor la valida).
        ...(paymentMethod === 'cash' && ce.pasarela ? { anticipoPasarela: ce.pasarela } : {}),
      }

      // Tipo de entrega (aplica a todos los tipos de org)
      orderPayload.deliveryType = orderType
      // Domicilio de la tienda o transportadora: el servidor lo valida contra los tipos activos.
      if (orderType === 'delivery') orderPayload.grupoEnvio = grupoEnvio
      if (orderType === 'delivery') {
        orderPayload.deliveryAddress = {
          address: customerData.address,
          city: customerData.city,
          country: customerData.countryCode,
          state: customerData.stateName,
          state_code: customerData.stateCode,
          department: customerData.department,
          ...(customerData.barrio.trim() ? { neighborhood: customerData.barrio.trim() } : {})
        }
      }

      // Campos exclusivos de restaurante
      if (isRestaurant) {
        if (tipAmount > 0) orderPayload.tipAmount = tipAmount
        if (isScheduled && scheduledAt) {
          orderPayload.isScheduled = true
          orderPayload.scheduledAt = scheduledAt
        }
        // La mesa solo viaja con «Comer aquí»: un pedido cambiado a domicilio o recoger no la lleva.
        if (orderType === 'dine_in') {
          const ref = mesa?.mesa ?? mesaManual.trim()
          if (ref) orderPayload.tableRef = ref
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
        const cambios = preciosCambiados(orderRes.status, orderData)
        if (cambios) {
          // El servidor cobra su precio, no el del carrito: se actualiza el carrito y el cliente
          // confirma de nuevo viendo el total real (promociones y envío se recalculan solos).
          const actualizado = aplicarPreciosNuevos(cartItems, cambios)
          setCartItems(actualizado)
          localStorage.setItem(getCartKey(organizationSubdomain || '', branchId), JSON.stringify(actualizado))
          window.dispatchEvent(new CustomEvent('cart-updated'))
          setPaymentError(mensajePreciosCambiados(cambios, fmtPrice))
        } else if (esCuponNoValido(orderRes.status, orderData)) {
          removeCoupon()
          setPaymentError(mensajeErrorPedido(orderRes.status, orderData))
        } else if (orderData?.code === 'SEDE_CERRADA' || orderData?.code === 'HORA_PROGRAMADA_INVALIDA') {
          // El servidor rechazó el momento (la sede cerró mientras se pagaba, o la hora ya no vale):
          // se pasa a «Programar» y se vuelve al paso donde se elige la hora.
          setIsScheduled(true)
          setScheduledAt(null)
          if (!isOnePage) setStep(1)
          setPaymentError(mensajeErrorPedido(orderRes.status, orderData))
        } else if (orderData?.code === 'MESA_INVALIDA') {
          // La mesa guardada ya no vale (otra sede, borrada): se olvida y el cliente elige de nuevo.
          limpiarMesa(organizationSubdomain || '')
          setMesa(null)
          setMesaManual('')
          if (!isOnePage) setStep(1)
          setPaymentError(mensajeErrorPedido(orderRes.status, orderData))
        } else {
          setPaymentError(mensajeErrorPedido(orderRes.status, orderData))
        }
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

      // 1b. Contraentrega con anticipo: se paga el anticipo en la pasarela (el monto lo fijó el
      //     servidor). El pedido queda en efectivo; el resto se cobra al recibir.
      if (orderData.anticipo && typeof orderData.orderId === 'string') {
        const initAnticipo = await fetch('/api/checkout/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'anticipo_pedido',
            sourceId: orderData.orderId,
            gateway: orderData.anticipo.pasarela,
            returnUrl: `${window.location.origin}/checkout/resultado`,
          }),
        })
        const datosAnticipo = await initAnticipo.json().catch(() => ({}))
        localStorage.removeItem(getCartKey(organizationSubdomain || '', branchId))
        window.dispatchEvent(new CustomEvent('cart-updated'))
        if (initAnticipo.ok && datosAnticipo.checkoutUrl) {
          if (BOLD_CODES.has(orderData.anticipo.pasarela) && (await abrirBoldDesdeUrl(datosAnticipo.checkoutUrl))) return
          window.location.href = datosAnticipo.checkoutUrl
          return
        } else {
          // El pedido ya existe: la página del pedido ofrece «Pagar» el anticipo hasta que venza.
          window.location.href = conPrefijo(typeof orderData.trackingToken === 'string'
            ? `/pedido/${encodeURIComponent(createdOrderNumber)}?t=${orderData.trackingToken}`
            : `/pedido/${encodeURIComponent(createdOrderNumber)}`, prefijoSede)
          return
        }
      } else {
        // Sin anticipo: como siempre.
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
          // Pedido creado: la mesa del QR ya cumplió (el siguiente pedido no sale como «comer aquí»).
          if (orderType === 'dine_in') limpiarMesa(organizationSubdomain || '')

          // Bold: abrir su pago directo, sin la página intermedia /checkout/bold (2026-11-21).
          // Si no se puede (librería sin cargar, red), esa página queda de respaldo.
          if (BOLD_CODES.has(paymentMethod) && (await abrirBoldDesdeUrl(initData.checkoutUrl))) return

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
      // Copia de lo pedido antes de vaciar carrito y estado (resumen de la confirmación).
      setResumenPedido({
        tipo: orderType === 'delivery' ? etiquetaDomicilio : orderType === 'pickup' ? 'Recoger' : 'Comer aquí',
        mesa: orderType === 'dine_in' ? (mesa?.nombre || mesaManual.trim() || null) : null,
        sede: orderType === 'dine_in' ? (mesa?.nombreSede || sedePedido?.nombre || null) : (sedePedido?.nombre || null),
        programadoPara: isScheduled && scheduledAt && orderType !== 'dine_in' ? scheduledAt : null,
        zona: sedePedido?.zona || null,
        total: fmtPrice(total),
        trackingToken: typeof orderData.trackingToken === 'string' ? orderData.trackingToken : null,
      })
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
      if (orderType === 'dine_in') limpiarMesa(organizationSubdomain || '')
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
      <OrderConfirmation
        orderNumber={orderNumber}
        customerEmail={customerData.email}
        primaryColor={primaryColor}
        isRestaurant={isRestaurant}
        resumen={resumenPedido}
        rutaSeguirPidiendo={rutaSeguirPidiendo}
      />
    )
  }

  if (cartItems.length === 0 && carritosDeSede.length > 0) {
    // Carrito global vacío, pero hay pedidos empezados en sitios de sede: se ofrecen, no se mezclan.
    return (
      <div className="max-w-lg mx-auto text-center py-12 px-4">
        <ShoppingBag className="h-16 w-16 mx-auto text-gray-300 mb-6" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Tu pedido está en una sede</h1>
        <p className="text-gray-600 mb-6">Cada sede tiene su carta y su carrito. Continúa en la sede donde empezaste:</p>
        <ul className="space-y-3 text-left">
          {carritosDeSede.map(({ sede, unidades }) => (
            <li key={sede.id}>
              <a
                href={`${sede.href}/checkout`}
                className="flex items-center justify-between rounded-xl border bg-white p-4 hover:shadow-sm"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <MapPin className="h-4 w-4" aria-hidden="true" style={{ color: primaryColor }} />
                  {sede.nombre}
                </span>
                <span className="text-xs text-gray-500">{unidades} {unidades === 1 ? 'producto' : 'productos'} →</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (cartItems.length === 0) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <ShoppingBag className="h-20 w-20 mx-auto text-gray-300 mb-6" />
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Tu carrito está vacío</h1>
        <p className="text-gray-600 mb-8">Agrega productos para comenzar tu compra</p>
        <Link href={conPrefijo('/productos', prefijoSede)}>
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
      icon: isWompi ? (
        <IconoPasarela tono="verde" />
      ) : MERCADOPAGO_CODES.has(m.code) ? (
        <IconoPasarela tono="azul" />
      ) : BOLD_CODES.has(m.code) ? (
        <IconoPasarela tono="rojo" />
      ) : (
        <span className="text-xl">{m.icon || METHOD_ICONS[m.code] || '💰'}</span>
      ),
      label: m.name,
      description: m.description || null,
      isWompi,
    }
  })

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Validación para one-page: permitir submit solo si tiene datos requeridos
  // Horario de la sede (restaurante): misma regla que /api/orders. Con la sede cerrada hay que
  // programar, y programar exige una hora. Sin horario, o fuera de restaurante, no bloquea nada.
  const horarioPedido = isRestaurant && orderType !== 'dine_in' ? sedePedido?.horario ?? null : null
  // «Comer aquí» exige mesa: la del QR o la que escriba el cliente.
  const mesaFaltante = orderType === 'dine_in' && !mesa && !mesaManual.trim()
  const momentoBloqueado = horarioPedido
    ? (isScheduled ? !scheduledAt : !validarMomentoPedido(horarioPedido, sedePedido?.zona, null).ok)
    : false

  const canSubmitOnePage = customerData.firstName && customerData.email && customerData.phone &&
    !!customerData.countryCode &&
    (isRestaurant && orderType !== 'delivery' ? true : !!customerData.address) &&
    !momentoBloqueado && !mesaFaltante

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
      {conversionManda(settings, 'checkout') ? (
        <div className="mb-6">
          <ContadoresDe settings={settings} ubicacion="checkout" primaryColor={primaryColor} variante="inline" />
        </div>
      ) : settings.countdownConfig ? (
        <ContadorColumnas
          settings={{ ...settings.countdownConfig, checkout_show_countdown: settings.showCountdown === true }}
          columna="checkout_show_countdown"
          primaryColor={primaryColor}
          variant="inline"
          envoltorio="mb-6"
        />
      ) : null}

      {/* Sede del pedido (restaurante): «Pides en Sede Norte · Cambiar sede» */}
      {isRestaurant && sedePedido && (
        <div className="mb-6 rounded-xl border bg-white px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <MapPin className="h-4 w-4 flex-shrink-0" aria-hidden="true" style={{ color: primaryColor }} />
            <span className="text-gray-700">Pides en <strong className="text-gray-900">{sedePedido.nombre}</strong></span>
            {sedePedido.direccion && <span className="text-gray-500">· {sedePedido.direccion}</span>}
            {/* «Cambiar sede»: el SelectorSede de C (avisa que el carrito de esta sede queda guardado). */}
            <SelectorSede
              sedes={sedesSelector}
              actualId={sedeActualId}
              subdomain={organizationSubdomain || ''}
              primaryColor={primaryColor}
              prefijoActual={prefijoSede}
              apariencia="enlace"
              className="ml-auto"
            />
          </div>
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
                          <AvisoStockLinea
                            activo={!!settings.showStockWarning}
                            stock={item.stock}
                            umbral={settings.conversion?.urgencia?.stockBajo?.activo ? settings.conversion.urgencia.stockBajo.umbral : (settings.stockWarningThreshold ?? 5)}
                            plantilla={settings.conversion?.urgencia?.stockBajo?.plantilla || settings.stockWarningTemplate || 'Quedan {n}'}
                          />
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

                {/* Comer aquí: mesa del QR, con salida «No estoy en la mesa» */}
                {orderType === 'dine_in' && mesa && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg p-3 text-sm"
                    style={{ backgroundColor: `${primaryColor}10`, color: primaryColor }}
                    role="status"
                  >
                    <span aria-hidden="true">🍽️</span>
                    <span>
                      Pides en la <strong>{etiquetaMesa(mesa.nombre)}</strong>
                      {mesa.zona ? ` · ${mesa.zona}` : ''}
                      {mesa.nombreSede ? ` · ${mesa.nombreSede}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        limpiarMesa(organizationSubdomain || '')
                        setMesa(null)
                        setOrderType(defaultOrderType)
                      }}
                      className="ml-auto text-xs font-medium underline underline-offset-2 text-gray-600 hover:text-gray-900"
                    >
                      No estoy en la mesa
                    </button>
                  </div>
                )}

                {/* Tipo de pedido: se muestra si hay más de 1 opción */}
                {opcionesEntrega > 1 && (
                  <div className="mt-6 space-y-5 border-t pt-5">
                    <OrderTypeSelector
                      value={orderType}
                      onChange={setOrderType}
                      primaryColor={primaryColor}
                      enableDelivery={hasDelivery}
                      enablePickup={hasPickup}
                      enableDineIn={hasDineIn}
                      opcionesDomicilio={opcionesDomicilio}
                      grupoDomicilio={grupoEnvio}
                      onGrupoDomicilio={setGrupoEnvio}
                    />
                    {orderType === 'dine_in' && !mesa && (
                      <div>
                        <label htmlFor="checkout-mesa" className="block text-sm font-medium text-gray-700 mb-1">
                          Número de mesa <span className="text-red-400">*</span>
                        </label>
                        <Input
                          id="checkout-mesa"
                          value={mesaManual}
                          onChange={(e) => setMesaManual(e.target.value)}
                          placeholder="Ej.: 4 o Mesa 4"
                          maxLength={20}
                          aria-describedby="checkout-mesa-ayuda"
                        />
                        <p id="checkout-mesa-ayuda" className="text-xs text-gray-500 mt-1">
                          El número que ves en tu mesa. Lo confirmamos antes de enviarlo a cocina.
                        </p>
                      </div>
                    )}
                    {isRestaurant && orderType !== 'dine_in' && (
                      <ScheduleSelector
                        isScheduled={isScheduled}
                        scheduledAt={scheduledAt}
                        onScheduledChange={setIsScheduled}
                        onTimeChange={setScheduledAt}
                        primaryColor={primaryColor}
                        horario={horarioPedido}
                        zona={sedePedido?.zona}
                        verbo={orderType === 'delivery' ? 'recibes' : orderType === 'pickup' ? 'recoges' : 'quieres'}
                      />
                    )}
                  </div>
                )}
                {/* Solo restaurant: programar pedido (cuando solo hay 1 tipo de entrega) */}
                {isRestaurant && !(opcionesEntrega > 1) && orderType !== 'dine_in' && (
                  <div className="mt-6 space-y-5 border-t pt-5">
                    <ScheduleSelector
                      isScheduled={isScheduled}
                      scheduledAt={scheduledAt}
                      onScheduledChange={setIsScheduled}
                      onTimeChange={setScheduledAt}
                      primaryColor={primaryColor}
                      horario={horarioPedido}
                      zona={sedePedido?.zona}
                      verbo={orderType === 'delivery' ? 'recibes' : orderType === 'pickup' ? 'recoges' : 'quieres'}
                    />
                  </div>
                )}

                {!isOnePage && paymentError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm whitespace-pre-line" role="alert">
                    {paymentError}
                  </div>
                )}

                {!isOnePage && (
                  <Button
                    className="w-full mt-6"
                    style={{ backgroundColor: primaryColor }}
                    onClick={() => setStep(2)}
                    disabled={momentoBloqueado || mesaFaltante}
                  >
                    {mesaFaltante ? 'Indica tu mesa' : momentoBloqueado ? 'Elige la hora del pedido' : 'Continuar'}
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

                      {/* Domicilio por zona (Figma 2830:75378 y 2830:75453): barrio, zona y envío gratis */}
                      {orderType === 'delivery' && grupoEnvio === 'own' && cotZona && (
                        <div className="space-y-3">
                          <div>
                            <label htmlFor="checkout-barrio" className="block text-sm font-medium text-gray-700 mb-1">Barrio</label>
                            <Input
                              id="checkout-barrio"
                              value={customerData.barrio}
                              onChange={(e) => setCustomerData({ ...customerData, barrio: e.target.value })}
                              placeholder="Chapinero"
                              autoComplete="address-level3"
                            />
                          </div>
                          {envioZona && !envioZona.ok && (
                            <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                              {bloqueoZona}
                            </div>
                          )}
                          {envioZona?.ok && envioZona.fueraDeZona && (
                            <div role="status" className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                              <p className="font-medium text-gray-900">Tu dirección está fuera de nuestras zonas de domicilio</p>
                              <p className="mt-0.5">Puedes pagar la tarifa general de domicilio ({fmtPrice(envioZona.costo)}){gruposDomicilio.includes('third_party') ? ' o elegir transportadora' : ''}.</p>
                            </div>
                          )}
                          {barraGratis && (
                            <div aria-live="polite">
                              <div className="flex items-center justify-between text-sm text-gray-700">
                                <span>Te faltan {fmtPrice(barraGratis.falta)} para envío gratis</span>
                                <span className="text-xs text-gray-500">{barraGratis.porcentaje} %</span>
                              </div>
                              <div
                                className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-200"
                                role="progressbar"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={barraGratis.porcentaje}
                                aria-label="Progreso hacia el envío gratis"
                              >
                                <div className="h-full rounded-full" style={{ width: `${barraGratis.porcentaje}%`, backgroundColor: primaryColor }} />
                              </div>
                              <p className="mt-1 text-xs text-gray-500">Envío gratis desde {fmtPrice(barraGratis.desde)} en tu zona.</p>
                            </div>
                          )}
                          {envioZona?.ok && envioZona.fueraDeZona && (
                            <p className="text-xs text-gray-500">El envío gratis solo aplica dentro de las zonas de domicilio.</p>
                          )}
                        </div>
                      )}

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
                      {/* Más de una tarifa en el domicilio elegido: el cliente escoge (con una, se usa sola). */}
                      {tarifasGrupo.length > 1 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Método de envío</label>
                          <div className="space-y-2">
                            {tarifasGrupo.map((rate) => (
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
                                      {textoDias([rate.dias]) && ` · ${textoDias([rate.dias])}`}
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
                    <div key={method.id}>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod(method.id)}
                      aria-disabled={method.id === 'cash' && !!ce.estado && !ce.estado.disponible}
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
                    {/* Contraentrega con condiciones: motivo si no aplica, desglose y pasarela del anticipo si sí. */}
                    {method.id === 'cash' && ce.estado && (
                      !ce.estado.disponible
                        ? <MotivoContraentrega estado={ce.estado} fmt={fmtPrice} hrefSeguirComprando={conPrefijo('/productos', prefijoSede)} hrefIngresar={isAuthenticated ? null : conPrefijo('/cuenta', prefijoSede)} ciudad={customerData.city} onCambiarDireccion={cambiarDireccionContraentrega} onQuitar={quitarNoAplican} />
                        : paymentMethod === 'cash' && (
                          <DetalleContraentrega estado={ce.estado} total={total} fmt={fmtPrice} pasarela={ce.pasarela} onPasarela={ce.setPasarela} color={primaryColor} />
                        )
                    )}
                    </div>
                  ))}
                </div>

                {paymentError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm whitespace-pre-line" role="alert">
                    {paymentError}
                  </div>
                )}

                {isOnePage ? (
                  <Button
                    type="button"
                    className="w-full mt-6"
                    style={{ backgroundColor: primaryColor }}
                    onClick={() => handleSubmit()}
                    disabled={submitting || !canSubmitOnePage || ceBloqueada}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      textoPagar
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
                      disabled={submitting || ceBloqueada}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        textoPagar
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
                    {orderType === 'delivery' ? (etiquetaDomicilio === 'Transportadora' ? '📦 Transportadora' : '🛵 Domicilio') : orderType === 'pickup' ? '🏪 Recoger' : '🍽️ Comer aquí'}
                    {isScheduled && scheduledAt && (
                      <span className="text-gray-500 ml-auto">
                        {sedePedido
                          ? momentoPedido(scheduledAt, sedePedido.zona)
                          : new Date(scheduledAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                    )}
                  </div>
                )}

                {cartItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <div className="text-gray-600 flex-1 min-w-0">
                      <span className="truncate block">
                        {item.name} x{item.quantity}
                      </span>
                      <PromoDeLinea promos={promotionsForItem(appliedPromotions, item.id)} pista={promoVolumeHints?.[String(item.id)] ?? null} fmt={fmtPrice} />
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
                    <span className="text-gray-600">{appliedPromotions.length > 0 ? 'Subtotal (precio normal)' : 'Subtotal'}</span>
                    <span>{fmtPrice(subtotal)}</span>
                  </div>
                  {tax > 0 && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-600">{etiquetaImpuesto}</span>
                      <span>{fmtPrice(tax)}</span>
                    </div>
                  )}
                  {impuestoIncluido > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      {impuestoVisto.resumen.nombre} incluido en el precio: {fmtPrice(impuestoIncluido)}
                    </p>
                  )}
                  {needsShipping && (settings.enableShipping || !!envioZona) && (
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
                  {/* «Descuentos por promoción» con su desglose (Figma S7/S8; components/site/checkout/PromocionesResumen.tsx) */}
                  <DescuentosPorPromocion promotions={appliedPromotions} totalDiscount={promoDiscount} fmt={fmtPrice} />
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
                  {/* Contraentrega con anticipo (08): lo de hoy y lo de la puerta. Sin anticipo no pinta nada. */}
                  {paymentMethod === 'cash' && <ResumenPagoContraentrega estado={ce.estado} fmt={fmtPrice} />}
                  {(promoDiscount + couponDiscount) > 0 && (
                    <p className="text-xs text-green-600 text-right mt-1">
                      Estás ahorrando <strong>{fmtPrice(promoDiscount + couponDiscount)}</strong>
                    </p>
                  )}
                </div>

                {needsShipping && !envioZona && settings.enableShipping && shipping === 0 && settings.freeShippingThreshold > 0 && (
                  <p className="text-xs text-green-600 text-center mt-2">
                    {(promoDiscount + couponDiscount) > 0
                      ? `Envío gratis: tus productos suman más de ${fmtPrice(settings.freeShippingThreshold)}, ya con los descuentos.`
                      : `¡Envío gratis por compras mayores a ${fmtPrice(settings.freeShippingThreshold)}!`}
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
              {paymentMethod === 'cash' && <ResumenPagoContraentrega estado={ce.estado} fmt={fmtPrice} compacto />}
              {promoDiscount > 0 && (
                <span className="block text-xs text-green-600">Ahorras {fmtPrice(promoDiscount)} en promociones</span>
              )}
            </div>
            <Button
              type="button"
              className="px-8 h-11 font-semibold"
              style={{ backgroundColor: primaryColor }}
              onClick={() => handleSubmit()}
              disabled={submitting || !canSubmitOnePage || ceBloqueada}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                textoPagar
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
