import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { sendAppointmentConfirmation } from '@/lib/email/send-appointment-confirmation'

export const dynamic = 'force-dynamic'

/**
 * POST /api/services/appointments
 *
 * Solicita una cita online. Crea calendar_events con status 'pending'.
 * El admin confirma/rechaza desde el ERP.
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient() || createPublicClient()

  try {
    const body = await request.json()
    const {
      organizationId,
      serviceId,
      serviceName,
      customerEmail,
      customerName,
      customerPhone,
      customerCompany,
      preferredDate,
      preferredTime,
      durationMinutes,
      notes,
    } = body

    if (!organizationId || !customerEmail || !preferredDate || !preferredTime) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: organizationId, customerEmail, preferredDate, preferredTime' },
        { status: 400 }
      )
    }

    // 1. Buscar o crear customer
    let customerId: string | null = null
    const emailNorm = customerEmail.toLowerCase().trim()

    const { data: existingCustomer } = await (supabase as any)
      .from('customers')
      .select('id')
      .eq('email', emailNorm)
      .eq('organization_id', organizationId)
      .limit(1)
      .maybeSingle()

    if (existingCustomer) {
      customerId = existingCustomer.id
    } else {
      const nameParts = (customerName || '').trim().split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      const { data: newCustomer } = await (supabase as any)
        .from('customers')
        .insert({
          organization_id: organizationId,
          email: emailNorm,
          first_name: firstName,
          last_name: lastName,
          phone: customerPhone || null,
          company_name: customerCompany || null,
        })
        .select('id')
        .single()

      customerId = newCustomer?.id || null
    }

    if (!customerId) {
      return NextResponse.json({ error: 'Error al crear/obtener el cliente' }, { status: 500 })
    }

    // 2. Calcular start_at y end_at
    const duration = durationMinutes || 60
    const startAt = new Date(`${preferredDate}T${preferredTime}:00`)
    const endAt = new Date(startAt.getTime() + duration * 60 * 1000)

    if (isNaN(startAt.getTime())) {
      return NextResponse.json({ error: 'Fecha/hora inválida' }, { status: 400 })
    }

    // 3. Verificar que no haya conflicto en la misma hora para esta org
    const { data: conflicts } = await (supabase as any)
      .from('calendar_events')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('event_type', 'appointment')
      .in('status', ['pending', 'confirmed'])
      .lt('start_at', endAt.toISOString())
      .gt('end_at', startAt.toISOString())
      .eq('customer_id', customerId)
      .limit(1)

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json(
        { error: 'Ya tienes una cita en ese horario. Elige otra fecha/hora.' },
        { status: 409 }
      )
    }

    // 4. Crear calendar_event con status 'pending'
    const title = serviceName
      ? `Cita: ${serviceName} - ${customerName || emailNorm}`
      : `Cita: ${customerName || emailNorm}`

    const { data: event, error: eventError } = await (supabase as any)
      .from('calendar_events')
      .insert({
        organization_id: organizationId,
        customer_id: customerId,
        title,
        description: notes || null,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        event_type: 'appointment',
        status: 'pending',
        metadata: {
          service_id: serviceId || null,
          service_name: serviceName || null,
          source: 'website',
          customer_phone: customerPhone || null,
          customer_company: customerCompany || null,
        },
      })
      .select('id, title, start_at, end_at, status')
      .single()

    if (eventError || !event) {
      console.error('Error creando cita:', eventError)
      return NextResponse.json({ error: 'Error al crear la cita' }, { status: 500 })
    }

    // 5. Enviar email de confirmación
    try {
      await sendAppointmentConfirmation({
        customerEmail: emailNorm,
        customerName: customerName || emailNorm,
        appointmentId: event.id,
        serviceName: serviceName || 'Consulta general',
        date: startAt,
        durationMinutes: duration,
        status: 'pending',
        notes: notes || undefined,
      })
    } catch (emailErr) {
      console.error('Error enviando email de cita:', emailErr)
    }

    return NextResponse.json({
      appointmentId: event.id,
      reference: `APT-${event.id.substring(0, 8).toUpperCase()}`,
      status: 'pending',
      startAt: event.start_at,
      endAt: event.end_at,
      message: 'Solicitud de cita recibida. Te confirmaremos pronto.',
    })
  } catch (err: any) {
    console.error('Error en /api/services/appointments:', err)
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
