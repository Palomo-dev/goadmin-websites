/**
 * Pedido web (`web_orders`) que cobra `/api/checkout/init`.
 *
 * Extraído tal cual de app/api/checkout/init/route.ts (checkout de 83 sitios:
 * extracción primero, cambios de comportamiento en un commit aparte).
 */

const COUNTRY_CURRENCY: Record<string, string> = {
  COL: 'COP', MEX: 'MXN', USA: 'USD', ARG: 'ARS', CHL: 'CLP',
  PER: 'PEN', ECU: 'USD', BRA: 'BRL', URY: 'UYU', PAN: 'USD',
  CRI: 'CRC', GTM: 'GTQ', HND: 'HNL', SLV: 'USD', NIC: 'NIO',
  DOM: 'DOP', BOL: 'BOB', PRY: 'PYG', VEN: 'VES', ESP: 'EUR',
}

/**
 * Obtiene la orden de web_orders por order_number.
 *
 * Con `organizationId` (la del HOST) solo busca en esa organización:
 * `order_number` no tiene UNIQUE en la base, y sin el filtro el sitio de una
 * organización podía iniciar el cobro de un pedido de otra. Sin organización
 * (host que no resuelve, p. ej. localhost sin subdominio), como antes.
 */
export async function getOrder(supabase: any, orderNumber: string, organizationId: number | null = null) {
  let consulta = supabase
    .from('web_orders')
    .select('id, organization_id, order_number, total, status, payment_status, customer_email, customer_name, customer_phone, delivery_address, delivery_type')
    .eq('order_number', orderNumber)
  if (organizationId !== null) {
    consulta = consulta.eq('organization_id', organizationId)
  } else {
    // Sin organización del host: comportamiento anterior, solo por número.
  }
  const { data, error } = await consulta.single()

  if (error || !data) return null

  // Obtener moneda desde country_code de la organización
  const { data: org } = await supabase
    .from('organizations')
    .select('country_code')
    .eq('id', data.organization_id)
    .single()

  const currency = COUNTRY_CURRENCY[org?.country_code || ''] || 'COP'

  // Normalizar datos del cliente para pasarelas
  const deliveryAddress = typeof data.delivery_address === 'object' ? data.delivery_address : null
  const customerPhone = data.customer_phone || deliveryAddress?.phone || ''
  const customerCity = deliveryAddress?.city || ''
  const customerAddressLine = deliveryAddress?.address || ''

  return {
    ...data,
    currency,
    customer_phone: customerPhone,
    customer_city: customerCity,
    customer_address: customerAddressLine,
  }
}

/**
 * Organización dueña de un número de pedido, o `null` si no existe. Solo para
 * registrar y responder 403 cuando el host pide el pedido de otra organización.
 */
export async function organizacionDelPedido(supabase: any, orderNumber: string): Promise<number | null> {
  const { data } = await supabase
    .from('web_orders')
    .select('organization_id')
    .eq('order_number', orderNumber)
    .limit(1)
    .maybeSingle()
  return typeof data?.organization_id === 'number' ? data.organization_id : null
}
