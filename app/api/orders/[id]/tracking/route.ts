import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/orders/[id]/tracking
 * Retorna el estado del pedido + shipment + delivery_attempts
 * Acepta id (uuid) o order_number como parámetro
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = (createAdminClient() || createPublicClient()) as any

    // Buscar por uuid o por order_number
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

    let orderQuery = supabase
      .from('web_orders')
      .select(`
        id, order_number, status, delivery_type, delivery_address,
        organization_id, branch_id,
        is_scheduled, scheduled_at,
        tip_amount, subtotal, tax_total, delivery_fee, discount_total, total,
        estimated_ready_at, estimated_delivery_at,
        confirmed_at, ready_at, delivered_at, cancelled_at, cancellation_reason,
        customer_name, customer_phone, customer_notes,
        created_at, updated_at
      `)

    if (isUuid) {
      orderQuery = orderQuery.eq('id', id)
    } else {
      orderQuery = orderQuery.eq('order_number', id)
    }

    const { data: order, error: orderError } = await orderQuery.single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }

    // Obtener tipo de organización
    const { data: orgData } = await supabase
      .from('organizations')
      .select('type_id')
      .eq('id', order.organization_id)
      .single()

    const orgTypeId = orgData?.type_id || 3 // default retail

    // Buscar shipment asociado (source_type='web_order')
    const { data: shipment } = await supabase
      .from('shipments')
      .select(`
        id, shipment_number, status,
        carrier_id, tracking_number, external_tracking_url,
        delivery_address, delivery_city, delivery_contact_name, delivery_contact_phone,
        delivery_latitude, delivery_longitude, delivery_instructions,
        expected_pickup_date, expected_delivery_date,
        picked_at, dispatched_at, delivered_at,
        shipping_fee, notes,
        transport_carriers (
          id, name, code, carrier_type, contact_name, contact_phone
        )
      `)
      .eq('source_type', 'web_order')
      .eq('source_id', order.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Buscar delivery_attempts si hay shipment
    let deliveryAttempts: any[] = []
    if (shipment) {
      const { data: attempts } = await supabase
        .from('delivery_attempts')
        .select('*')
        .eq('shipment_id', shipment.id)
        .order('attempt_number', { ascending: true })

      deliveryAttempts = attempts || []
    }

    // Construir timeline de eventos
    const timeline = buildTimeline(order, shipment, deliveryAttempts, orgTypeId)

    return NextResponse.json({
      order: {
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        deliveryType: order.delivery_type,
        deliveryAddress: order.delivery_address,
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
        customerName: order.customer_name,
        customerNotes: order.customer_notes,
        createdAt: order.created_at,
        organizationId: order.organization_id,
        branchId: order.branch_id,
      },
      shipment: shipment ? {
        id: shipment.id,
        shipmentNumber: shipment.shipment_number,
        status: shipment.status,
        trackingNumber: shipment.tracking_number,
        externalTrackingUrl: shipment.external_tracking_url,
        carrier: shipment.transport_carriers || null,
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
        photoUrls: a.photo_urls,
      })),
      timeline,
      orgTypeId,
    })
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

function buildTimeline(order: any, shipment: any, attempts: any[], orgTypeId: number): TimelineEvent[] {
  const events: TimelineEvent[] = []
  const isRetail = orgTypeId === 3

  // 1. Pedido recibido
  events.push({
    key: 'received',
    label: 'Pedido recibido',
    description: `Pedido #${order.order_number}`,
    timestamp: order.created_at,
    status: 'completed',
    icon: '📋',
  })

  // 2. Confirmado
  events.push({
    key: 'confirmed',
    label: 'Confirmado',
    description: order.confirmed_at
      ? (isRetail ? 'Tu pedido fue confirmado' : 'El restaurante confirmó tu pedido')
      : undefined,
    timestamp: order.confirmed_at,
    status: order.confirmed_at ? 'completed' : (order.status === 'pending' ? 'current' : 'pending'),
    icon: '✅',
  })

  // 3. Preparando / Empacando
  const isPreparing = ['preparing', 'ready', 'shipped', 'delivered', 'completed'].includes(order.status)
  events.push({
    key: 'preparing',
    label: isRetail ? 'Empacando' : 'Preparando',
    description: order.estimated_ready_at
      ? (isRetail
        ? `Estimado: ${new Date(order.estimated_ready_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}`
        : `Estimado: ${new Date(order.estimated_ready_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`)
      : undefined,
    timestamp: isPreparing ? (order.confirmed_at || order.created_at) : null,
    status: isPreparing ? 'completed' : (order.status === 'confirmed' ? 'current' : 'pending'),
    icon: isRetail ? '�' : '�👨‍🍳',
  })

  // 4. Enviado / Listo
  if (isRetail) {
    // Para retail: Enviado (shipped)
    const isShipped = ['shipped', 'delivered', 'completed'].includes(order.status)
    events.push({
      key: 'shipped',
      label: 'Enviado',
      description: shipment?.tracking_number
        ? `Guía: ${shipment.tracking_number}`
        : (isShipped ? 'Tu pedido fue despachado' : undefined),
      timestamp: shipment?.dispatched_at || (isShipped ? order.ready_at : null),
      status: isShipped ? 'completed' : (order.status === 'preparing' ? 'current' : 'pending'),
      icon: '🚚',
    })
  } else {
    // Para restaurante: Listo
    events.push({
      key: 'ready',
      label: 'Listo',
      description: order.ready_at ? 'Tu pedido está listo' : undefined,
      timestamp: order.ready_at,
      status: order.ready_at ? 'completed' : (order.status === 'preparing' ? 'current' : 'pending'),
      icon: '🔔',
    })

    // Delivery: En camino (solo restaurante)
    if (order.delivery_type === 'delivery') {
      const dispatchedAt = shipment?.dispatched_at
      events.push({
        key: 'on_the_way',
        label: 'En camino',
        description: shipment?.transport_carriers?.name
          ? `Repartidor: ${shipment.transport_carriers.name}`
          : undefined,
        timestamp: dispatchedAt,
        status: dispatchedAt ? 'completed' : (order.status === 'ready' ? 'current' : 'pending'),
        icon: '🛵',
      })
    }
  }

  // 5. En camino (retail con delivery)
  if (isRetail && order.delivery_type === 'delivery') {
    const isInTransit = order.status === 'shipped' && shipment?.dispatched_at
    const isDelivered = ['delivered', 'completed'].includes(order.status)
    events.push({
      key: 'in_transit',
      label: 'En camino',
      description: shipment?.transport_carriers?.name
        ? `Transportadora: ${shipment.transport_carriers.name}`
        : undefined,
      timestamp: shipment?.dispatched_at,
      status: isDelivered ? 'completed' : (isInTransit ? 'current' : 'pending'),
      icon: '🛵',
    })
  }

  // 6. Entregado
  const finalLabel = isRetail
    ? 'Entregado'
    : (order.delivery_type === 'delivery'
      ? 'Entregado'
      : order.delivery_type === 'dine_in'
        ? 'Servido'
        : 'Recogido')

  events.push({
    key: 'delivered',
    label: finalLabel,
    timestamp: order.delivered_at || shipment?.delivered_at,
    status: (order.delivered_at || order.status === 'delivered' || order.status === 'completed')
      ? 'completed'
      : 'pending',
    icon: '🎉',
  })

  // Cancelado (si aplica)
  if (order.status === 'cancelled') {
    events.push({
      key: 'cancelled',
      label: 'Cancelado',
      description: order.cancellation_reason || undefined,
      timestamp: order.cancelled_at,
      status: 'completed',
      icon: '❌',
    })
  }

  return events
}
