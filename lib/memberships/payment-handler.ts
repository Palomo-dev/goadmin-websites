/**
 * Pagos de pasarela con referencia `MEM-{id}` (compra directa de membresía) — FLUJO RETIRADO.
 *
 * Antes este handler, llamado por los seis webhooks, cambiaba `memberships.status` a mano,
 * insertaba `payments` (source 'membership'), `membership_payments` y `membership_events`.
 * Desde las fases 1–2 de Membresías del ERP (go-admin-erp, docs/design/MEMBRESIAS-FASE-1-2.md
 * §4) una membresía se crea y activa SOLO dentro de la base, al confirmarse la venta de su
 * producto: el pedido web pagado llega al ERP por `notifyErpAutoConfirm` (lib/erp-auto-confirm.ts)
 * y el ERP llama `fn_membresias_activar_venta`. Duplicar aquí esa activación es justo lo que la
 * regla de "no duplicar lógica" prohíbe (y lo que dejó a este flujo roto: escribía estados que
 * la base ya no admite).
 *
 * Ninguna referencia `MEM-` nueva puede generarse: `/api/memberships/purchase` y el ramal
 * `source: 'membership'` de `/api/checkout/init` responden 410, y en la base no hay ni un pago
 * con source 'membership'. Si aun así llega uno (un enlace viejo), NO se toca ninguna tabla: se
 * registra en el log con los datos para conciliarlo a mano, y el webhook responde 200 como
 * antes (la pasarela no debe reintentar un evento que no vamos a procesar).
 *
 * Además, el handler anterior no comprobaba que la membresía `MEM-{id}` fuera de la organización
 * dueña de la pasarela que notificaba: con un id ajeno activaba la membresía de otra organización.
 */

/**
 * Detecta si una referencia de pago corresponde a una membresía (flujo retirado).
 */
export function isMembershipReference(reference: string): boolean {
  return reference?.startsWith('MEM-') ?? false
}

interface PaymentResult {
  handled: boolean
  membershipId?: number
  status?: string
  error?: string
}

export async function handleMembershipPayment(
  _supabase: unknown,
  reference: string,
  paymentStatus: string,
  paymentDetails: {
    transactionId: string
    amount: number
    currency: string
    method: string
    processorResponse: unknown
    gateway: string
  }
): Promise<PaymentResult> {
  if (!isMembershipReference(reference)) {
    return { handled: false }
  }

  console.error(
    '[MembershipPayment] Referencia MEM- recibida: la compra directa de membresías está retirada; ' +
      'no se modifica ninguna tabla. Conciliar a mano si hubo cobro.',
    {
      reference,
      paymentStatus,
      gateway: paymentDetails.gateway,
      transactionId: paymentDetails.transactionId,
      amount: paymentDetails.amount,
      currency: paymentDetails.currency,
    }
  )

  return { handled: true, error: 'flujo_retirado' }
}
