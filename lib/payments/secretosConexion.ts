/**
 * Lector DUAL de credenciales de pasarela (`integration_credentials.secret_ref`).
 *
 * Hoy todas las pasarelas guardan el valor tal cual en `secret_ref`. El ERP ya sabe guardar en la
 * bóveda de Supabase (Vault): entonces `secret_ref` es el uuid de `vault.secrets` y el valor se lee
 * con `fn_get_provider_secret(conexión, propósito)` (SECURITY DEFINER, solo service role).
 *
 * Reglas (las mismas que `lib/payments/wompi-firma.ts` y el lector del ERP):
 *  - `secret_ref` SIN forma de uuid → se devuelve igual que siempre y NO se llama a ninguna RPC.
 *    Es exactamente el comportamiento anterior (la RPC `get_decrypted_secret` que se intentaba
 *    antes no existe en la base: siempre fallaba y se usaba el valor crudo).
 *  - `secret_ref` con forma de uuid → se resuelve en la bóveda. Si la bóveda no responde, se
 *    devuelve '' (nunca el uuid: firmar o cobrar con él fallaría peor que declarar «sin secreto»).
 *
 * Módulo PURO: recibe el cliente (service role) y no importa nada del proyecto.
 */

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** ¿El `secret_ref` es una referencia a la bóveda? */
export function esReferenciaDeBoveda(secretRef: unknown): boolean {
  return typeof secretRef === 'string' && UUID_RE.test(secretRef)
}

interface ClienteRpc {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
}

/** Valor real de una credencial (en claro o desde la bóveda). */
export async function valorDeCredencial(
  supabase: ClienteRpc,
  connectionId: string,
  purpose: string,
  secretRef: string | null | undefined
): Promise<string> {
  const crudo = typeof secretRef === 'string' ? secretRef : ''
  if (!esReferenciaDeBoveda(crudo)) return crudo
  try {
    const { data, error } = await supabase.rpc('fn_get_provider_secret', {
      p_connection_id: connectionId,
      p_purpose: purpose,
    })
    if (!error && typeof data === 'string' && data) return data
  } catch {
    // Sin permiso o sin red: se declara «sin secreto».
  }
  console.error('[secretos] secret_ref de la bóveda sin valor. Propósito:', purpose)
  return ''
}

/**
 * Devuelve las mismas filas con `secret_ref` resuelto. Filas en claro: idénticas y sin RPC, así
 * cada lector conserva su lógica (último gana, `find`, etc.) sin cambios.
 */
export async function resolverCredenciales<T extends { purpose?: string | null; secret_ref?: string | null }>(
  supabase: ClienteRpc,
  connectionId: string,
  filas: readonly T[] | null | undefined
): Promise<T[]> {
  const salida: T[] = []
  for (const f of filas ?? []) {
    if (!esReferenciaDeBoveda(f.secret_ref)) {
      salida.push(f)
      continue
    }
    const valor = await valorDeCredencial(supabase, connectionId, String(f.purpose ?? ''), f.secret_ref)
    salida.push({ ...f, secret_ref: valor })
  }
  return salida
}
