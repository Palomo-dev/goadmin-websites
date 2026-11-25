'use client'

/**
 * Consulta del pedido en la tienda (`/pedido/<n>`) — Figma «21 Logística» › 10, aprobado por el
 * dueño el 2026-11-24. La misma página para todos los estados:
 * - Arriba, un solo estado en palabras claras y lo que hay que hacer (`lib/orders/consultaPedido`).
 *   Se acabó el «Pendiente · Pago pendiente» con «Confirmado» abajo.
 * - Si falta el pago: total, hasta qué hora se apartan los productos (`fn_web_order_plazo_minutos`,
 *   la misma hora con la que vence) y «Pagar» por `/api/checkout/init`, igual que el checkout.
 *   Si el pago no pasó: «Intentar de nuevo» o «Pagar con otro medio». Si venció: «Retomar mi compra».
 * - Número del pedido pequeño, con «Copiar»; barra de 4 pasos; productos con foto; entrega con el
 *   nombre público de la sede (nunca «Sucursal 562»); «¿Dudas?» con WhatsApp.
 * - Entregado: factura, calificación por producto y «Volver a comprar estos productos».
 * - Final de la página (Figma «16 Sitio web» › opción A, 3067:82354 a 3068:82776, aprobado el
 *   2026-11-24): «Seguir comprando/pidiendo» como botón secundario a todo el ancho, lo último de la
 *   página; entregado, encima va «Volver a comprar estos productos». El botón gris «Actualizar» se
 *   cambió por la línea «Se actualiza solo · hace N s» debajo de los pasos (tocarla actualiza).
 * - Lo de logística aprobado (Figma 2804:13320) se queda igual: quién lo lleva, código de entrega,
 *   «Pagas al recibir», novedad, mapa, guía e intentos de entrega.
 */

import { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react'
import {
  Loader2, RefreshCw, MapPin, Phone, Clock, ExternalLink, Mail, MessageCircle, Banknote, X, Copy, Check,
  Lock, XCircle, Truck, Store, Package, ChevronDown, FileText, Star, ShoppingBag, CreditCard, PackageCheck, Info, CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import Enlace from '@/components/site/Enlace'
import { DeliveryInfo } from '@/components/site/DeliveryInfo'
import { EstimatedTime } from '@/components/site/EstimatedTime'
import { DeliveryMap } from '@/components/site/DeliveryMap'
import { esDomicilio, esEstadoFinal, etiquetaTipoEntrega } from '@/lib/orders/estados-pedido'
import { diaPedido, fechaHoraPedido, horaPedido } from '@/lib/restaurant/ventanaPedido'
import { etiquetaMesa } from '@/lib/orders/nombreMesa'
import { direccionCompleta, enlaceWhatsApp, type CanalesAyuda, type RastreoLogistica } from '@/lib/orders/rastreoPublico'
import {
  encabezadoPedido,
  minutosRestantes,
  pasosPedido,
  textoRestante,
  type TonoInsignia,
  type VistaPedido,
} from '@/lib/orders/consultaPedido'
import { abrirBoldDesdeUrl } from '@/lib/payments/boldCheckoutCliente'
import { codigoConector } from '@/lib/contraentrega/textosContraentrega'
import { SiluetaPedido } from '@/components/site/rastreo/SiluetaPedido'

interface ItemPedido {
  productId: number | null
  name: string
  quantity: number
  unitPrice: number
  total: number
  imageUrl: string | null
}

interface TrackingData {
  orgTypeId: number
  /** Zona de la sede: todas las horas se pintan en ella, no en la del navegador. */
  zona: string
  /** El enlace trae el token de seguimiento: hay dirección, conductor y entrega. */
  verificado: boolean
  order: {
    id: string
    orderNumber: string
    status: string
    paymentStatus: string | null
    deliveryType: string
    mesa: string | null
    /** Nombre PÚBLICO de la sede (`nombrePublicoSede`), o null. */
    sede: string | null
    paymentMethod: string | null
    paymentMethodName: string | null
    paymentDetail: string | null
    estimatedDeliveryDate: string | null
    cancellationReason: string | null
    deliveryAddress: any
    /** «Cra 45 #12-… · Chapinero, Bogotá» (solo con el token). */
    direccionIncompleta?: string | null
    isScheduled: boolean
    scheduledAt: string | null
    tipAmount: number | null
    subtotal: number
    taxTotal: number
    deliveryFee: number
    discountTotal: number
    total: number
    /** Contraentrega con anticipo (pantallas 11 y 12). null = sin anticipo, la página de siempre. */
    anticipo?: { monto: number; estado: string | null; venceEn: string | null; pasarela: string | null; nombrePasarela: string | null; alRecibir: number; medios?: string | null } | null
    estimatedReadyAt: string | null
    estimatedDeliveryAt: string | null
    customerName: string
    customerNotes: string | null
    createdAt: string
    organizationId: number
    branchId: number | null
  }
  shipment: {
    id: string
    shipmentNumber: string
    status: string
    trackingNumber: string | null
    externalTrackingUrl: string | null
    carrier: { name: string; contact_phone: string } | null
    pickedAt: string | null
    dispatchedAt: string | null
    deliveredAt: string | null
    expectedDeliveryDate: string | null
    latitude: number | null
    longitude: number | null
  } | null
  deliveryAttempts: {
    attemptNumber: number
    attemptedAt: string
    status: string
    failureReason: string | null
    driverNotes: string | null
    latitude: number | null
    longitude: number | null
  }[]
  timeline: { key: string; timestamp: string | null }[]
  /** Logística Fase 1: rastreo del envío (null sin envío o sin el token válido). */
  logistica?: RastreoLogistica | null
  /** Canales de Contacto de la tienda para «Ayuda». */
  ayuda?: CanalesAyuda
  vista: VistaPedido
  pago: { esPasarela: boolean; apartadoHasta: string | null; metodos: { code: string; name: string }[] | null }
  /** null en la consulta ligera: se conserva lo anterior. */
  items: ItemPedido[] | null
  factura: { id: string; numero: string | null; total: number } | null
  rutas: { retomar: string | null; recompra: string | null }
}

interface OrderTrackerProps {
  orderIdentifier: string
  primaryColor: string
  /** Token de seguimiento del enlace (`?t=`): sin él no se muestran datos personales. */
  token?: string | null
  /** Ruta de la carta / catálogo para «Seguir pidiendo». */
  rutaSeguirPidiendo?: string
  /**
   * Dentro de /consultar-pedido (Figma «16 Sitio web» › Consultar pedido v2): sin el contenedor
   * propio de la página, silueta mientras carga y «Rastrear en la transportadora» como botón.
   * Sin esta prop, /pedido/<n> se ve exactamente como antes.
   */
  incrustado?: boolean
  /**
   * El cliente ya probó que el pedido es suyo con el número + el correo o teléfono de la compra
   * (/consultar-pedido): con el token válido se muestra la dirección COMPLETA, como hacía el
   * /rastrear anterior. Sin esta prop (el enlace del correo, /pedido/<n>) sigue la incompleta del
   * Figma 2804:13320; sin token, ninguna.
   */
  direccionCompleta?: boolean
}

const POLL_INTERVAL = 15000 // 15 segundos

/** Mismos códigos de Bold que el checkout (`CheckoutWizard`): se abre su pago directo. */
const CODIGOS_BOLD = new Set(['bold', 'bold_link'])

/**
 * El token de seguimiento no se queda en la barra de direcciones: la página carga el píxel de Meta
 * y los scripts del negocio, que leen `location.href` (el PageView manda la URL completa). Al
 * montar, el token del enlace se guarda en sessionStorage de este pedido y `?t=` se quita con
 * history.replaceState ANTES de que corran esos scripts (efecto de layout, antes de los efectos
 * de next/script y de CustomScripts). Recargar la pestaña conserva el acceso; otra pestaña o
 * dispositivo necesita el enlace del correo.
 */
const useEfectoDeLayout = typeof window !== 'undefined' ? useLayoutEffect : useEffect

function claveToken(pedido: string): string {
  return `seguimiento_pedido_${pedido}`
}

function leerTokenGuardado(pedido: string): string | null {
  try {
    const t = window.sessionStorage.getItem(claveToken(pedido))
    return t && /^[A-Za-z0-9_-]{16,64}$/.test(t) ? t : null
  } catch {
    return null
  }
}

const TONO_INSIGNIA: Record<TonoInsignia, string> = {
  advertencia: 'border-amber-200 bg-amber-50 text-amber-800',
  peligro: 'border-red-200 bg-red-50 text-red-700',
  exito: 'border-green-200 bg-green-50 text-green-700',
  informacion: 'border-sky-200 bg-sky-50 text-sky-700',
  neutro: 'border-gray-200 bg-gray-100 text-gray-700',
}

/** Etiqueta del tipo de entrega sin el emoji del principio («Envío a domicilio»). */
const sinEmoji = (texto: string) => texto.replace(/^[^\p{L}]+/u, '')

/** «hoy a las 3:10 p. m.», «mañana a las …», «el jue 26 nov a las …», en la zona de la sede. */
function cuando(iso: string, zona: string): string {
  const dia = diaPedido(iso, zona)
  const d = dia === 'Hoy' ? 'hoy' : dia === 'Mañana' ? 'mañana' : `el ${dia.toLowerCase()}`
  return `${d} a las ${horaPedido(iso, zona)}`
}

const pesos = (n: number | null | undefined) => `$ ${Math.round(Number(n) || 0).toLocaleString('es-CO')}`

function Tarjeta({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <section className={`rounded-2xl border bg-white p-4 ${className}`} style={style}>{children}</section>
}

/**
 * Foto de una línea del pedido (48 px). El 2026-11-24 se vieron recuadros grises en el computador
 * (en el celular cargaban). Por eso: sin `loading="lazy"` (son pocas y la lista se abre al tocar:
 * no se espera a que el navegador decida pedirlas), y si una foto no carga (enlace roto o un sitio
 * que no deja enlazarla), el ícono del paquete: nunca un recuadro gris vacío. `no-referrer`: las
 * fotos recuperadas de otras tiendas no se bloquean por el origen de la página.
 */
function FotoLinea({ url }: { url: string | null }) {
  const [fallo, setFallo] = useState(false)
  if (!url || fallo) return <Package className="h-5 w-5 text-slate-400" aria-hidden="true" />
  return (
    <img
      src={url}
      alt=""
      width={48}
      height={48}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFallo(true)}
      className="h-full w-full object-cover"
      data-foto-linea=""
    />
  )
}

function FilaInfo({ icono: Icono, titulo, detalle, color }: { icono: typeof Clock; titulo: string; detalle?: string | null; color?: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icono className="mt-0.5 h-[18px] w-[18px] flex-shrink-0" style={{ color: color || '#475569' }} aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{titulo}</p>
        {detalle ? <p className="text-[13px] text-gray-600">{detalle}</p> : null}
      </div>
    </div>
  )
}

/** Cada cuánto se mueve el «hace N s» de la línea (solo la línea se vuelve a pintar). */
const RELOJ_LINEA_MS = 5000

function haceCuanto(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `hace ${s} s`
  return `hace ${Math.floor(s / 60)} min`
}

/**
 * Línea «↻ Se actualiza solo · hace N s» debajo de los pasos (Figma 3067:82625). Es un botón:
 * tocarla consulta el pedido ya. Estados: normal, «Actualizando…», «Actualizado ahora» y «Sin
 * conexión · Reintentar». El pedido entregado o cancelado no la pinta (deja de actualizarse).
 * Accesible: el estado del pedido se anuncia (aria-live) solo cuando cambia, no el reloj.
 */
function LineaActualiza({
  actualizadoEn,
  actualizando,
  recien,
  sinConexion,
  estadoPedido,
  onActualizar,
}: {
  actualizadoEn: number | null
  actualizando: boolean
  recien: boolean
  sinConexion: boolean
  estadoPedido: string
  onActualizar: () => void
}) {
  const [reloj, setReloj] = useState(() => Date.now())
  useEffect(() => {
    setReloj(Date.now())
    const id = setInterval(() => setReloj(Date.now()), RELOJ_LINEA_MS)
    return () => clearInterval(id)
  }, [actualizadoEn])

  let contenido: React.ReactNode
  let clase = 'text-gray-500'
  let Icono: typeof RefreshCw = RefreshCw
  if (actualizando) {
    contenido = 'Actualizando…'
  } else if (sinConexion) {
    clase = 'text-orange-700'
    contenido = (
      <>
        Sin conexión · <span className="font-semibold">Reintentar</span>
      </>
    )
  } else if (recien) {
    clase = 'text-green-700'
    Icono = CheckCircle2
    contenido = 'Actualizado ahora'
  } else {
    contenido = `Se actualiza solo${actualizadoEn ? ` · ${haceCuanto(reloj - actualizadoEn)}` : ''}`
  }
  return (
    <div>
      <button
        type="button"
        onClick={onActualizar}
        disabled={actualizando}
        aria-label="Actualizar el pedido"
        className={`inline-flex items-center gap-1.5 text-[13px] ${clase} disabled:cursor-default`}
        data-linea-actualiza={actualizando ? 'actualizando' : sinConexion ? 'sin_conexion' : recien ? 'recien' : 'normal'}
      >
        <Icono className={`h-3.5 w-3.5 flex-shrink-0 ${actualizando ? 'animate-spin' : ''}`} aria-hidden="true" />
        <span>{contenido}</span>
      </button>
      <span className="sr-only" aria-live="polite">{estadoPedido}</span>
    </div>
  )
}

export function OrderTracker({ orderIdentifier, primaryColor, token: tokenDelEnlace, rutaSeguirPidiendo = '/', incrustado = false, direccionCompleta: conDireccionCompleta = false }: OrderTrackerProps) {
  // En el servidor, el del enlace; en el navegador, además, el guardado de esta pestaña.
  const [token] = useState<string | null>(() =>
    tokenDelEnlace ?? (typeof window !== 'undefined' ? leerTokenGuardado(orderIdentifier) : null),
  )
  useEfectoDeLayout(() => {
    if (tokenDelEnlace) {
      try {
        window.sessionStorage.setItem(claveToken(orderIdentifier), tokenDelEnlace)
      } catch {
        /* almacenamiento bloqueado: el acceso dura lo que dure la página */
      }
    }
    const url = new URL(window.location.href)
    if (url.searchParams.has('t')) {
      url.searchParams.delete('t')
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    }
  }, [tokenDelEnlace, orderIdentifier])
  const consulta = token ? `?t=${encodeURIComponent(token)}` : ''
  const [data, setData] = useState<TrackingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ayudaAbierta, setAyudaAbierta] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [pagando, setPagando] = useState<string | null>(null)
  const [errorPago, setErrorPago] = useState<string | null>(null)
  const [otrosMedios, setOtrosMedios] = useState(false)
  const [productosAbiertos, setProductosAbiertos] = useState<boolean | null>(null)
  const [calificados, setCalificados] = useState<Record<number, number>>({})
  const [errorCalificar, setErrorCalificar] = useState<string | null>(null)
  const [ahora, setAhora] = useState(() => Date.now())
  // Línea «Se actualiza solo»: cuándo llegó la última respuesta y su estado al tocarla.
  const [actualizadoEn, setActualizadoEn] = useState<number | null>(null)
  const [actualizando, setActualizando] = useState(false)
  const [recien, setRecien] = useState(false)
  const [sinConexion, setSinConexion] = useState(false)
  const completo = useRef(false)

  /** `true` si llegó el pedido. Con el pedido ya en pantalla, un fallo no lo borra: «Sin conexión». */
  const fetchTracking = useCallback(async (): Promise<boolean> => {
    try {
      // La primera consulta trae todo; las siguientes (cada 15 s) son ligeras: no vuelven a leer
      // productos, medios de pago ni factura.
      const ligero = completo.current ? `${consulta ? '&' : '?'}ligero=1` : ''
      const res = await fetch(`/api/orders/${encodeURIComponent(orderIdentifier)}/tracking${consulta}${ligero}`, { cache: 'no-store' })
      if (!res.ok) {
        if (completo.current) {
          setSinConexion(true)
        } else if (res.status === 404) {
          setError('Pedido no encontrado')
        } else {
          setError('Error al obtener el seguimiento')
        }
        return false
      }
      const json = (await res.json()) as TrackingData
      setData((previo) => ({
        ...json,
        items: json.items ?? previo?.items ?? null,
        factura: json.factura ?? previo?.factura ?? null,
        pago: { ...json.pago, metodos: json.pago?.metodos ?? previo?.pago?.metodos ?? null },
      }))
      completo.current = true
      setError(null)
      setSinConexion(false)
      setActualizadoEn(Date.now())
      return true
    } catch {
      if (completo.current) setSinConexion(true)
      else setError('Error de conexión')
      return false
    } finally {
      setLoading(false)
    }
  }, [orderIdentifier, consulta])

  useEffect(() => {
    fetchTracking()
    // Polling: refrescar cada 15s si el pedido no está finalizado
    const interval = setInterval(() => {
      if (data && esEstadoFinal(data.order.status)) return
      fetchTracking()
      setAhora(Date.now())
    }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchTracking, data?.order?.status])

  // Tocar la línea: «Actualizando…» y, si llegó, «Actualizado ahora» unos segundos.
  const actualizarAhora = useCallback(async () => {
    setActualizando(true)
    setRecien(false)
    const ok = await fetchTracking()
    setActualizando(false)
    setAhora(Date.now())
    if (ok) setRecien(true)
  }, [fetchTracking])
  useEffect(() => {
    if (!recien) return
    const id = setTimeout(() => setRecien(false), 3000)
    return () => clearTimeout(id)
  }, [recien])

  const pagar = useCallback(async (gateway: string) => {
    if (!data) return
    setPagando(gateway)
    setErrorPago(null)
    try {
      const res = await fetch('/api/checkout/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Contraentrega con el anticipo pendiente: se paga SOLO el anticipo (monto del servidor).
        // `t`: el token del enlace; con él la pasarela recibe el documento del comprador.
        body: JSON.stringify(data.order.anticipo?.estado === 'pending'
          ? { source: 'anticipo_pedido', sourceId: data.order.id, gateway, returnUrl: `${window.location.origin}/checkout/resultado`, ...(token ? { t: token } : {}) }
          : { orderNumber: data.order.orderNumber, gateway, returnUrl: `${window.location.origin}/checkout/resultado`, ...(token ? { t: token } : {}) }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok && j.checkoutUrl) {
        // Bold: su pago directo, como el checkout; si no abre, la URL de respaldo.
        if (CODIGOS_BOLD.has(gateway) && (await abrirBoldDesdeUrl(j.checkoutUrl, j.boldCustomerData))) {
          setPagando(null)
          return
        }
        window.location.href = j.checkoutUrl
        return
      }
      setErrorPago(j.error || 'No pudimos abrir el pago. Intenta de nuevo.')
    } catch {
      setErrorPago('No pudimos abrir el pago. Revisa tu conexión e intenta de nuevo.')
    }
    setPagando(null)
  }, [data, token])

  const calificar = useCallback(async (item: ItemPedido, rating: number) => {
    if (!data || item.productId === null) return
    setErrorCalificar(null)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // La tienda toma la organización del host; el token de seguimiento demuestra la compra
        // («Compra verificada» si el pedido está entregado, lib/resenas/verificarCompra.ts).
        body: JSON.stringify({
          organizationId: data.order.organizationId,
          productId: item.productId,
          authorName: data.order.customerName || 'Cliente',
          rating,
          orderId: data.order.id,
          trackingToken: token ?? undefined,
          origen: 'pedido',
          website: '',
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setErrorCalificar(j.error || 'No pudimos guardar tu calificación. Intenta más tarde.')
        return
      }
      setCalificados((c) => ({ ...c, [item.productId as number]: rating }))
    } catch {
      setErrorCalificar('No pudimos guardar tu calificación. Revisa tu conexión.')
    }
  }, [data, token])

  if (loading && incrustado) {
    return <SiluetaPedido texto="Cargando tu pedido…" />
  } else if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: primaryColor }} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
        <Package className="mb-4 h-12 w-12 text-gray-300" aria-hidden="true" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">{error || 'Pedido no encontrado'}</h2>
        <p className="text-gray-500 text-sm mb-4">Verifica el número de pedido e intenta de nuevo.</p>
        <Button variant="outline" onClick={() => { setLoading(true); fetchTracking() }}>
          <RefreshCw className="h-4 w-4 mr-2" /> Reintentar
        </Button>
      </div>
    )
  }

  const { order, shipment, deliveryAttempts, orgTypeId, zona, vista } = data
  const isFinal = esEstadoFinal(order.status)
  const isRetail = orgTypeId === 3
  const esRestaurante = orgTypeId === 1
  const domicilio = esDomicilio(order.deliveryType)
  const logistica = data.logistica ?? null
  const ayuda = data.ayuda ?? { whatsapp: null, telefono: null, correo: null }
  const whatsapp = enlaceWhatsApp(ayuda.whatsapp, order.orderNumber)
  const hayAyuda = !!(whatsapp || ayuda.telefono || ayuda.correo)
  const anticipo = order.anticipo ?? null
  // Lo que se paga al recibir, como lo ve el cliente: con el anticipo pendiente ya se descuenta
  // (si no, «Anticipo hoy $ 20.000» + «Al recibir $ 134.700» suman más que el total).
  const alRecibirVista = anticipo
    ? anticipo.estado === 'paid'
      ? anticipo.alRecibir
      : Math.max(0, Number(order.total) - Number(anticipo.monto))
    : 0
  const anticipoPendiente = !!anticipo && anticipo.estado === 'pending' && order.status === 'pending'
  const anticipoPagado = !!anticipo && anticipo.estado === 'paid' && !isFinal
  const encabezadoBase = encabezadoPedido(vista, {
    nombre: order.customerName,
    pagado: order.paymentStatus === 'paid',
    deliveryType: order.deliveryType,
    esRestaurante,
    status: order.status,
  })
  // Anticipo pendiente: un solo estado arriba, como «Falta tu pago» pero por el anticipo (pantalla 11).
  const encabezado = anticipoPendiente
    ? { insignia: 'Esperando tu anticipo', tono: 'advertencia' as const, titulo: `Paga ${anticipo && order.deliveryFee && Math.abs(Number(order.deliveryFee) - anticipo.monto) < 0.5 ? 'el envío' : 'el anticipo'} para confirmar tu pedido` }
    : encabezadoBase
  const pasos = pasosPedido(vista, order.deliveryType, esRestaurante)
  const items = data.items ?? []
  const porPagar = vista === 'pagar' || vista === 'pago_fallido'
  const abiertos = productosAbiertos ?? (porPagar || vista === 'recibido')
  const apartado = data.pago?.apartadoHasta ?? null
  const restante = textoRestante(minutosRestantes(apartado, ahora))
  const metodoPedido = order.paymentMethod || ''
  const otros = (data.pago?.metodos ?? []).filter((m) => anticipoPendiente
    ? codigoConector(m.code) !== null && codigoConector(m.code) !== codigoConector(anticipo?.pasarela)
    : m.code !== metodoPedido)
  // Dirección: completa en la consulta validada (número + correo o teléfono), incompleta con el
  // enlace del correo; sin token, ninguna (la ruta no la entrega).
  const direccionVista = data.verificado
    ? (conDireccionCompleta ? direccionCompleta(order.deliveryAddress) : null) ?? order.direccionIncompleta ?? null
    : null
  const direccionEsCompleta = data.verificado && conDireccionCompleta && !!direccionCompleta(order.deliveryAddress)
  const entregadoEn = order.status === 'delivered'
    ? data.timeline.find((e) => e.key === 'delivered')?.timestamp ?? shipment?.deliveredAt ?? null
    : null

  const fechaPlana = (fecha: string) =>
    new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${fecha.slice(0, 10)}T12:00:00Z`))
  const formatoMoneda = (monto: number, moneda: string | null) => {
    if (!moneda) return `$${monto.toLocaleString('es-CO')}`
    try {
      return new Intl.NumberFormat('es-CO', { style: 'currency', currency: moneda, maximumFractionDigits: 0 }).format(monto)
    } catch {
      return `$${monto.toLocaleString('es-CO')}`
    }
  }
  // Cuándo llega: la hora estimada del pedido o la fecha esperada del envío; si no hay, no se inventa.
  const llegada = order.estimatedDeliveryAt
    ? `Llega ${cuando(order.estimatedDeliveryAt, zona)}`
    : order.estimatedDeliveryDate
      ? `Llega el ${fechaPlana(order.estimatedDeliveryDate)}`
      : null

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(order.orderNumber)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      /* sin portapapeles: el número sigue visible */
    }
  }

  const botonPrincipal = (texto: string, onClick: () => void, icono: typeof Lock, ocupado = false) => {
    const Icono = icono
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!!pagando}
        className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-70"
        style={{ backgroundColor: primaryColor }}
      >
        {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icono className="h-4 w-4" aria-hidden="true" />}
        {texto}
      </button>
    )
  }

  const listaOtrosMedios = otrosMedios && otros.length > 0 ? (
    <ul className="space-y-2" aria-label="Otros medios de pago">
      {otros.map((m) => (
        <li key={m.code}>
          <button
            type="button"
            onClick={() => pagar(m.code)}
            disabled={!!pagando}
            className="flex w-full items-center justify-between rounded-xl border bg-white px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-70"
          >
            <span className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-gray-500" aria-hidden="true" />{m.name}</span>
            {pagando === m.code ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          </button>
        </li>
      ))}
    </ul>
  ) : null

  return (
    <div className={incrustado ? 'w-full pb-16' : 'container mx-auto max-w-xl px-4 pt-6 pb-28'} data-order-tracker={incrustado ? 'incrustado' : ''}>
      <div className="flex flex-col gap-3">
        {/* Estado y Ayuda (dentro de la página: ya no se monta sobre la cabecera de la tienda) */}
        <div className="flex items-center justify-between gap-3">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONO_INSIGNIA[encabezado.tono]}`}>
            {encabezado.insignia}
          </span>
          {hayAyuda && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAyudaAbierta((v) => !v)}
                aria-expanded={ayudaAbierta}
                aria-controls="ayuda-pedido"
                className="inline-flex items-center gap-1.5 text-sm font-medium"
                style={{ color: primaryColor }}
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" /> Ayuda
              </button>
              {ayudaAbierta && (
                <div
                  id="ayuda-pedido"
                  role="dialog"
                  aria-label="¿Necesitas ayuda con tu pedido?"
                  className="absolute right-0 top-7 z-20 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border bg-white p-4 shadow-lg"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">¿Necesitas ayuda con tu pedido?</p>
                      <p className="text-xs text-gray-500">Te respondemos por estos canales. Pedido {order.orderNumber}.</p>
                    </div>
                    <button type="button" onClick={() => setAyudaAbierta(false)} aria-label="Cerrar" className="text-gray-400 hover:text-gray-700">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <ul className="space-y-1">
                    {whatsapp && (
                      <li>
                        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 rounded-lg p-2 hover:bg-gray-50">
                          <MessageCircle className="mt-0.5 h-4 w-4 text-gray-600" />
                          <span><span className="block text-sm font-medium text-gray-900">Escribir por WhatsApp</span><span className="block text-xs text-gray-500">Mensaje ya escrito con el número del pedido</span></span>
                        </a>
                      </li>
                    )}
                    {ayuda.telefono && (
                      <li>
                        <a href={`tel:${ayuda.telefono}`} className="flex items-start gap-3 rounded-lg p-2 hover:bg-gray-50">
                          <Phone className="mt-0.5 h-4 w-4 text-gray-600" />
                          <span><span className="block text-sm font-medium text-gray-900">Llamar a la tienda</span><span className="block text-xs text-gray-500">{ayuda.telefono}</span></span>
                        </a>
                      </li>
                    )}
                    {ayuda.correo && (
                      <li>
                        <a href={`mailto:${ayuda.correo}?subject=${encodeURIComponent(`Pedido ${order.orderNumber}`)}`} className="flex items-start gap-3 rounded-lg p-2 hover:bg-gray-50">
                          <Mail className="mt-0.5 h-4 w-4 text-gray-600" />
                          <span><span className="block text-sm font-medium text-gray-900">Enviar correo</span><span className="block text-xs text-gray-500">{ayuda.correo}</span></span>
                        </a>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <h1 className="text-2xl font-semibold leading-tight text-gray-900">{encabezado.titulo}</h1>

        {/* Número del pedido: pequeño y con «Copiar» */}
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-[13px] text-gray-600">
            <span className="block break-all">Pedido {order.orderNumber}</span>
            <span className="block">
              {fechaHoraPedido(order.createdAt, zona)}
              {' · '}{sinEmoji(etiquetaTipoEntrega(order.deliveryType, esRestaurante))}
              {order.mesa ? ` · ${etiquetaMesa(order.mesa)}` : ''}
            </span>
          </p>
          <button type="button" onClick={copiar} className="inline-flex flex-shrink-0 items-center gap-1 text-[13px] font-medium" style={{ color: primaryColor }}>
            {copiado ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>

        {/* Barra de 4 pasos */}
        <ol className="grid grid-cols-4 gap-1.5" aria-label="Avance del pedido">
          {pasos.map((p) => (
            <li key={p.etiqueta} className="flex flex-col gap-1.5" aria-current={p.estado === 'actual' || p.estado === 'error' ? 'step' : undefined}>
              <span
                className="h-1 rounded-full"
                style={{
                  backgroundColor: p.estado === 'error' ? '#DC2626' : p.estado === 'pendiente' ? '#E2E8F0' : primaryColor,
                  opacity: p.estado === 'actual' ? 0.45 : 1,
                }}
              />
              <span className={`text-xs ${p.estado === 'pendiente' ? 'text-gray-400' : p.estado === 'error' ? 'font-semibold text-red-600' : p.estado === 'actual' ? 'font-semibold text-gray-900' : 'font-medium text-gray-900'}`}>
                {p.etiqueta}
              </span>
            </li>
          ))}
        </ol>

        {/* «Se actualiza solo · hace N s» (Figma 3067:82625): reemplaza el botón «Actualizar» del
            final. Con el pedido entregado o cancelado no sale: la página deja de actualizarse. */}
        {!isFinal && (
          <LineaActualiza
            actualizadoEn={actualizadoEn}
            actualizando={actualizando}
            recien={recien}
            sinConexion={sinConexion}
            estadoPedido={encabezado.insignia}
            onActualizar={() => void actualizarAhora()}
          />
        )}

        {/* Lo que hay que hacer ahora, según el estado */}
        {vista === 'pagar' && (
          <Tarjeta className="flex flex-col gap-3 border-amber-200 bg-amber-50">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">Total a pagar</span>
              <span className="text-lg font-bold text-gray-900">{pesos(order.total)}</span>
            </div>
            {apartado && (
              <FilaInfo icono={Clock} titulo={`Apartamos tus productos hasta las ${horaPedido(apartado, zona)}`} detalle={restante ? `${restante} Después se liberan para otros clientes.` : null} color="#0F172A" />
            )}
            {botonPrincipal(`Pagar ${pesos(order.total)}`, () => pagar(metodoPedido), Lock, pagando === metodoPedido)}
            {otros.length > 0 && (
              <button type="button" onClick={() => setOtrosMedios((v) => !v)} className="text-sm font-medium text-gray-900">
                {otrosMedios ? 'Ocultar otros medios' : 'Pagar con otro medio'}
              </button>
            )}
            {listaOtrosMedios}
            {errorPago && <p role="alert" className="text-sm text-red-700">{errorPago}</p>}
            <p className="text-xs text-gray-600">Si ya pagaste, puede tardar unos minutos en verse aquí. Esta página se actualiza sola.</p>
          </Tarjeta>
        )}

        {vista === 'pago_fallido' && (
          <Tarjeta className="flex flex-col gap-3 border-red-200 bg-red-50">
            <FilaInfo icono={XCircle} titulo="El pago no fue aprobado" detalle="No se hizo ningún cobro. Puedes intentarlo otra vez o pagar con otro medio." color="#DC2626" />
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">Total a pagar</span>
              <span className="text-lg font-bold text-gray-900">{pesos(order.total)}</span>
            </div>
            {botonPrincipal('Intentar de nuevo', () => pagar(metodoPedido), RefreshCw, pagando === metodoPedido)}
            {otros.length > 0 && (
              <button type="button" onClick={() => setOtrosMedios((v) => !v)} className="flex items-center justify-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-medium text-gray-900">
                <CreditCard className="h-4 w-4" aria-hidden="true" /> {otrosMedios ? 'Ocultar otros medios' : 'Pagar con otro medio'}
              </button>
            )}
            {listaOtrosMedios}
            {errorPago && <p role="alert" className="text-sm text-red-700">{errorPago}</p>}
            {apartado && <FilaInfo icono={Clock} titulo={`Tus productos siguen apartados hasta las ${horaPedido(apartado, zona)}`} color="#0F172A" />}
          </Tarjeta>
        )}

        {vista === 'vencido' && (
          <Tarjeta className="flex flex-col gap-3 bg-gray-50">
            <FilaInfo icono={Clock} titulo="El pedido no se pagó a tiempo" detalle="Liberamos los productos para otros clientes. No se hizo ningún cobro." color="#475569" />
            {data.rutas.retomar
              ? <a href={data.rutas.retomar} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white" style={{ backgroundColor: primaryColor }}><ShoppingBag className="h-4 w-4" aria-hidden="true" /> Retomar mi compra</a>
              : <p className="text-xs text-gray-600">Para retomar tu compra con los mismos productos, abre el enlace del correo de tu pedido.</p>}
          </Tarjeta>
        )}

        {anticipoPendiente && anticipo && (
          <Tarjeta className="flex flex-col gap-3 border-amber-200 bg-amber-50">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">Anticipo{Math.abs(Number(order.deliveryFee) - anticipo.monto) < 0.5 ? ' (el envío)' : ''}</span>
              <span className="text-lg font-bold text-gray-900">{pesos(anticipo.monto)}</span>
            </div>
            {anticipo.venceEn && (
              <FilaInfo icono={Clock} titulo={`Apartamos tus productos hasta las ${horaPedido(anticipo.venceEn, zona)}`} detalle={`${textoRestante(minutosRestantes(anticipo.venceEn, ahora)) ?? ''} Si no pagas el anticipo, el pedido se cancela sin cobro y los productos se liberan.`.trim()} color="#0F172A" />
            )}
            {anticipo.pasarela && botonPrincipal(`Pagar ${pesos(anticipo.monto)}`, () => pagar(anticipo.pasarela as string), Lock, pagando === anticipo.pasarela)}
            {otros.length > 0 && (
              <button type="button" onClick={() => setOtrosMedios((v) => !v)} className="text-sm font-medium text-gray-900">
                {otrosMedios ? 'Ocultar otros medios' : 'Pagar con otro medio'}
              </button>
            )}
            {listaOtrosMedios}
            {errorPago && <p role="alert" className="text-sm text-red-700">{errorPago}</p>}
            <FilaInfo icono={Banknote} titulo={`Al recibir pagas ${pesos(alRecibirVista)}`} detalle={`${anticipo.medios ? `${anticipo.medios}. ` : ''}${order.deliveryType === 'delivery_own' ? 'El domiciliario te lo cobra al entregarte.' : 'Te lo cobran al entregarte el pedido.'}`} color="#0F172A" />
            <p className="text-xs text-gray-600">Si ya pagaste, puede tardar unos minutos en verse aquí. Esta página se actualiza sola.</p>
          </Tarjeta>
        )}

        {anticipoPagado && anticipo && !logistica?.contraentrega?.pendiente && (
          <Tarjeta className="flex flex-col gap-2 border-orange-200 bg-orange-50">
            <p className="flex items-center gap-2 text-sm font-medium" style={{ color: primaryColor }}><Banknote className="h-4 w-4" aria-hidden="true" /> Pagas al recibir</p>
            <p className="text-3xl font-bold text-gray-900">{pesos(anticipo.alRecibir)}</p>
            <p className="text-sm text-gray-600">{anticipo.medios ? `${anticipo.medios}. ` : ''}Ten el valor listo para que la entrega sea rápida.</p>
            <p className="flex items-start gap-2 rounded-lg bg-white px-3 py-2 text-sm text-green-700"><Check className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" /> Anticipo pagado: {pesos(anticipo.monto)}{Math.abs(Number(order.deliveryFee) - anticipo.monto) < 0.5 ? ' (el envío)' : ''}{anticipo.nombrePasarela ? ` con ${anticipo.nombrePasarela}` : ''}</p>
          </Tarjeta>
        )}

        {vista === 'recibido' && !anticipoPendiente && (
          <Tarjeta className="flex flex-col gap-2" style={{ backgroundColor: `${primaryColor}0D`, borderColor: `${primaryColor}33` }}>
            <FilaInfo icono={Info} titulo="La tienda confirma tu pedido en breve" detalle="Te avisamos por WhatsApp y correo. Esta página se actualiza sola." color={primaryColor} />
          </Tarjeta>
        )}

        {(vista === 'preparando' || vista === 'listo' || vista === 'en_camino') && (llegada || order.estimatedReadyAt) && (
          <Tarjeta style={{ backgroundColor: `${primaryColor}0D`, borderColor: `${primaryColor}33` }}>
            <FilaInfo
              icono={domicilio ? Truck : Store}
              titulo={llegada ?? `Listo aprox. ${horaPedido(order.estimatedReadyAt as string, zona)}`}
              detalle={domicilio ? 'Te avisamos por WhatsApp y correo cuando salga.' : null}
              color={primaryColor}
            />
          </Tarjeta>
        )}

        {vista === 'entregado' && (
          <Tarjeta className="border-green-200 bg-green-50">
            <FilaInfo
              icono={PackageCheck}
              titulo={entregadoEn ? `${encabezado.insignia} ${cuando(entregadoEn, zona)}` : encabezado.insignia}
              detalle={direccionVista ? `En ${direccionVista}.` : null}
              color="#16A34A"
            />
          </Tarjeta>
        )}

        {vista === 'cancelado' && (
          <Tarjeta className="bg-gray-50">
            <FilaInfo icono={XCircle} titulo={encabezado.titulo} detalle={order.cancellationReason || (order.paymentStatus === 'paid' ? 'Si pagaste, la tienda te devuelve el dinero.' : 'No se hizo ningún cobro.')} color="#475569" />
          </Tarjeta>
        )}

        {/* Logística (Figma 2804:13320): quién lo lleva, código de entrega, pagas al recibir y novedad */}
        {logistica && !isFinal && logistica.domiciliario && (
          <Tarjeta>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ backgroundColor: primaryColor }} aria-hidden="true">
                {logistica.domiciliario.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{logistica.domiciliario} te lo lleva</p>
                <p className="text-xs text-gray-500">Domiciliario de la tienda</p>
              </div>
            </div>
            {whatsapp && (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50">
                <MessageCircle className="h-4 w-4" /> Escribir a la tienda por WhatsApp
              </a>
            )}
          </Tarjeta>
        )}

        {logistica?.codigoEntrega && (
          <div className="rounded-2xl border p-4" style={{ backgroundColor: `${primaryColor}0D`, borderColor: `${primaryColor}40` }}>
            <p className="font-semibold text-gray-900">Tu código de entrega</p>
            <div className="mt-3 flex gap-2" aria-label={`Código ${logistica.codigoEntrega.split('').join(' ')}`}>
              {logistica.codigoEntrega.split('').map((d, i) => (
                <span key={i} aria-hidden="true" className="flex h-14 w-12 items-center justify-center rounded-lg border bg-white text-2xl font-semibold text-gray-900">{d}</span>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-600">Dáselo a quien te entregue. Así sabemos que llegó a la persona correcta.</p>
          </div>
        )}

        {logistica?.contraentrega?.pendiente && !isFinal && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="flex items-center gap-2 font-semibold text-gray-900">
              <Banknote className="h-4 w-4" /> Pagas al recibir: {formatoMoneda(logistica.contraentrega.monto, logistica.contraentrega.moneda)}
            </p>
            <p className="mt-1 text-xs text-gray-600">Efectivo, datáfono o transferencia. Si pagas en efectivo, ten el valor exacto si puedes.</p>
          </div>
        )}

        {logistica?.novedad && !isFinal && (
          <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-gray-900">No pudimos entregar tu pedido</p>
            <p className="mt-1 text-sm text-gray-700">{logistica.novedad}.{logistica.fechaEstimada ? ` Lo intentamos de nuevo el ${fechaPlana(logistica.fechaEstimada)}.` : ' Te contactamos para acordar una nueva entrega.'}</p>
          </div>
        )}

        {/* Barra de tiempo estimado (solo restaurante en preparación) */}
        {!isRetail && ['confirmed', 'preparing'].includes(order.status) && order.organizationId && (
          <EstimatedTime
            organizationId={order.organizationId}
            branchId={order.branchId || undefined}
            orderCreatedAt={order.createdAt}
            primaryColor={primaryColor}
          />
        )}

        {/* Entregado: factura, calificación y volver a comprar */}
        {vista === 'entregado' && data.factura && (
          <Tarjeta className="flex flex-col gap-2.5">
            <p className="font-semibold text-gray-900">Tu factura</p>
            <p className="text-[13px] text-gray-600">Factura {data.factura.numero || ''} · {pesos(data.factura.total)}. También te llegó al correo.</p>
            <a href={`/mi-cuenta/facturas/${data.factura.id}`} className="flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50">
              <FileText className="h-4 w-4" aria-hidden="true" /> Ver mi factura
            </a>
          </Tarjeta>
        )}

        {vista === 'entregado' && data.verificado && items.some((i) => i.productId !== null) && (
          <Tarjeta className="flex flex-col gap-3">
            <p className="font-semibold text-gray-900">¿Cómo te fue con tu compra?</p>
            <ul className="flex flex-col gap-3">
              {items.filter((i) => i.productId !== null).slice(0, 5).map((i) => {
                const dado = calificados[i.productId as number]
                return (
                  <li key={i.productId} className="flex flex-col gap-1">
                    <span className="text-sm text-gray-900">{i.name}</span>
                    {dado ? (
                      <span className="text-[13px] text-green-700">¡Gracias! Calificaste con {dado} {dado === 1 ? 'estrella' : 'estrellas'}.</span>
                    ) : (
                      <div className="flex gap-1" role="group" aria-label={`Calificar ${i.name}`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} type="button" onClick={() => calificar(i, n)} aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`} className="rounded p-0.5 text-amber-500 hover:scale-110">
                            <Star className="h-6 w-6" aria-hidden="true" />
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            {errorCalificar && <p role="alert" className="text-sm text-red-700">{errorCalificar}</p>}
            <p className="text-[13px] text-gray-600">Tu opinión ayuda a otros clientes. Toma 10 segundos.</p>
          </Tarjeta>
        )}

        {/* Productos y resumen (abiertos si falta el pago; si no, plegados en una línea) */}
        <Tarjeta className="flex flex-col gap-3">
          <button type="button" onClick={() => setProductosAbiertos(!abiertos)} aria-expanded={abiertos} className="flex items-center justify-between gap-2 text-left">
            <span className="font-semibold text-gray-900">
              Tu pedido{items.length ? ` · ${items.length} ${items.length === 1 ? 'producto' : 'productos'}` : ''}
            </span>
            <span className="flex items-center gap-1 text-sm font-semibold text-gray-900">
              {!abiertos && pesos(order.total)}
              <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${abiertos ? 'rotate-180' : ''}`} aria-hidden="true" />
            </span>
          </button>
          {abiertos && (
            <>
              {items.length > 0 && (
                <ul className="flex flex-col gap-3">
                  {items.map((i, idx) => (
                    <li key={`${i.productId ?? 'x'}-${idx}`} className="flex items-center gap-3">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-slate-100">
                        <FotoLinea url={i.imageUrl} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">{i.name}</p>
                        <p className="text-[13px] text-gray-600">{i.quantity.toLocaleString('es-CO')} × {pesos(i.unitPrice)}</p>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{pesos(i.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-col gap-2 border-t pt-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{pesos(order.subtotal)}</span></div>
                {Number(order.taxTotal) > 0 && <div className="flex justify-between"><span className="text-gray-600">Impuestos</span><span>{pesos(order.taxTotal)}</span></div>}
                {Number(order.deliveryFee) > 0 && <div className="flex justify-between"><span className="text-gray-600">Envío</span><span>{pesos(order.deliveryFee)}</span></div>}
                {Number(order.tipAmount) > 0 && <div className="flex justify-between"><span className="text-gray-600">Propina</span><span>{pesos(order.tipAmount)}</span></div>}
                {Number(order.discountTotal) > 0 && <div className="flex justify-between text-green-700"><span>Descuento</span><span>-{pesos(order.discountTotal)}</span></div>}
                <div className="flex justify-between text-base font-bold"><span>Total</span><span>{pesos(order.total)}</span></div>
                {anticipo && anticipo.estado !== 'expired' && (
                  <>
                    <div className={`flex justify-between ${anticipo.estado === 'paid' ? 'text-green-700' : 'text-amber-700'}`}><span>{anticipo.estado === 'paid' ? 'Anticipo pagado' : 'Anticipo hoy (pendiente)'}</span><span>{anticipo.estado === 'paid' ? '− ' : ''}{pesos(anticipo.monto)}</span></div>
                    <div className="flex justify-between font-bold"><span>{anticipo.estado === 'paid' ? 'Por pagar al recibir' : 'Al recibir (después del anticipo)'}</span><span>{pesos(alRecibirVista)}</span></div>
                  </>
                )}
              </div>
            </>
          )}
        </Tarjeta>

        {/* Entrega */}
        <Tarjeta className="flex flex-col gap-3">
          <p className="font-semibold text-gray-900">Entrega</p>
          <FilaInfo
            icono={domicilio ? Truck : Store}
            titulo={sinEmoji(etiquetaTipoEntrega(order.deliveryType, esRestaurante))}
            detalle={[
              order.isScheduled && order.scheduledAt ? `Programado para ${cuando(order.scheduledAt, zona)}` : null,
              vista !== 'entregado' && llegada ? llegada : null,
              order.paymentStatus === 'paid' ? `Pagado${order.paymentDetail ? ` con ${order.paymentDetail}` : order.paymentMethodName ? ` con ${order.paymentMethodName}` : ''} · ${pesos(order.total)}` : null,
            ].filter(Boolean).join(' · ') || null}
            color={primaryColor}
          />
          {direccionVista && (
            <FilaInfo icono={MapPin} titulo={direccionVista} detalle={direccionEsCompleta ? null : 'Mostramos la dirección incompleta para cuidar tus datos.'} />
          )}
          {order.sede && <FilaInfo icono={Store} titulo={`${domicilio ? 'Despacha' : 'Recoges en'}: ${order.sede}`} />}
          {!data.verificado && (
            <p className="text-xs text-gray-500">Para ver la dirección y los datos del envío, abre el enlace de tu correo de confirmación.</p>
          )}
        </Tarjeta>

        {/* Shipment info (transportadora y guía) */}
        {shipment && (shipment.carrier || shipment.trackingNumber) && (
          <Tarjeta className="space-y-3">
            <p className="font-semibold text-gray-900">Información de envío</p>
            {shipment.carrier && (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100"><Truck className="h-5 w-5 text-gray-500" aria-hidden="true" /></div>
                <div>
                  <p className="font-medium text-sm">{shipment.carrier.name}</p>
                  {shipment.carrier.contact_phone && (
                    <a href={`tel:${shipment.carrier.contact_phone}`} className="text-xs flex items-center gap-1" style={{ color: primaryColor }}>
                      <Phone className="h-3 w-3" /> {shipment.carrier.contact_phone}
                    </a>
                  )}
                </div>
              </div>
            )}
            {shipment.trackingNumber && incrustado ? (
              <>
                <p className="text-sm text-gray-500">Guía: <span className="font-medium text-gray-900 break-all">{shipment.trackingNumber}</span></p>
                {shipment.externalTrackingUrl && (
                  <a href={shipment.externalTrackingUrl} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50">
                    <Truck className="h-4 w-4" aria-hidden="true" /> Rastrear en la transportadora <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="sr-only">(se abre en otra pestaña)</span>
                  </a>
                )}
              </>
            ) : shipment.trackingNumber && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Guía: {shipment.trackingNumber}</span>
                {shipment.externalTrackingUrl && (
                  <a href={shipment.externalTrackingUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-medium" style={{ color: primaryColor }}>
                    Ver en la transportadora <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}
          </Tarjeta>
        )}

        {/* Conductor + Vehículo (domicilio, con el enlace verificado) */}
        {domicilio && data.verificado && !isFinal && !logistica && (
          <DeliveryInfo orderIdentifier={orderIdentifier} primaryColor={primaryColor} token={token} />
        )}

        {/* Mapa en vivo (solo cuando está en camino) */}
        {domicilio && data.verificado && order.status === 'in_delivery' && (
          <DeliveryMap
            orderIdentifier={orderIdentifier}
            token={token}
            destinationLat={shipment?.latitude || undefined}
            destinationLng={shipment?.longitude || undefined}
            destinationAddress={
              typeof order.deliveryAddress === 'object'
                ? [order.deliveryAddress?.address, order.deliveryAddress?.city].filter(Boolean).join(', ')
                : undefined
            }
            primaryColor={primaryColor}
          />
        )}

        {/* Historial de la entrega (eventos canónicos de logística) */}
        {logistica && logistica.eventos.length > 0 && (
          <Tarjeta>
            <p className="mb-3 font-semibold text-gray-900">Historial de la entrega</p>
            <ul className="space-y-3">
              {[...logistica.eventos].reverse().map((e, i) => (
                <li key={`${e.estado}-${i}`} className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: primaryColor }} aria-hidden="true" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{e.estado === 'picked' && logistica.domiciliario ? `Recogido por ${logistica.domiciliario}` : e.etiqueta}</p>
                    {e.motivo && <p className="text-xs text-gray-500">{e.motivo}</p>}
                  </div>
                  {e.fecha && <span className="text-xs text-gray-400">{horaPedido(e.fecha, zona)}</span>}
                </li>
              ))}
            </ul>
          </Tarjeta>
        )}

        {/* Intentos de entrega */}
        {deliveryAttempts.length > 0 && (
          <Tarjeta>
            <p className="mb-3 font-semibold text-gray-900">Intentos de entrega</p>
            <div className="space-y-3">
              {deliveryAttempts.map((attempt) => (
                <div key={attempt.attemptNumber} className="flex gap-3 text-sm">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${attempt.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {attempt.attemptNumber}
                  </div>
                  <div>
                    <p className="font-medium">{attempt.status === 'delivered' ? 'Entregado' : 'Intento fallido'}</p>
                    {attempt.failureReason && <p className="text-xs text-gray-500">{attempt.failureReason}</p>}
                    {attempt.driverNotes && <p className="text-xs text-gray-400 italic">{attempt.driverNotes}</p>}
                    <p className="text-xs text-gray-400">{fechaHoraPedido(attempt.attemptedAt, zona)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Tarjeta>
        )}

        {/* ¿Dudas? */}
        {hayAyuda && (
          <Tarjeta className="flex flex-col gap-2.5">
            <p className="font-semibold text-gray-900">
              {vista === 'entregado' ? '¿Algo no está bien?' : porPagar ? '¿Necesitas ayuda para pagar?' : '¿Dudas con tu pedido?'}
            </p>
            <p className="text-[13px] text-gray-600">
              {vista === 'entregado'
                ? 'Si un producto llegó dañado o quieres cambiarlo, escríbenos y lo resolvemos.'
                : 'Te respondemos con el número del pedido ya escrito.'}
            </p>
            {whatsapp ? (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50">
                <MessageCircle className="h-4 w-4" aria-hidden="true" /> Escribir por WhatsApp
              </a>
            ) : ayuda.telefono ? (
              <a href={`tel:${ayuda.telefono}`} className="flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50">
                <Phone className="h-4 w-4" aria-hidden="true" /> Llamar a la tienda
              </a>
            ) : ayuda.correo ? (
              <a href={`mailto:${ayuda.correo}?subject=${encodeURIComponent(`Pedido ${order.orderNumber}`)}`} className="flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50">
                <Mail className="h-4 w-4" aria-hidden="true" /> Enviar correo
              </a>
            ) : null}
          </Tarjeta>
        )}

        {/* Final de la página (opción A): entregado, «Volver a comprar» (principal); siempre, lo
            último, «Seguir comprando/pidiendo» como botón secundario a todo el ancho. Mientras falta
            pagar, el único botón principal sigue siendo «Pagar $ X» (arriba). */}
        {vista === 'entregado' && data.rutas.recompra && (
          <a href={data.rutas.recompra} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white" style={{ backgroundColor: primaryColor }}>
            <ShoppingBag className="h-4 w-4" aria-hidden="true" /> Volver a comprar estos productos
          </a>
        )}
        <Enlace
          href={rutaSeguirPidiendo}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
          data-seguir-comprando=""
        >
          <Store className="h-4 w-4" aria-hidden="true" /> {isRetail ? 'Seguir comprando' : 'Seguir pidiendo'}
        </Enlace>
      </div>
    </div>
  )
}
