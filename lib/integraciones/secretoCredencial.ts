/**
 * Valor real de una credencial de `integration_credentials`, según la forma de `secret_ref`:
 * - uuid de `vault.secrets` (lo que deja `fn_set_provider_secret` del ERP): se lee con
 *   `fn_get_provider_secret(connection_id, purpose)`, que solo ejecuta service_role. Si el Vault no
 *   responde se devuelve '' (falla cerrado: nunca se usa el uuid como si fuera el secreto).
 * - cualquier otra cosa: el valor en claro de las credenciales anteriores a Vault, tal cual
 *   (lo de siempre).
 *
 * Reemplaza la llamada a `get_decrypted_secret`, que no existe en la base: fallaba siempre y el
 * código seguía con `secret_ref`, así que con un uuid se habría firmado con el uuid.
 * Misma regla que `lib/payments/wompi-firma.ts` y que `secretosIntegracion.ts` del ERP.
 */
type ClienteRpc = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> }

const FORMA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function esReferenciaVault(secretRef: unknown): secretRef is string {
  return typeof secretRef === 'string' && FORMA_UUID.test(secretRef.trim())
}

export async function resolverSecretoCredencial(
  supabase: ClienteRpc,
  connectionId: string,
  purpose: string,
  secretRef: string | null | undefined,
): Promise<string> {
  if (!secretRef) return ''
  if (!esReferenciaVault(secretRef)) return secretRef
  const { data, error } = await supabase.rpc('fn_get_provider_secret', { p_connection_id: connectionId, p_purpose: purpose })
  if (error || typeof data !== 'string' || !data) {
    console.error(`[secretos] No se pudo leer «${purpose}» del Vault para la conexión ${connectionId}: ${error?.message ?? 'sin valor'}`)
    return ''
  }
  return data
}
