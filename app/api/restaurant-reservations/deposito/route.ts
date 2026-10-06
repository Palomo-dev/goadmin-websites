import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { organizacionDeLaReserva, sedeDeLaReserva } from '@/lib/restaurant/reservas-contexto'
import { cotizarDeposito } from '@/lib/restaurant/deposito-servidor'
import { SIN_DEPOSITO } from '@/lib/restaurant/deposito-modelo'

export const dynamic = 'force-dynamic'

/**
 * GET /api/restaurant-reservations/deposito?branchId=&partySize=
 *
 * ¿La sede pide depósito para reservar? Monto, cálculo, reembolso y política,
 * para mostrarlos ANTES de reservar. Lo decide la base
 * (`fn_reserva_mesa_deposito_cotizar`): solo hay depósito si la sede lo pide y
 * la organización tiene una pasarela integrada activa. Sin la migración D7,
 * `{ requiere: false }`.
 *
 * La organización sale del host (`organizacionDeLaReserva`). Una consulta por
 * formulario y cambio de sede; cacheable unos segundos en el navegador.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams
  const contexto = await organizacionDeLaReserva(q.get('organizationId'), 'Reservation Deposit')
  if ('respuesta' in contexto) return contexto.respuesta

  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json(SIN_DEPOSITO)

  const sede = await sedeDeLaReserva(supabase, contexto.orgId, q.get('branchId'))
  if ('respuesta' in sede) return sede.respuesta

  const personas = Math.max(1, Math.min(200, parseInt(q.get('partySize') || '1', 10) || 1))
  const cotizacion = await cotizarDeposito(supabase, contexto.orgId, sede.branchId, personas)
  return NextResponse.json(cotizacion, { headers: { 'Cache-Control': 'private, max-age=30' } })
}
