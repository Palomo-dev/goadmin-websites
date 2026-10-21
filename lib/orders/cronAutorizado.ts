/**
 * Autenticación de los cron del sitio. Falla cerrado.
 *
 * Vercel Cron manda `Authorization: Bearer` con `CRON_SECRET`. El horario
 * de la base manda el secreto `crm_cron_secret` del vault: no es el mismo,
 * y se comprueba en Postgres para no copiarlo a una variable del despliegue.
 */

import { timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

type ClienteRpc = {
  rpc: (
    fn: string,
    args: Record<string, string>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>
}

function secretoRecibido(request: NextRequest): string {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  return request.headers.get('x-webhook-secret') ?? bearer
}

function secretoDeEntorno(request: NextRequest): boolean {
  const esperado = process.env.CRON_SECRET
  if (!esperado) return false
  const recibido = secretoRecibido(request)
  if (!recibido) return false
  const a = Buffer.from(recibido)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function cronAutorizado(request: NextRequest, supabase: object | null): Promise<boolean> {
  if (secretoDeEntorno(request)) return true
  if (!supabase) return false
  const recibido = secretoRecibido(request)
  if (!recibido || recibido.length > 512) return false
  const cliente = supabase as ClienteRpc
  const { data, error } = await cliente.rpc('fn_secreto_vault_coincide', {
    p_nombre: 'crm_cron_secret',
    p_token: recibido,
  })
  if (error) {
    console.error('[cron] No se pudo comprobar el secreto')
    return false
  }
  return data === true
}
