import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/memberships/freeze
 *
 * Solicita congelamiento de membresía.
 * Crea un registro en membership_freezes con status='pending'.
 * El admin aprueba/rechaza desde el ERP.
 *
 * Body: { membershipId, customerId, organizationId, reason, requestedDays }
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient() || createPublicClient()

  try {
    const { membershipId, customerId, organizationId, reason, requestedDays } = await request.json()

    if (!membershipId || !customerId || !organizationId) {
      return NextResponse.json(
        { error: 'Faltan parámetros: membershipId, customerId, organizationId' },
        { status: 400 }
      )
    }

    if (!requestedDays || requestedDays < 1 || requestedDays > 90) {
      return NextResponse.json(
        { error: 'Los días de congelamiento deben ser entre 1 y 90' },
        { status: 400 }
      )
    }

    // 1. Verificar que la membresía pertenece al customer y está activa
    const { data: membership, error: memError } = await (supabase as any)
      .from('memberships')
      .select('id, status, end_date, customer_id')
      .eq('id', membershipId)
      .eq('customer_id', customerId)
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .single()

    if (memError || !membership) {
      return NextResponse.json(
        { error: 'Membresía no encontrada o no está activa' },
        { status: 404 }
      )
    }

    // 2. Verificar que no haya un congelamiento pendiente o activo
    const { data: existingFreeze } = await (supabase as any)
      .from('membership_freezes')
      .select('id, status')
      .eq('membership_id', membershipId)
      .in('status', ['pending', 'active'])
      .limit(1)

    if (existingFreeze && existingFreeze.length > 0) {
      const st = existingFreeze[0].status
      return NextResponse.json(
        { error: st === 'pending' ? 'Ya tienes una solicitud de congelamiento pendiente' : 'Tu membresía ya tiene un congelamiento activo' },
        { status: 409 }
      )
    }

    // 3. Calcular fechas: desde hoy + N días
    const startDate = new Date().toISOString().split('T')[0]
    const endDate = new Date(Date.now() + requestedDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // 4. Crear solicitud de congelamiento (status='pending')
    const { data: freeze, error: freezeError } = await (supabase as any)
      .from('membership_freezes')
      .insert({
        membership_id: membershipId,
        start_date: startDate,
        end_date: endDate,
        reason: reason || 'Solicitud desde portal web',
        status: 'pending',
        days_frozen: requestedDays,
        notes: `Solicitud web: ${requestedDays} días desde ${startDate}`,
      })
      .select()
      .single()

    if (freezeError || !freeze) {
      console.error('[Membership Freeze] Error:', freezeError)
      return NextResponse.json(
        { error: 'Error al crear la solicitud de congelamiento' },
        { status: 500 }
      )
    }

    console.log(
      `[Membership Freeze] Solicitud creada: freeze=${freeze.id} membership=${membershipId} days=${requestedDays}`
    )

    return NextResponse.json({
      success: true,
      freezeId: freeze.id,
      startDate,
      endDate,
      requestedDays,
      status: 'pending',
    })
  } catch (error: any) {
    console.error('[Membership Freeze] Error:', error)
    return NextResponse.json(
      { error: 'Error interno al procesar la solicitud' },
      { status: 500 }
    )
  }
}
