import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'
import { tokenSeguimientoValido } from '@/lib/orders/tokenSeguimiento'
import {
  ESTADOS_SIN_ENTREGA,
  esComerAqui,
  esDomicilio,
  estiloEstado,
  etiquetaEntregaFinal,
} from '@/lib/orders/estados-pedido'
import { ZONA_POR_DEFECTO } from '@/lib/restaurant/horario'
import { fechaHoraPedido, horaPedido } from '@/lib/restaurant/ventanaPedido'
import { direccionIncompleta, leerRastreoLogistica, type CanalesAyuda } from '@/lib/orders/rastreoPublico'
import { grupoDeTransportadora } from '@/lib/shipping/opcionesDomicilio'
import { getWebsitePaymentMethods } from '@/lib/checkout/metodosPagoSitio'
import { filtrarMetodosPorSede } from '@/lib/payments/metodosPorSucursal'
import { fotosDeProductos } from '@/lib/orders/fotosLinea'
import { rutaRetomar } from '@/lib/orders/tokenSeguimiento'
import { decisionRetoma } from '@/lib/orders/compraPendiente'
import { apartadoHasta, nombrePublicoSede, vistaPedido } from '@/lib/orders/consultaPedido'
import { cobroEnPuerta, CONDICIONES_POR_DEFECTO } from '@/lib/contraentrega/reglaContraentrega'
import { fraseMedios, nombrePasarela } from '@/lib/contraentrega/textosContraentrega'
import { leerCondicionesContraentrega } from '@/lib/contraentrega/contraentregaServidor'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SIN_CACHE = { 'Cache-Control': 'no-store' }

function noEncontrado() {
  return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404, headers: SIN_CACHE })
}

/** «Mesa: 4 (Terraza)» de `internal_notes` (lo escribe /api/orders con la mesa validada). */
function mesaDeNotas(notas: string | null): string | null {
  const m = /Mesa:\s*([^\n]+)/.exec(notas || '')
  return m ? m[1].trim().slice(0, 60) : null
}

/**
 * GET /api/orders/[id]/tracking?t=<token>
 *
 * Estado del pedido, línea de tiempo y totales. Acepta el id (uuid) o el order_number.
 *
 * - Solo pedidos de la organización del HOST (antes cualquier sitio rastreaba pedidos de cualquier
 *   organización). Sin organización en el host u otro dueño: 404, sin confirmar que existe.
 * - Datos personales (dirección, notas, coordenadas) y TODO lo del envío (guía, transportadora,
 *   intentos, rastreo de logística) solo con el token de seguimiento del enlace (`?t=`,
 *   lib/orders/tokenSeguimiento.ts). Sin él o con uno inválido: estado del pedido, línea de
 *   tiempo (sin guía ni transportadora), totales y nombre de pila del cliente.
 * - Nunca, ni con el token: teléfono del domiciliario ni fotos o firmas de la prueba de entrega
 *   (el bucket `shipment-pod` es privado desde el 2026-11-23; `photo_urls` ya no se lee).
 * - Horas formateadas en la zona de la sede (`branches.timezone` → `organizations.timezone`), y
 *   la zona va en la respuesta para que el navegador formatee igual.
 * - Límite por IP (el seguimiento consulta cada 15 s).
 * - Logística Fase 1 (`logistica`): `logistica_rastreo_publico` (solo service role) con el
 *   domiciliario por su primer nombre, «Pagas al recibir», el historial canónico y el código de
 *   entrega SOLO con el token válido (lib/orders/rastreoPublico.ts). La dirección, incompleta y
 *   solo con el token (`direccionIncompleta`).
 * - `ayuda`: los canales de Contacto de la tienda (WhatsApp, teléfono y correo del sitio; si no,
 *   los de la organización). Son públicos: los mismos del pie del sitio.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const limite = checkRateLimit(`tracking:ip:${getClientIP(request)}`, 300, 10 * 60 * 1000)
    if (!limite.allowed) {
      return NextResponse.json({ error: 'Demasiadas consultas. Espera un momento.' }, { status: 429, headers: SIN_CACHE })
    }

    const orgId = await getOrgIdDelHost()
    if (orgId === null) return noEncontrado()

    const supabaseAdmin = createAdminClient()
    if (!supabaseAdmin) {
      console.error('[Tracking] Falta SUPABASE_SERVICE_ROLE_KEY')
      return NextResponse.json({ error: 'Servicio no disponible' }, { status: 503, headers: SIN_CACHE })
    }
    const supabase = supabaseAdmin as any

    let orderQuery = supabase
      .from('web_orders')
      .select(`
        id, order_number, status, delivery_type, delivery_address,
        organization_id, branch_id,
        is_scheduled, scheduled_at,
        tip_amount, subtotal, tax_total, delivery_fee, discount_total, total,
        estimated_ready_at, estimated_delivery_at,
        confirmed_at, ready_at, delivered_at, cancelled_at, cancellation_reason,
        customer_name, customer_notes, internal_notes, payment_status,
        payment_method, payment_method_detail, sale_id,
        advance_amount, advance_status, advance_due_at, advance_gateway,
        created_at, updated_at
      `)
      .eq('organization_id', orgId)

    orderQuery = UUID_RE.test(id) ? orderQuery.eq('id', id) : orderQuery.eq('order_number', id)

    // order_number es único dentro de la organización; maybeSingle: 0 filas no es un error.
    const { data: order, error: orderError } = await orderQuery.maybeSingle()
    if (orderError) console.error('[Tracking] Error leyendo el pedido', { orgId, error: orderError.message })
    if (orderError || !order) return noEncontrado()

    const verificado = tokenSeguimientoValido(orgId, order.id, request.nextUrl.searchParams.get('t'))

    const [{ data: orgData }, { data: sede }] = await Promise.all([
      supabase.from('organizations').select('type_id, timezone').eq('id', orgId).maybeSingle(),
      order.branch_id
        ? supabase.from('branches').select('name, timezone').eq('id', order.branch_id).eq('organization_id', orgId).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    const orgTypeId = orgData?.type_id || 3 // default retail
    const zona: string = sede?.timezone || orgData?.timezone || ZONA_POR_DEFECTO

    // Shipment del pedido (source_type='web_order'), de esta organización.
    const { data: shipment } = await supabase
      .from('shipments')
      .select(`
        id, shipment_number, status,
        carrier_id, tracking_number, external_tracking_url,
        delivery_latitude, delivery_longitude,
        expected_delivery_date,
        picked_at, dispatched_at, delivered_at,
        transport_carriers (
          id, name, contact_phone, carrier_type
        )
      `)
      .eq('organization_id', orgId)
      .eq('source_type', 'web_order')
      .eq('source_id', order.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let deliveryAttempts: any[] = []
    if (shipment && verificado) {
      const { data: attempts } = await supabase
        .from('delivery_attempts')
        .select('attempt_number, attempted_at, status, failure_reason_text, driver_notes, latitude, longitude')
        .eq('shipment_id', shipment.id)
        .order('attempt_number', { ascending: true })
      deliveryAttempts = attempts || []
    }

    // Logística Fase 1: rastreo canónico del envío (solo con el token válido) y canales de Ayuda
    // de la tienda.
    const [{ data: rastreo, error: errorRastreo }, { data: ajustesSitio }, { data: orgContacto }] = await Promise.all([
      shipment && verificado
        ? supabase.rpc('logistica_rastreo_publico', { p_organization_id: orgId, p_web_order_id: order.id })
        : Promise.resolve({ data: null, error: null }),
      supabase.from('website_settings').select('whatsapp_number, contact_phone, contact_email').eq('organization_id', orgId).is('branch_id', null).maybeSingle(),
      supabase.from('organizations').select('phone, email').eq('id', orgId).maybeSingle(),
    ])
    if (errorRastreo) console.error('[Tracking] logistica_rastreo_publico falló', { orgId, error: errorRastreo.message })
    const logistica = verificado ? leerRastreoLogistica(rastreo, verificado) : null
    const ayuda: CanalesAyuda = {
      whatsapp: ajustesSitio?.whatsapp_number || null,
      telefono: ajustesSitio?.contact_phone || orgContacto?.phone || null,
      correo: ajustesSitio?.contact_email || orgContacto?.email || null,
    }

    // Sin token, la línea de tiempo solo con las horas del envío (sin guía ni transportadora).
    const shipmentTimeline = shipment && !verificado
      ? { dispatched_at: shipment.dispatched_at, delivered_at: shipment.delivered_at }
      : shipment
    const timeline = buildTimeline(order, shipmentTimeline, orgTypeId, zona)
    const comerAqui = esComerAqui(order.delivery_type, order.internal_notes)

    // Consulta del pedido (Figma «21 Logística» › 10, 2026-11-24). `ligero=1` lo manda la consulta
    // que se repite cada 15 s: no vuelve a leer productos, medios de pago ni factura (no cambian).
    const ligero = request.nextUrl.searchParams.get('ligero') === '1'
    const porPagar = order.status === 'pending' && order.payment_status !== 'paid'
    const metodoPedido: string = String(order.payment_method || '')
    const [nativoRes, plazoRes, metodosSitio, itemsRes, facturaRes] = await Promise.all([
      // Pasarela = método no nativo (misma regla de `fn_web_order_metodo_nativo` y del vencimiento).
      porPagar && metodoPedido
        ? supabase.rpc('fn_web_order_metodo_nativo', { p_organization_id: orgId, p_metodo: metodoPedido })
        : Promise.resolve({ data: null, error: null }),
      porPagar
        ? supabase.rpc('fn_web_order_plazo_minutos', { p_organization_id: orgId, p_payment_method: metodoPedido || null, p_por_defecto: 30 })
        : Promise.resolve({ data: null, error: null }),
      porPagar && !ligero ? getWebsitePaymentMethods(orgId) : Promise.resolve(null),
      ligero
        ? Promise.resolve({ data: null, error: null })
        : supabase
            .from('web_order_items')
            .select('product_id, product_name, quantity, unit_price, total')
            .eq('web_order_id', order.id)
            .order('created_at', { ascending: true }),
      verificado && !ligero && order.sale_id && order.status === 'delivered'
        ? supabase
            .from('invoice_sales')
            .select('id, number, total, status, document_type')
            .eq('organization_id', orgId)
            .eq('sale_id', order.sale_id)
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: null, error: null }),
    ])
    // Contraentrega con anticipo (pantallas 11 y 12): con qué se paga en la puerta («En efectivo, con
    // datáfono o Nequi»), de las condiciones de la sede. Sin anticipo no se consulta nada.
    const mediosAlRecibir = Number(order.advance_amount) > 0
      ? await leerCondicionesContraentrega(supabase, orgId, order.branch_id ?? null)
          .then((c) => fraseMedios((c ?? CONDICIONES_POR_DEFECTO).medios))
          .catch(() => null)
      : null
    if (nativoRes.error) console.error('[Tracking] fn_web_order_metodo_nativo falló', { orgId, error: nativoRes.error.message })
    if (plazoRes.error) console.error('[Tracking] fn_web_order_plazo_minutos falló', { orgId, error: plazoRes.error.message })
    if (itemsRes.error) console.error('[Tracking] No se pudieron leer los productos', { orgId, error: itemsRes.error.message })
    const MANUALES = new Set(['transfer', 'cash', 'bancolombia_transfer', 'bancolombia_collect', 'pse', 'mesa'])
    const esPasarela = porPagar && !!metodoPedido && !MANUALES.has(metodoPedido) && nativoRes.data === false
    const metodosPasarela = metodosSitio
      ? filtrarMetodosPorSede(metodosSitio, order.branch_id).filter((m: any) => m.type === 'gateway').map((m: any) => ({ code: String(m.code), name: String(m.name) }))
      : null
    const nombreMetodo = metodosPasarela?.find((m) => m.code === metodoPedido)?.name ?? null
    const vista = vistaPedido({ status: order.status, paymentStatus: order.payment_status, esPasarela })

    let items: { productId: number | null; name: string; quantity: number; unitPrice: number; total: number; imageUrl: string | null }[] | null = null
    if (!ligero && Array.isArray(itemsRes.data)) {
      const filas = itemsRes.data as { product_id: number | null; product_name: string | null; quantity: unknown; unit_price: unknown; total: unknown }[]
      const fotos = await fotosDeProductos(supabase, orgId, filas.map((f) => Number(f.product_id)).filter((id) => Number.isInteger(id) && id > 0))
      const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
      items = filas.map((f) => {
        const id = Number.isInteger(Number(f.product_id)) && Number(f.product_id) > 0 ? Number(f.product_id) : null
        return {
          productId: id,
          name: String(f.product_name || 'Producto'),
          quantity: num(f.quantity),
          unitPrice: num(f.unit_price),
          total: num(f.total),
          imageUrl: id !== null ? fotos.get(id) ?? null : null,
        }
      })
    }

    const facturas = Array.isArray(facturaRes.data) ? (facturaRes.data as { id: string; number: string | null; total: unknown; status: string | null; document_type: string | null }[]) : []
    const facturaValida = facturas.find((f) => (f.document_type || 'invoice') === 'invoice' && !['void', 'voided', 'cancelled', 'draft', 'rejected'].includes(String(f.status || '')))
    const factura = facturaValida ? { id: facturaValida.id, numero: facturaValida.number, total: Number(facturaValida.total) || 0 } : null

    // Retomar (pedido vencido o cancelado por falta de pago) y volver a comprar (entregado): el mismo
    // enlace firmado de «Retomar mi compra», solo con el token.
    const enlaceRetomar = verificado ? rutaRetomar(orgId, order.id) : null
    const rutas = {
      retomar: enlaceRetomar && decisionRetoma(order.status, order.payment_status) === 'retomar' ? enlaceRetomar : null,
      recompra: enlaceRetomar && order.status === 'delivered' ? `${enlaceRetomar}&recompra=1` : null,
    }

    return NextResponse.json({
      order: {
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        paymentStatus: order.payment_status,
        deliveryType: comerAqui ? 'dine_in' : order.delivery_type,
        mesa: comerAqui ? mesaDeNotas(order.internal_notes) : null,
        // Nombre público de la sede: «Sucursal 562» y parecidos no se muestran.
        sede: nombrePublicoSede(sede?.name),
        paymentMethod: metodoPedido || null,
        paymentMethodName: nombreMetodo,
        // «Tarjeta terminada en 4821»: solo con el token.
        paymentDetail: verificado ? order.payment_method_detail ?? null : null,
        estimatedDeliveryDate: shipment?.expected_delivery_date ?? null,
        deliveryAddress: verificado ? order.delivery_address : null,
        // Lo que se muestra: incompleta, para cuidar los datos (Figma 2804:13320).
        direccionIncompleta: verificado ? direccionIncompleta(order.delivery_address) : null,
        isScheduled: order.is_scheduled,
        scheduledAt: order.scheduled_at,
        tipAmount: order.tip_amount,
        subtotal: order.subtotal,
        taxTotal: order.tax_total,
        deliveryFee: order.delivery_fee,
        discountTotal: order.discount_total,
        total: order.total,
        estimatedReadyAt: order.estimated_ready_at,
        estimatedDeliveryAt: order.estimated_delivery_at,
        // Sin token, solo el nombre de pila.
        customerName: verificado ? order.customer_name : String(order.customer_name || '').split(' ')[0],
        customerNotes: verificado ? order.customer_notes : null,
        cancellationReason: ESTADOS_SIN_ENTREGA.has(order.status) ? order.cancellation_reason : null,
        createdAt: order.created_at,
        organizationId: order.organization_id,
        branchId: order.branch_id,
        // Contraentrega con anticipo (Figma 3019:76125 › 11 y 12): lo que se paga hoy y lo que se paga
        // al recibir. Sin anticipo, null (la página queda como hoy).
        anticipo: Number(order.advance_amount) > 0
          ? {
              monto: Number(order.advance_amount),
              estado: order.advance_status ?? null,
              venceEn: order.advance_status === 'pending' ? order.advance_due_at ?? null : null,
              pasarela: order.advance_gateway ?? null,
              nombrePasarela: order.advance_gateway ? nombrePasarela(order.advance_gateway) : null,
              alRecibir: cobroEnPuerta(order.total, { monto: order.advance_amount, estado: order.advance_status }),
              medios: mediosAlRecibir,
            }
          : null,
      },
      shipment: shipment && verificado ? {
        id: shipment.id,
        shipmentNumber: shipment.shipment_number,
        status: shipment.status,
        trackingNumber: shipment.tracking_number,
        externalTrackingUrl: shipment.external_tracking_url,
        // Teléfono solo de una transportadora de tercero (empresa); nunca en domicilio propio (otro
        // `carrier_type` o modo `own`): ahí puede ser el del domiciliario. Para hablar, «Ayuda».
        // Mismo criterio de grupo que el checkout (grupoDeTransportadora).
        carrier: shipment.transport_carriers
          ? {
              name: shipment.transport_carriers.name,
              contact_phone: grupoDeTransportadora(shipment.transport_carriers.carrier_type) === 'third_party' && logistica?.modo !== 'own'
                ? shipment.transport_carriers.contact_phone
                : null,
            }
          : null,
        pickedAt: shipment.picked_at,
        dispatchedAt: shipment.dispatched_at,
        deliveredAt: shipment.delivered_at,
        expectedDeliveryDate: shipment.expected_delivery_date,
        latitude: shipment.delivery_latitude,
        longitude: shipment.delivery_longitude,
      } : null,
      deliveryAttempts: deliveryAttempts.map(a => ({
        attemptNumber: a.attempt_number,
        attemptedAt: a.attempted_at,
        status: a.status,
        failureReason: a.failure_reason_text,
        driverNotes: a.driver_notes,
        latitude: a.latitude,
        longitude: a.longitude,
      })),
      timeline,
      orgTypeId,
      zona,
      verificado,
      logistica,
      ayuda,
      vista,
      pago: {
        esPasarela,
        apartadoHasta: porPagar && typeof plazoRes.data === 'number' ? apartadoHasta(order.created_at, plazoRes.data) : null,
        // null en la consulta ligera: el navegador conserva la lista anterior.
        metodos: metodosPasarela,
      },
      items,
      factura,
      rutas,
    }, { headers: SIN_CACHE })
  } catch (err) {
    console.error('Error in tracking API:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

interface TimelineEvent {
  key: string
  label: string
  description?: string
  timestamp: string | null
  status: 'completed' | 'current' | 'pending'
  icon: string
}

/**
 * Línea de tiempo con los estados REALES de `web_orders.status` (lib/orders/estados-pedido.ts):
 * pending → confirmed → preparing → ready → in_delivery (solo domicilio) → delivered; y un evento
 * terminal para cancelled, rejected, refunded o expired. Antes se comparaba con 'delivery',
 * 'shipped' y 'completed', que nunca se guardan: un domicilio no pasaba de «Listo».
 */
function buildTimeline(order: any, shipment: any, orgTypeId: number, zona: string): TimelineEvent[] {
  const events: TimelineEvent[] = []
  const isRetail = orgTypeId === 3
  const esRestaurante = orgTypeId === 1
  const domicilio = esDomicilio(order.delivery_type)
  const s: string = order.status
  const cerradoSinEntrega = ESTADOS_SIN_ENTREGA.has(s)
  const orden = ['pending', 'confirmed', 'preparing', 'ready', 'in_delivery', 'delivered']
  const paso = orden.indexOf(s)
  const alcanzo = (estado: string) => paso >= orden.indexOf(estado)

  events.push({
    key: 'received',
    label: 'Pedido recibido',
    description: `Pedido #${order.order_number}`,
    timestamp: order.created_at,
    status: 'completed',
    icon: '📋',
  })

  events.push({
    key: 'confirmed',
    label: 'Confirmado',
    description: order.confirmed_at
      ? (isRetail ? 'Tu pedido fue confirmado' : 'El restaurante confirmó tu pedido')
      : undefined,
    timestamp: order.confirmed_at,
    status: order.confirmed_at || alcanzo('confirmed') ? 'completed' : (s === 'pending' ? 'current' : 'pending'),
    icon: '✅',
  })

  const preparando = alcanzo('preparing')
  events.push({
    key: 'preparing',
    label: isRetail ? 'Empacando' : 'Preparando',
    description: order.estimated_ready_at && !alcanzo('ready')
      ? `Estimado: ${isRetail ? fechaHoraPedido(order.estimated_ready_at, zona) : horaPedido(order.estimated_ready_at, zona)}`
      : undefined,
    timestamp: preparando ? (order.confirmed_at || order.created_at) : null,
    status: alcanzo('ready') ? 'completed' : (s === 'preparing' ? 'current' : (s === 'confirmed' ? 'current' : 'pending')),
    icon: isRetail ? '📦' : '👨‍🍳',
  })

  events.push({
    key: 'ready',
    label: isRetail ? 'Listo para despachar' : 'Listo',
    description: order.ready_at
      ? (domicilio ? 'Saldrá pronto hacia tu dirección' : 'Tu pedido está listo')
      : undefined,
    timestamp: order.ready_at,
    status: order.ready_at || alcanzo('in_delivery') ? 'completed' : (s === 'ready' ? 'current' : 'pending'),
    icon: '🔔',
  })

  if (domicilio) {
    events.push({
      key: 'on_the_way',
      label: 'En camino',
      description: shipment?.tracking_number
        ? `Guía: ${shipment.tracking_number}`
        : shipment?.transport_carriers?.name
          ? `${isRetail ? 'Transportadora' : 'Repartidor'}: ${shipment.transport_carriers.name}`
          : undefined,
      timestamp: shipment?.dispatched_at || null,
      status: alcanzo('delivered') ? 'completed' : (s === 'in_delivery' ? 'current' : 'pending'),
      icon: isRetail ? '🚚' : '🛵',
    })
  }

  events.push({
    key: 'delivered',
    label: etiquetaEntregaFinal(order.delivery_type, esRestaurante, order.internal_notes),
    timestamp: order.delivered_at || shipment?.delivered_at || null,
    status: s === 'delivered' || order.delivered_at ? 'completed' : 'pending',
    icon: '🎉',
  })

  if (cerradoSinEntrega) {
    const estilo = estiloEstado(s)
    events.push({
      key: s,
      label: estilo.etiqueta,
      description: order.cancellation_reason || undefined,
      timestamp: order.cancelled_at || order.updated_at || null,
      status: 'completed',
      icon: estilo.icono,
    })
  }

  return events
}
