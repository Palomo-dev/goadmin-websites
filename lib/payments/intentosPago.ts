/**
 * Registrar un intento de pago de un pedido web (o de su anticipo) — UNA sola pieza para
 * checkout/init, los webhooks de Bold, Mercado Pago y Wompi, y /checkout/resultado.
 *
 * Llama `fn_web_order_intento_registrar` (ERP 20261125001000, solo service_role): la base valida
 * que el pedido sea de la organización, recorta los textos y no duplica un aviso repetido (mismo
 * pedido, concepto, pasarela, evento y referencia). Quien llama ya verificó la organización (firma
 * de la pasarela, conexión dueña del pago o host de la tienda); NUNCA sale del payload.
 *
 * Nunca lanza ni bloquea el cobro: un fallo solo queda en consola. El historial es informativo; el
 * estado del pedido lo siguen decidiendo `aplicarPagoPedidoWeb` y el webhook de Wompi.
 */
import { parametrosIntento, type ConceptoIntento, type DatosIntento } from '@/lib/payments/intentosPagoReglas'

export type { ConceptoIntento, DatosIntento } from '@/lib/payments/intentosPagoReglas'

export async function registrarIntentoPago(
  supabase: any,
  destino: { organizationId: number; webOrderId: string | number; concepto?: ConceptoIntento },
  datos: DatosIntento | null | undefined,
): Promise<void> {
  if (!datos || !supabase?.rpc) return
  const organizationId = Number(destino.organizationId)
  const webOrderId = String(destino.webOrderId ?? '')
  if (!Number.isInteger(organizationId) || organizationId <= 0 || !webOrderId) return
  try {
    const { data, error } = await supabase.rpc(
      'fn_web_order_intento_registrar',
      parametrosIntento(organizationId, webOrderId, destino.concepto ?? 'order', datos),
    )
    if (error) {
      console.error('[Intentos de pago] No se pudo registrar', { evento: datos.evento, pasarela: datos.pasarela, code: error.code })
    } else if (data && data.ok === false) {
      console.warn('[Intentos de pago] La base no lo registró', { evento: datos.evento, motivo: data.motivo })
    } else {
      // Registrado (o ya estaba: aviso repetido).
    }
  } catch (err) {
    console.error('[Intentos de pago] Error inesperado', err)
  }
}
