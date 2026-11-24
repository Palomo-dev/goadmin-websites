/**
 * Contraentrega con condiciones del lado del SERVIDOR de la tienda: lee las condiciones de la sede,
 * el historial del cliente de la sesión y las pasarelas activas, y evalúa la regla pura
 * (`reglaContraentrega.ts`, copia byte a byte del ERP). La usan `/api/orders` (decide y cobra),
 * `/api/contraentrega` (lo que muestra el checkout, informativo) y `/api/checkout/init` (cobro del
 * anticipo). El navegador nunca decide el monto del anticipo.
 *
 * Sin condiciones para la sede (lo normal hoy en las ~40 tiendas con «Efectivo»): no se hace
 * ninguna otra consulta y el resultado es «como hoy» (`conCondiciones: false`).
 *
 * El anticipo se cobra con la referencia `ANT-<id del pedido>`: el id (uuid) es único entre
 * organizaciones, así que el webhook resuelve el pedido —y su organización— sin mirar el payload.
 */

import { getWebsitePaymentMethods } from '@/lib/checkout/metodosPagoSitio'
import { filtrarMetodosPorSede } from '@/lib/payments/metodosPorSucursal'
import {
  condicionesDeSede,
  evaluarContraentrega,
  pasarelasAnticipo,
  type CondicionesContraentrega,
  type LineaContraentrega,
  type ResultadoContraentrega,
  type TipoEntregaPedido,
} from './reglaContraentrega'
import { codigoConector } from './textosContraentrega'
import { referenciaAnticipo, UUID_PEDIDO } from './referenciaAnticipo'

export { codigoConector }

type Cliente = any

export { FUENTE_COBRO_ANTICIPO, referenciaAnticipo, idDeReferenciaAnticipo, esReferenciaAnticipo } from './referenciaAnticipo'

/** Condiciones de la sede (fila `cash` de la organización), o `null` = como hoy. Un error también es `null`. */
export async function leerCondicionesContraentrega(
  supabase: Cliente,
  organizationId: number,
  branchId: number | null,
): Promise<CondicionesContraentrega | null> {
  if (!Number.isFinite(Number(branchId))) return null
  const { data, error } = await supabase
    .from('organization_payment_methods')
    .select('settings')
    .eq('organization_id', organizationId)
    .eq('payment_method_code', 'cash')
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[Contraentrega] No se pudieron leer las condiciones (se sigue como hoy)', { organizationId, code: error.code })
    return null
  } else {
    return condicionesDeSede(data?.settings ?? null, branchId)
  }
}

/** Pasarelas activas del sitio en la sede, como códigos de conector y sin repetir. */
export async function pasarelasActivasSede(organizationId: number, branchId: number | null): Promise<string[]> {
  const metodos = (await getWebsitePaymentMethods(organizationId)) as { code: string; type: string; branchIds?: number[] | null }[]
  const enSede = filtrarMetodosPorSede(metodos, branchId)
  const codigos = enSede.filter((m) => m.type === 'gateway').map((m) => codigoConector(m.code)).filter((c): c is string => !!c)
  return Array.from(new Set(codigos))
}

/** Pedidos entregados y rechazos en la puerta del cliente de la SESIÓN. */
export async function historialCliente(
  supabase: Cliente,
  organizationId: number,
  customerId: string | null,
): Promise<{ pedidosEntregados: number; rechazosEnPuerta: number } | null> {
  if (!customerId) return null
  const [entregados, rechazos] = await Promise.all([
    supabase
      .from('web_orders')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('customer_id', customerId)
      .eq('status', 'delivered'),
    supabase
      .from('shipments')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('customer_id', customerId)
      .eq('source_type', 'web_order')
      .gt('cod_amount', 0)
      .or('status.eq.returned,exception_reason.eq.rejected'),
  ])
  if (entregados.error || rechazos.error) return null
  return { pedidosEntregados: Number(entregados.count) || 0, rechazosEnPuerta: Number(rechazos.count) || 0 }
}

/** Categoría y padre de cada producto del carrito (de la organización). */
export async function lineasConCategoria(
  supabase: Cliente,
  organizationId: number,
  items: { productId: number; nombre?: string; total?: number }[],
): Promise<LineaContraentrega[]> {
  const ids = Array.from(new Set(items.map((i) => Number(i.productId)).filter((n) => Number.isInteger(n) && n > 0)))
  if (ids.length === 0) return []
  const { data } = await supabase
    .from('products')
    .select('id, name, category_id, parent_product_id')
    .eq('organization_id', organizationId)
    .in('id', ids)
  const porId = new Map<number, any>((Array.isArray(data) ? data : []).map((p: any) => [Number(p.id), p]))
  return items.map((i) => {
    const p = porId.get(Number(i.productId))
    return {
      productoId: Number(i.productId),
      categoriaId: p?.category_id != null ? Number(p.category_id) : null,
      productoPadreId: p?.parent_product_id != null ? Number(p.parent_product_id) : null,
      nombre: i.nombre ?? p?.name ?? undefined,
      total: i.total,
    }
  })
}

export interface EntradaServidor {
  organizationId: number
  branchId: number | null
  tipoEntrega: TipoEntregaPedido
  subtotalProductos: number
  envio: number
  total: number
  zonaId: string | null
  items: { productId: number; nombre?: string; total?: number }[]
  /** Cliente de la SESIÓN (nunca el buscado por correo). */
  customerId: string | null
  /** Condiciones ya leídas (para no volver a consultarlas); sin el campo se leen aquí. */
  condicionesLeidas?: CondicionesContraentrega | null
}

export interface EvaluacionServidor {
  condiciones: CondicionesContraentrega | null
  resultado: ResultadoContraentrega
  lineas: LineaContraentrega[]
}

/** Evalúa la contraentrega de un pedido con los datos del servidor. */
export async function evaluarContraentregaServidor(supabase: Cliente, e: EntradaServidor): Promise<EvaluacionServidor> {
  const condiciones = e.condicionesLeidas !== undefined
    ? e.condicionesLeidas
    : await leerCondicionesContraentrega(supabase, e.organizationId, e.branchId)
  const domicilio = e.tipoEntrega === 'delivery_own' || e.tipoEntrega === 'delivery_third_party'
  if (!condiciones || !domicilio) {
    // Sin condiciones, recoger o comer aquí: como hoy, sin más consultas.
    return {
      condiciones,
      lineas: [],
      resultado: evaluarContraentrega({
        condiciones, tipoEntrega: e.tipoEntrega, subtotalProductos: e.subtotalProductos, envio: e.envio,
        total: e.total, zonaId: e.zonaId, lineas: [], cliente: null, pasarelasActivas: [],
      }),
    }
  }
  const pideHistorial = condiciones.soloClientesConEntregas || condiciones.noOfrecerARechazados
  const pideAnticipo = condiciones.anticipo.tipo !== 'ninguno'
  const [lineas, cliente, pasarelas, nombresZonas] = await Promise.all([
    condiciones.productos.modo === 'todos' ? Promise.resolve([] as LineaContraentrega[]) : lineasConCategoria(supabase, e.organizationId, e.items),
    pideHistorial ? historialCliente(supabase, e.organizationId, e.customerId) : Promise.resolve(null),
    pideAnticipo ? pasarelasActivasSede(e.organizationId, e.branchId) : Promise.resolve([] as string[]),
    condiciones.zonas.modo === 'algunas' && condiciones.zonas.ids.length > 0
      ? supabase.from('shipping_zones').select('id, name').eq('organization_id', e.organizationId).in('id', condiciones.zonas.ids)
          .then((r: any) => (Array.isArray(r.data) ? r.data.map((z: any) => String(z.name)) : []))
      : Promise.resolve([] as string[]),
  ])
  const resultado = evaluarContraentrega({
    condiciones,
    tipoEntrega: e.tipoEntrega,
    subtotalProductos: e.subtotalProductos,
    envio: e.envio,
    total: e.total,
    zonaId: e.zonaId,
    nombresZonas,
    lineas,
    cliente,
    pasarelasActivas: pasarelas,
  })
  return { condiciones, resultado, lineas }
}

/**
 * La pasarela del anticipo: la que eligió el cliente si está permitida; si no, la primera
 * permitida (la que viene marcada en el checkout).
 */
export function pasarelaElegida(permitidas: string[], pedida: unknown): string | null {
  const codigo = codigoConector(typeof pedida === 'string' ? pedida : null)
  if (codigo && permitidas.includes(codigo)) return codigo
  return permitidas[0] ?? null
}

export interface AnticipoPorCobrar {
  id: string
  organization_id: number
  branch_id: number | null
  /** Referencia de la pasarela: `ANT-<id>`. */
  order_number: string
  numero_pedido: string
  total: number
  currency: string
  status: string
  payment_status: 'paid' | 'pending'
  customer_email: string
  customer_name: string
  customer_phone: string
  customer_city: string
  customer_address: string
  advance_gateway: string | null
  /** Vencido, cerrado o ya sin anticipo pendiente: no se cobra. */
  vencido: boolean
}

const MONEDA_PAIS: Record<string, string> = {
  COL: 'COP', MEX: 'MXN', USA: 'USD', ARG: 'ARS', CHL: 'CLP', PER: 'PEN', ECU: 'USD', BRA: 'BRL',
  URY: 'UYU', PAN: 'USD', CRI: 'CRC', GTM: 'GTQ', HND: 'HNL', SLV: 'USD', NIC: 'NIO', DOM: 'DOP',
  BOL: 'BOB', PRY: 'PYG', VEN: 'VES', ESP: 'EUR',
}

/**
 * El anticipo pendiente de un pedido, con la forma de «order» que usan las pasarelas de
 * `/api/checkout/init`. Se lee por id Y por la organización del host (si la hay).
 */
export async function anticipoPorCobrar(
  supabase: Cliente,
  orderId: unknown,
  hostOrgId: number | null,
): Promise<AnticipoPorCobrar | null> {
  if (typeof orderId !== 'string' || !UUID_PEDIDO.test(orderId)) return null
  let consulta = supabase
    .from('web_orders')
    .select('id, organization_id, branch_id, order_number, status, payment_status, customer_email, customer_name, customer_phone, delivery_address, advance_amount, advance_status, advance_due_at, advance_gateway')
    .eq('id', orderId)
  if (hostOrgId !== null) {
    consulta = consulta.eq('organization_id', hostOrgId)
  } else {
    // Host sin organización: solo por id (uuid único), como las demás fuentes de cobro.
  }
  const { data, error } = await consulta.maybeSingle()
  if (error || !data || !(Number(data.advance_amount) > 0)) return null
  const { data: org } = await supabase.from('organizations').select('country_code').eq('id', data.organization_id).maybeSingle()
  const dir = data.delivery_address && typeof data.delivery_address === 'object' ? data.delivery_address : {}
  const vence = Date.parse(data.advance_due_at || '')
  const cerrado = ['cancelled', 'rejected', 'refunded', 'expired', 'delivered'].includes(String(data.status))
  return {
    id: String(data.id),
    organization_id: Number(data.organization_id),
    branch_id: data.branch_id ?? null,
    order_number: referenciaAnticipo(String(data.id)),
    numero_pedido: String(data.order_number),
    total: Number(data.advance_amount),
    currency: MONEDA_PAIS[String(org?.country_code || '')] || 'COP',
    status: String(data.status || ''),
    payment_status: data.advance_status === 'paid' ? 'paid' : 'pending',
    customer_email: data.customer_email || '',
    customer_name: data.customer_name || '',
    customer_phone: data.customer_phone || dir.phone || '',
    customer_city: dir.city || '',
    customer_address: dir.address || '',
    advance_gateway: data.advance_gateway ?? null,
    vencido: data.advance_status !== 'pending' || cerrado || (Number.isFinite(vence) && vence < Date.now()),
  }
}

/** Una pasarela pedida para el anticipo: activa en la sede y permitida por las condiciones. */
export async function pasarelaPermitidaParaAnticipo(
  supabase: Cliente,
  anticipo: Pick<AnticipoPorCobrar, 'organization_id' | 'branch_id'>,
  gateway: unknown,
): Promise<string | null> {
  const codigo = codigoConector(typeof gateway === 'string' ? gateway : null)
  if (!codigo) return null
  const [condiciones, activas] = await Promise.all([
    leerCondicionesContraentrega(supabase, anticipo.organization_id, anticipo.branch_id),
    pasarelasActivasSede(anticipo.organization_id, anticipo.branch_id),
  ])
  const permitidas = condiciones ? pasarelasAnticipo(condiciones, activas) : activas
  return permitidas.includes(codigo) ? codigo : null
}
