/**
 * Carta QR en la mesa — servidor (service role).
 *
 * Llama a las RPC públicas de la mesa de las migraciones 20261007090000…0300 del ERP. Reglas
 * (CLAUDE.md › Multi-tenancy y decisiones del coordinador, 2026-10-06):
 * - La organización sale SIEMPRE del host (`organizacionDePeticion`): una `organizationId` del
 *   cliente distinta → 403 y se registra. La mesa es el uuid del QR y la base comprueba que es
 *   de esa organización (MESA_INVALIDA si no).
 * - Las RPC solo actúan con una sesión ACTIVA de esa mesa (un QR fotografiado sirve para
 *   siempre): sin sesión responden SIN_SESION y el sitio solo muestra la carta.
 * - Límite de frecuencia por IP y por mesa (lib/rateLimit.ts, en memoria por instancia): frena
 *   ráfagas; la base deduplica además el llamado al mesero (60 s) y los abonos en curso.
 * - `createAdminClient()` estricto: sin service role, 503 (no degrada a anon en silencio).
 * - Sin la migración aplicada las RPC responden PGRST202: 503 NO_DISPONIBLE, sin detalles.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { organizacionDePeticion } from '@/lib/api/organizacion-peticion'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const SIN_CACHE = { 'Cache-Control': 'no-store' } as const

export type AccionMesa =
  | 'pedido'
  | 'cuenta'
  | 'solicitar'
  | 'cancelar-solicitud'
  | 'pedir-cuenta'
  | 'abono'
  | 'valorar'

/**
 * Límites por acción: [por IP, por mesa] como [máximo, ventana en ms].
 * - Lecturas (pedido y cuenta en vivo, cada ~8 s por celular): holgadas.
 * - Llamar al mesero: 1 por mesa cada 60 s (decisión del coordinador).
 * - Pedir la cuenta: 3 por mesa por minuto (la base deja una sola solicitud viva).
 * - Abonos y valoraciones: pocos por mesa.
 */
export const LIMITES_MESA: Record<AccionMesa, { ip: [number, number]; mesa: [number, number] }> = {
  pedido: { ip: [240, 10 * 60_000], mesa: [900, 10 * 60_000] },
  cuenta: { ip: [240, 10 * 60_000], mesa: [900, 10 * 60_000] },
  solicitar: { ip: [10, 10 * 60_000], mesa: [1, 60_000] },
  'cancelar-solicitud': { ip: [20, 10 * 60_000], mesa: [10, 60_000] },
  'pedir-cuenta': { ip: [10, 10 * 60_000], mesa: [3, 60_000] },
  abono: { ip: [20, 10 * 60_000], mesa: [20, 10 * 60_000] },
  valorar: { ip: [10, 60 * 60_000], mesa: [12, 60 * 60_000] },
}

export type ContextoMesa =
  | { ok: true; organizationId: number; mesaId: string; db: any }
  | { ok: false; respuesta: NextResponse }

function json(cuerpo: Record<string, unknown>, status: number) {
  return NextResponse.json(cuerpo, { status, headers: SIN_CACHE })
}

/** Uuid de mesa del QR saneado, o `null`. */
export function mesaDeRuta(valor: unknown): string | null {
  return typeof valor === 'string' && UUID_RE.test(valor) ? valor.toLowerCase() : null
}

/** Organización del host + mesa del QR + límite de frecuencia + cliente estricto. */
export async function contextoMesa(
  request: Request,
  mesaRuta: unknown,
  accion: AccionMesa,
  organizacionCliente: string | null,
): Promise<ContextoMesa> {
  const mesaId = mesaDeRuta(mesaRuta)
  if (!mesaId) return { ok: false, respuesta: json({ ok: false, motivo: 'MESA_INVALIDA' }, 404) }

  const org = await organizacionDePeticion(organizacionCliente, 'Carta QR')
  if (!org.ok) return { ok: false, respuesta: org.respuesta }

  const limite = LIMITES_MESA[accion]
  const ip = getClientIP(request)
  const porIp = checkRateLimit(`mesa:${accion}:ip:${ip}`, limite.ip[0], limite.ip[1])
  const porMesa = porIp.allowed ? checkRateLimit(`mesa:${accion}:mesa:${mesaId}`, limite.mesa[0], limite.mesa[1]) : porIp
  if (!porIp.allowed || !porMesa.allowed) {
    console.warn('[Carta QR] Límite alcanzado', { accion, organizationId: org.organizationId, porIp: !porIp.allowed })
    const espera = Math.max(1, Math.ceil(((porIp.allowed ? porMesa : porIp).resetAt - Date.now()) / 1000))
    return {
      ok: false,
      respuesta: NextResponse.json(
        { ok: false, motivo: 'DEMASIADOS', espera },
        { status: 429, headers: { ...SIN_CACHE, 'Retry-After': String(espera) } },
      ),
    }
  }

  const db = createAdminClient()
  if (!db) {
    console.error('[Carta QR] Falta SUPABASE_SERVICE_ROLE_KEY')
    return { ok: false, respuesta: json({ ok: false, motivo: 'NO_DISPONIBLE' }, 503) }
  }
  return { ok: true, organizationId: org.organizationId, mesaId, db: db as any }
}

/** Respuesta de una RPC de mesa → HTTP. Errores de la base sin detalles al cliente. */
export function respuestaRpc(accion: AccionMesa, organizationId: number, data: unknown, error: { code?: string; message?: string } | null) {
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') return json({ ok: false, motivo: 'NO_DISPONIBLE' }, 503)
    if (error.code === 'P0002' || String(error.message || '').includes('MESA_INVALIDA')) {
      return json({ ok: false, motivo: 'MESA_INVALIDA' }, 404)
    }
    if (error.code === '22023') return json({ ok: false, motivo: 'DATOS_INVALIDOS' }, 400)
    console.error('[Carta QR] RPC', { accion, organizationId, code: error.code })
    return json({ ok: false, motivo: 'ERROR' }, 500)
  }
  return json({ ok: true, ...(data && typeof data === 'object' ? (data as Record<string, unknown>) : {}) }, 200)
}

/** Texto del cliente acotado (la base vuelve a sanear). */
export function textoCliente(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim().slice(0, max)
  return t === '' ? null : t
}

/** Número del cliente o `null`. */
export function numeroCliente(v: unknown): number | null {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

/** Correo plausible o `null`. */
export function correoCliente(v: unknown): string | null {
  const t = textoCliente(v, 200)
  return t && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t.toLowerCase() : null
}

/** Abono en línea por cobrar, leído por id Y por la organización del host (para /api/checkout/init). */
export interface AbonoPorCobrar {
  id: string
  organization_id: number
  order_number: string
  total: number
  currency: string
  status: string
  payment_status: 'paid' | 'pending'
  customer_email: string
  customer_name: string
  customer_phone: string
  gateway: string
  vencido: boolean
}

export const FUENTE_COBRO_MESA = 'table_bill'

/** Referencia de un abono en línea de la Carta QR (`CQR-` + 32 hex). */
export function esReferenciaAbonoMesa(referencia: unknown): referencia is string {
  return typeof referencia === 'string' && /^CQR-[0-9A-F]{32}$/.test(referencia)
}

export async function abonoMesaPorCobrar(
  supabase: any,
  abonoId: string,
  orgId: number | null,
  ahora: Date = new Date(),
): Promise<AbonoPorCobrar | null> {
  if (!UUID_RE.test(abonoId)) return null
  let consulta = supabase
    .from('table_online_payments')
    .select('id, organization_id, reference, amount, tip_amount, currency, gateway, status, expires_at, customer_email, customer_name, diner_label')
    .eq('id', abonoId)
  if (orgId !== null) consulta = consulta.eq('organization_id', orgId)
  const { data, error } = await consulta.maybeSingle()
  if (error) {
    if (error.code !== '42P01' && error.code !== 'PGRST205') console.error('[Checkout Init] abono de mesa', { code: error.code })
    return null
  }
  if (!data) return null
  const vence = data.expires_at ? Date.parse(data.expires_at) : NaN
  return {
    id: data.id,
    organization_id: Number(data.organization_id),
    order_number: data.reference,
    total: Math.round((Number(data.amount) + Number(data.tip_amount || 0)) * 100) / 100,
    currency: String(data.currency || 'COP').toUpperCase(),
    status: data.status,
    payment_status: data.status === 'pending' ? 'pending' : 'paid',
    customer_email: data.customer_email || '',
    customer_name: data.customer_name || data.diner_label || '',
    customer_phone: '',
    gateway: data.gateway,
    vencido: data.status !== 'pending' || (Number.isFinite(vence) && vence <= ahora.getTime()),
  }
}
