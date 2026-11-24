/**
 * Código de 6 dígitos propio de la tienda (solo servidor).
 *
 * Reemplaza el OTP de Supabase (2026-11-24): el comprador nunca recibe correos de Supabase Auth.
 * Tabla `web_customer_login_codes` (migración 20261124180000 del ERP): RLS sin políticas, solo
 * service_role. Se guarda el HMAC-SHA256 del código, nunca el código.
 *
 * - Pepper: derivado de la service role key (que nunca sale del servidor), como el token de
 *   seguimiento (lib/orders/tokenSeguimiento.ts). Sin ella no se emite ni se verifica nada.
 * - El hash firma organización + correo + propósito + código: un código de una tienda no sirve en
 *   otra ni para otro propósito.
 * - Vence a los `MINUTOS_VIGENCIA_CODIGO`, máximo `MAX_INTENTOS_CODIGO` intentos y un solo uso.
 *   Pedir uno nuevo invalida el anterior del mismo propósito.
 * - Límite por correo en la base (vale entre instancias): uno por minuto y
 *   `MAX_CODIGOS_VENTANA` cada `VENTANA_CODIGOS_MIN`. El de IP sigue en las rutas (lib/rateLimit.ts).
 *
 * `organizationId` sale SIEMPRE del host. El cliente es de service role: cada consulta filtra por
 * organización y correo.
 */

import { createHash, createHmac, randomInt, timingSafeEqual } from 'crypto'
import {
  LARGO_CODIGO,
  MINUTOS_VIGENCIA_CODIGO,
  VENTANA_CODIGOS_MIN,
  estadoAntesDeProbar,
  puedeEnviarCodigo,
  type PropositoCodigo,
  type ResultadoCodigo,
} from '@/lib/cuenta/reglasCuenta'

type ClienteDb = { from: (tabla: string) => any }

const TABLA = 'web_customer_login_codes'

function pepper(): Buffer | null {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRole) return null
  return createHash('sha256').update(`codigo-tienda:${serviceRole}`).digest()
}

function hashCodigo(p: Buffer, organizationId: number, correo: string, proposito: PropositoCodigo, codigo: string): string {
  return createHmac('sha256', p).update(`${organizationId}:${correo}:${proposito}:${codigo}`).digest('hex')
}

function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export type ResultadoEmision =
  | { ok: true; codigo: string }
  | { ok: false; motivo: 'espera' | 'limite' | 'error' }

/** Genera, guarda (hash) y devuelve un código nuevo para enviarlo. No envía nada. */
export async function emitirCodigo(
  db: ClienteDb,
  entrada: { organizationId: number; correo: string; proposito: PropositoCodigo; ip: string | null },
): Promise<ResultadoEmision> {
  const p = pepper()
  if (!p) return { ok: false, motivo: 'error' }
  const { organizationId, correo, proposito } = entrada
  const ahora = Date.now()

  const desde = new Date(ahora - VENTANA_CODIGOS_MIN * 60_000).toISOString()
  const { data: recientes, error: errLectura } = await db
    .from(TABLA)
    .select('created_at')
    .eq('organization_id', organizationId)
    .eq('email', correo)
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .limit(20)
  if (errLectura) {
    console.error('[codigo] No se pudieron leer los códigos recientes', { organizationId, error: errLectura.message })
    return { ok: false, motivo: 'error' }
  }
  const permiso = puedeEnviarCodigo((recientes || []).map((r: { created_at: string }) => r.created_at), ahora)
  if (permiso !== 'ok') return { ok: false, motivo: permiso }

  // El anterior del mismo propósito deja de servir: solo vale el último que llegó.
  await db
    .from(TABLA)
    .update({ used_at: new Date(ahora).toISOString() })
    .eq('organization_id', organizationId)
    .eq('email', correo)
    .eq('purpose', proposito)
    .is('used_at', null)

  const codigo = String(randomInt(0, 10 ** LARGO_CODIGO)).padStart(LARGO_CODIGO, '0')
  const { error } = await db.from(TABLA).insert({
    organization_id: organizationId,
    email: correo,
    code_hash: hashCodigo(p, organizationId, correo, proposito, codigo),
    purpose: proposito,
    expires_at: new Date(ahora + MINUTOS_VIGENCIA_CODIGO * 60_000).toISOString(),
    ip: entrada.ip ? entrada.ip.slice(0, 64) : null,
  })
  if (error) {
    console.error('[codigo] No se pudo guardar el código', { organizationId, error: error.message })
    return { ok: false, motivo: 'error' }
  }

  // Limpieza de lo viejo de este correo (la tabla no crece sin fin).
  await db
    .from(TABLA)
    .delete()
    .eq('organization_id', organizationId)
    .eq('email', correo)
    .lt('created_at', new Date(ahora - 24 * 60 * 60_000).toISOString())

  return { ok: true, codigo }
}

/**
 * Comprueba el código escrito contra el último vigente del propósito. Cada intento cuenta (antes de
 * comparar) y un acierto lo marca usado: no sirve dos veces.
 */
export async function verificarCodigo(
  db: ClienteDb,
  entrada: { organizationId: number; correo: string; proposito: PropositoCodigo; codigo: string },
): Promise<ResultadoCodigo | 'error'> {
  const p = pepper()
  if (!p) return 'error'
  const { organizationId, correo, proposito, codigo } = entrada

  const { data: fila, error } = await db
    .from(TABLA)
    .select('id, code_hash, attempts, expires_at, used_at')
    .eq('organization_id', organizationId)
    .eq('email', correo)
    .eq('purpose', proposito)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[codigo] No se pudo leer el código', { organizationId, error: error.message })
    return 'error'
  }
  const estado = estadoAntesDeProbar(fila, Date.now())
  if (estado !== 'probar') return estado

  // El intento se cuenta primero; si otra petición contó a la vez, este no vale.
  const intentos = Number(fila.attempts ?? 0)
  const { data: contado } = await db
    .from(TABLA)
    .update({ attempts: intentos + 1 })
    .eq('id', fila.id)
    .eq('attempts', intentos)
    .is('used_at', null)
    .select('id')
    .maybeSingle()
  if (!contado) return 'no_coincide'

  if (!iguales(String(fila.code_hash), hashCodigo(p, organizationId, correo, proposito, codigo))) {
    return estadoAntesDeProbar({ ...fila, attempts: intentos + 1 }, Date.now()) === 'intentos' ? 'intentos' : 'no_coincide'
  }

  const { data: usado } = await db
    .from(TABLA)
    .update({ used_at: new Date().toISOString() })
    .eq('id', fila.id)
    .is('used_at', null)
    .select('id')
    .maybeSingle()
  return usado ? 'ok' : 'vencido'
}
