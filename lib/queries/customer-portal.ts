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

  const [orders, reservations, addresses, coupons, memberships, checkins, tickets, passes, vehicles] = await Promise.all([
    sb.from('web_orders').select('id', { count: 'exact', head: true }).eq('customer_id', customerId).eq('organization_id', organizationId),
    sb.from('reservations').select('id', { count: 'exact', head: true }).eq('customer_id', customerId).eq('organization_id', organizationId),
    sb.from('customer_addresses').select('id', { count: 'exact', head: true }).eq('customer_id', customerId).eq('organization_id', organizationId),
    sb.from('coupons').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).or(`customer_id.eq.${customerId},customer_id.is.null`).eq('is_active', true),
    sb.from('memberships').select('id', { count: 'exact', head: true }).eq('customer_id', customerId).eq('organization_id', organizationId).eq('status', 'active'),
    sb.from('member_checkins').select('id', { count: 'exact', head: true }).eq('customer_id', customerId).eq('organization_id', organizationId),
    sb.from('trip_tickets').select('id', { count: 'exact', head: true }).eq('customer_id', customerId).eq('organization_id', organizationId),
    sb.from('parking_passes').select('id', { count: 'exact', head: true }).eq('customer_id', customerId).eq('organization_id', organizationId).eq('status', 'active'),
    sb.from('parking_vehicles').select('id', { count: 'exact', head: true }).eq('customer_id', customerId).eq('organization_id', organizationId),
  ])

  // Conteo de sesiones via placas del customer (parking_sessions no tiene customer_id)
  let sessionsCount = 0
  const { data: customerPlates } = await sb
    .from('parking_vehicles')
    .select('plate')
    .eq('customer_id', customerId)
    .eq('organization_id', organizationId)
  if (customerPlates && customerPlates.length > 0) {
    const plates = customerPlates.map((v: any) => v.plate)
    const sessionsRes = await sb
      .from('parking_sessions')
      .select('id', { count: 'exact', head: true })
      .in('vehicle_plate', plates)
    sessionsCount = sessionsRes.count ?? 0
  }

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
    sessions: sessionsCount,
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

/** Membresía que muestra el portal del cliente. */
export interface CustomerMembership {
  id: number
  /** pending · active · frozen · past_due · expired · cancelled (CHECK de la base). */
  status: string
  start_date: string | null
  end_date: string
  grace_until: string | null
  access_code: string | null
  membership_plan_id: number
  plan_name: string | null
  /** Regla del plan copiada al venderse (`plan_snapshot.freeze_allowed`). */
  freeze_allowed: boolean
}

// Columnas reales de memberships (verificadas por MCP el 2026-09-29). Antes era select('*') y la
// página leía `plan_name` y `price`, que no existen en memberships: el plan salía siempre como
// «Membresía» y el precio nunca se mostraba.
const CUSTOMER_MEMBERSHIP_COLUMNS =
  'id, status, start_date, end_date, grace_until, access_code, membership_plan_id, plan_snapshot, membership_plans ( name )'

function toCustomerMembership(row: any): CustomerMembership {
  return {
    id: row.id,
    status: row.status,
    start_date: row.start_date ?? null,
    end_date: row.end_date,
    grace_until: row.grace_until ?? null,
    access_code: row.access_code ?? null,
    membership_plan_id: row.membership_plan_id,
    plan_name: row.membership_plans?.name ?? null,
    freeze_allowed: row.plan_snapshot?.freeze_allowed === true,
  }
}

export async function getCustomerMembership(customerId: string, organizationId: number): Promise<CustomerMembership | null> {
  const supabase = await getSb()
  // `as any`: types/database.ts resuelve hoy a `never` (ver el aviso allí); memberships está
  // declarada en ese archivo con sus columnas reales.
  const sb = supabase as any

  // 1. La vigente: activa, congelada, en gracia o pendiente de pago. Una renovación extiende la
  //    MISMA membresía (y una venta aplicada como renovación deja su fila `cancelled`), así que
  //    «la más reciente por created_at» podía mostrar una cancelada en vez de la vigente.
  const { data: viva } = await sb
    .from('memberships')
    .select(CUSTOMER_MEMBERSHIP_COLUMNS)
    .eq('customer_id', customerId)
    .eq('organization_id', organizationId)
    .in('status', ['active', 'frozen', 'past_due', 'pending'])
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (viva) return toCustomerMembership(viva)

  // 2. Si no hay vigente, la última (vencida o cancelada) para ofrecer renovar.
  const { data: ultima } = await sb
    .from('memberships')
    .select(CUSTOMER_MEMBERSHIP_COLUMNS)
    .eq('customer_id', customerId)
    .eq('organization_id', organizationId)
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  return ultima ? toCustomerMembership(ultima) : null
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
    .from('parking_vehicles')
    .select('*')
    .eq('customer_id', customerId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
  return (data || []) as any[]
}

// ─── Parking: Sesiones ────────────────────────────────────────

export async function getCustomerParkingSessions(customerId: string, organizationId: number, limit = 30) {
  const supabase = await getSb()
  const sb = supabase as any

  // parking_sessions no tiene customer_id — buscar por placas del customer
  const { data: customerVehicles } = await sb
    .from('parking_vehicles')
    .select('plate')
    .eq('customer_id', customerId)
    .eq('organization_id', organizationId)

  const plates = (customerVehicles || []).map((v: any) => v.plate)
  if (plates.length === 0) return []

  const { data } = await sb
    .from('parking_sessions')
    .select('*')
    .in('vehicle_plate', plates)
    .order('entry_at', { ascending: false })
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
    activity.push({ type: 'order', id: o.id, title: `Pedido ${o.order_number}`, status: o.status, detail: `$${Number(o.total || 0).toLocaleString('es-CO')}`, date: o.created_at })
  }
  for (const r of (reservationsRes.data || [])) {
    activity.push({ type: 'reservation', id: r.id, title: 'Reserva', status: r.status, detail: `${r.checkin || ''} → ${r.checkout || ''}`, date: r.created_at })
  }

  return activity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8)
}

// ─── Citas / Appointments (services) ─────────────────────────

export async function getCustomerAppointments(customerId: string, organizationId: number, limit = 30) {
  const supabase = await getSb()
  const { data } = await (supabase as any)
    .from('calendar_events')
    .select('*')
    .eq('customer_id', customerId)
    .eq('organization_id', organizationId)
    .eq('event_type', 'appointment')
    .order('start_at', { ascending: false })
    .limit(limit)
  return (data || []) as any[]
}

// ─── Facturas / Invoices (services) ──────────────────────────

export async function getCustomerInvoices(customerId: string, organizationId: number, limit = 30) {
  const supabase = await getSb()
  const { data } = await (supabase as any)
    .from('invoice_sales')
    .select('id, number, issue_date, due_date, subtotal, tax_total, total, balance, status, document_type, currency')
    .eq('customer_id', customerId)
    .eq('organization_id', organizationId)
    .order('issue_date', { ascending: false })
    .limit(limit)
  return (data || []) as any[]
}

export async function getCustomerInvoiceDetail(invoiceId: string, customerId: string) {
  const supabase = await getSb()
  const sb = supabase as any

  const { data: invoice } = await sb
    .from('invoice_sales')
    .select('*')
    .eq('id', invoiceId)
    .eq('customer_id', customerId)
    .single()

  if (!invoice) return null

  const { data: items } = await sb
    .from('invoice_items')
    .select('*')
    .eq('invoice_sales_id', invoiceId)
    .order('created_at', { ascending: true })

  const { data: receivable } = await sb
    .from('accounts_receivable')
    .select('*')
    .eq('invoice_id', invoiceId)
    .eq('customer_id', customerId)
    .limit(1)

  return {
    ...invoice,
    items: (items || []) as any[],
    receivable: receivable?.[0] || null,
  }
}

// ─── Cotizaciones / Quotes (services) ────────────────────────

export async function getCustomerQuotes(customerId: string, organizationId: number, limit = 20) {
  const supabase = await getSb()
  const { data } = await (supabase as any)
    .from('opportunities')
    .select('id, name, amount, currency, expected_close_date, status, created_at')
    .eq('customer_id', customerId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data || []) as any[]
}

// ─── Dashboard Servicios (conteos) ───────────────────────────

export async function getCustomerServiceDashboard(customerId: string, organizationId: number) {
  const supabase = await getSb()
  const sb = supabase as any
  const now = new Date().toISOString()

  const [upcomingAppts, pendingInvoices, totalPaid, openQuotes] = await Promise.all([
    sb.from('calendar_events')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('organization_id', organizationId)
      .eq('event_type', 'appointment')
      .in('status', ['pending', 'confirmed'])
      .gte('start_at', now),
    sb.from('invoice_sales')
      .select('id, balance')
      .eq('customer_id', customerId)
      .eq('organization_id', organizationId)
      .in('status', ['sent', 'overdue', 'partial']),
    sb.from('payments')
      .select('amount')
      .eq('customer_id', customerId)
      .eq('organization_id', organizationId)
      .eq('status', 'approved'),
    sb.from('opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('organization_id', organizationId)
      .eq('status', 'open'),
  ])

  const pendingBalance = (pendingInvoices.data || []).reduce((sum: number, inv: any) => sum + Number(inv.balance || 0), 0)
  const paidTotal = (totalPaid.data || []).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)

  return {
    upcomingAppointments: upcomingAppts.count ?? 0,
    pendingInvoices: (pendingInvoices.data || []).length,
    pendingBalance,
    totalPaid: paidTotal,
    openQuotes: openQuotes.count ?? 0,
  }
}
