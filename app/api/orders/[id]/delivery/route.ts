import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/orders/[id]/delivery
 *
 * Retorna información de delivery para un pedido:
 * - Datos del conductor asignado (nombre, teléfono, foto)
 * - Datos del vehículo (placa, tipo, color, marca, modelo)
 * - Último evento GPS (lat, lng, timestamp)
 * - Estado del shipment
 *
 * Busca: web_orders → shipments → metadata.driver_id → driver_credentials → profiles
 *                                → metadata.vehicle_id → vehicles
 *                                → transport_events (último GPS)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createAdminClient() || createPublicClient()
  const { id } = await params

  try {
    // 1. Buscar el web_order (por order_number o id)
    let orderQuery = (supabase as any)
      .from('web_orders')
      .select('id, order_number, status, delivery_type, delivery_address, organization_id')

    // Intentar por order_number primero, luego por id
    const isUuid = id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/i)
    if (isUuid) {
      orderQuery = orderQuery.eq('id', id)
    } else {
      orderQuery = orderQuery.eq('order_number', id)
    }

    const { data: order } = await orderQuery.single()
    if (!order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }

    // 2. Buscar shipment asociado
    const { data: shipment } = await (supabase as any)
      .from('shipments')
      .select('id, status, tracking_number, expected_delivery_date, picked_at, delivered_at, dispatched_at, metadata, delivery_latitude, delivery_longitude, delivery_address, delivery_contact_name')
      .eq('source_type', 'web_order')
      .eq('source_id', order.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!shipment) {
      return NextResponse.json({
        hasDelivery: false,
        message: 'No hay envío asociado a este pedido',
      })
    }

    const result: any = {
      hasDelivery: true,
      shipment: {
        id: shipment.id,
        status: shipment.status,
        trackingNumber: shipment.tracking_number,
        expectedDeliveryDate: shipment.expected_delivery_date,
        pickedAt: shipment.picked_at,
        deliveredAt: shipment.delivered_at,
        dispatchedAt: shipment.dispatched_at,
        deliveryLatitude: shipment.delivery_latitude,
        deliveryLongitude: shipment.delivery_longitude,
      },
      driver: null,
      vehicle: null,
      lastEvent: null,
      proofOfDelivery: null,
    }

    const meta = shipment.metadata || {}

    // 3. Obtener datos del conductor
    if (meta.driver_id) {
      const { data: driver } = await (supabase as any)
        .from('driver_credentials')
        .select(`
          id, license_number, license_category,
          employments (
            id,
            organization_members (
              id,
              profiles ( id, first_name, last_name, phone, avatar_url )
            )
          )
        `)
        .eq('id', meta.driver_id)
        .single()

      if (driver) {
        const profile = driver.employments?.organization_members?.profiles
        result.driver = {
          id: driver.id,
          name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : null,
          phone: profile?.phone || null,
          avatarUrl: profile?.avatar_url || null,
          licenseCategory: driver.license_category,
        }
      }
    }

    // 4. Obtener datos del vehículo
    if (meta.vehicle_id) {
      const { data: vehicle } = await (supabase as any)
        .from('vehicles')
        .select('id, plate_number, vehicle_type, brand, model, color, year')
        .eq('id', meta.vehicle_id)
        .single()

      if (vehicle) {
        result.vehicle = {
          id: vehicle.id,
          plateNumber: vehicle.plate_number,
          vehicleType: vehicle.vehicle_type,
          brand: vehicle.brand,
          model: vehicle.model,
          color: vehicle.color,
          year: vehicle.year,
        }
      }
    }

    // 5. Obtener último evento GPS del shipment
    const { data: lastEvent } = await (supabase as any)
      .from('transport_events')
      .select('id, event_type, event_time, latitude, longitude, location_text, description')
      .eq('reference_type', 'shipment')
      .eq('reference_id', shipment.id)
      .not('latitude', 'is', null)
      .order('event_time', { ascending: false })
      .limit(1)
      .single()

    if (lastEvent) {
      result.lastEvent = {
        eventType: lastEvent.event_type,
        eventTime: lastEvent.event_time,
        latitude: lastEvent.latitude,
        longitude: lastEvent.longitude,
        locationText: lastEvent.location_text,
        description: lastEvent.description,
      }
    }

    // 6. Si está entregado, obtener prueba de entrega
    if (shipment.status === 'delivered') {
      const { data: pod } = await (supabase as any)
        .from('proof_of_delivery')
        .select('id, delivered_at, recipient_name, recipient_relationship, signature_url, photo_urls, customer_rating, customer_feedback, notes')
        .eq('shipment_id', shipment.id)
        .single()

      if (pod) {
        result.proofOfDelivery = {
          deliveredAt: pod.delivered_at,
          recipientName: pod.recipient_name,
          recipientRelationship: pod.recipient_relationship,
          signatureUrl: pod.signature_url,
          photoUrls: pod.photo_urls,
          rating: pod.customer_rating,
          feedback: pod.customer_feedback,
          notes: pod.notes,
        }
      }
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Delivery API] Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
