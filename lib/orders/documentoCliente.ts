/**
 * Documento de la factura electrónica del checkout → ficha del cliente y pedido (pedido del dueño
 * 2026-11-25). Fuera de las rutas del dinero: /api/orders solo lo llama después de crear el pedido.
 *
 * La regla vive en UNA transacción del ERP, `fn_web_order_documento_cliente` (migración
 * 20261125061424, service role):
 * - Cédula, CE o pasaporte → identificación del cliente del pedido si no tenía; la misma: nada;
 *   otra distinta, o el documento ya es de OTRO cliente: no se toca ninguna ficha y el pedido queda
 *   marcado para revisión (nota interna + `billing_data.perfil`).
 * - NIT → la ficha de la empresa con ese NIT (o una nueva con razón social, NIT, DV y correo de
 *   factura), enlazada como empresa del cliente si no tenía una.
 * - Siempre: `web_orders.billing_data` con los datos estructurados (Factus factura ese pedido con
 *   ellos; las pasarelas reciben el documento).
 *
 * Nunca lanza ni registra el documento: un fallo deja el pedido como hoy (la línea de las notas).
 */

import type { FacturaPedidoServidor } from '@/components/site/checkout/facturaEmpresa'

type ClienteSupabase = { rpc: (fn: string, args: Record<string, unknown>) => any }

export type EstadoDocumentoCliente =
  | 'guardado' | 'igual' | 'distinto' | 'duplicado' | 'empresa_existente' | 'empresa_creada'
  | 'sin_cliente' | 'sin_pedido' | 'invalido' | 'error'

export async function guardarDocumentoPedido(
  supabase: ClienteSupabase,
  organizationId: number,
  webOrderId: string,
  factura: FacturaPedidoServidor,
): Promise<EstadoDocumentoCliente> {
  try {
    const { data, error } = await supabase.rpc('fn_web_order_documento_cliente', {
      p_organization_id: organizationId,
      p_order_id: webOrderId,
      p_datos: factura,
    })
    if (error) {
      // Sin el documento ni los datos del cliente en el log: solo el código.
      console.error('[Orders] No se pudo guardar el documento de la factura', { organizationId, webOrderId, code: error.code })
      return 'error'
    }
    const estado = typeof data?.estado === 'string' ? (data.estado as EstadoDocumentoCliente) : 'error'
    if (estado === 'distinto' || estado === 'duplicado') {
      console.warn('[Orders] Documento de factura distinto al de la ficha: pedido marcado para revisión', { organizationId, webOrderId, estado })
    } else {
      // Guardado, el mismo, empresa o sin ficha: nada que avisar.
    }
    return estado
  } catch {
    console.error('[Orders] No se pudo guardar el documento de la factura', { organizationId, webOrderId })
    return 'error'
  }
}
