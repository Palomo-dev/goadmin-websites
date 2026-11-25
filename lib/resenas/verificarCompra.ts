/**
 * Verificación de compra de una reseña, en el servidor (Figma 2C / 2H / 3B, paso 6 de 5A).
 *
 * Una opinión sale con «Compra verificada» SOLO si una de estas vías lo demuestra para un pedido
 * del sitio de la organización del host, ENTREGADO (`web_orders.status = 'delivered'`) y que
 * incluye el producto (o una de sus variantes):
 *
 * 1. `enlace`: el pedido y un token firmado — el del correo «¿Qué te pareció tu compra?»
 *    (`firmaResena.ts`) o el de seguimiento del pedido (`tokenSeguimiento.ts`, el de Consultar
 *    pedido y Mi cuenta). Sin token válido el id del pedido no basta: lo muestra el rastreo público.
 * 2. `pedido`: el correo de la compra + el número de pedido (los dos deben coincidir).
 * 3. `sesion`: el cliente con sesión en la tienda (`getAuthCustomer`) tiene un pedido así.
 *
 * Nunca lanza: ante un error de lectura responde «no verificado» y lo registra.
 * Columnas verificadas por MCP el 2026-11-25: web_orders (id, organization_id, customer_id,
 * order_number, status, source, customer_name, customer_email, delivered_at), web_order_items
 * (web_order_id, product_id), products (id, parent_product_id, organization_id).
 */

import { enlaceResenaValido } from '@/lib/resenas/firmaResena'
import { tokenSeguimientoValido } from '@/lib/orders/tokenSeguimiento'
import { igualdadSinMayusculas } from '@/lib/auth/clienteSesion'

type Cliente = { from: (tabla: string) => any }

export type MetodoVerificacion = 'sesion' | 'pedido' | 'enlace'
export type MotivoNoVerificado = 'sin_datos' | 'no_encontrado' | 'no_entregado' | 'sin_producto' | 'error'

export interface PedidoVerificado {
  id: string
  numero: string
  nombre: string | null
  correo: string | null
  entregadoEn: string | null
}

export type Verificacion =
  | { verificado: true; metodo: MetodoVerificacion; pedido: PedidoVerificado }
  | { verificado: false; motivo: MotivoNoVerificado }

export interface EntradaVerificacion {
  organizationId: number
  productId: number
  /** Vía 1. */
  orderId?: string | null
  token?: string | null
  trackingToken?: string | null
  /** Vía 2. */
  email?: string | null
  orderNumber?: string | null
  /** Vía 3: la ficha de cliente de la sesión (ya resuelta por quien llama). */
  customerId?: string | null
}

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLUMNAS_PEDIDO = 'id, order_number, status, customer_name, customer_email, delivered_at'

/** El producto y sus variantes (una ficha de producto padre se compra como variante). */
async function idsDelProducto(sb: Cliente, organizationId: number, productId: number): Promise<number[]> {
  const { data, error } = await sb
    .from('products')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('parent_product_id', productId)
    .limit(200)
  if (error) throw error
  return [productId, ...((data ?? []) as { id: number }[]).map((p) => p.id)]
}

async function incluyeProducto(sb: Cliente, orderId: string, ids: number[]): Promise<boolean> {
  const { data, error } = await sb.from('web_order_items').select('id').eq('web_order_id', orderId).in('product_id', ids).limit(1)
  if (error) throw error
  return Array.isArray(data) && data.length > 0
}

function aPedido(f: any): PedidoVerificado {
  return {
    id: String(f.id),
    numero: String(f.order_number ?? ''),
    nombre: typeof f.customer_name === 'string' && f.customer_name.trim() ? f.customer_name.trim() : null,
    correo: typeof f.customer_email === 'string' ? f.customer_email.trim().toLowerCase() : null,
    entregadoEn: f.delivered_at ?? null,
  }
}

async function revisar(sb: Cliente, filas: any[], ids: number[], metodo: MetodoVerificacion): Promise<Verificacion> {
  if (filas.length === 0) return { verificado: false, motivo: 'no_encontrado' }
  const entregados = filas.filter((f) => f.status === 'delivered')
  if (entregados.length === 0) return { verificado: false, motivo: 'no_entregado' }
  for (const f of entregados) {
    if (await incluyeProducto(sb, String(f.id), ids)) return { verificado: true, metodo, pedido: aPedido(f) }
  }
  return { verificado: false, motivo: 'sin_producto' }
}

export async function verificarCompra(sb: Cliente, e: EntradaVerificacion): Promise<Verificacion> {
  const org = e.organizationId
  try {
    // 1. Enlace firmado o token de seguimiento.
    if (e.orderId && PATRON_UUID.test(e.orderId) && (enlaceResenaValido(org, e.orderId, e.token) || tokenSeguimientoValido(org, e.orderId, e.trackingToken))) {
      const ids = await idsDelProducto(sb, org, e.productId)
      const { data, error } = await sb.from('web_orders').select(COLUMNAS_PEDIDO).eq('organization_id', org).eq('id', e.orderId).limit(1)
      if (error) throw error
      return revisar(sb, data ?? [], ids, 'enlace')
    }

    // 2. Correo + número de pedido.
    const numero = typeof e.orderNumber === 'string' ? e.orderNumber.trim().toUpperCase().slice(0, 40) : ''
    if (e.email && numero) {
      const ids = await idsDelProducto(sb, org, e.productId)
      const { data, error } = await sb
        .from('web_orders')
        .select(COLUMNAS_PEDIDO)
        .eq('organization_id', org)
        .eq('order_number', numero)
        .ilike('customer_email', igualdadSinMayusculas(e.email))
        .limit(5)
      if (error) throw error
      return revisar(sb, data ?? [], ids, 'pedido')
    }

    // 3. Sesión de cliente.
    if (e.customerId && PATRON_UUID.test(e.customerId)) {
      const ids = await idsDelProducto(sb, org, e.productId)
      const { data, error } = await sb
        .from('web_orders')
        .select(COLUMNAS_PEDIDO)
        .eq('organization_id', org)
        .eq('customer_id', e.customerId)
        .eq('status', 'delivered')
        .order('delivered_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return revisar(sb, data ?? [], ids, 'sesion')
    }
    return { verificado: false, motivo: 'sin_datos' }
  } catch (err) {
    console.error('[resenas] No se pudo verificar la compra', { organizationId: org, error: err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err) })
    return { verificado: false, motivo: 'error' }
  }
}
