/**
 * Pasos de `/api/orders` extraídos de la ruta (archivo sensible: aquí solo se mueve código, con el
 * mismo comportamiento). Servidor: reciben el cliente de Supabase de la ruta (service role) y la
 * organización del contexto, nunca la del body.
 */

import { ZONA_POR_DEFECTO } from '@/lib/restaurant/horario'

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
    .maybeSingle()

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
  organizationId: number,
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
    // Nunca escribir la ficha de un cliente de otra organización, aunque el id viniera mal.
    .eq('organization_id', organizationId)
}

// ---------------------------------------------------------------------------
// Contexto del pedido: organización, ajustes de venta y horario de la sede
// ---------------------------------------------------------------------------

export interface AjustesVentaWeb {
  pedidoEnLinea: boolean | null
  enableShipping: boolean
  tarifaPlana: number
  umbralGratis: number
  tiposEntrega: string[] | null
}

export interface ContextoPedido {
  esRestaurante: boolean
  nombreOrganizacion: string
  /** Zona efectiva de la sede: `branches.timezone` → `organizations.timezone` → America/Bogota. */
  zona: string
  /** `branches.opening_hours` de la sede del pedido (sin parsear). */
  horarioSede: unknown
  nombreSede: string | null
  /** `null` si no hay fila de `website_settings` de la organización. */
  ajustes: AjustesVentaWeb | null
}

const COLUMNAS_AJUSTES_VENTA = 'branch_id, enable_online_ordering, enable_shipping, shipping_flat_rate, free_shipping_threshold, available_delivery_types'

/**
 * Tres lecturas en paralelo, todas filtradas por la organización del contexto: la organización,
 * sus ajustes del sitio (fila global y, si hay sede explícita, la de la sede, que gana campo a
 * campo como en `getEffectiveSettings`) y la sede del pedido.
 */
export async function leerContextoPedido(
  supabase: ClienteSupabase,
  organizationId: number,
  branchId: number | null,
  sedeExplicita: number | null,
): Promise<ContextoPedido> {
  const [org, ajustes, sede] = await Promise.all([
    supabase.from('organizations').select('type_id, name, timezone').eq('id', organizationId).maybeSingle(),
    supabase.from('website_settings').select(COLUMNAS_AJUSTES_VENTA).eq('organization_id', organizationId),
    branchId
      ? supabase.from('branches').select('name, opening_hours, timezone').eq('id', branchId).eq('organization_id', organizationId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  if (org.error) console.error('[Orders] No se pudo leer la organización', { organizationId, error: org.error })
  if (ajustes.error) console.error('[Orders] No se pudieron leer los ajustes del sitio', { organizationId, error: ajustes.error })
  if (sede.error) console.error('[Orders] No se pudo leer la sede', { organizationId, branchId, error: sede.error })

  const filas: any[] = Array.isArray(ajustes.data) ? ajustes.data : []
  const global = filas.find((f) => f.branch_id === null) ?? null
  const propia = sedeExplicita !== null ? filas.find((f) => f.branch_id === sedeExplicita) ?? null : null
  const valor = (campo: string) => (propia && propia[campo] !== null && propia[campo] !== undefined ? propia[campo] : global?.[campo])
  const base = global || propia
  const zona = (sede.data as any)?.timezone || (org.data as any)?.timezone || ZONA_POR_DEFECTO

  return {
    esRestaurante: Number((org.data as any)?.type_id) === 1,
    nombreOrganizacion: String((org.data as any)?.name || ''),
    zona,
    horarioSede: (sede.data as any)?.opening_hours ?? null,
    nombreSede: (sede.data as any)?.name ?? null,
    ajustes: base
      ? {
          pedidoEnLinea: typeof valor('enable_online_ordering') === 'boolean' ? valor('enable_online_ordering') : null,
          enableShipping: valor('enable_shipping') !== false,
          tarifaPlana: Number(valor('shipping_flat_rate') ?? 0) || 0,
          umbralGratis: Number(valor('free_shipping_threshold') ?? 0) || 0,
          tiposEntrega: Array.isArray(valor('available_delivery_types')) ? valor('available_delivery_types') : null,
        }
      : null,
  }
}

/**
 * Sede del pedido cuando el checkout no manda una explícita: la fuente de inventario web, si no
 * la principal, si no la primera (por id) entre las activas. La usan `/api/orders` (stock y
 * horario) y la página del checkout (horario que se le muestra al cliente), para que sean la misma.
 */
export function sedePorDefectoPedido<T extends { id: number; is_main?: boolean | null; is_web_stock_source?: boolean | null; is_active?: boolean | null }>(
  sedes: T[] | null | undefined,
): T | null {
  const activas = (sedes || []).filter((b) => b.is_active !== false).sort((a, b) => a.id - b.id)
  return activas.find((b) => b.is_web_stock_source) ?? activas.find((b) => b.is_main) ?? activas[0] ?? null
}
