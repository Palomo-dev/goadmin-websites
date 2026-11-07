import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { fechaValida, horaNormalizada, organizacionDeLaReserva, sedeDeLaReserva } from '@/lib/restaurant/reservas-contexto'
import { reglaDeError, respuestaDeRegla } from '@/lib/restaurant/reservas-errores'
import { reglasEnObservacion } from '@/lib/restaurant/reservas-servidor'
import { leerDisponibilidadMesas } from '@/lib/restaurant/planoMesas'

export const dynamic = 'force-dynamic'

/** RPC y parámetros (scripts/verify-cafe.mjs los compara con la migración del ERP). */
const RPC_DISPONIBILIDAD_MESAS = 'get_restaurant_table_availability'

/**
 * GET /api/restaurant-reservations/mesas — disponibilidad POR MESA de una sede para la reserva
 * con plano (`reservation` · `floor_plan`, plantilla «Café de especialidad»). Solo lectura: la
 * reserva se crea con el POST de siempre (`/api/restaurant-reservations`).
 *
 * Query: branchId, date (YYYY-MM-DD), time (HH:MM), partySize, organizationId? (solo se compara).
 * Respuesta: `{ mesas: { [tableId]: 'libre' | 'ocupada' | 'no_alcanza' | 'no_web' } }`.
 *
 * La organización sale del HOST (`organizacionDeLaReserva`): 403 si el query trae otra. La sede
 * tiene que ser de la organización. La RPC (`get_restaurant_table_availability`, ERP M4) aplica
 * las mismas reglas que la rama web de `create_restaurant_reservation`; con
 * `RESERVAS_ENFORCE_REGLAS` sin activar observa (una regla incumplida no bloquea), igual que al crear.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const contexto = await organizacionDeLaReserva(searchParams.get('organizationId'), 'Restaurant Tables Availability')
    if ('respuesta' in contexto) return contexto.respuesta

    const date = searchParams.get('date')
    const hora = horaNormalizada(searchParams.get('time'))
    const personas = Number(searchParams.get('partySize'))
    if (!fechaValida(date) || !hora || !Number.isInteger(personas) || personas < 1 || personas > 200) {
      return NextResponse.json({ error: 'Faltan parámetros: date, time y partySize' }, { status: 400 })
    }

    const supabase = createAdminClient()
    if (!supabase) {
      console.error('[Restaurant Tables Availability] Falta SUPABASE_SERVICE_ROLE_KEY')
      return NextResponse.json({ error: 'Servicio no disponible' }, { status: 503 })
    }

    const sede = await sedeDeLaReserva(supabase, contexto.orgId, searchParams.get('branchId'))
    if ('respuesta' in sede) return sede.respuesta
    if (sede.branchId === null) {
      return NextResponse.json({ error: 'Falta la sede' }, { status: 400 })
    }

    const { data, error } = await (supabase as any).rpc(RPC_DISPONIBILIDAD_MESAS, {
      p_organization_id: contexto.orgId,
      p_branch_id: sede.branchId,
      p_date: date,
      p_time: hora,
      p_party_size: personas,
      p_validar_reglas: !reglasEnObservacion(),
    })
    if (error) {
      const regla = reglaDeError(error.message || '')
      if (regla) {
        const { status, mensaje } = respuestaDeRegla(regla)
        return NextResponse.json({ error: mensaje, code: regla.codigo, mesas: {} }, { status })
      }
      console.error('[Restaurant Tables Availability] RPC error:', error.message)
      return NextResponse.json({ error: 'No se pudo consultar la disponibilidad', mesas: {} }, { status: 500 })
    }
    return NextResponse.json({ mesas: leerDisponibilidadMesas(data) })
  } catch (e) {
    console.error('[Restaurant Tables Availability] Error:', e)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
