import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { getOrganizationByHost } from '@/lib/supabase/queries'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'
import { sendAppointmentConfirmation } from '@/lib/email/send-appointment-confirmation'

export const dynamic = 'force-dynamic'

/**
 * POST /api/services/appointments
 *
 * Solicita una cita online. Crea calendar_events con status 'pending'.
 * El admin confirma/rechaza desde el ERP.
 *
 * Esta ruta arrastraba tres defectos, corregidos aquí:
 *
 *  1. **Nunca funcionó.** `app/agendar/AppointmentForm.tsx` envía `email`,
 *     `firstName`, `startAt` y `endAt`, pero la ruta sólo leía `customerEmail`,
 *     `preferredDate` y `preferredTime`. Como esos tres eran obligatorios,
 *     TODA solicitud de cita moría en un 400. Ahora se aceptan los dos
 *     esquemas, igual que hace `/api/services/quotes`.
 *  2. **La organización salía del body.** Con el cliente de servicio (que se
 *     salta RLS), bastaba con mandar cualquier `organizationId` para crear
 *     clientes y citas en la organización de otro. Ahora sale del host, y el
 *     valor del body sólo se admite si coincide.
 *  3. **Sin límite de tasa ni señuelo**, a diferencia de los otros formularios
 *     públicos que escriben en el CRM.
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient() || createPublicClient()

  try {
    // ── Límite de tasa: 5 solicitudes/hora/IP ──
    const clientIP = getClientIP(request)
    const rate = checkRateLimit(clientIP, 5, 60 * 60 * 1000)
    if (!rate.allowed) {
      const retryAfter = Math.ceil((rate.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { error: 'Has enviado demasiadas solicitudes. Inténtalo más tarde.', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const body = await request.json()

    // ── Señuelo: los bots rellenan el campo oculto ──
    if (typeof body?.website === 'string' && body.website.trim() !== '') {
      console.warn(`[appointments] señuelo activado desde ${clientIP}; envío descartado`)
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }

    const { serviceId, serviceName, durationMinutes, notes } = body

    // Se aceptan los nombres largos y los cortos del formulario público.
    const customerEmail = body.customerEmail || body.email
    const customerName =
      body.customerName ||
      [body.firstName, body.lastName].filter(Boolean).join(' ').trim() ||
      undefined
    const customerPhone = body.customerPhone || body.phone
    const customerCompany = body.customerCompany || body.companyName

    // ── La organización sale del host, no se acepta a ciegas del body ──
    const headersList = await headers()
    const identifier = headersList.get('x-custom-domain') || headersList.get('x-subdomain')
    if (!identifier) {
      console.error('[appointments] petición sin host de tenant (x-custom-domain / x-subdomain)')
      return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })
    }

    const organizationFromHost = await getOrganizationByHost(identifier)
    if (!organizationFromHost) {
      console.error(`[appointments] host sin organización: ${identifier}`)
      return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })
    }

    if (
      body.organizationId !== undefined &&
      body.organizationId !== null &&
      Number(body.organizationId) !== Number(organizationFromHost.id)
    ) {
      console.error(
        `[appointments] organizationId del body (${body.organizationId}) no coincide con el host ${identifier} (org ${organizationFromHost.id})`
      )
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 403 })
    }

    const organizationId = organizationFromHost.id

    if (!customerEmail || typeof customerEmail !== 'string') {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: email' },
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

    // ── El servicio solicitado ────────────────────────────────────────────────
    // El formulario manda el id de `organization_services` y NO manda el nombre,
    // así que el título de la cita salía siempre genérico. Se resuelve el nombre
    // validando el id contra la organización del host.
    let servicioResuelto: { id: string; nombre: string } | null = null
    if (typeof serviceId === 'string' && serviceId.trim() !== '') {
      const { data: os } = await (supabase as any)
        .from('organization_services')
        .select('id, custom_name, is_active, services(name)')
        .eq('id', serviceId.trim())
        .eq('organization_id', organizationId)
        .maybeSingle()
      if (os && os.is_active !== false) {
        servicioResuelto = { id: os.id, nombre: os.custom_name || os.services?.name || 'Servicio' }
      } else {
        console.warn(
          `[appointments] servicio ${serviceId} no pertenece a la organización ${organizationId} o está inactivo; la cita sigue sin él`
        )
      }
    }
    const etiquetaServicio = servicioResuelto?.nombre || (typeof serviceName === 'string' ? serviceName : '')

    // 2. Calcular start_at y end_at.
    // El formulario público manda `startAt`/`endAt` ya en ISO; la API larga
    // manda la pareja `preferredDate` + `preferredTime`. Se admiten las dos.
    const duration = durationMinutes || 60
    const startAt = body.startAt
      ? new Date(body.startAt)
      : new Date(`${body.preferredDate}T${body.preferredTime}:00`)

    if (isNaN(startAt.getTime())) {
      return NextResponse.json(
        { error: 'Falta la fecha y hora de la cita, o no es válida' },
        { status: 400 }
      )
    }

    const endAt = body.endAt && !isNaN(new Date(body.endAt).getTime())
      ? new Date(body.endAt)
      : new Date(startAt.getTime() + duration * 60 * 1000)

    if (endAt <= startAt) {
      return NextResponse.json({ error: 'La cita termina antes de empezar' }, { status: 400 })
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
    const title = etiquetaServicio
      ? `Cita: ${etiquetaServicio} - ${customerName || emailNorm}`
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
          organization_service_id: servicioResuelto?.id ?? null,
          service_name: servicioResuelto?.nombre ?? null,
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
        serviceName: etiquetaServicio || 'Consulta general',
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
