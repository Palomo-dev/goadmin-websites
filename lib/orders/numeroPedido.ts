/**
 * Número del pedido web (la referencia que viaja a la pasarela).
 *
 * El formato lo elige cada organización en el ERP (Configuración › POS › Número de pedido) y lo
 * entrega el RPC `siguiente_numero_pedido_web` de la base, el MISMO que usa el ERP para el pedido
 * manual (go-admin-erp `src/lib/services/webOrders/numeroPedidoServer.ts`):
 *  - `actual` (por defecto, el RPC devuelve null): `WO-{orgId}-{Date.now() base 36}-{4 al azar}`;
 *  - `consecutivo`: `PREFIJO-0001`, atómico en la base;
 *  - `corto`: `PREFIJO-XXXXXX`.
 * Si el RPC no existe (migración sin aplicar), falla o el cliente no tiene permiso (solo se concede
 * a service_role), se usa el formato de siempre: un pedido nunca se queda sin crear por el número.
 *
 * `order_number` es único en toda la base (índice `web_orders_order_number_key`): los webhooks
 * encuentran el pedido de un cobro por su número sin mirar la organización. Si el insert choca
 * (código corto repetido, carrera), se pide otro número.
 *
 * Sin imports con alias: `scripts/verify-numero-pedido.mjs` lo importa directo con node.
 */

export const RPC_SIGUIENTE_NUMERO = 'siguiente_numero_pedido_web'
export const INDICE_NUMERO_UNICO = 'web_orders_order_number_key'
export const INTENTOS_NUMERO = 3

type ErrorPg = { code?: string | null; message?: string | null; details?: string | null } | null | undefined

interface ClienteRpc {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: ErrorPg }>
}

/** `WO-{orgId}-{ts36}-{rand4}`, el formato de siempre. `ahora` y `azar` existen para las pruebas. */
export function numeroLegado(organizationId: number, ahora: number = Date.now(), azar: () => number = Math.random): string {
  const ts = ahora.toString(36).toUpperCase()
  const rand = azar().toString(36).substring(2, 6).toUpperCase().padEnd(4, '0')
  return `WO-${organizationId}-${ts}-${rand}`
}

/** ¿El insert falló porque el número ya existe? (no otro índice único, p. ej. el de la ronda de mesa) */
export function esNumeroRepetido(error: ErrorPg): boolean {
  if (!error || error.code !== '23505') return false
  const texto = `${error.message ?? ''} ${error.details ?? ''}`
  return texto.includes(INDICE_NUMERO_UNICO) || /\(order_number\)/.test(texto)
}

const NO_EXISTE = /does not exist|could not find|schema cache/i

function rpcAusente(error: ErrorPg): boolean {
  return !!error && (error.code === '42883' || error.code === 'PGRST202' || NO_EXISTE.test(error.message ?? ''))
}

/** Número para un pedido nuevo de la organización (ver arriba). */
export async function generarNumeroPedido(supabase: ClienteRpc, organizationId: number, ahora: () => number = Date.now): Promise<string> {
  try {
    const { data, error } = await supabase.rpc(RPC_SIGUIENTE_NUMERO, { p_organization_id: organizationId })
    if (!error && typeof data === 'string' && data.trim()) return data.trim()
    if (error && !rpcAusente(error)) {
      console.warn('[Orders] siguiente_numero_pedido_web falló; se usa el formato de siempre', { organizationId, code: error.code })
    }
  } catch (e) {
    console.warn('[Orders] siguiente_numero_pedido_web lanzó; se usa el formato de siempre', { organizationId, error: e instanceof Error ? e.message : String(e) })
  }
  return numeroLegado(organizationId, ahora())
}

/**
 * Inserta la fila con un número recién pedido; si choca con uno existente, pide otro, hasta
 * `INTENTOS_NUMERO` veces. Otros errores (incluidos los de otros índices únicos) vuelven tal cual.
 */
export async function insertarConNumero<R extends { error: ErrorPg }>(
  supabase: ClienteRpc,
  organizationId: number,
  insertar: (orderNumber: string) => PromiseLike<R>,
  ahora: () => number = Date.now,
): Promise<R> {
  let ultimo: R | undefined
  for (let i = 0; i < INTENTOS_NUMERO; i++) {
    const numero = await generarNumeroPedido(supabase, organizationId, ahora)
    ultimo = await insertar(numero)
    if (!esNumeroRepetido(ultimo.error)) return ultimo
  }
  return ultimo as R
}
