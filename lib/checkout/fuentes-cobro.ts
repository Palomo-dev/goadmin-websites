/**
 * Fuentes de cobro de `/api/checkout/init` distintas del pedido web: reserva
 * de hospedaje, boleto de transporte, pase de parking y factura. Cada una
 * devuelve un objeto compatible con la interfaz de «order» que usan las
 * pasarelas. Extraído tal cual de `app/api/checkout/init/route.ts` (sin cambios
 * de comportamiento): la ruta es un archivo sensible y crece por fuente.
 */

/**
 * Obtiene una reservación por ID para generar pago.
 * Devuelve un objeto compatible con la interfaz de "order" para las pasarelas.
 */
export async function getReservation(supabase: any, reservationId: string) {
  const { data, error } = await supabase
    .from('reservations')
    .select('id, organization_id, total_estimated, status, metadata, customer_id')
    .eq('id', reservationId)
    .single()

  if (error || !data) return null

  // Generar referencia corta para la pasarela: RES-{primeros 8 chars del UUID}
  const shortRef = `RES-${data.id.substring(0, 8).toUpperCase()}`

  return {
    id: data.id,
    organization_id: data.organization_id,
    order_number: shortRef,
    total: Number(data.total_estimated),
    currency: 'COP',
    status: data.status,
    payment_status: data.status === 'confirmed' ? 'paid' : 'pending',
    customer_email: data.metadata?.customer_email || '',
    customer_name: data.metadata?.customer_name || '',
    _source: 'reservation' as const,
  }
}

/**
 * Obtiene un ticket de transporte por ID para generar pago.
 * Devuelve un objeto compatible con la interfaz de "order" para las pasarelas.
 */
export async function getTripTicket(supabase: any, ticketId: string) {
  const { data, error } = await supabase
    .from('trip_tickets')
    .select('id, organization_id, ticket_number, passenger_name, passenger_email, total, currency, status, payment_status')
    .eq('id', ticketId)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    organization_id: data.organization_id,
    order_number: data.ticket_number,
    total: Number(data.total || 0),
    currency: data.currency || 'COP',
    status: data.status,
    payment_status: data.payment_status === 'paid' ? 'paid' : 'pending',
    customer_email: data.passenger_email || '',
    customer_name: data.passenger_name || '',
    _source: 'trip_ticket' as const,
  }
}

/**
 * Obtiene un pase de parking por ID para generar pago.
 * Devuelve un objeto compatible con la interfaz de "order" para las pasarelas.
 */
export async function getParkingPass(supabase: any, passId: string) {
  const { data, error } = await supabase
    .from('parking_passes')
    .select('id, organization_id, customer_id, plan_name, price, status')
    .eq('id', passId)
    .single()

  if (error || !data) return null

  const shortRef = `PKP-${data.id.substring(0, 8).toUpperCase()}`

  // Buscar email del customer
  const { data: customer } = await supabase
    .from('customers')
    .select('email, first_name, last_name')
    .eq('id', data.customer_id)
    .single()

  return {
    id: data.id,
    organization_id: data.organization_id,
    order_number: shortRef,
    total: Number(data.price || 0),
    currency: 'COP',
    status: data.status,
    payment_status: data.status === 'active' ? 'paid' : 'pending',
    customer_email: customer?.email || '',
    customer_name: `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim(),
    _source: 'parking_pass' as const,
  }
}

/**
 * Obtiene una factura pendiente por ID para generar pago online.
 * Devuelve un objeto compatible con la interfaz de "order" para las pasarelas.
 */
export async function getInvoice(supabase: any, invoiceId: string) {
  const { data, error } = await supabase
    .from('invoice_sales')
    .select('id, organization_id, customer_id, number, total, balance, currency, status')
    .eq('id', invoiceId)
    .single()

  if (error || !data) return null

  // Solo facturas con balance pendiente
  const balance = Number(data.balance || 0)
  if (balance <= 0) return null

  const shortRef = `INV-${data.number || data.id.substring(0, 8).toUpperCase()}`

  const { data: customer } = await supabase
    .from('customers')
    .select('email, first_name, last_name')
    .eq('id', data.customer_id)
    .single()

  return {
    id: data.id,
    organization_id: data.organization_id,
    order_number: shortRef,
    total: balance,
    currency: data.currency || 'COP',
    status: data.status,
    payment_status: ['paid', 'cancelled'].includes(data.status) ? 'paid' : 'pending',
    customer_email: customer?.email || '',
    customer_name: `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim(),
    _source: 'invoice' as const,
  }
}
