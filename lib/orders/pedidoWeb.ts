/**
 * Pasos de `/api/orders` extraídos de la ruta (archivo sensible: aquí solo se mueve código, con el
 * mismo comportamiento). Servidor: reciben el cliente de Supabase de la ruta (service role) y la
 * organización del contexto, nunca la del body.
 */

type ClienteSupabase = { from: (tabla: string) => any }

/** Tipo de entrega que se guarda en `web_orders.delivery_type` a partir del que manda el checkout. */
export function tipoEntregaCliente(deliveryType: unknown, envio: number): string {
  if (deliveryType === 'delivery') return 'delivery_own'
  if (typeof deliveryType === 'string' && deliveryType) return deliveryType
  return envio > 0 ? 'delivery_own' : 'pickup'
}

/** Marca el pedido como cancelado con el motivo (rama de error después de crearlo). */
export async function cancelarPedidoWeb(supabase: ClienteSupabase, webOrderId: string, motivo: string): Promise<void> {
  const { error } = await supabase
    .from('web_orders')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: motivo,
    })
    .eq('id', webOrderId)
  if (error) console.error('[Orders] No se pudo cancelar el pedido', { webOrderId, motivo, error })
}

export interface DatosClientePedido {
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  address?: string
  city?: string
  countryCode?: string
  department?: string
}

/** Busca el cliente por correo en la organización o lo crea (invitado). `null` si no se pudo. */
export async function buscarOCrearCliente(
  supabase: ClienteSupabase,
  organizationId: number,
  branchId: number | null,
  customer: DatosClientePedido,
): Promise<string | null> {
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('email', customer.email)
    .single()

  if (existingCustomer) return existingCustomer.id

  const { data: newCustomer } = await supabase
    .from('customers')
    .insert({
      organization_id: organizationId,
      branch_id: branchId,
      email: customer.email,
      first_name: customer.firstName,
      last_name: customer.lastName,
      // full_name es GENERATED ALWAYS AS (CASE ...), no se puede insertar.
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      is_registered: false,
    })
    .select('id')
    .single()

  return newCustomer ? newCustomer.id : null
}

/** Guarda la dirección del pedido como principal si el cliente aún no tiene ninguna. */
export async function guardarDireccionPrincipal(
  supabase: ClienteSupabase,
  customerId: string,
  customer: DatosClientePedido,
): Promise<void> {
  if (!customer.address) return
  const { data: existingAddresses } = await supabase
    .from('customer_addresses')
    .select('id')
    .eq('customer_id', customerId)
    .limit(1)

  if (existingAddresses && existingAddresses.length > 0) return

  await supabase
    .from('customer_addresses')
    .insert({
      customer_id: customerId,
      label: 'Principal',
      address_line1: customer.address,
      city: customer.city || null,
      country_code: customer.countryCode || null,
      department: customer.department || null,
      is_default: true,
      is_active: true,
    })
  // Actualizar dirección en el customer también
  await supabase
    .from('customers')
    .update({ address: customer.address, city: customer.city || null })
    .eq('id', customerId)
}
