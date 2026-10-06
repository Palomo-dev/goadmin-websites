import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'
import { tokenSeguimientoValido } from '@/lib/orders/tokenSeguimiento'

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
 *
 * Solo pedidos de la organización del HOST (404 si no), y conductor, vehículo, GPS y prueba de
 * entrega solo con el token de seguimiento (`?t=`, lib/orders/tokenSeguimiento.ts): sin él, el
 * estado del envío y nada más. Antes cualquier sitio devolvía teléfono, GPS y fotos de entrega
 * de pedidos de cualquier organización.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const limite = checkRateLimit(`delivery:ip:${getClientIP(request)}`, 300, 10 * 60 * 1000)
    if (!limite.allowed) {
      return NextResponse.json({ error: 'Demasiadas consultas. Espera un momento.' }, { status: 429 })
    }
    const orgId = await getOrgIdDelHost()
    if (orgId === null) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    const supabase = createAdminClient()
    if (!supabase) {
      console.error('[Delivery API] Falta SUPABASE_SERVICE_ROLE_KEY')
      return NextResponse.json({ error: 'Servicio no disponible' }, { status: 503 })
    }

    // 1. Buscar el web_order (por order_number o id) de esta organización
    let orderQuery = (supabase as any)
      .from('web_orders')
      .select('id, order_number, status, delivery_type, organization_id')
      .eq('organization_id', orgId)

    // Intentar por order_number primero, luego por id
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    if (isUuid) {
      orderQuery = orderQuery.eq('id', id)
    } else {
      orderQuery = orderQuery.eq('order_number', id)
    }

    const { data: order } = await orderQuery.maybeSingle()
    if (!order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }
    const verificado = tokenSeguimientoValido(orgId, order.id, request.nextUrl.searchParams.get('t'))

    // 2. Buscar shipment asociado
    const { data: shipment } = await (supabase as any)
      .from('shipments')
      .select('id, status, tracking_number, expected_delivery_date, picked_at, delivered_at, dispatched_at, metadata, delivery_latitude, delivery_longitude, delivery_address, delivery_contact_name')
      .eq('organization_id', orgId)
      .eq('source_type', 'web_order')
      .eq('source_id', order.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

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
        deliveryLatitude: verificado ? shipment.delivery_latitude : null,
        deliveryLongitude: verificado ? shipment.delivery_longitude : null,
      },
      driver: null,
      vehicle: null,
      lastEvent: null,
      proofOfDelivery: null,
    }

    // Sin token: solo el estado del envío.
    if (!verificado) {
      return NextResponse.json(result)
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
              id, organization_id,
              profiles ( id, first_name, last_name, phone, avatar_url )
            )
          )
        `)
        .eq('id', meta.driver_id)
        .maybeSingle()

      // Solo un conductor de esta misma organización.
      if (driver && Number(driver.employments?.organization_members?.organization_id) === orgId) {
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
        .select('id, plate, vehicle_type, brand, model, color, year')
        .eq('id', meta.vehicle_id)
        .eq('organization_id', orgId)
        .maybeSingle()

      if (vehicle) {
        result.vehicle = {
          id: vehicle.id,
          plateNumber: vehicle.plate,
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
      .eq('organization_id', orgId)
      .eq('reference_type', 'shipment')
      .eq('reference_id', shipment.id)
      .not('latitude', 'is', null)
      .order('event_time', { ascending: false })
      .limit(1)
      .maybeSingle()

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
        .order('delivered_at', { ascending: false })
        .limit(1)
        .maybeSingle()

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
