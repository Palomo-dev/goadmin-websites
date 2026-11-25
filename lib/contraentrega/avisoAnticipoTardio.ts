/**
 * Anticipo pagado con el pedido VENCIDO: avisos de la tienda (ERP 20261125121000, Figma «05 POS y
 * ventas» 3181-202769 › 11a / 12a). Lo llama `anticipoWebhook.ts` en el `else` de «pagado» (sin
 * cambiar ese ramal): con cualquier otro estado de la base no hace nada.
 *
 * 1. Avisa al ERP con el mismo `notifyErpAutoConfirm` del anticipo a tiempo: si la base reactivó
 *    el pedido, el ERP lo confirma por el camino de siempre; si quedó «Anticipo pagado · vencido»,
 *    el ERP manda el WhatsApp «lo estamos revisando» y no confirma nada.
 * 2. El correo al comprador, con la marca de la tienda (después de la confirmación, para llevar las
 *    horas estimadas cuando las hay).
 *
 * Nunca lanza y nunca devuelve dinero: la devolución la decide una persona en el ERP.
 */

import { notifyErpAutoConfirm } from '@/lib/erp-auto-confirm'
import { accionAnticipoTardio } from './anticipoTardio'
import { enviarCorreoAnticipoTardio } from './correoAnticipoTardio'

export async function avisarAnticipoTardio(webOrderId: string, status: string | null | undefined): Promise<void> {
  const accion = accionAnticipoTardio(status)
  if (!accion) {
    return
  } else {
    try {
      // notifyErpAutoConfirm nunca lanza (red y respuestas del ERP quedan en el log).
      await notifyErpAutoConfirm(webOrderId)
      await enviarCorreoAnticipoTardio(webOrderId, accion.correo)
    } catch (err) {
      console.error('[Anticipo] Aviso del anticipo tardío', { webOrderId, err })
    }
  }
}
