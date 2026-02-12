import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { sendClassReservationEmail } from '@/lib/email/send-class-reservation-email'

export const dynamic = 'force-dynamic'

/**
 * POST /api/classes/[id]/reserve
 *
 * Reserva un cupo en una clase de gimnasio.
 * Validaciones:
 *  1. Clase existe y está activa
 *  2. Hay cupos disponibles (capacity - reservas booked/checked_in)
 *  3. Customer tiene membresía activa en la organización
 *  4. Customer no tiene reserva duplicada para esta clase
 *
 * Body: { customerId, organizationId }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createAdminClient() || createPublicClient()
  const { id: classIdStr } = await params
  const classId = parseInt(classIdStr, 10)

  if (isNaN(classId)) {
    return NextResponse.json({ error: 'ID de clase inválido' }, { status: 400 })
  }

  try {
    const { customerId, organizationId } = await request.json()

    if (!customerId || !organizationId) {
      return NextResponse.json(
        { error: 'Faltan parámetros: customerId, organizationId' },
        { status: 400 }
      )
    }

    // 1. Validar que la clase existe y está activa
    const { data: gymClass, error: classError } = await (supabase as any)
      .from('gym_classes')
      .select('id, organization_id, title, capacity, start_at, end_at, status')
      .eq('id', classId)
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .single()

    if (classError || !gymClass) {
      return NextResponse.json(
        { error: 'Clase no encontrada o inactiva' },
        { status: 404 }
      )
    }

    // 2. Verificar que la clase no haya pasado
    if (new Date(gymClass.start_at) < new Date()) {
      return NextResponse.json(
        { error: 'Esta clase ya ha comenzado o finalizado' },
        { status: 400 }
      )
    }

    // 3. Verificar cupos disponibles
    const { count: reservedCount } = await (supabase as any)
      .from('class_reservations')
      .select('id', { count: 'exact', head: true })
      .eq('gym_class_id', classId)
      .eq('organization_id', organizationId)
      .in('status', ['booked', 'checked_in'])

    const spotsLeft = gymClass.capacity - (reservedCount || 0)
    if (spotsLeft <= 0) {
      return NextResponse.json(
        { error: 'No hay cupos disponibles para esta clase' },
        { status: 409 }
      )
    }

    // 4. Verificar membresía activa
    const { data: membership, error: membershipError } = await (supabase as any)
      .from('memberships')
      .select('id, status, end_date, membership_plan_id')
      .eq('customer_id', customerId)
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString())
      .limit(1)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Necesitas una membresía activa para reservar clases' },
        { status: 403 }
      )
    }

    // 5. Verificar que no tenga reserva duplicada
    const { data: existingReservation } = await (supabase as any)
      .from('class_reservations')
      .select('id, status')
      .eq('gym_class_id', classId)
      .eq('customer_id', customerId)
      .eq('organization_id', organizationId)
      .in('status', ['booked', 'checked_in'])
      .limit(1)

    if (existingReservation && existingReservation.length > 0) {
      return NextResponse.json(
        { error: 'Ya tienes una reserva para esta clase', reservationId: existingReservation[0].id },
        { status: 409 }
      )
    }

    // 6. Crear reserva
    const { data: reservation, error: reserveError } = await (supabase as any)
      .from('class_reservations')
      .insert({
        organization_id: organizationId,
        gym_class_id: classId,
        customer_id: customerId,
        membership_id: membership.id,
        status: 'booked',
        reservation_source: 'website',
        booked_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (reserveError || !reservation) {
      console.error('[Class Reserve] Error creando reserva:', reserveError)
      return NextResponse.json(
        { error: 'Error al crear la reserva' },
        { status: 500 }
      )
    }

    console.log(
      `[Class Reserve] Reserva creada: class=${classId} customer=${customerId} reservation=${reservation.id}`
    )

    // 7. Enviar email de confirmación (async, no bloquea la respuesta)
    const { data: customerData } = await (supabase as any)
      .from('customers')
      .select('email, first_name, last_name')
      .eq('id', customerId)
      .single()

    const { data: orgData } = await (supabase as any)
      .from('organizations')
      .select('name, domain')
      .eq('id', organizationId)
      .single()

    // Obtener instructor
    const { data: classDetail } = await (supabase as any)
      .from('gym_classes')
      .select('profiles:instructor_id (first_name, last_name), room, class_type')
      .eq('id', classId)
      .single()

    if (customerData?.email && orgData) {
      const instructor = classDetail?.profiles
      const instructorName = instructor ? `${instructor.first_name || ''} ${instructor.last_name || ''}`.trim() : undefined
      const domain = orgData.domain || 'localhost:3000'

      sendClassReservationEmail({
        customerEmail: customerData.email,
        customerName: `${customerData.first_name || ''} ${customerData.last_name || ''}`.trim() || 'Cliente',
        classTitle: gymClass.title,
        classType: classDetail?.class_type,
        instructorName,
        startAt: gymClass.start_at,
        endAt: gymClass.end_at,
        room: classDetail?.room,
        organizationName: orgData.name,
        portalUrl: `https://${domain}/mi-cuenta/clases`,
      }).catch(err => console.error('[Class Reserve] Error enviando email:', err))
    }

    return NextResponse.json({
      success: true,
      reservationId: reservation.id,
      classTitle: gymClass.title,
      startAt: gymClass.start_at,
      spotsRemaining: spotsLeft - 1,
    })
  } catch (error: any) {
    console.error('[Class Reserve] Error:', error)
    return NextResponse.json(
      { error: 'Error interno al procesar la reserva' },
      { status: 500 }
    )
  }
}
