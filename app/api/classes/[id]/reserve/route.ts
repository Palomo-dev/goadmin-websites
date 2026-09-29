import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { sendClassReservationEmail } from '@/lib/email/send-class-reservation-email'
import { getOrgContext } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'

export const dynamic = 'force-dynamic'

/**
 * POST /api/classes/[id]/reserve
 *
 * Reserva un cupo en una clase de gimnasio.
 * Validaciones:
 *  1. Clase existe y está activa
 *  2. Hay cupos disponibles (capacity - reservas booked/checked_in)
 *  3. Customer tiene membresía vigente en la organización (activa, o en período de gracia)
 *  4. Customer no tiene reserva duplicada para esta clase
 *
 * La organización sale del contexto del sitio (host) y el cliente de la sesión, nunca del
 * body. Si el body trae `organizationId`/`customerId` distintos: 403.
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
    const ctx = await getOrgContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Sitio no encontrado' }, { status: 404 })
    }
    const organizationId = ctx.organization.id
    const authCustomer = await getAuthCustomer(organizationId)
    if (!authCustomer) {
      return NextResponse.json({ error: 'Inicia sesión para reservar' }, { status: 401 })
    }
    const customerId = authCustomer.id

    // Compatibilidad con clientes que aún mandan los ids en el body: se ignoran, pero si
    // no coinciden con el contexto se rechaza (y se registra).
    const body = await request.json().catch(() => ({}))
    if (
      (body?.organizationId != null && Number(body.organizationId) !== organizationId) ||
      (body?.customerId != null && String(body.customerId) !== customerId)
    ) {
      console.warn('[Class Reserve] organización o cliente del body distinto al de la sesión', {
        organizationId, bodyOrganizationId: body?.organizationId,
      })
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
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

    // 4. Verificar membresía vigente: activa y sin vencer, o vencida dentro del período de
    //    gracia (`past_due` + `grace_until`; en el ERP la gracia deja entrar con aviso).
    //    Congelada, pendiente de pago, vencida o cancelada no reservan.
    const ahora = Date.now()
    const { data: candidatas } = await (supabase as any)
      .from('memberships')
      .select('id, status, end_date, grace_until, membership_plan_id')
      .eq('customer_id', customerId)
      .eq('organization_id', organizationId)
      .in('status', ['active', 'past_due'])
      .order('end_date', { ascending: false })
      .limit(5)

    const membership = ((candidatas || []) as any[]).find((m) =>
      m.status === 'active'
        ? new Date(m.end_date).getTime() >= ahora
        : !!m.grace_until && new Date(m.grace_until).getTime() >= ahora
    )

    if (!membership) {
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
        // CHECK de la base: app · web · staff · kiosk. 'website' hacía fallar toda reserva.
        reservation_source: 'web',
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

    // `organizations.domain` no existe: el select fallaba y el correo nunca salía.
    const { data: orgData } = await (supabase as any)
      .from('organizations')
      .select('name, subdomain, custom_domain')
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
      const domain = orgData.custom_domain || (orgData.subdomain ? `${orgData.subdomain}.goadmin.io` : 'localhost:3000')

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
