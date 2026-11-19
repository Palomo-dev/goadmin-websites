/**
 * Consulta directa a Bold o a Mercado Pago del pago de un pedido web, para /checkout/resultado:
 * si el aviso (webhook) no ha llegado cuando el cliente vuelve, la página le pregunta al
 * proveedor, igual que ya hacía con Wompi. Lo que responda se aplica con `aplicarPagoPedidoWeb`,
 * así que webhook y página no duplican nada.
 *
 *  - Mercado Pago: `GET /v1/payments/search?external_reference=…` con el access_token de la
 *    organización del pedido.
 *  - Bold (Botón de pagos): `GET https://payments.api.bold.co/v2/payment-voucher/{order-id}` con
 *    `Authorization: x-api-key <llave de identidad>` (nunca la secreta). Fuente:
 *    https://developers.bold.co/pagos-en-linea/boton-de-pagos/consulta-de-transacciones
 *
 * Solo lectura hacia el proveedor; ninguna credencial sale en registros.
 */
import { resolverCredenciales } from '@/lib/payments/secretosConexion'
import { mapToPaymentMethodCode } from '@/lib/payments/mapPaymentMethod'
import {
  elegirPagoMercadoPago,
  estadoComprobanteBold,
  estadoMercadoPago,
  type PagoMercadoPago,
} from '@/lib/payments/pasarelasTienda'
import { BOLD_CONECTOR_LINK_ID } from '@/lib/payments/firmanteBold'
import type { ResultadoPasarela } from '@/lib/payments/pagoPedidoWeb'

const MP_CONECTOR_ID = 'b00cfe3f-efa6-4656-93da-f42bf3073ab4'
const TIEMPO_LIMITE_MS = 5000

/** `web_orders.payment_method` que deja checkout/init al elegir cada pasarela. */
export const METODO_PEDIDO_MERCADOPAGO = 'mp_checkout'
export const METODO_PEDIDO_BOLD = 'bold_link'

async function credenciales(supabase: any, organizationId: number, conectorId: string): Promise<Record<string, string> | null> {
  const { data: conexion } = await supabase
    .from('integration_connections')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('connector_id', conectorId)
    .in('status', ['active', 'connected'])
    .limit(1)
    .maybeSingle()
  if (!conexion) return null
  const { data: filas } = await supabase
    .from('integration_credentials')
    .select('purpose, credential_type, secret_ref')
    .eq('connection_id', conexion.id)
    .eq('status', 'active')
  const resueltas = await resolverCredenciales<{ purpose: string; credential_type: string; secret_ref: string }>(supabase, conexion.id, filas)
  const salida: Record<string, string> = {}
  for (const f of resueltas) salida[f.purpose || f.credential_type] = f.secret_ref
  return salida
}

async function pedirJson(url: string, cabeceras: Record<string, string>): Promise<any | null> {
  const controlador = new AbortController()
  const limite = setTimeout(() => controlador.abort(), TIEMPO_LIMITE_MS)
  try {
    const res = await fetch(url, { headers: cabeceras, signal: controlador.signal, cache: 'no-store' })
    if (!res.ok) {
      console.warn(`[Consulta pasarela] ${new URL(url).host} respondió ${res.status}`)
      return null
    }
    return await res.json()
  } catch (err) {
    console.warn(`[Consulta pasarela] ${new URL(url).host}: ${controlador.signal.aborted ? 'sin respuesta a tiempo' : 'error de red'}`)
    return null
  } finally {
    clearTimeout(limite)
  }
}

export async function consultarMercadoPago(
  supabase: any,
  pedido: { organization_id: number; order_number: string }
): Promise<ResultadoPasarela | null> {
  const creds = await credenciales(supabase, pedido.organization_id, MP_CONECTOR_ID)
  const token = creds?.access_token
  if (!token) return null
  const url = `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(pedido.order_number)}&sort=date_created&criteria=desc&limit=20`
  const json = await pedirJson(url, { Authorization: `Bearer ${token}` })
  const pago: PagoMercadoPago | null = elegirPagoMercadoPago(json?.results, pedido.order_number)
  if (!pago || pago.id == null) return null
  const monto = Number(pago.transaction_amount)
  return {
    estado: estadoMercadoPago(pago.status),
    transaccionId: String(pago.id),
    monto: Number.isFinite(monto) ? monto : null,
    moneda: pago.currency_id || 'COP',
    metodoPago: mapToPaymentMethodCode(pago.payment_method_id || pago.payment_type_id, 'mercadopago'),
    metodoPedido: pago.payment_method_id || pago.payment_type_id || 'mercadopago',
    respuesta: pago,
    proveedor: 'Mercado Pago',
    detalle: [pago.status, pago.status_detail].filter(Boolean).join(' · '),
  }
}

export async function consultarBold(
  supabase: any,
  pedido: { organization_id: number; order_number: string }
): Promise<ResultadoPasarela | null> {
  const creds = await credenciales(supabase, pedido.organization_id, BOLD_CONECTOR_LINK_ID)
  const llaveIdentidad = creds?.identity_key
  if (!llaveIdentidad) return null
  const url = `https://payments.api.bold.co/v2/payment-voucher/${encodeURIComponent(pedido.order_number)}`
  const json = await pedirJson(url, { Authorization: `x-api-key ${llaveIdentidad}` })
  if (!json || typeof json !== 'object') return null
  const estado = estadoComprobanteBold(json.payment_status)
  if (estado === 'pending') return null
  const monto = Number(json.total)
  const metodo = typeof json.payment_method === 'string' ? json.payment_method.toLowerCase() : null
  return {
    estado,
    transaccionId: String(json.transaction_id || json.link_id || pedido.order_number),
    monto: Number.isFinite(monto) ? monto : null,
    moneda: 'COP',
    metodoPago: mapToPaymentMethodCode(metodo, 'bold'),
    metodoPedido: metodo || 'bold_link',
    respuesta: json,
    proveedor: 'Bold',
    detalle: json.payment_status ?? null,
  }
}
