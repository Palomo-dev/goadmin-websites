'use client'

import { filtrarMetodosPorSede } from '@/lib/payments/metodosPorSucursal'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { alTocarIngresarCheckout } from '@/components/site/cuenta/eventos'
import { mezclarDatosCuenta } from './checkout/sesionCheckout'
import { quitarLineaCarrito } from '@/lib/carrito/cantidadLinea'
import { textoCobroEnBase } from './checkout/cobroEnBase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowRight, ShoppingBag, Loader2, MapPin, ChevronDown, AlertTriangle, Lock, Plus, User, UtensilsCrossed } from 'lucide-react'
import Link from '@/components/site/Enlace'
import { type OrderType, type OpcionDomicilio } from '@/components/site/OrderTypeSelector'
import { gruposActivos, resumenDomicilio, tarifasDelGrupo, textoDias, type GrupoEnvio } from '@/lib/shipping/opcionesDomicilio'
import { barraEnvioGratis, detalleZona, envioDeZona, llegadaZona, type CotizacionPublica } from '@/lib/shipping/domicilioZonas'
import { descripcionEnvioPropia, tiempoConfiguradoTexto, tiempoEntregaCheckout, type TiemposEntregaTienda } from '@/lib/shipping/tiempoEntrega'
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
import { TelefonoPais } from './TelefonoPais'
import { formatearTelefono, paisIsoDeOrganizacion } from '@/lib/utils/telefono'
import { useCurrency } from './CurrencyProvider'
import { getCartKey } from '@/lib/utils'
import { useCartPromotions, promotionsForItem, promotionBadgeLabel } from '@/lib/hooks/useCartPromotions'
import { subtotalParaEnvioGratis } from '@/lib/shipping/envioGratisDescontado'
import { DescuentosPorPromocion, PromoDeLinea } from './checkout/PromocionesResumen'
import { sedeDePedidoWeb } from '@/lib/orders/pedidoWeb'
import { trackMetaPurchase } from '@/components/site/MetaPixelEvents'
import { abrirBoldDesdeUrl, cargarLibreriaBold } from '@/lib/payments/boldCheckoutCliente'
import { aplicarPreciosNuevos, esCuponNoValido, mensajeErrorPedido, mensajePreciosCambiados, preciosCambiados } from '@/lib/checkout/respuesta-pedido'
import { DetalleContraentrega, MotivoContraentrega, ResumenPagoContraentrega, lineaOpcionContraentrega, textoBotonAnticipo, useContraentrega } from '@/components/site/contraentrega/OpcionContraentrega'
import { textoMedios, textoMotivo } from '@/lib/contraentrega/textosContraentrega'
import { BarraPagoMovil } from './checkout/BarraPagoMovil'
import { BarraPagoComputador } from './checkout/BarraPagoComputador'
import { contenidoBarraPago, contenidoBarraPagoComputador, motivoBarraApagada, normalizarEstiloBarraPago, type CasoBarraPago, type EstiloBarraPago } from './checkout/barraPago'
import { descripcionMetodo, iconoMetodo, metodoDeRespaldo, metodoDeTraspaso, metodoPreseleccionado, nombrePasarelaMetodo, type TipoEntregaResumen } from './checkout/resumenPago'
import { ChipEntregaResumen, MediosPagoAceptados, SellosConfianza } from './checkout/ResumenPagoPiezas'
import { TarjetaMetodoPago } from './checkout/TarjetaMetodoPago'
// Checkout v2 (Figma «16 Sitio web» › Checkout v2 3117-87133, aprobado 2026-11-24): piezas extraídas
// y reglas puras (components/site/checkout/*; scripts/verify-checkout-v2.mjs).
import { PasosCheckout } from './checkout/PasosCheckout'
import { CampoCheckout, CasillaCheckout, ErrorDeCampo, ResumenErrores, TarjetaCheckout, TarjetaNumerada, idCampo } from './checkout/CampoCheckout'
import { OpcionesEntrega, AvisoCostoEnvio } from './checkout/OpcionesEntrega'
import { ResumenPedido, type LineaResumen } from './checkout/ResumenPedido'
import { RevisarPedido, PagoRechazado, CuponCheckout, type FilaRevisar } from './checkout/RevisarPedido'
import { FacturaEmpresaCampos } from './checkout/FacturaEmpresaCampos'
import { MunicipioBuscador } from './checkout/MunicipioBuscador'
import { DireccionesGuardadas } from './checkout/DireccionesGuardadas'
import { camposDelCheckout, campo as campoDe } from './checkout/camposCheckout'
import { documentoFactura, erroresFactura, FACTURA_VACIA, facturaParaPedido, notasConFactura, type DatosFactura } from './checkout/facturaEmpresa'
import { facturaParaGuardar, leerPerfilFactura, mezclarFacturaPerfil } from './checkout/facturaPerfil'
import {
  CAMPOS_CONTACTO,
  CAMPOS_ENTREGA,
  cobraEnLinea,
  direccionConComplemento,
  errorDe,
  partirNombre,
  pasoDeUrl,
  pasoPermitido,
  seccionCompleta,
  textoBotonPago,
  unirNombre,
  urlConPaso,
  validarDatosCheckout,
  type CampoValidado,
  type NumeroPaso,
} from './checkout/reglasCheckout'
import { admiteReintento, carritoAlVolver, guardarPedidoPendiente, leerPedidoPendiente, numeroPedidoValido } from './checkout/pedidoPendiente'

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
  /** Tiempos guardados en «Pedidos online» del ERP (lib/shipping/tiempoEntrega.ts); null sin fila. */
  tiemposEntrega?: TiemposEntregaTienda | null
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
  /** Estilo de la barra fija del pago en celular (ERP › Ventas en línea › Checkout). Sin valor: C. */
  barraPagoMovil?: EstiloBarraPago | null
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

// Bold: 'bold_link' es el método del link de pago (el único de Bold que va en la tienda).
const BOLD_CODES = new Set(['bold', 'bold_link'])

// Ícono de cada método (billetera de la pasarela en su color, billete del efectivo, banco de la
// transferencia): checkout/resumenPago.ts `iconoMetodo` y checkout/TarjetaMetodoPago.tsx.

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

export function CheckoutWizard({ organizationId, primaryColor, paymentMethods: todosLosMetodos, checkoutSettings, isRestaurant = false, organizationSubdomain, branchId, sedePedido = null, sedesSelector = [], sedeActualId = null, sedePorDefectoId = null, prefijoSede = '', rutaSeguirPidiendo }: CheckoutWizardProps) {
  const settings = { ...DEFAULT_SETTINGS, ...checkoutSettings }
  const isOnePage = settings.checkoutMode === 'one_page'
  const { formatPrice: fmtPrice, currency: displayCurrency, baseCurrency, loading } = useCurrency()
  const showCurrencyNotice = !loading && displayCurrency !== baseCurrency && baseCurrency === 'COP'
  const [currencyNoticeDismissed, setCurrencyNoticeDismissed] = useState(false)
  // Paso del checkout v2: 1 «Datos y entrega», 2 «Pago», 3 «Revisar y confirmar» (el carrito ya no
  // es un paso: queda en su página). Va en la URL (?paso=) para que el «atrás» del teléfono funcione.
  const [step, setStep] = useState<NumeroPaso>(1)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ cart: true, customer: true, delivery: true, payment: true })
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
  // Método que pidió el chat al mandar al checkout (?metodo=<código>). null = como hoy. Se olvida
  // en cuanto el cliente elige otro método a mano.
  const [metodoPedido, setMetodoPedido] = useState<string | null>(null)
  const elegirMetodo = (codigo: string) => {
    setMetodoPedido(null)
    setPaymentMethod(codigo)
  }
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

  // Checkout v2: «Nombre y apellido» en un campo (se parte en firstName/lastName al escribir, que es
  // lo que viaja a /api/orders como siempre), complemento de la dirección, factura a nombre de
  // empresa y lo que necesita la validación por campo.
  const camposCheckout = useMemo(() => camposDelCheckout(null), [])
  const [nombreCompleto, setNombreCompleto] = useState('')
  const [complemento, setComplemento] = useState('')
  const [factura, setFactura] = useState<DatosFactura>(FACTURA_VACIA)
  const [notasAbiertas, setNotasAbiertas] = useState(false)
  const [mostrarErrores, setMostrarErrores] = useState(false)
  const [tocados, setTocados] = useState<Partial<Record<CampoValidado, boolean>>>({})
  const tocar = (c: CampoValidado) => setTocados((t) => (t[c] ? t : { ...t, [c]: true }))
  const [usandoOtraDireccion, setUsandoOtraDireccion] = useState(false)
  // Celular: el resumen del pedido va plegado arriba («Ver resumen»); en computador, siempre a la derecha.
  const [resumenAbierto, setResumenAbierto] = useState(false)
  const [cotizandoZona, setCotizandoZona] = useState(false)
  // Pago rechazado: el MISMO pedido pendiente que se puede volver a cobrar (lo confirma el servidor).
  const [reintento, setReintento] = useState<{ orderNumber: string; gateway: string; total: number; trackingToken: string | null } | null>(null)
  const [reintentando, setReintentando] = useState<string | null>(null)
  const [errorReintento, setErrorReintento] = useState<string | null>(null)

  // Lo que llega de fuera (navegador, sesión, chat) a firstName/lastName se pinta en el campo único.
  useEffect(() => {
    const actual = partirNombre(nombreCompleto)
    if (actual.firstName !== (customerData.firstName || '').trim() || actual.lastName !== (customerData.lastName || '').trim()) {
      setNombreCompleto(unirNombre(customerData.firstName, customerData.lastName))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerData.firstName, customerData.lastName])
  const cambiarNombre = (texto: string) => {
    setNombreCompleto(texto)
    const { firstName, lastName } = partirNombre(texto)
    setCustomerData((prev) => ({ ...prev, firstName, lastName }))
  }

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

  // Documento de la factura en este navegador, como nombre, correo y dirección: la próxima compra
  // no lo pide otra vez. Solo llena lo vacío (mezclarFacturaPerfil) y la casilla no se marca sola.
  const facturaStorageKey = `checkout_factura_${organizationSubdomain}`
  useEffect(() => {
    try {
      const guardada = leerPerfilFactura(JSON.parse(localStorage.getItem(facturaStorageKey) || 'null'))
      if (guardada) {
        setFactura((f) => mezclarFacturaPerfil(f, guardada))
      } else {
        // Sin documento guardado: la factura queda como esté (lo de siempre).
      }
    } catch {}
  }, [facturaStorageKey])

  useEffect(() => {
    const aGuardar = facturaParaGuardar(factura)
    if (aGuardar) {
      try {
        localStorage.setItem(facturaStorageKey, JSON.stringify(aGuardar))
      } catch {}
    } else {
      // Sin número escrito no se guarda nada (no se borra lo guardado antes).
    }
  }, [factura, facturaStorageKey])

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
      const metodoParam = urlParams.get('metodo')
      let metodoEnCliente: unknown = null
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
            // `metodo` dentro de `customer` (si el chat lo manda ahí) no es un dato del cliente.
            const { metodo, ...datosCliente } = customerFromUrl as Record<string, unknown>
            metodoEnCliente = metodo
            setCustomerData(prev => ({ ...prev, ...datosCliente }))
            localStorage.setItem(`checkout_customer_${subdomain}`, JSON.stringify(datosCliente))
          }
        } catch {}
      }
      // Método que pidió el chat («contraentrega» → cash): se preselecciona si aplica (efecto de abajo).
      const metodoChat = metodoDeTraspaso(metodoParam, metodoEnCliente)
      if (metodoChat) {
        setMetodoPedido(metodoChat)
      } else {
        // Sin método en el traspaso: el primero, como hoy.
      }
      // Paso del checkout en la URL (?paso=pago): se respeta si los datos lo permiten (pasoPermitido
      // al pintar). Sin parámetro, el primero, como hoy.
      const pasoUrl = pasoDeUrl(urlParams.get('paso'))
      if (pasoUrl) setStep(pasoUrl)
      // Limpiar query params de la URL sin recargar (se conservan solo el paso y el pedido pendiente)
      if (cartParam || customerParam || metodoParam) {
        const conservar = new URLSearchParams()
        for (const k of ['paso', 'pedido']) {
          const v = urlParams.get(k)
          if (v) conservar.set(k, v)
        }
        const cleanUrl = conservar.toString() ? `${window.location.pathname}?${conservar.toString()}` : window.location.pathname
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


  // Precargar datos del usuario autenticado via API server-side. `trasIngreso`: el cliente acaba de
  // entrar desde la ventana de acceso sin salir del pago; lo que ya escribió se respeta y la cuenta
  // llena lo vacío (mezclarDatosCuenta). Al abrir el checkout con sesión, lo de siempre.
  const autenticadoRef = useRef(false)
  const cargarDatosCuenta = useCallback(async (trasIngreso: boolean) => {
    try {
      const res = await fetch(`/api/customer/me?organizationId=${organizationId}`)
      if (!res.ok) return
      const data = await res.json()
      if (!data.authenticated) return

      autenticadoRef.current = true
      setIsAuthenticated(true)
      if (data.customerId) setCustomerId(data.customerId)

      const direcciones = Array.isArray(data.addresses) && data.addresses.length > 0 ? data.addresses : null
      setCustomerData((prev: any) => mezclarDatosCuenta(prev, data, direcciones, trasIngreso))
      // Documento y datos de factura de la cuenta: solo llenan lo vacío; la casilla no se marca sola.
      const perfilFactura = leerPerfilFactura(data.factura)
      if (perfilFactura) {
        setFactura((f) => mezclarFacturaPerfil(f, perfilFactura))
      } else {
        // La cuenta no tiene documento: la factura queda como esté.
      }
      if (direcciones) setSavedAddresses(direcciones)
    } catch (err) {
      console.error('Error loading auth data:', err)
    }
  }, [organizationId])

  useEffect(() => {
    void cargarDatosCuenta(false)
  }, [cargarDatosCuenta])

  // Entró desde la ventana de acceso (AccesoCuenta, sin recargar): se piden los datos de la cuenta
  // otra vez para llenar nombre, correo, celular y direcciones guardadas. Con sesión desde el
  // principio, no hace nada (ya se cargaron arriba).
  useEffect(() => {
    const { data } = createClient().auth.onAuthStateChange((evento) => {
      if (evento !== 'SIGNED_IN' || autenticadoRef.current) return
      void cargarDatosCuenta(true)
    })
    return () => data.subscription.unsubscribe()
  }, [cargarDatosCuenta])

  // «Atrás» y «adelante» del navegador entre pasos (?paso=).
  useEffect(() => {
    const alVolver = () => setStep(pasoDeUrl(new URLSearchParams(window.location.search).get('paso')) ?? 1)
    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
  }, [])

  // Vuelta de la pasarela con el pago no aprobado (/checkout?pedido=WO-…&paso=revisar, desde
  // /checkout/resultado). Lo decide el SERVIDOR: solo con el pedido pendiente y el pago rechazado o
  // sin pagar se ofrece reintentar el MISMO pedido; si no, el checkout de siempre.
  useEffect(() => {
    const numero = numeroPedidoValido(new URLSearchParams(window.location.search).get('pedido'))
    if (!numero) return
    let vivo = true
    ;(async () => {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(numero)}/tracking?ligero=1`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const o = data?.order
        if (!vivo || !o || o.orderNumber !== numero || !admiteReintento({ status: o.status, paymentStatus: o.paymentStatus })) return
        const subdomain = organizationSubdomain || ''
        const copia = leerPedidoPendiente(window.localStorage, subdomain, numero, Date.now())
        // El carrito vuelve si está vacío (para «Editar carrito» u otro pedido); nunca pisa uno nuevo.
        if (copia) {
          let actual: unknown[] | null = null
          try {
            actual = JSON.parse(localStorage.getItem(copia.cartKey) || 'null')
          } catch {
            actual = null
          }
          const devolver = carritoAlVolver(Array.isArray(actual) ? actual : null, copia.carrito)
          if (devolver && copia.cartKey === getCartKey(subdomain, branchId)) {
            localStorage.setItem(copia.cartKey, JSON.stringify(devolver))
            setCartItems(devolver as CartItem[])
            window.dispatchEvent(new CustomEvent('cart-updated'))
          } else {
            // El cliente ya armó otro carrito (o es de otra sede): se respeta.
          }
        }
        setReintento({
          orderNumber: numero,
          gateway: copia?.gateway ?? (typeof o.paymentMethod === 'string' ? o.paymentMethod : ''),
          total: Number(o.total) || 0,
          trackingToken: copia?.trackingToken ?? null,
        })
        setStep(3)
      } catch {
        // Sin conexión o pedido ajeno: el checkout de siempre.
      }
    })()
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const removeItem = (id: number | string) => {
    setCartItems(items => {
      const updated = quitarLineaCarrito(items, id)
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
  // Método pedido por el chat: se elige si está activo en la tienda web y aplica a este pedido
  // (contraentrega fuera de zona o bajo el mínimo no se fuerza: queda el primero disponible y la
  // opción muestra su motivo). Sin método pedido, no hace nada (lo de hoy).
  const disponibleCe = ce.estado ? ce.estado.disponible : null
  useEffect(() => {
    if (!metodoPedido) return
    const activos = availableMethods.map((m) => m.code)
    const elegido = metodoPreseleccionado(metodoPedido, activos, metodoPedido === 'cash' ? disponibleCe : null)
    if (elegido) {
      if (paymentMethod !== elegido) setPaymentMethod(elegido)
    } else if (paymentMethod === metodoPedido) {
      const respaldo = metodoDeRespaldo(metodoPedido, activos)
      if (respaldo) setPaymentMethod(respaldo)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metodoPedido, availableMethods, disponibleCe])
  // Efectivo SIN condiciones de contraentrega (dueño, 2026-11-24): no se cobra nada en línea, así
  // que el botón dice «Confirmar pedido» (antes «Pagar $ X»). Con condiciones, lo decide
  // textoBotonAnticipo; los demás métodos, como siempre.
  const efectivoSinCondiciones = paymentMethod === 'cash' && !ce.estado?.disponible
  // Checkout v2: la regla del botón vive en textoBotonPago (reglasCheckout.ts, con pruebas). Efectivo:
  // la de hoy; pasarela: «Pagar $ X»; transferencia y lo que no cobra en línea: «Confirmar pedido».
  const metodoElegido = availableMethods.find((m) => m.code === paymentMethod) ?? null
  const entradaBoton = {
    codigo: paymentMethod,
    tipo: metodoElegido?.type ?? null,
    textoAnticipo: paymentMethod === 'cash' ? textoBotonAnticipo(ce.estado, ce.pasarela, fmtPrice) : null,
    total: fmtPrice(total),
  }
  const textoPagar = textoBotonPago(entradaBoton)
  const pagoEnLinea = cobraEnLinea(entradaBoton)
  // Barra fija del pago en celular (Figma 3059:80757): el caso de hoy en el estilo de la tienda.
  const ceDisponible = paymentMethod === 'cash' && ce.estado?.disponible ? ce.estado : null
  const casoBarra: CasoBarraPago = ceDisponible?.anticipo
    ? {
        tipo: 'anticipo',
        total: fmtPrice(total),
        hoy: fmtPrice(ceDisponible.anticipo.monto),
        alRecibir: fmtPrice(ceDisponible.alRecibir),
        pasarela: ceDisponible.pasarelas.find((p) => p.codigo === ce.pasarela)?.nombre ?? (ce.pasarela ? nombrePasarelaMetodo(ce.pasarela) : null),
      }
    : ceDisponible
      ? { tipo: 'sin_anticipo', total: fmtPrice(total), alRecibir: fmtPrice(ceDisponible.alRecibir), medios: textoMedios(ceDisponible.medios) }
      : efectivoSinCondiciones
        ? { tipo: 'sin_anticipo', total: fmtPrice(total), alRecibir: fmtPrice(total), medios: 'efectivo' }
        : metodoElegido && metodoElegido.type !== 'gateway'
          ? {
            // Transferencia u otro que no cobra en línea: «Confirmar pedido» (checkout v2).
            tipo: 'confirmar',
            total: fmtPrice(total),
            productos: cartItems.reduce((n, i) => n + i.quantity, 0),
            envio: orderType === 'delivery' ? (shipping > 0 ? 'incluido' : 'gratis') : null,
            medio: paymentMethod === 'transfer' ? 'transferencia' : metodoElegido.name.toLowerCase(),
          }
          : {
          tipo: 'pago',
          total: fmtPrice(total),
          productos: cartItems.reduce((n, i) => n + i.quantity, 0),
          envio: orderType === 'delivery' ? (shipping > 0 ? 'incluido' : 'gratis') : null,
          pasarela: metodoElegido?.type === 'gateway' ? nombrePasarelaMetodo(metodoElegido.code) : null,
          ahorro: promoDiscount > 0 ? fmtPrice(promoDiscount) : null,
        }
  const contenidoBarra = contenidoBarraPago(normalizarEstiloBarraPago(settings.barraPagoMovil), casoBarra)
  // Alto real de la barra del celular (con el área segura) para el espaciador; 0 en computador.
  const [altoBarraMovil, setAltoBarraMovil] = useState(0)
  const ponerAltoBarra = useCallback((alto: number) => setAltoBarraMovil(alto), [])
  // Barra fija del pago en computador (Figma 3214:110908): el mismo caso y el mismo estilo de la
  // tienda; a la izquierda el resumen corto (antes: total, «Se cobra en COP», contraentrega y ahorro).
  const contenidoBarraComputador = contenidoBarraPagoComputador(normalizarEstiloBarraPago(settings.barraPagoMovil), casoBarra, {
    productos: cartItems.reduce((n, i) => n + i.quantity, 0),
    envio: orderType === 'delivery' ? (shipping > 0 ? 'incluido' : 'gratis') : null,
    ahorro: promoDiscount > 0 ? fmtPrice(promoDiscount) : null,
    cobroEnBase: textoCobroEnBase(total, baseCurrency, displayCurrency, loading),
  })
  // Botón apagado: solo el motivo que el checkout YA conoce (contraentrega que no aplica, el mismo
  // texto de la tarjeta). Sin motivo, solo el botón apagado, como antes.
  const motivoCe = ceBloqueada && ce.estado?.motivos[0] ? textoMotivo(ce.estado.motivos[0], fmtPrice, customerData.city).texto : null
  const motivoBarra = motivoBarraApagada(submitting || ceBloqueada, submitting, motivoCe)
  // «Ir al campo»: la tarjeta de contraentrega, donde están el motivo y sus acciones.
  const irAlMotivo = () => {
    const tarjeta = document.querySelector<HTMLElement>('[data-metodo-pago="cash"]')
    if (!tarjeta) return
    tarjeta.scrollIntoView({ behavior: 'smooth', block: 'center' })
    tarjeta.querySelector<HTMLElement>('[role="radio"]')?.focus({ preventScroll: true })
  }
  // Alto real de la barra de computador para su espaciador (96 px hasta medirla).
  const [altoBarraComputador, setAltoBarraComputador] = useState(96)
  const ponerAltoBarraComputador = useCallback((alto: number) => setAltoBarraComputador(alto), [])
  // «Detalle» de la barra: abre el resumen (plegado en celular) y baja hasta él.
  const irAlResumen = () => {
    setResumenAbierto(true)
    setTimeout(() => document.getElementById('resumen-pedido')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }
  // Acciones de la opción apagada (pantalla 09 E y F): solo existen con condiciones en la sede.
  const quitarNoAplican = (productIds: number[]) => {
    const ids = new Set(productIds)
    cartItems.filter((item) => ids.has(Number(idProductoCarrito(item)))).forEach((item) => removeItem(item.id))
  }
  // Ir a un paso (3 pasos): el paso queda en la URL con su historial y la pantalla sube al inicio.
  const irAPaso = (paso: NumeroPaso) => {
    setStep(paso)
    try {
      window.history.pushState({ paso }, '', urlConPaso(window.location.pathname, window.location.search, paso))
    } catch {
      // Sin historial (vista previa incrustada): solo cambia el paso.
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const enfocarDireccion = () => {
    setTimeout(() => {
      const campo = document.getElementById(idCampo('direccion')) as HTMLInputElement | null
      if (campo) {
        campo.scrollIntoView({ behavior: 'smooth', block: 'center' })
        campo.focus()
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }, 0)
  }
  const cambiarDireccionContraentrega = () => {
    setUsandoOtraDireccion(true)
    if (isOnePage) {
      setOpenSections((prev) => ({ ...prev, customer: true }))
      enfocarDireccion()
    } else {
      irAPaso(1)
      enfocarDireccion()
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
      setCotizandoZona(false)
      return
    }
    let vigente = true
    // «Calculando el envío…» mientras cotiza (checkout v2, C7b). Solo pinta.
    setCotizandoZona(true)
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
      } finally {
        if (vigente) setCotizandoZona(false)
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
        // Con zona, la zona decide sola (tiempoEntregaCheckout): lo de hoy.
        tiempo: tiempoEntregaCheckout({ conZona: true, zona: e.ok ? llegadaZona(cotZona, fechaCorta) : null, tarifas: null, configurado: null }),
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
      // Días de las tarifas web (lo de hoy); sin ellos, el tiempo de «Pedidos online» que guardó la
      // tienda; sin ninguno, sin tiempo (nunca uno inventado). Una sola regla para tarjeta, aviso y resumen.
      tiempo: tiempoEntregaCheckout({ conZona: false, zona: null, tarifas: r.tiempo, configurado: tiempoConfiguradoTexto(settings.tiemposEntrega, g, sedeMetodos) }),
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

  // Horario de la sede (restaurante): misma regla que /api/orders. Con la sede cerrada hay que
  // programar, y programar exige una hora. Sin horario, o fuera de restaurante, no bloquea nada.
  const horarioPedido = isRestaurant && orderType !== 'dine_in' ? sedePedido?.horario ?? null : null
  // «Comer aquí» exige mesa: la del QR o la que escriba el cliente.
  const mesaFaltante = orderType === 'dine_in' && !mesa && !mesaManual.trim()
  const momentoBloqueado = horarioPedido
    ? (isScheduled ? !scheduledAt : !validarMomentoPedido(horarioPedido, sedePedido?.zona, null).ok)
    : false

  // Checkout v2: UNA validación para 3 pasos y 1 paso (reglasCheckout.ts, con pruebas). Antes el de
  // 1 paso pedía el país y el de 3 no; «Apellido *» no se validaba y «+57» pasaba como teléfono.
  // Recoger en tienda y comer aquí ya no piden dirección.
  const isoTelefono = paisIsoDeOrganizacion(customerData.countryCode) ?? undefined
  const errores = validarDatosCheckout({
    nombreCompleto,
    email: customerData.email,
    phone: customerData.phone,
    address: customerData.address,
    city: customerData.city,
    countryCode: customerData.countryCode,
    factura,
    entrega: orderType,
    mesaFaltante,
    momentoBloqueado,
  }, camposCheckout, isoTelefono)
  const datosCompletos = errores.length === 0
  const verError = (c: CampoValidado) => (mostrarErrores || tocados[c] ? errorDe(errores, c) : null)
  const erroresVisibles = mostrarErrores ? errores : []
  // Lo que viaja a /api/orders: sin complemento ni factura, exactamente lo de hoy (`customerData`).
  const direccionPedido = direccionConComplemento(customerData.address, complemento)
  const clientePedido = { ...customerData, address: direccionPedido, notes: notasConFactura(customerData.notes, factura) }
  // Datos incompletos al pagar: se muestran los errores (con el resumen arriba) y, en 3 pasos, se
  // vuelve a «Datos y entrega». El botón queda siempre activo.
  const mostrarFaltantes = () => {
    setMostrarErrores(true)
    if (!isOnePage) {
      irAPaso(1)
    } else {
      setOpenSections((prev) => ({ ...prev, customer: true, delivery: true }))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    // Fuera de cobertura o bajo el mínimo de la zona: el servidor también lo rechaza (422).
    if (bloqueoZona) {
      setPaymentError(bloqueoZona)
      return
    }
    if (!datosCompletos) {
      // Faltan datos (la misma regla de los botones): no se crea el pedido.
      mostrarFaltantes()
      return
    } else {
      // Datos completos: sigue como siempre.
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
        // `customerData` con la dirección + complemento y la línea de la factura en las notas; sin
        // complemento ni factura es el mismo objeto de siempre.
        customer: clientePedido,
        // Factura electrónica estructurada (además de la línea de las notas): el servidor la valida y
        // la guarda en la ficha del cliente y en el pedido. Sin factura, no viaja (lo de siempre).
        ...(facturaParaPedido(factura) ? { factura: facturaParaPedido(factura) } : {}),
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
          address: direccionPedido,
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
          if (!isOnePage) irAPaso(1)
          setPaymentError(mensajeErrorPedido(orderRes.status, orderData))
        } else if (orderData?.code === 'MESA_INVALIDA') {
          // La mesa guardada ya no vale (otra sede, borrada): se olvida y el cliente elige de nuevo.
          limpiarMesa(organizationSubdomain || '')
          setMesa(null)
          setMesaManual('')
          if (!isOnePage) irAPaso(1)
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
            address_line: direccionPedido,
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
            // Token del pedido: con él la pasarela recibe el documento del comprador (no lo pide otra vez).
            ...(typeof orderData.trackingToken === 'string' ? { t: orderData.trackingToken } : {}),
          }),
        })
        const datosAnticipo = await initAnticipo.json().catch(() => ({}))
        localStorage.removeItem(getCartKey(organizationSubdomain || '', branchId))
        window.dispatchEvent(new CustomEvent('cart-updated'))
        if (initAnticipo.ok && datosAnticipo.checkoutUrl) {
          if (BOLD_CODES.has(orderData.anticipo.pasarela) && (await abrirBoldDesdeUrl(datosAnticipo.checkoutUrl, datosAnticipo.boldCustomerData))) return
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
            returnUrl: `${window.location.origin}/checkout/resultado`,
            // Token del pedido: con él la pasarela recibe el documento del comprador (no lo pide otra vez).
            ...(typeof orderData.trackingToken === 'string' ? { t: orderData.trackingToken } : {}),
          })
        })

        const initData = await initRes.json()

        if (initRes.ok && initData.checkoutUrl) {
          // Pago rechazado sin perder el pedido (checkout v2): copia del pedido y del carrito en el
          // navegador ANTES de vaciarlo. Al volver con el pago no aprobado, Revisar ofrece
          // «Intentar de nuevo» sobre ESTE pedido (lo confirma el servidor). Nunca lanza.
          guardarPedidoPendiente(window.localStorage, organizationSubdomain || '', {
            orderNumber: createdOrderNumber,
            trackingToken: typeof orderData.trackingToken === 'string' ? orderData.trackingToken : null,
            gateway: paymentMethod,
            total: fmtPrice(total),
            cartKey: getCartKey(organizationSubdomain || '', branchId),
            carrito: cartItems,
            guardadoEn: Date.now(),
          })
          // Limpiar carrito antes de redirigir
          localStorage.removeItem(getCartKey(organizationSubdomain || '', branchId))
          window.dispatchEvent(new CustomEvent('cart-updated'))
          // Pedido creado: la mesa del QR ya cumplió (el siguiente pedido no sale como «comer aquí»).
          if (orderType === 'dine_in') limpiarMesa(organizationSubdomain || '')

          // Bold: abrir su pago directo, sin la página intermedia /checkout/bold (2026-11-21).
          // Si no se puede (librería sin cargar, red), esa página queda de respaldo.
          if (BOLD_CODES.has(paymentMethod) && (await abrirBoldDesdeUrl(initData.checkoutUrl, initData.boldCustomerData))) return

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

  // Pago rechazado: cobrar OTRA VEZ el mismo pedido pendiente, con la misma pasarela o con otra. La
  // ruta es la de siempre (/api/checkout/init, como «Pagar» en la consulta del pedido): el servidor
  // valida organización, estado y pasarela y es el único que cambia el método del pedido.
  const reintentarPago = async (gateway: string) => {
    if (!reintento) return
    setReintentando(gateway)
    setErrorReintento(null)
    try {
      const res = await fetch('/api/checkout/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // `t`: el token del pedido; con él la pasarela recibe el documento del comprador.
        body: JSON.stringify({ orderNumber: reintento.orderNumber, gateway, returnUrl: `${window.location.origin}/checkout/resultado`, ...(reintento.trackingToken ? { t: reintento.trackingToken } : {}) }),
      })
      const datos = await res.json().catch(() => ({}))
      if (res.ok && datos.checkoutUrl) {
        const subdomain = organizationSubdomain || ''
        const cartKey = getCartKey(subdomain, branchId)
        const anterior = leerPedidoPendiente(window.localStorage, subdomain, reintento.orderNumber, Date.now())
        guardarPedidoPendiente(window.localStorage, subdomain, {
          orderNumber: reintento.orderNumber,
          trackingToken: reintento.trackingToken,
          gateway,
          total: fmtPrice(reintento.total),
          cartKey,
          carrito: cartItems.length > 0 ? cartItems : anterior?.carrito ?? [],
          guardadoEn: Date.now(),
        })
        // Igual que al pagar la primera vez: el carrito se vacía al ir a la pasarela.
        localStorage.removeItem(cartKey)
        window.dispatchEvent(new CustomEvent('cart-updated'))
        if (BOLD_CODES.has(gateway) && (await abrirBoldDesdeUrl(datos.checkoutUrl, datos.boldCustomerData))) return
        window.location.href = datos.checkoutUrl
        return
      } else {
        setErrorReintento(typeof datos?.error === 'string' ? datos.error : 'No pudimos abrir el pago. Intenta de nuevo.')
      }
    } catch {
      setErrorReintento('Error de conexión. Intenta de nuevo.')
    } finally {
      setReintentando(null)
    }
  }
  // Dejar el pedido pendiente y armar uno nuevo (otro método que no es pasarela, o cambiar datos):
  // el pendiente vence solo, como hoy.
  const salirDeReintento = (paso: NumeroPaso) => {
    setReintento(null)
    setErrorReintento(null)
    try {
      const params = new URLSearchParams(window.location.search)
      params.delete('pedido')
      const q = params.toString()
      window.history.replaceState({}, '', q ? `${window.location.pathname}?${q}` : window.location.pathname)
    } catch {
      // Sin historial: no importa.
    }
    irAPaso(paso)
  }
  const metodosReintento = availableMethods
    .filter((m) => m.type === 'gateway')
    .map((m) => ({ code: m.code, name: m.name, descripcion: descripcionMetodo(m, orderType === 'delivery') }))
  const hrefPedidoReintento = reintento
    ? conPrefijo(`/pedido/${encodeURIComponent(reintento.orderNumber)}${reintento.trackingToken ? `?t=${reintento.trackingToken}` : ''}`, prefijoSede)
    : ''

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

  if (cartItems.length === 0 && reintento) {
    // Pago rechazado en otro navegador o sin la copia del carrito: el pedido igual se puede pagar.
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Tu pago no se completó</h1>
        <PagoRechazado
          numeroPedido={reintento.orderNumber}
          pasarela={nombrePasarelaMetodo(reintento.gateway)}
          total={fmtPrice(reintento.total)}
          color={primaryColor}
          metodos={metodosReintento}
          metodoActual={reintento.gateway}
          reintentando={reintentando}
          error={errorReintento}
          onReintentar={reintentarPago}
          hrefPedido={hrefPedidoReintento}
        />
      </div>
    )
  } else if (cartItems.length === 0 && carritosDeSede.length > 0) {
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
  const paymentOptions = availableMethods.map(m => ({
    id: m.code,
    // El ícono elegido en el ERP (lucide) o el de su tipo; nunca la palabra suelta.
    icono: iconoMetodo(m),
    label: m.name,
    // La que escribió la tienda manda; si no, un texto por tipo («Pago en línea con Wompi»…).
    description: descripcionMetodo(m, orderType === 'delivery'),
  }))

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Paso que se pinta: el pedido (URL o botones) sin saltarse lo que falta. Con un pago rechazado
  // por reintentar, «Revisar».
  const pagoListo = !ceBloqueada && availableMethods.some((m) => m.code === paymentMethod)
  const pasoVisible: NumeroPaso = reintento && step === 3 ? 3 : pasoPermitido(step, datosCompletos, pagoListo)
  const continuarDatos = () => {
    if (!datosCompletos) {
      setMostrarErrores(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      irAPaso(2)
    }
  }

  const nombrePasarela = metodoElegido?.type === 'gateway' ? nombrePasarelaMetodo(metodoElegido.code) : null
  const unidades = cartItems.reduce((n, i) => n + i.quantity, 0)
  const telefonoVisible = customerData.phone ? formatearTelefono(customerData.phone, isoTelefono) : ''
  const hrefCarrito = conPrefijo('/carrito', prefijoSede)
  const hrefIngresar = `${conPrefijo('/auth', prefijoSede)}?siguiente=${encodeURIComponent(conPrefijo('/checkout', prefijoSede))}`
  const tiempoDomicilio = orderType === 'delivery' ? opcionesDomicilio.find((o) => o.grupo === grupoEnvio)?.tiempo ?? null : null
  const momentoTexto = isScheduled && scheduledAt
    ? (sedePedido
        ? momentoPedido(scheduledAt, sedePedido.zona)
        : new Date(scheduledAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }))
    : null
  const etiquetaEntrega = orderType === 'delivery' ? etiquetaDomicilio : orderType === 'pickup' ? 'Recoger en tienda' : 'Comer aquí'
  const resumenEntrega = orderType === 'delivery'
    ? [direccionConComplemento(customerData.address, complemento), customerData.barrio.trim(), customerData.city].filter(Boolean).join(' · ')
    : orderType === 'pickup'
      ? (sedePedido ? [sedePedido.nombre, sedePedido.direccion].filter(Boolean).join(' · ') : '')
      : (mesa ? etiquetaMesa(mesa.nombre) : mesaManual.trim() ? `Mesa ${mesaManual.trim()}` : '')

  // Costo y hora del envío en cuanto hay barrio o municipio (Figma A1 y C7b). Solo pinta.
  const lugarEnvio = customerData.barrio.trim() || customerData.city.trim()
  const conZonaPropia = orderType === 'delivery' && grupoEnvio === 'own' && conDomicilioPropio
  const avisoEnvio = orderType !== 'delivery'
    ? null
    : conZonaPropia && cotizandoZona && lugarEnvio
      ? { calculando: true, titulo: null, detalle: null, pista: null }
      : envioZona?.ok && lugarEnvio
        ? { calculando: false, titulo: `${etiquetaDomicilio} a ${lugarEnvio}: ${envioZona.costo === 0 ? 'gratis' : fmtPrice(envioZona.costo)}`, detalle: cotZona ? llegadaZona(cotZona, fechaCorta) : null, pista: null }
        : !envioZona && (settings.enableShipping || dynamicShippingCost !== null) && customerData.city.trim()
          ? { calculando: false, titulo: `${etiquetaDomicilio} a ${customerData.city.trim()}: ${shipping === 0 ? 'gratis' : fmtPrice(shipping)}`, detalle: tiempoDomicilio, pista: null }
          : {
            calculando: false,
            titulo: null,
            detalle: null,
            pista: cotZona && !customerData.barrio.trim()
              ? 'Escribe el barrio y te decimos el costo exacto y la hora de llegada.'
              : !customerData.city.trim() ? 'Elige tu municipio y te decimos cuánto cuesta el envío.' : null,
          }

  const nivelServicio = (n: string) => (n === 'express' ? 'Express' : n === 'same_day' ? 'Mismo día' : n === 'economy' ? 'Económico' : 'Estándar')
  const direccionElegida = savedAddresses.find((a) => a.address_line1 === customerData.address) ?? null
  const camposDireccionVisibles = savedAddresses.length === 0 || usandoOtraDireccion || !direccionElegida

  const etiquetaNotas = orderType === 'delivery'
    ? (isRestaurant ? 'Instrucciones especiales (opcional)' : 'Indicaciones para el repartidor (opcional)')
    : (isRestaurant ? 'Instrucciones especiales (opcional)' : 'Notas para la tienda (opcional)')

  // ── Secciones (las mismas en 3 pasos y en 1 paso) ──────────────────────────────────────────

  const seccionContacto = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoCheckout
          def={campoDe(camposCheckout, 'email')}
          valor={customerData.email}
          onCambio={(v) => setCustomerData((prev) => ({ ...prev, email: v }))}
          error={errorDe(errores, 'email')}
          mostrarError={mostrarErrores || !!tocados.email}
          onSalir={() => tocar('email')}
          color={primaryColor}
        />
        <div onBlur={() => tocar('celular')}>
          <label htmlFor={idCampo('celular')} className="mb-1 block text-sm font-medium text-gray-700">{campoDe(camposCheckout, 'celular').etiqueta}</label>
          <TelefonoPais
            id={idCampo('celular')}
            name="celular"
            value={customerData.phone}
            onChange={(value) => setCustomerData((prev) => ({ ...prev, phone: value }))}
            paisPorDefecto={isoTelefono}
            mostrarError={false}
            className={`h-11 rounded-lg border bg-white text-[15px] [&_input]:h-full ${verError('celular') ? 'border-red-500' : 'border-gray-300'}`}
          />
          {verError('celular') ? (
            <ErrorDeCampo id={idCampo('celular')} error={verError('celular')} />
          ) : (
            <p className="mt-1 text-xs text-gray-500">{campoDe(camposCheckout, 'celular').ayuda}</p>
          )}
        </div>
      </div>
      <CampoCheckout
        def={campoDe(camposCheckout, 'nombre')}
        valor={nombreCompleto}
        onCambio={cambiarNombre}
        error={errorDe(errores, 'nombre')}
        mostrarError={mostrarErrores || !!tocados.nombre}
        onSalir={() => tocar('nombre')}
        color={primaryColor}
      />
      {campoDe(camposCheckout, 'factura').visible && (
        <div>
          <CasillaCheckout
            id="checkout-factura"
            marcada={factura.activa}
            onCambio={(v) => setFactura((f) => ({ ...f, activa: v, correo: v && !f.correo ? customerData.email : f.correo }))}
            titulo={campoDe(camposCheckout, 'factura').etiqueta}
            detalle={factura.activa ? 'La factura electrónica sale con estos datos' : campoDe(camposCheckout, 'factura').ayuda}
            color={primaryColor}
          />
          {factura.activa && (
            <FacturaEmpresaCampos factura={factura} onCambio={setFactura} errores={erroresFactura(factura)} mostrarErrores={mostrarErrores} color={primaryColor} nombreCliente={nombreCompleto} />
          )}
        </div>
      )}
    </div>
  )

  const seccionEntrega = (
    <div className="space-y-5">
      {/* Comer aquí: mesa del QR, con salida «No estoy en la mesa» */}
      {orderType === 'dine_in' && mesa && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg p-3 text-sm"
          style={{ backgroundColor: `${primaryColor}10`, color: primaryColor }}
          role="status"
        >
          <UtensilsCrossed className="h-4 w-4" aria-hidden="true" />
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
        <OpcionesEntrega
          value={orderType}
          onChange={setOrderType}
          primaryColor={primaryColor}
          enableDelivery={hasDelivery}
          enablePickup={hasPickup}
          enableDineIn={hasDineIn}
          opcionesDomicilio={opcionesDomicilio}
          grupoDomicilio={grupoEnvio}
          onGrupoDomicilio={setGrupoEnvio}
          detalleRecoger={sedePedido ? [sedePedido.nombre, sedePedido.direccion].filter(Boolean).join(' · ') : null}
        />
      )}

      {orderType === 'dine_in' && !mesa && (
        <div>
          <label htmlFor="checkout-mesa" className="block text-sm font-medium text-gray-700 mb-1">
            Número de mesa
          </label>
          <Input
            id="checkout-mesa"
            value={mesaManual}
            onChange={(e) => setMesaManual(e.target.value)}
            placeholder="Ej.: 4 o Mesa 4"
            maxLength={20}
            aria-invalid={mostrarErrores && mesaFaltante ? true : undefined}
            aria-describedby="checkout-mesa-ayuda"
          />
          <p id="checkout-mesa-ayuda" className={`text-xs mt-1 ${mostrarErrores && mesaFaltante ? 'text-red-600' : 'text-gray-500'}`}>
            {mostrarErrores && mesaFaltante ? 'Escribe el número de tu mesa.' : 'El número que ves en tu mesa. Lo confirmamos antes de enviarlo a cocina.'}
          </p>
        </div>
      )}

      {/* Restaurante: programar el pedido (la misma regla de horario que /api/orders) */}
      {isRestaurant && orderType !== 'dine_in' && (
        <div id="checkout-momento" tabIndex={-1}>
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
          {mostrarErrores && momentoBloqueado && <p className="mt-1 text-xs text-red-600">{errorDe(errores, 'momento')}</p>}
        </div>
      )}

      {/* Dirección: solo a domicilio (recoger en tienda y comer aquí no la piden) */}
      {orderType === 'delivery' && (
        <div className={`space-y-4 ${opcionesEntrega > 1 ? 'border-t pt-5' : ''}`}>
          <h3 className="text-base font-semibold text-gray-900">Dirección de entrega</h3>

          {/* Con sesión: direcciones guardadas como tarjetas + «Usar otra dirección» */}
          <DireccionesGuardadas
            direcciones={savedAddresses}
            elegidaId={direccionElegida?.id ?? null}
            usandoOtra={usandoOtraDireccion || !direccionElegida}
            onElegir={(addr) => {
              setUsandoOtraDireccion(false)
              setComplemento('')
              setCustomerData(prev => ({
                ...prev,
                address: addr.address_line1,
                city: addr.city || '',
                countryCode: addr.country_code || prev.countryCode,
                stateName: addr.department || prev.stateName,
                department: addr.department || prev.department,
              }))
            }}
            onOtra={() => {
              setUsandoOtraDireccion(true)
              enfocarDireccion()
            }}
            color={primaryColor}
          />

          {camposDireccionVisibles && (
            <>
              <CampoCheckout
                def={campoDe(camposCheckout, 'direccion')}
                valor={customerData.address}
                onCambio={(v) => setCustomerData((prev) => ({ ...prev, address: v }))}
                error={errorDe(errores, 'direccion')}
                mostrarError={mostrarErrores || !!tocados.direccion}
                onSalir={() => tocar('direccion')}
                color={primaryColor}
              />
              <CampoCheckout
                def={campoDe(camposCheckout, 'complemento')}
                valor={complemento}
                onCambio={setComplemento}
                error={null}
                mostrarError={false}
                color={primaryColor}
                maxLength={80}
              />
              <div>
                <label htmlFor={idCampo('ciudad')} className="mb-1 block text-sm font-medium text-gray-700">{campoDe(camposCheckout, 'ciudad').etiqueta}</label>
                <MunicipioBuscador
                  id={idCampo('ciudad')}
                  valor={{ countryCode: customerData.countryCode, stateCode: customerData.stateCode, stateName: customerData.stateName, city: customerData.city }}
                  onCambio={(data) => setCustomerData((prev) => ({
                    ...prev,
                    countryCode: data.countryCode,
                    stateCode: data.stateCode,
                    stateName: data.stateName,
                    city: data.city,
                    department: data.stateName,
                  }))}
                  color={primaryColor}
                  error={verError('ciudad')}
                  fallbackCities={['Bogotá','Medellín','Cali','Barranquilla','Cartagena','Cúcuta','Bucaramanga','Pereira','Santa Marta','Ibagué','Pasto','Manizales','Neiva','Villavicencio','Armenia','Valledupar','Montería','Sincelejo','Popayán','Tunja','Riohacha','Florencia','Quibdó','Yopal','Mocoa','Leticia','San Andrés','Arauca','Mitú','Puerto Carreño','Inírida','Envigado','Bello','Itagüí','Sabaneta','Rionegro','Soacha','Chía','Zipaquirá','Fusagasugá','Girardot','Tuluá','Palmira','Buenaventura','Barrancabermeja','Sogamoso','Duitama','Girón','Piedecuesta','Soledad','Malambo','Dosquebradas','Apartadó','Turbo','Lorica','Magangué','Aguachica','Ocaña','Pamplona','Tumaco','Ipiales','Cartago','Buga','Jamundí']}
                />
              </div>
            </>
          )}

          {/* Domicilio por zona (Figma 2830:75378 y 2830:75453): barrio, zona y envío gratis */}
          {orderType === 'delivery' && grupoEnvio === 'own' && cotZona && (
            <div className="space-y-3">
              <CampoCheckout
                def={campoDe(camposCheckout, 'barrio')}
                valor={customerData.barrio}
                onCambio={(v) => setCustomerData({ ...customerData, barrio: v })}
                error={null}
                mostrarError={false}
                color={primaryColor}
              />
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
            </div>
          )}

          {/* Costo y hora del envío («Calculando…» mientras cotiza) */}
          {avisoEnvio && <AvisoCostoEnvio calculando={avisoEnvio.calculando} titulo={avisoEnvio.titulo} detalle={avisoEnvio.detalle} pista={avisoEnvio.pista} />}

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

          {/* Botón guardar dirección para usuarios autenticados */}
          {isAuthenticated && camposDireccionVisibles && customerData.address && customerData.city && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await fetch('/api/customer/address', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      organizationId,
                      address_line: direccionPedido,
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
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              Guardar como dirección principal
            </button>
          )}

          {/* Más de una tarifa en el domicilio elegido: el cliente escoge (con una, se usa sola). */}
          {tarifasGrupo.length > 1 && (
            <div>
              <p className="block text-sm font-medium text-gray-700 mb-2" id="checkout-metodo-envio">Método de envío</p>
              <div className="space-y-2" role="radiogroup" aria-labelledby="checkout-metodo-envio">
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
                          {nivelServicio(rate.service_level)}
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
        </div>
      )}

      {/* Indicaciones (opcional): plegadas hasta que el cliente las pide */}
      {notasAbiertas || customerData.notes ? (
        <CampoCheckout
          def={campoDe(camposCheckout, 'notas')}
          etiqueta={etiquetaNotas}
          valor={customerData.notes}
          onCambio={(v) => setCustomerData((prev) => ({ ...prev, notes: v }))}
          error={null}
          mostrarError={false}
          color={primaryColor}
          maxLength={500}
        />
      ) : (
        <button type="button" onClick={() => setNotasAbiertas(true)} className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: primaryColor }}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {orderType === 'delivery' && !isRestaurant ? 'Agregar indicaciones para el repartidor (opcional)' : isRestaurant ? 'Agregar instrucciones especiales (opcional)' : 'Agregar una nota para la tienda (opcional)'}
        </button>
      )}

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
    </div>
  )

  const seccionPago = (
    <div>
      <div className="space-y-3" role="radiogroup" aria-label="Método de pago">
        {paymentOptions.map((method) => {
          // Contraentrega con condiciones: la línea con sus montos (en el color de la tienda si está elegida).
          const lineaCe = method.id === 'cash' ? lineaOpcionContraentrega(ce.estado, fmtPrice) : null
          const elegido = paymentMethod === method.id
          return (
            <TarjetaMetodoPago
              key={method.id}
              id={method.id}
              titulo={method.label}
              descripcion={lineaCe ?? method.description}
              descripcionEnColor={!!lineaCe && elegido}
              icono={method.icono}
              seleccionada={elegido}
              color={primaryColor}
              apagada={method.id === 'cash' && !!ce.estado && !ce.estado.disponible}
              onSeleccionar={() => elegirMetodo(method.id)}
            >
              {/* Contraentrega con condiciones: motivo si no aplica, desglose y pasarela del anticipo si sí. */}
              {method.id === 'cash' && ce.estado && (
                !ce.estado.disponible
                  ? <MotivoContraentrega estado={ce.estado} fmt={fmtPrice} hrefSeguirComprando={conPrefijo('/productos', prefijoSede)} hrefIngresar={isAuthenticated ? null : hrefIngresar} onIngresar={(e) => alTocarIngresarCheckout(e, hrefIngresar)} ciudad={customerData.city} onCambiarDireccion={cambiarDireccionContraentrega} onQuitar={quitarNoAplican} />
                  : paymentMethod === 'cash' && (
                    <DetalleContraentrega estado={ce.estado} total={total} fmt={fmtPrice} pasarela={ce.pasarela} onPasarela={ce.setPasarela} color={primaryColor} sinMontos />
                  )
              )}
            </TarjetaMetodoPago>
          )
        })}
      </div>
      {nombrePasarela && (
        <p className="mt-4 flex items-start gap-2 text-xs text-gray-500">
          <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          Al final se abre la ventana segura de {nombrePasarela} para pagar. La tienda no ve ni guarda los datos de tu tarjeta.
        </p>
      )}
      <CuponCheckout
        codigo={couponCode}
        onCodigo={(v) => { setCouponCode(v); setCouponError(null) }}
        onAplicar={validateCoupon}
        cargando={couponLoading}
        error={couponError}
        aplicado={!!appliedCoupon}
        // Plegado tras «¿Tienes un cupón de descuento?» (3 pasos y 1 paso, celular y computador); el
        // cupón aplicado se ve aplicado con «Quitar» (y sigue en el resumen, como hoy).
        plegado
        cuponAplicado={appliedCoupon ? { codigo: appliedCoupon.code, descuento: couponDiscount, onQuitar: removeCoupon } : null}
        fmt={fmtPrice}
      />
    </div>
  )

  // Botón final (una sola regla: textoBotonPago). Candado solo si cobra en línea.
  const contenidoBotonPagar = submitting ? (
    <>
      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      Procesando...
    </>
  ) : (
    <>
      {pagoEnLinea && <Lock className="h-4 w-4 mr-2" aria-hidden="true" />}
      {textoPagar}
    </>
  )
  const notaBotonPagar = nombrePasarela && paymentMethod !== 'cash'
    ? `Se abre la ventana segura de ${nombrePasarela}. Si el pago falla, tu pedido queda guardado y puedes intentarlo de nuevo.`
    : null

  // Filas de «Revisar y confirmar».
  const filasRevisar: FilaRevisar[] = [
    {
      clave: 'contacto',
      etiqueta: 'Contacto',
      titulo: nombreCompleto.trim(),
      lineas: [[customerData.email, telefonoVisible].filter(Boolean).join(' · ')],
      accion: { texto: 'Cambiar', onClick: () => (reintento ? salirDeReintento(1) : irAPaso(1)) },
    },
    ...(factura.activa
      ? [{
        clave: 'factura' as const,
        etiqueta: 'Factura electrónica',
        titulo: `A nombre de ${factura.razonSocial.trim()}`,
        lineas: [`${documentoFactura(factura)} · ${factura.correo.trim()}`],
        accion: { texto: 'Cambiar', onClick: () => (reintento ? salirDeReintento(1) : irAPaso(1)) },
      }]
      : []),
    {
      clave: 'entrega',
      etiqueta: 'Entrega',
      titulo: [
        etiquetaEntrega,
        orderType === 'delivery' ? tiempoDomicilio : null,
        momentoTexto,
        orderType === 'delivery' && needsShipping ? (shipping === 0 ? 'Gratis' : fmtPrice(shipping)) : null,
      ].filter(Boolean).join(' · '),
      lineas: [resumenEntrega, customerData.notes.trim() ? `Indicaciones: ${customerData.notes.trim()}` : ''],
      accion: { texto: 'Cambiar', onClick: () => (reintento ? salirDeReintento(1) : irAPaso(1)) },
    },
    reintento
      ? {
        clave: 'pago',
        etiqueta: 'Pago · No aprobado',
        titulo: availableMethods.find((m) => m.code === reintento.gateway)?.name ?? (nombrePasarelaMetodo(reintento.gateway) ?? 'Pago en línea'),
        lineas: ['La entidad rechazó el pago. Prueba otra vez o con otro método.'],
        accion: {
          texto: 'Cambiar método',
          onClick: () => {
            const b = document.getElementById('checkout-otro-metodo')
            if (b) {
              b.scrollIntoView({ behavior: 'smooth', block: 'center' })
              b.click()
            } else {
              salirDeReintento(2)
            }
          },
        },
        alerta: true,
      }
      : {
        clave: 'pago',
        etiqueta: 'Pago',
        titulo: metodoElegido?.name ?? 'Pago',
        lineas: [
          paymentMethod === 'cash'
            ? (lineaOpcionContraentrega(ce.estado, fmtPrice) ?? (metodoElegido ? descripcionMetodo(metodoElegido, orderType === 'delivery') ?? '' : ''))
            : nombrePasarela
              ? `Pagas ${fmtPrice(total)} en la ventana segura de ${nombrePasarela}`
              : (metodoElegido ? descripcionMetodo(metodoElegido, orderType === 'delivery') ?? '' : ''),
        ],
        accion: { texto: 'Cambiar', onClick: () => irAPaso(2) },
      },
    {
      clave: 'productos',
      etiqueta: 'Productos',
      titulo: `${unidades} ${unidades === 1 ? 'producto' : 'productos'} · ${fmtPrice(subtotal)}`,
      lineas: [cartItems.map((i) => `${i.name}${i.quantity > 1 ? ` × ${i.quantity}` : ''}`).join(' · ')],
      accion: { texto: 'Editar carrito', href: hrefCarrito },
    },
  ]

  // Un solo resumen (antes había dos: el paso «Carrito» y la tarjeta «Resumen»).
  const umbralStock = settings.conversion?.urgencia?.stockBajo?.activo ? settings.conversion.urgencia.stockBajo.umbral : (settings.stockWarningThreshold ?? 5)
  const plantillaStock = settings.conversion?.urgencia?.stockBajo?.plantilla || settings.stockWarningTemplate || 'Quedan {n}'
  const lineasResumen: LineaResumen[] = cartItems.map((item) => ({
    id: item.id,
    nombre: item.name,
    cantidad: item.quantity,
    imagen: item.imageUrl ?? null,
    detalles: [
      item.variantAttributes && Object.keys(item.variantAttributes).length > 0 ? Object.entries(item.variantAttributes).map(([k, v]) => `${k}: ${v}`).join(' · ') : '',
      item.modifiers && item.modifiers.length > 0 ? item.modifiers.map(m => m.valueName).join(', ') : '',
      item.newModifiers && item.newModifiers.length > 0 ? item.newModifiers.map(m => `${m.name}${m.extraPrice > 0 ? ` (+${fmtPrice(m.extraPrice)})` : ''}`).join(', ') : '',
      item.notes ? `Nota: ${item.notes}` : '',
    ].filter(Boolean),
    bruto: item.price * item.quantity,
    descuento: promoItemDiscounts[String(item.id)] || 0,
    promo: <PromoDeLinea promos={promotionsForItem(appliedPromotions, item.id)} pista={promoVolumeHints?.[String(item.id)] ?? null} fmt={fmtPrice} />,
    avisoStock: settings.showStockWarning ? avisoStock(item.stock, umbralStock, plantillaStock) : null,
  }))

  const resumen = (
    <ResumenPedido
      lineas={lineasResumen}
      fmt={fmtPrice}
      color={primaryColor}
      hrefCarrito={hrefCarrito}
      // Minimalista (el dueño, 2026-11-25): sin − / + ni papelera; la cantidad se cambia en «Editar carrito».
      chipEntrega={(hasDelivery || hasPickup) ? (
        <ChipEntregaResumen
          tipo={(orderType === 'delivery' ? (etiquetaDomicilio === 'Transportadora' ? 'transportadora' : 'domicilio') : orderType === 'pickup' ? 'recoger' : 'comer_aqui') satisfies TipoEntregaResumen}
          color={primaryColor}
          momento={momentoTexto}
        />
      ) : null}
      subtotal={subtotal}
      etiquetaSubtotal={appliedPromotions.length > 0 ? 'Subtotal (precio normal)' : 'Subtotal'}
      impuesto={{ etiqueta: etiquetaImpuesto, valor: tax, incluido: impuestoIncluido > 0 ? { nombre: impuestoVisto.resumen.nombre, valor: impuestoIncluido } : null }}
      envio={needsShipping && (settings.enableShipping || !!envioZona)
        ? {
          titulo: settings.shippingTitle || (isRestaurant ? 'Domicilio' : 'Envío'),
          valor: shipping,
          detalle: envioZona?.ok && cotZona ? llegadaZona(cotZona, fechaCorta) : tiempoDomicilio,
          // El DEFAULT de la columna (DESCRIPCION_ENVIO_POR_DEFECTO) no es un tiempo configurado: no se
          // muestra. Un texto propio de la tienda, como hoy (descripcionEnvioPropia).
          descripcion: descripcionEnvioPropia(settings.shippingDescription),
          calculando: conZonaPropia && cotizandoZona,
        }
        : null}
      propina={tipAmount}
      cupon={couponDiscount > 0 && appliedCoupon ? { codigo: appliedCoupon.code, descuento: couponDiscount, onQuitar: removeCoupon } : null}
      descuentosPromocion={<DescuentosPorPromocion promotions={appliedPromotions} totalDiscount={promoDiscount} fmt={fmtPrice} />}
      total={total}
      bajoTotal={paymentMethod === 'cash' ? <ResumenPagoContraentrega estado={ce.estado} fmt={fmtPrice} /> : null}
      // Precios en otra moneda: «Se cobra en COP: $ X» junto al total (el cobro no cambia).
      cobroEnBase={textoCobroEnBase(total, baseCurrency, displayCurrency, loading)}
      ahorro={promoDiscount + couponDiscount}
      mensajeEnvioGratis={needsShipping && !envioZona && settings.enableShipping && shipping === 0 && settings.freeShippingThreshold > 0
        ? ((promoDiscount + couponDiscount) > 0
            ? `Envío gratis: tus productos suman más de ${fmtPrice(settings.freeShippingThreshold)}, ya con los descuentos.`
            : `¡Envío gratis por compras mayores a ${fmtPrice(settings.freeShippingThreshold)}!`)
        : null}
      pie={
        <>
          {/* Sellos de confianza: fila de 3 con íconos de línea (Figma 3061:82007, versión 1). */}
          {settings.showTrustBadges && settings.trustBadges && settings.trustBadges.length > 0 && (
            <SellosConfianza sellos={settings.trustBadges} color={primaryColor} />
          )}
          {/* Medios de pago: los métodos activos de la tienda web (los del paso de pago), no una lista fija. */}
          {settings.showPaymentLogos && (
            <MediosPagoAceptados metodos={availableMethods} aDomicilio={orderType === 'delivery'} />
          )}
        </>
      }
      accion={isOnePage ? (
        // 1 paso en computador: UN botón, debajo del resumen (antes, el de la tarjeta 3 y la barra fija).
        <div className="hidden md:block">
          <Button
            type="button"
            className="w-full h-12 text-base font-semibold"
            style={{ backgroundColor: primaryColor }}
            onClick={() => handleSubmit()}
            disabled={submitting || ceBloqueada}
          >
            {contenidoBotonPagar}
          </Button>
          {notaBotonPagar && <p className="mt-2 text-center text-xs text-gray-500">{notaBotonPagar}</p>}
        </div>
      ) : null}
    />
  )

  const avisoInvitado = (
    <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">
      <User className="h-4 w-4 text-gray-400" aria-hidden="true" />
      {isAuthenticated ? (
        <span>Compras con tu cuenta{customerData.firstName ? `, ${customerData.firstName}` : ''}.</span>
      ) : (
        <>
          <span>Compras como invitado, sin crear cuenta.</span>
          {/* Con la ventana de acceso montada (opción del editor distinta de «Página») se abre ahí y el
              cliente sigue en el pago; si no, el enlace a /auth?siguiente=/checkout de siempre. */}
          <Link href={hrefIngresar} onClick={(e) => alTocarIngresarCheckout(e, hrefIngresar)} className="font-semibold underline underline-offset-4" style={{ color: primaryColor }}>
            ¿Ya compraste aquí? Ingresa con un código
          </Link>
        </>
      )}
    </p>
  )

  const subtituloContacto = [nombreCompleto.trim(), customerData.email.trim(), telefonoVisible].filter(Boolean).join(' · ')

  return (
    <div className="container mx-auto px-4 py-8 md:py-10">
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

      {/* Celular: el resumen plegado arriba, con el total a la vista (Figma A1 celular). */}
      <button
        type="button"
        onClick={() => setResumenAbierto((v) => !v)}
        aria-expanded={resumenAbierto}
        aria-controls="resumen-pedido-contenedor"
        className="mb-4 flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 md:hidden"
      >
        <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: primaryColor }}>
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
          {resumenAbierto ? 'Ocultar resumen' : 'Ver resumen'} · {unidades} {unidades === 1 ? 'producto' : 'productos'}
          <ChevronDown className={`h-4 w-4 transition-transform ${resumenAbierto ? 'rotate-180' : ''}`} aria-hidden="true" />
        </span>
        <span className="text-base font-bold text-gray-900">{fmtPrice(total)}</span>
      </button>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-3">
        {/* Contenido */}
        <div className="min-w-0 lg:col-span-2">
          {!isOnePage && <PasosCheckout actual={pasoVisible} color={primaryColor} onIr={(p) => (reintento && p < 3 ? salirDeReintento(p) : irAPaso(p))} />}

          {(isOnePage || pasoVisible === 1) && avisoInvitado}

          <ResumenErrores errores={erroresVisibles} />

          {paymentError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm whitespace-pre-line" role="alert">
              {paymentError}
            </div>
          )}

          {isOnePage ? (
            // ── 1 paso (Figma B): tres tarjetas numeradas, con check al completarse ──
            <>
              <TarjetaNumerada
                numero={1}
                titulo="Contacto"
                subtitulo={seccionCompleta(errores, CAMPOS_CONTACTO) ? subtituloContacto : 'Correo, celular y nombre'}
                completa={seccionCompleta(errores, CAMPOS_CONTACTO)}
                abierta={openSections.customer}
                onAlternar={() => toggleSection('customer')}
                color={primaryColor}
              >
                {seccionContacto}
              </TarjetaNumerada>
              <TarjetaNumerada
                numero={2}
                titulo="Entrega"
                subtitulo={seccionCompleta(errores, CAMPOS_ENTREGA) && resumenEntrega ? `${etiquetaEntrega} · ${resumenEntrega}` : '¿Cómo quieres recibirlo?'}
                completa={seccionCompleta(errores, CAMPOS_ENTREGA)}
                abierta={openSections.delivery}
                onAlternar={() => toggleSection('delivery')}
                color={primaryColor}
              >
                {seccionEntrega}
              </TarjetaNumerada>
              <TarjetaNumerada
                numero={3}
                titulo="Pago"
                subtitulo={metodoElegido?.name ?? null}
                completa={pagoListo && datosCompletos}
                abierta={openSections.payment}
                onAlternar={() => toggleSection('payment')}
                color={primaryColor}
              >
                {seccionPago}
              </TarjetaNumerada>
            </>
          ) : pasoVisible === 1 ? (
            // ── Paso 1 · Datos y entrega ──
            <>
              <TarjetaCheckout titulo="Contacto">{seccionContacto}</TarjetaCheckout>
              <TarjetaCheckout titulo="¿Cómo quieres recibirlo?" className="mt-6">{seccionEntrega}</TarjetaCheckout>
              <div className="mt-6 flex flex-col-reverse items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Link href={hrefCarrito} className="flex items-center justify-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900">
                  Volver al carrito
                </Link>
                <Button type="button" className="h-12 px-10 text-base font-semibold" style={{ backgroundColor: primaryColor }} onClick={continuarDatos}>
                  Continuar al pago
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </>
          ) : pasoVisible === 2 ? (
            // ── Paso 2 · Pago ──
            <>
              <section className="mb-6 flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-5" aria-label="Datos y entrega">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-gray-900">Datos y entrega</p>
                  <p className="text-sm text-gray-600">
                    {[nombreCompleto.trim(), telefonoVisible, `${etiquetaEntrega}${resumenEntrega ? ` · ${resumenEntrega}` : ''}`, momentoTexto].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button type="button" onClick={() => irAPaso(1)} className="flex-shrink-0 text-sm font-semibold underline underline-offset-4" style={{ color: primaryColor }}>
                  Cambiar
                </button>
              </section>
              <TarjetaCheckout titulo="¿Cómo quieres pagar?">{seccionPago}</TarjetaCheckout>
              <div className="mt-6 flex flex-col-reverse items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" onClick={() => irAPaso(1)} className="flex items-center justify-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900">
                  Volver a Datos y entrega
                </button>
                <Button type="button" className="h-12 px-10 text-base font-semibold" style={{ backgroundColor: primaryColor }} onClick={() => irAPaso(3)} disabled={!pagoListo}>
                  Revisar pedido
                </Button>
              </div>
            </>
          ) : reintento ? (
            // ── Paso 3 con el pago rechazado (Figma C2): el MISMO pedido, otra vez o con otro método ──
            <>
              <PagoRechazado
                numeroPedido={reintento.orderNumber}
                pasarela={nombrePasarelaMetodo(reintento.gateway)}
                total={fmtPrice(reintento.total)}
                color={primaryColor}
                metodos={metodosReintento}
                metodoActual={reintento.gateway}
                reintentando={reintentando}
                error={errorReintento}
                onReintentar={reintentarPago}
                hrefPedido={hrefPedidoReintento}
              >
                <RevisarPedido filas={filasRevisar} color={primaryColor} />
              </PagoRechazado>
              {availableMethods.some((m) => m.type !== 'gateway') && (
                <p className="mt-4 text-center text-sm text-gray-600">
                  ¿Prefieres pagar contra entrega o por transferencia?{' '}
                  <button type="button" onClick={() => salirDeReintento(2)} className="font-semibold underline underline-offset-4" style={{ color: primaryColor }}>
                    Haz el pedido con otro método
                  </button>
                </p>
              )}
            </>
          ) : (
            // ── Paso 3 · Revisar y confirmar ──
            <>
              <h2 className="text-2xl font-bold text-gray-900">Revisa y confirma</h2>
              <p className="mb-5 mt-1 text-sm text-gray-500">Puedes cambiar cualquier dato sin perder lo demás.</p>
              <RevisarPedido filas={filasRevisar} color={primaryColor} />
              <Button
                type="button"
                className="mt-6 h-12 w-full text-base font-semibold"
                style={{ backgroundColor: primaryColor }}
                onClick={() => handleSubmit()}
                disabled={submitting || ceBloqueada}
              >
                {contenidoBotonPagar}
              </Button>
              {notaBotonPagar && <p className="mt-3 text-center text-sm text-gray-500">{notaBotonPagar}</p>}
              <button type="button" onClick={() => irAPaso(2)} className="mx-auto mt-3 flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900">
                Volver a Pago
              </button>
            </>
          )}
        </div>

        {/* Resumen: a la derecha en computador, fijo al bajar (sticky en la columna: el resumen solo no
            tiene recorrido porque su columna mide lo mismo que él); en celular, plegado arriba. */}
        <div id="resumen-pedido-contenedor" className={`${resumenAbierto ? '' : 'hidden'} order-first md:order-none md:block lg:sticky lg:top-4 lg:self-start`}>
          {resumen}
        </div>
      </div>

      {/* Celular, 1 paso: la barra del pago en el estilo de la tienda (A, B o C; por defecto C). */}
      {isOnePage && cartItems.length > 0 && (
        <BarraPagoMovil
          contenido={contenidoBarra}
          color={primaryColor}
          deshabilitado={submitting || ceBloqueada}
          procesando={submitting}
          onPagar={() => handleSubmit()}
          onDetalle={irAlResumen}
          onAlto={ponerAltoBarra}
        />
      )}
      {/* Computador (md en adelante), 1 paso: la barra fija en el estilo de la tienda (A, B o C; por
          defecto C; Figma 3214:110908). Siempre a la vista, junto con el botón de debajo del resumen
          (el dueño, 2026-11-25). Mismo handleSubmit y mismo disabled que ese botón. */}
      {isOnePage && cartItems.length > 0 && (
        <BarraPagoComputador
          contenido={contenidoBarraComputador}
          color={primaryColor}
          imagenes={cartItems.slice(0, 3).map((i) => i.imageUrl ?? null)}
          deshabilitado={submitting || ceBloqueada}
          procesando={submitting}
          onPagar={() => handleSubmit()}
          onDetalle={irAlResumen}
          motivoApagado={motivoBarra}
          onIrAlCampo={motivoBarra ? irAlMotivo : null}
          onAlto={ponerAltoBarraComputador}
        />
      )}

      {/* Espaciador de la barra: en celular y en computador, el alto real de cada una (en celular con el área segura del iPhone). */}
      {isOnePage && cartItems.length > 0 && (
        <>
          <div className="md:hidden" style={{ height: altoBarraMovil }} aria-hidden="true" />
          <div className="hidden md:block" style={{ height: altoBarraComputador }} aria-hidden="true" data-espaciador-barra-computador="" />
        </>
      )}
    </div>
  )
}
