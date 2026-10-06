/**
 * Reglas de Sitio web › Ventas en línea del ERP sobre un pedido web: «Compra como invitado» y
 * «Pedido mínimo» (`checkout_guest_enabled`, `checkout_min_order_amount`; contrato en
 * lib/website/ajustesSitio.ts).
 *
 * Una sola regla para el checkout (aviso y bloqueo) y para `/api/orders` (la que manda). Con los
 * DEFAULT —invitado permitido y sin mínimo— las dos funciones responden siempre `ok`: el pedido
 * sigue exactamente igual que antes de que existieran los ajustes.
 *
 * Decisiones (repórtense al diseño si cambian):
 * - El mínimo se compara con el SUBTOTAL DE PRODUCTOS calculado con precios del servidor, antes
 *   de cupón, impuesto, envío y propina. Es el número que el cliente ve crecer al añadir
 *   productos; un cupón no lo deja por debajo del mínimo.
 * - Con sesión de cliente de la organización la regla de invitado no aplica.
 *
 * Puro (sin imports): lo usan el servidor, el navegador y scripts/verify-ajustes-sitio.mjs.
 */

export type ResultadoRegla =
  | { ok: true }
  | {
      ok: false
      codigo: 'requiere_cuenta' | 'pedido_minimo'
      status: 401 | 422
      /** Solo `pedido_minimo`: lo que falta para llegar, y el mínimo. */
      faltante?: number
      minimo?: number
    }

/** Tolerancia de redondeo (centavos), la misma escala que `redondear2` de /api/orders. */
const TOLERANCIA = 0.005

export function evaluarCompraInvitado(args: { invitadoPermitido: boolean; conSesion: boolean }): ResultadoRegla {
  if (args.invitadoPermitido) return { ok: true }
  if (args.conSesion) return { ok: true }
  return { ok: false, codigo: 'requiere_cuenta', status: 401 }
}

export function evaluarPedidoMinimo(args: { minimo: number | null; subtotal: number }): ResultadoRegla {
  const { minimo, subtotal } = args
  if (minimo === null || !Number.isFinite(minimo) || minimo <= 0) return { ok: true }
  if (!Number.isFinite(subtotal)) return { ok: true }
  if (subtotal + TOLERANCIA >= minimo) return { ok: true }
  const faltante = Math.round((minimo - subtotal) * 100) / 100
  return { ok: false, codigo: 'pedido_minimo', status: 422, faltante, minimo }
}
