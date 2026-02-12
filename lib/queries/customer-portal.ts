/**
 * Queries para el portal del cliente (/mi-cuenta).
 * Todas reciben el customerId (uuid) y organizationId.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'

function getSb() {
  return createServerSupabaseClient()
}

// ─── Conteos para Dashboard ───────────────────────────────────

export async function getCustomerDashboardCounts(customerId: string, organizationId: number) {
  const supabase = await getSb()
  const sb = supabase as any

  const [orders, reservations, addresses, coupons, memberships, checkins, tickets, passes, vehicles, sessions] = await Promise.all([
    sb.from('web_orders').select('id', { count: 'exact', head: true }).eq('customer_id', customerId).eq('organization_id', organizationId),
    sb.from('reservations').select('id', { count: 'exact', head: true }).eq('customer_id', customerId).eq('organization_id', organizationId),
    sb.from('customer_addresses').select('id', { count: 'exact', head: true }).eq('customer_id', customerId).eq('organization_id', organizationId),
    sb.from('coupons').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).or(`customer_id.eq.${customerId},customer_id.is.null`).eq('is_active', true),
    sb.from('memberships').select('id', { count: 'exact', head: true }).eq('customer_id', customerId).eq('organization_id', organizationId).eq('status', 'active'),
    sb.from('member_checkins').select('id', { count: 'exact', head: true }).eq('customer_id', customerId).eq('organization_id', organizationId),
    sb.from('tickets').select('id', { count: 'exact', head: true }).eq('customer_id', customerId).eq('organization_id', organizationId),
    sb.from('parking_passes').select('id', { count: 'exact', head: true }).eq('customer_id', customerId).eq('organization_id', organizationId).eq('status', 'active'),
    sb.from('vehicles').select('id', { count: 'exact', head: true }).eq('customer_id', customerId).eq('organization_id', organizationId),
    sb.from('parking_sessions').select('id', { count: 'exact', head: true }).eq('customer_id', customerId).eq('organization_id', organizationId),
  ])

  return {
    orders: orders.count ?? 0,
    reservations: reservations.count ?? 0,
    addresses: addresses.count ?? 0,
    coupons: coupons.count ?? 0,
    memberships: memberships.count ?? 0,
    checkins: checkins.count ?? 0,
    tickets: tickets.count ?? 0,
    passes: passes.count ?? 0,
    vehicles: vehicles.count ?? 0,
    sessions: sessions.count ?? 0,
  }
}

// ─── Pedidos (web_orders) ─────────────────────────────────────

export async function getCustomerOrders(customerId: string, organizationId: number, limit = 20) {
  const supabase = await getSb()
  const { data } = await (supabase as any)
    .from('web_orders')
    .select('id, order_number, status, payment_status, total, delivery_type, created_at')
    .eq('customer_id', customerId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data || []) as any[]
}

export async function getCustomerOrderDetail(orderId: string, customerId: string) {
  const supabase = await getSb()
  const sb = supabase as any

  const { data: order } = await sb
    .from('web_orders')
    .select('*')
    .eq('id', orderId)
    .eq('customer_id', customerId)
    .single()

  if (!order) return null

  // Items + shipment + delivery_attempts en paralelo
  const [itemsRes, shipmentRes] = await Promise.all([
    sb.from('web_order_items')
      .select('*')
      .eq('web_order_id', orderId)
      .order('created_at', { ascending: true }),
    sb.from('shipments')
      .select(`*, transport_carriers ( id, name, code, contact_phone )`)
      .eq('source_type', 'web_order')
      .eq('source_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  ])

  let deliveryAttempts: any[] = []
  if (shipmentRes.data) {
    const { data: attempts } = await sb
      .from('delivery_attempts')
      .select('*')
      .eq('shipment_id', shipmentRes.data.id)
      .order('attempt_number', { ascending: true })
    deliveryAttempts = attempts || []
  }

  return {
    ...order,
    items: itemsRes.data || [],
    shipment: shipmentRes.data || null,
    deliveryAttempts
  }
}

// ─── Reservaciones ────────────────────────────────────────────

export async function getCustomerReservations(customerId: string, organizationId: number, limit = 20) {
  const supabase = await getSb()
  const { data } = await (supabase as any)
    .from('reservations')
    .select('id, status, resource_type, checkin, checkout, total_estimated, occupant_count, notes, created_at, space_types(name)')
    .eq('customer_id', customerId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data || []) as any[]
}

// ─── Direcciones ──────────────────────────────────────────────

export async function getCustomerAddresses(customerId: string, organizationId: number) {
  const supabase = await getSb()
  const { data } = await (supabase as any)
    .from('customer_addresses')
    .select('*')
    .eq('customer_id', customerId)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
  return (data || []) as any[]
}

// ─── Cupones ──────────────────────────────────────────────────

export async function getCustomerCoupons(customerId: string, organizationId: number) {
  const supabase = await getSb()
  const { data } = await (supabase as any)
    .from('coupons')
    .select('id, code, name, discount_type, discount_value, min_purchase_amount, max_discount_amount, usage_limit_per_customer, usage_count, start_date, end_date, is_active')
    .eq('organization_id', organizationId)
    .or(`customer_id.eq.${customerId},customer_id.is.null`)
    .eq('is_active', true)
    .order('end_date', { ascending: true })
  return (data || []) as any[]
}

// ─── Membresías (gym) ─────────────────────────────────────────

export async function getCustomerMembership(customerId: string, organizationId: number) {
  const supabase = await getSb()
  const { data } = await (supabase as any)
    .from('memberships')
    .select('*')
    .eq('customer_id', customerId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return data as any | null
}

// ─── Check-ins (gym) ──────────────────────────────────────────

export async function getCustomerCheckins(customerId: string, organizationId: number, limit = 30) {
  const supabase = await getSb()
  const { data } = await (supabase as any)
    .from('member_checkins')
    .select('*')
    .eq('customer_id', customerId)
    .eq('organization_id', organizationId)
    .order('checked_in_at', { ascending: false })
    .limit(limit)
  return (data || []) as any[]
}

// ─── Reservaciones de Clases (gym) ────────────────────────────

export async function getCustomerClassReservations(customerId: string, organizationId: number, limit = 30) {
  const supabase = await getSb()
  const { data } = await (supabase as any)
    .from('class_reservations')
    .select(`
      *,
      gym_classes (
        id, title, class_type, difficulty_level, start_at, end_at, 
        duration_minutes, capacity, room, location,
        profiles:instructor_id ( first_name, last_name )
      )
    `)
    .eq('customer_id', customerId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data || []) as any[]
}

// ─── Parking: Pases ───────────────────────────────────────────

export async function getCustomerParkingPasses(customerId: string, organizationId: number) {
  const supabase = await getSb()
  const { data } = await (supabase as any)
    .from('parking_passes')
    .select('*')
    .eq('customer_id', customerId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
  return (data || []) as any[]
}

// ─── Parking: Vehículos ───────────────────────────────────────

export async function getCustomerVehicles(customerId: string, organizationId: number) {
  const supabase = await getSb()
  const { data } = await (supabase as any)
    .from('vehicles')
    .select('*')
    .eq('customer_id', customerId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
  return (data || []) as any[]
}

// ─── Parking: Sesiones ────────────────────────────────────────

export async function getCustomerParkingSessions(customerId: string, organizationId: number, limit = 30) {
  const supabase = await getSb()
  const { data } = await (supabase as any)
    .from('parking_sessions')
    .select('*')
    .eq('customer_id', customerId)
    .eq('organization_id', organizationId)
    .order('entry_time', { ascending: false })
    .limit(limit)
  return (data || []) as any[]
}

// ─── Actividad reciente (últimas acciones del cliente) ────────

export async function getCustomerRecentActivity(customerId: string, organizationId: number) {
  const supabase = await getSb()
  const sb = supabase as any

  // Obtener últimos 5 pedidos y últimas 5 reservas y combinar
  const [ordersRes, reservationsRes] = await Promise.all([
    sb.from('web_orders')
      .select('id, order_number, status, total, created_at')
      .eq('customer_id', customerId)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(5),
    sb.from('reservations')
      .select('id, status, checkin, checkout, created_at')
      .eq('customer_id', customerId)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const activity: any[] = []

  for (const o of (ordersRes.data || [])) {
    activity.push({ type: 'order', id: o.id, title: `Pedido ${o.order_number}`, status: o.status, detail: `$${Number(o.total || 0).toLocaleString()}`, date: o.created_at })
  }
  for (const r of (reservationsRes.data || [])) {
    activity.push({ type: 'reservation', id: r.id, title: 'Reserva', status: r.status, detail: `${r.checkin || ''} → ${r.checkout || ''}`, date: r.created_at })
  }

  return activity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8)
}
