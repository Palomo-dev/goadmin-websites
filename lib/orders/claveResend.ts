/**
 * Clave con la que el sitio envía correos por Resend.
 *
 * Primero la variable del despliegue. Si no está —en producción el cron
 * llegaba a la base y se devolvía sin leer la cola—, la lee del vault
 * (`resend_api_key`) con la service role. Nunca se escribe en el log.
 */

type ClienteRpc = {
  rpc: (
    fn: string,
    args: Record<string, string>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>
}

function claveDeEntorno(): string | null {
  const key = process.env.RESEND_API_KEY
  if (!key || !key.startsWith('re_') || /your|placeholder|xxx/i.test(key)) return null
  return key
}

let memoria: string | null = null

export async function claveResend(supabase: object): Promise<string | null> {
  const entorno = claveDeEntorno()
  if (entorno) return entorno
  if (memoria) return memoria
  const cliente = supabase as ClienteRpc
  const { data, error } = await cliente.rpc('fn_leer_secreto_vault', { p_nombre: 'resend_api_key' })
  if (error || typeof data !== 'string' || !data.startsWith('re_')) {
    if (error) console.error('[correo] No se pudo leer la clave de envío')
    return null
  }
  memoria = data
  return data
}
