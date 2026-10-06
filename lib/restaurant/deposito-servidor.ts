/**
 * Depósito de la reserva de mesa — servidor (service role).
 *
 * La organización llega SIEMPRE resuelta desde el host (`organizacionDeLaReserva`)
 * o desde la propia reserva (webhook), nunca del body. Todo depende de la
 * migración D7 del ERP (`20261006170000_reservas_deposito_web`); mientras no
 * esté aplicada las RPC responden PGRST202 y el sitio reserva como siempre.
 */

import { crearReservaWeb, reglasEnObservacion, type ArgsReservaWeb } from './reservas-servidor'
import { normalizarTelefono } from '@/lib/utils/telefono'
import { parseCotizacion, parseDepositoCreado, SIN_DEPOSITO, type CotizacionDeposito, type DepositoCreado } from './deposito-modelo'

/** Lo que el sitio muestra antes de reservar. Sin migración o con error: sin depósito. */
export async function cotizarDeposito(
  supabase: any,
  orgId: number,
  branchId: number | null,
  personas: number,
): Promise<CotizacionDeposito> {
  const { data, error } = await supabase.rpc('fn_reserva_mesa_deposito_cotizar', {
    p_organization_id: orgId,
    p_branch_id: branchId,
    p_party_size: personas,
  })
  if (error) {
    if (error.code !== 'PGRST202') console.error('[Reservas] cotizar depósito', { orgId, branchId, code: error.code })
    return SIN_DEPOSITO
  }
  return parseCotizacion(data)
}

/**
 * Crea la reserva web. Con D7 aplicada usa `fn_reserva_mesa_crear_web`, que es
 * la misma `create_restaurant_reservation` y, si la sede pide depósito y hay
 * pasarela, la deja «pendiente de pago» en la misma transacción. Sin D7
 * (PGRST202) llama a `crearReservaWeb`, exactamente lo de antes.
 */
export async function crearReservaWebConDeposito(
  supabase: any,
  args: ArgsReservaWeb,
): Promise<{ data: any; error: any; deposito: DepositoCreado | null }> {
  const r = await supabase.rpc('fn_reserva_mesa_crear_web', {
    p_organization_id: args.p_organization_id,
    p_reservation_date: args.p_reservation_date,
    p_reservation_time: args.p_reservation_time,
    p_party_size: args.p_party_size,
    p_customer_name: args.p_customer_name,
    p_branch_id: args.p_branch_id,
    p_customer_phone: args.p_customer_phone,
    p_customer_email: args.p_customer_email,
    p_zone: args.p_zone,
    p_notes: args.p_notes,
    p_validar_reglas: !reglasEnObservacion(),
  })
  if (r.error?.code === 'PGRST202') {
    const anterior = await crearReservaWeb(supabase, args)
    return { ...anterior, deposito: null }
  } else {
    if (r.data?.regla_incumplida) {
      console.warn('[Restaurant Reservations] regla incumplida (observación)', {
        orgId: args.p_organization_id,
        branchId: args.p_branch_id,
        regla: String(r.data.regla_incumplida).split(':')[0],
      })
    }
    return { data: r.data, error: r.error, deposito: parseDepositoCreado(r.data?.deposito) }
  }
}

/** Reserva con depósito por cobrar, leída por id y organización (para `/api/checkout/init`). */
export interface ReservaPorCobrar {
  id: string
  organization_id: number
  order_number: string
  total: number
  currency: string
  status: string
  payment_status: 'paid' | 'pending'
  customer_email: string
  customer_name: string
  /** «+57 3001234567»: Wompi separa indicativo y número por el espacio. */
  customer_phone: string
  /** Pasarela con la que la base dejó el cobro (`deposit_gateway`). */
  gateway: string | null
  vencida: boolean
}

export async function reservaConDepositoPorCobrar(
  supabase: any,
  reservationId: string,
  orgId: number | null,
  ahora: Date = new Date(),
): Promise<ReservaPorCobrar | null> {
  if (!/^[0-9a-f-]{36}$/i.test(reservationId)) return null
  let consulta = supabase
    .from('restaurant_reservations')
    .select('id, organization_id, status, customer_name, customer_email, customer_phone, deposit_status, deposit_amount, deposit_currency, deposit_reference, deposit_due_at, deposit_gateway')
    .eq('id', reservationId)
  if (orgId !== null) consulta = consulta.eq('organization_id', orgId)
  const { data, error } = await consulta.maybeSingle()
  if (error) {
    if (error.code !== '42703') console.error('[Checkout Init] reserva de mesa', { code: error.code })
    return null
  }
  if (!data || !data.deposit_reference || !(Number(data.deposit_amount) > 0)) return null
  const vence = data.deposit_due_at ? Date.parse(data.deposit_due_at) : NaN
  return {
    id: data.id,
    organization_id: Number(data.organization_id),
    order_number: data.deposit_reference,
    total: Number(data.deposit_amount),
    currency: (data.deposit_currency || 'COP').toUpperCase(),
    status: data.status,
    payment_status: data.deposit_status === 'pending' ? 'pending' : 'paid',
    customer_email: data.customer_email || '',
    customer_name: data.customer_name || '',
    customer_phone: normalizarTelefono(data.customer_phone || ''),
    gateway: data.deposit_gateway || null,
    vencida: data.deposit_status !== 'pending' || data.status !== 'pending' || (Number.isFinite(vence) && vence <= ahora.getTime()),
  }
}
