import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { sendRestaurantTableConfirmationEmail } from '@/lib/email/send-restaurant-table-confirmation'
import { sendRestaurantTeamNotice } from '@/lib/email/send-restaurant-team-notice'
import { fechaLarga } from '@/lib/restaurant/horario'
import { reglaDeError, respuestaDeRegla, rutaGestionReserva, tokenValido } from '@/lib/restaurant/reservas-errores'
import { contextoCorreoReserva, crearReservaWeb, urlEnElSitio } from '@/lib/restaurant/reservas-servidor'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'
import {
  ahoraEnLaZona,
  disponibilidadDeLaSede,
  fechaValida,
  horaNormalizada,
  organizacionDeLaReserva,
  sedeDeLaReserva,
} from '@/lib/restaurant/reservas-contexto'

export const dynamic = 'force-dynamic'

/**
 * POST /api/restaurant-reservations
 *
 * Crea una reserva de mesa en `restaurant_reservations` usando la RPC
 * transaccional `create_restaurant_reservation` con FOR UPDATE.
 *
 * Protecciones:
 * - Rate limiting: máximo 5 reservas/hora/IP
 * - Honeypot: campo oculto `website` que, si se rellena, rechaza silenciosamente
 *
 * La organización sale del host (`organizacionDeLaReserva`); `organizationId`
 * del body solo se compara (403 si es otra). La sede debe ser de la organización.
 *
 * Body: {
 *   organizationId?, branchId?, date, time, partySize,
 *   name, phone, email?, notes?, zone?,
 *   website?,  // honeypot — debe estar vacío
 *   successMessage?, organizationName?
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // ── Rate limiting: 5 reservas/hora/IP ──
    const clientIP = getClientIP(request)
    const rateLimit = checkRateLimit(clientIP, 5, 60 * 60 * 1000)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Has alcanzado el límite de reservas. Inténtalo más tarde.',
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
        }
      )
    }

    const body = await request.json()
    const {
      organizationId,
      branchId,
      date,
      time,
      partySize,
      name,
      phone,
      email,
      notes,
      zone,
      website, // honeypot
    } = body

    // ── Honeypot: si el campo oculto "website" tiene valor, es un bot ──
    // Rechazar silenciosamente como si fuera exitoso (no informar al bot)
    if (website && String(website).trim() !== '') {
      return NextResponse.json({
        success: true,
        data: {
          id: '00000000-0000-0000-0000-000000000000',
          code: 'SPAM0000',
          status: 'confirmed',
          date,
          time,
          partySize: parseInt(partySize, 10) || 2,
        },
      })
    }

    // ── Validación de campos requeridos ──
    const hora = horaNormalizada(time)
    if (!fechaValida(date) || !hora || !partySize || !name) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: date, time, partySize, name' },
        { status: 400 }
      )
    }

    if (!phone && !email) {
      return NextResponse.json(
        { error: 'Se requiere al menos un teléfono o email de contacto' },
        { status: 400 }
      )
    }

    const contexto = await organizacionDeLaReserva(organizationId, 'Restaurant Reservations')
    if ('respuesta' in contexto) return contexto.respuesta
    const orgId = contexto.orgId

    const supabase = createAdminClient() || createPublicClient()

    const sede = await sedeDeLaReserva(supabase, orgId, branchId)
    if ('respuesta' in sede) return sede.respuesta

    // ── Validar que la fecha/hora no sea pasada (en la zona de la sede) ──
    const ahora = await ahoraEnLaZona(supabase, orgId, sede.branchId)
    if (date < ahora.fecha || (date === ahora.fecha && hora < ahora.hora)) {
      return NextResponse.json(
        { error: 'No se pueden crear reservas en el pasado' },
        { status: 400 }
      )
    }

    // ── Llamar RPC transaccional create_restaurant_reservation ──
    // Con la migración D1 la RPC valida además horario, anticipación, franja,
    // zona, aforo y contacto de la sede (errores con prefijo). Solo bloquea con
    // RESERVAS_ENFORCE_REGLAS=true; sin la variable observa y registra
    // (ver lib/restaurant/reservas-servidor.ts).
    const { data: rpcResult, error: rpcError } = await crearReservaWeb(supabase, {
      p_organization_id: orgId,
      p_reservation_date: date,
      p_reservation_time: hora,
      p_party_size: parseInt(partySize, 10),
      p_customer_name: name,
      p_branch_id: sede.branchId,
      p_customer_phone: phone || null,
      p_customer_email: email || null,
      p_zone: zone || null,
      p_notes: notes || null,
      p_source: 'website',
    })

    if (rpcError || !rpcResult || !rpcResult.success) {
      console.error('[Restaurant Reservations] RPC error:', rpcError)

      // Detectar errores específicos de la RPC
      const errMsg = rpcError?.message || rpcResult?.error || 'Error al crear la reserva'
      const regla = reglaDeError(errMsg)

      // Reglas de la sede (migración D1): 400 legible, salvo AFORO, que sigue
      // al 409 con horas sugeridas de abajo.
      if (regla && regla.codigo !== 'AFORO') {
        const { status, mensaje } = respuestaDeRegla(regla)
        return NextResponse.json({ error: mensaje, code: regla.codigo }, { status })
      }

      // Errores de disponibilidad → 409 con sugerencias
      if (regla?.codigo === 'AFORO' || errMsg.includes('No hay mesas disponibles')) {
        // Consultar disponibilidad para sugerir horarios alternativos
        // De la misma sede en la que se intentó reservar.
        const { data: availResult } = await disponibilidadDeLaSede(supabase, {
          orgId,
          branchId: sede.branchId,
          date,
          partySize: parseInt(partySize, 10),
          zone: zone || null,
        })

        const suggestedTimes = availResult?.suggestedTimes || []

        return NextResponse.json(
          {
            error: 'No hay mesas disponibles para la fecha y hora seleccionadas',
            suggestedTimes,
            ...(regla ? { code: regla.codigo } : {}),
          },
          { status: 409 }
        )
      }

      // Errores de configuración → 403
      if (errMsg.includes('deshabilitadas')) {
        return NextResponse.json({ error: errMsg }, { status: 403 })
      }

      // Errores de validación de tamaño → 400
      // La RPC escribe «minimo/maximo» sin tilde: sin esta comparación,
      // un grupo fuera de rango terminaba en 500.
      if (/m[ií]nimo|m[áa]ximo/i.test(errMsg)) {
        return NextResponse.json({ error: errMsg }, { status: 400 })
      }

      return NextResponse.json(
        { error: 'Error al crear la reserva', details: errMsg },
        { status: 500 }
      )
    }

    // ── Enlace de gestión por token (migración D2; sin ella no hay enlace) ──
    const token = tokenValido(rpcResult.manage_token) ? rpcResult.manage_token : null
    const manageUrl = token ? rutaGestionReserva(token) : null

    // ── Correos (best-effort): al cliente y al equipo (notify_emails) ──
    // El texto del cliente sigue `rpcResult.status`: `pending` no se anuncia como confirmada.
    const personas = parseInt(partySize, 10)
    let datosCorreo: Awaited<ReturnType<typeof contextoCorreoReserva>> | null = null
    try {
      datosCorreo = await contextoCorreoReserva(supabase, orgId, sede.branchId)
    } catch (contextoError) {
      console.error('[Restaurant Reservations] Error leyendo datos del correo:', contextoError)
    }

    if (email) {
      try {
        await sendRestaurantTableConfirmationEmail({
          reservationId: rpcResult.reservation_id,
          customerEmail: email,
          customerName: name,
          date,
          time,
          partySize: personas,
          organizationName: datosCorreo?.organizacion.nombre || 'El restaurante',
          status: rpcResult.status,
          manageUrl: manageUrl ? urlEnElSitio(request, manageUrl) : null,
          dateLabel: fechaLarga(date),
          branchName: datosCorreo?.sede?.nombre ?? null,
          branchAddress: datosCorreo?.sede?.direccion ?? null,
          replyTo: datosCorreo?.sede?.email || datosCorreo?.organizacion.email || null,
        })
      } catch (emailError) {
        console.error('[Restaurant Reservations] Error sending email:', emailError)
      }
    }

    if (datosCorreo && datosCorreo.correosEquipo.length > 0) {
      try {
        await sendRestaurantTeamNotice({
          destinatarios: datosCorreo.correosEquipo,
          organizacion: datosCorreo.organizacion.nombre,
          sede: datosCorreo.sede?.nombre ?? null,
          codigo: rpcResult.code,
          cliente: name,
          telefono: phone || null,
          email: email || null,
          personas,
          fecha: fechaLarga(date),
          hora,
          estado: rpcResult.status,
          notas: notes || null,
        })
      } catch (avisoError) {
        console.error('[Restaurant Reservations] Error avisando al equipo:', avisoError)
      }
    }

    // ── Respuesta ──
    return NextResponse.json({
      success: true,
      data: {
        id: rpcResult.reservation_id,
        code: rpcResult.code,
        status: rpcResult.status,
        date,
        time,
        partySize: parseInt(partySize, 10),
        ...(manageUrl ? { manageUrl } : {}),
      },
    })
  } catch (error) {
    console.error('[Restaurant Reservations] Error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
