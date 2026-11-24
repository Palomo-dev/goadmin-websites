/**
 * ¿El pedido se paga en línea por una pasarela de la tienda?
 *
 * Misma regla que la consulta del pedido (`app/api/orders/[id]/tracking/route.ts`) y que el
 * vencimiento de la base (`fn_web_order_plazo_minutos`): un método vacío, uno manual de la
 * lista, o uno que `fn_web_order_metodo_nativo` declare nativo (efectivo, transferencia, mesa, o
 * un método de la organización sin conexión de pasarela) no es pasarela.
 *
 * Sin imports: lo cargan los scripts de verificación tal cual.
 */

/** Métodos que se pagan fuera de línea aunque la organización no los haya configurado. */
export const METODOS_PAGO_MANUAL: ReadonlySet<string> = new Set([
  'transfer',
  'cash',
  'bancolombia_transfer',
  'bancolombia_collect',
  'pse',
  'mesa',
])

/** Lo que se descarta sin preguntar a la base. */
export function metodoPuedeSerPasarela(metodo: string | null | undefined): boolean {
  const m = typeof metodo === 'string' ? metodo.trim() : ''
  return !!m && !METODOS_PAGO_MANUAL.has(m)
}

/**
 * `nativo` es la respuesta de `fn_web_order_metodo_nativo`. Sin respuesta (null, o la consulta
 * falló) no se asume pasarela: falla cerrado, no se anuncia un pago que quizá no existe.
 */
export function esMetodoPasarela(metodo: string | null | undefined, nativo: boolean | null | undefined): boolean {
  return metodoPuedeSerPasarela(metodo) && nativo === false
}

type ClienteRpc = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>
}

/** Pregunta a la base. La organización la pasa quien ya la resolvió (el host o el pedido). */
export async function consultarMetodoPasarela(
  supabase: object,
  organizationId: number,
  metodo: string | null | undefined,
): Promise<boolean> {
  if (!metodoPuedeSerPasarela(metodo) || !Number.isInteger(organizationId)) return false
  const { data, error } = await (supabase as ClienteRpc).rpc('fn_web_order_metodo_nativo', {
    p_organization_id: organizationId,
    p_metodo: String(metodo).trim(),
  })
  if (error) {
    console.error('[metodo-pasarela] fn_web_order_metodo_nativo falló', { organizationId, error: error.message })
    return false
  }
  return esMetodoPasarela(metodo, typeof data === 'boolean' ? data : null)
}
