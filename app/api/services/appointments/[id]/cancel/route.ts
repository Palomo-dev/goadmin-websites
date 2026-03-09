import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/services/appointments/[id]/cancel
 *
 * Cancela una cita del cliente. Política: solo si status es pending o confirmed,
 * y la cita es al menos 24h en el futuro.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createAdminClient() || createPublicClient()
  const { id } = await params

  try {
    const body = await request.json()
    const { customerEmail, organizationId } = body

    if (!customerEmail || !organizationId) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: customerEmail, organizationId' },
        { status: 400 }
      )
    }

    // 1. Buscar customer por email
    const { data: customer } = await (supabase as any)
      .from('customers')
      .select('id')
      .eq('email', customerEmail.toLowerCase().trim())
      .eq('organization_id', organizationId)
      .limit(1)
      .maybeSingle()

    if (!customer) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    // 2. Buscar la cita
    const { data: appointment } = await (supabase as any)
      .from('calendar_events')
      .select('id, status, start_at, title')
      .eq('id', id)
      .eq('customer_id', customer.id)
      .eq('organization_id', organizationId)
      .eq('event_type', 'appointment')
      .single()

    if (!appointment) {
      return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 })
    }

    // 3. Validar status cancelable
    if (!['pending', 'confirmed'].includes(appointment.status)) {
      return NextResponse.json(
        { error: `No se puede cancelar una cita con estado "${appointment.status}"` },
        { status: 400 }
      )
    }

    // 4. Validar política de 24h
    const startAt = new Date(appointment.start_at)
    const now = new Date()
    const hoursUntil = (startAt.getTime() - now.getTime()) / (1000 * 60 * 60)

    if (hoursUntil < 24) {
      return NextResponse.json(
        { error: 'No se puede cancelar con menos de 24 horas de anticipación. Contacta directamente.' },
        { status: 400 }
      )
    }

    // 5. Cancelar
    const { error: updateError } = await (supabase as any)
      .from('calendar_events')
      .update({ status: 'cancelled' })
      .eq('id', id)

    if (updateError) {
      console.error('Error cancelando cita:', updateError)
      return NextResponse.json({ error: 'Error al cancelar la cita' }, { status: 500 })
    }

    return NextResponse.json({
      appointmentId: id,
      status: 'cancelled',
      message: 'Cita cancelada exitosamente.',
    })
  } catch (err: any) {
    console.error('Error en /api/services/appointments/[id]/cancel:', err)
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
