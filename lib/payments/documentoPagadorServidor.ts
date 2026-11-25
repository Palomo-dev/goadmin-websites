/**
 * Documento del pagador de un pedido web para `/api/checkout/init` (solo servidor). La regla de qué
 * se puede mandar y a qué pasarela vive en `documentoPagador.ts` (puro).
 *
 * Quién paga tiene que demostrar que es el comprador: el token de seguimiento del pedido (lo tiene
 * el checkout y el enlace del correo) o la sesión del cliente del pedido. Sin eso, null: con solo
 * el número del pedido nadie obtiene el documento de otro (hoy cualquiera puede abrir el cobro de un
 * pedido conociendo su número).
 *
 * Nunca lanza ni registra el documento.
 */

import { getAuthCustomer } from '@/lib/get-auth-customer'
import { tokenSeguimientoValido } from '@/lib/orders/tokenSeguimiento'
import { documentoDeFacturaPedido, elegirDocumentoPagador, type DocumentoPagador } from './documentoPagador'

type ClienteSupabase = { from: (tabla: string) => any }

export async function documentoPagadorDelPedido(
  supabase: ClienteSupabase,
  pedido: { id?: unknown; organization_id?: unknown },
  token: unknown,
): Promise<DocumentoPagador | null> {
  try {
    const organizationId = Number(pedido.organization_id)
    const id = typeof pedido.id === 'string' ? pedido.id : null
    if (!id || !Number.isInteger(organizationId) || organizationId <= 0) return null

    const { data, error } = await supabase
      .from('web_orders')
      .select('customer_id, billing_data')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (error || !data) return null

    const tokenValido = tokenSeguimientoValido(organizationId, id, typeof token === 'string' ? token : null)
    // La sesión solo hace falta si el token no basta (sin token, o sin factura en el pedido y hay
    // que mirar la ficha del cliente).
    let sesion: Awaited<ReturnType<typeof getAuthCustomer>> = null
    if (data.customer_id && !(tokenValido && documentoDeFacturaPedido(data.billing_data))) {
      sesion = await getAuthCustomer(organizationId)
    } else {
      // El token y la factura del pedido bastan, o el pedido no tiene cliente.
    }
    const sesionEsDelPedido = !!sesion && !!data.customer_id && String(sesion.id) === String(data.customer_id)

    return elegirDocumentoPagador({
      billing: data.billing_data,
      perfil: sesionEsDelPedido && sesion ? { tipo: sesion.identification_type, numero: sesion.identification_number } : null,
      tokenValido,
      sesionEsDelPedido,
    })
  } catch {
    return null
  }
}
