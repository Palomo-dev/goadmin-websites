import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { sendClassCancellationEmail } from '@/lib/email/send-class-reservation-email'

export const dynamic = 'force-dynamic'

/**
 * POST /api/classes/[id]/cancel
 *
 * Cancela una reserva de clase de gimnasio.
 * Validaciones:
 *  1. Reserva existe y pertenece al customer
 *  2. Reserva está en status 'booked' (no checked_in ni ya cancelada)
 *  3. La clase no ha comenzado (policy: se puede cancelar hasta 2h antes)
 *
 * Body: { customerId, organizationId, reason? }
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
    const { customerId, organizationId, reason } = await request.json()

    if (!customerId || !organizationId) {
      return NextResponse.json(
        { error: 'Faltan parámetros: customerId, organizationId' },
        { status: 400 }
      )
    }

    // 1. Buscar la reserva activa del customer para esta clase
    const { data: reservation, error: resError } = await (supabase as any)
      .from('class_reservations')
      .select('id, status, gym_class_id, gym_classes(start_at, title)')
      .eq('gym_class_id', classId)
      .eq('customer_id', customerId)
      .eq('organization_id', organizationId)
      .eq('status', 'booked')
      .limit(1)
      .single()

    if (resError || !reservation) {
      return NextResponse.json(
        { error: 'Reserva no encontrada o ya fue cancelada' },
        { status: 404 }
      )
    }

    // 2. Verificar policy de cancelación: hasta 2 horas antes de la clase
    const classStartAt = new Date(reservation.gym_classes?.start_at)
    const now = new Date()
    const hoursUntilClass = (classStartAt.getTime() - now.getTime()) / (1000 * 60 * 60)

    if (hoursUntilClass < 2) {
      return NextResponse.json(
        { error: 'No es posible cancelar con menos de 2 horas de anticipación' },
        { status: 400 }
      )
    }

    // 3. Cancelar la reserva
    const { error: updateError } = await (supabase as any)
      .from('class_reservations')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || 'Cancelado por el usuario desde website',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reservation.id)

    if (updateError) {
      console.error('[Class Cancel] Error cancelando reserva:', updateError)
      return NextResponse.json(
        { error: 'Error al cancelar la reserva' },
        { status: 500 }
      )
    }

    console.log(
      `[Class Cancel] Reserva cancelada: reservation=${reservation.id} class=${classId} customer=${customerId}`
    )

    // 4. Enviar email de cancelación (async, no bloquea)
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

    if (customerData?.email && orgData) {
      const domain = orgData.domain || 'localhost:3000'

      sendClassCancellationEmail({
        customerEmail: customerData.email,
        customerName: `${customerData.first_name || ''} ${customerData.last_name || ''}`.trim() || 'Cliente',
        classTitle: reservation.gym_classes?.title || 'Clase',
        startAt: reservation.gym_classes?.start_at,
        endAt: reservation.gym_classes?.start_at,
        organizationName: orgData.name,
        portalUrl: `https://${domain}/clases`,
      }).catch(err => console.error('[Class Cancel] Error enviando email:', err))
    }

    return NextResponse.json({
      success: true,
      reservationId: reservation.id,
      classTitle: reservation.gym_classes?.title,
    })
  } catch (error: any) {
    console.error('[Class Cancel] Error:', error)
    return NextResponse.json(
      { error: 'Error interno al cancelar la reserva' },
      { status: 500 }
    )
  }
}
