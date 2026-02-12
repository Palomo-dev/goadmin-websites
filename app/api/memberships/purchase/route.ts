import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/memberships/purchase
 *
 * Crea una membresía con status 'pending_payment' y retorna la info
 * necesaria para iniciar el pago vía /api/checkout/init.
 *
 * Body: { planId, organizationId, customerId, customerEmail, customerName }
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient() || createPublicClient()

  try {
    const body = await request.json()
    const { planId, organizationId, customerId, customerEmail, customerName } = body

    if (!planId || !organizationId || !customerId) {
      return NextResponse.json(
        { error: 'Faltan parámetros: planId, organizationId, customerId' },
        { status: 400 }
      )
    }

    // 1. Validar que el plan existe y está activo
    const { data: plan, error: planError } = await (supabase as any)
      .from('membership_plans')
      .select('*')
      .eq('id', planId)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan de membresía no encontrado o inactivo' },
        { status: 404 }
      )
    }

    // 2. Verificar que el customer no tenga una membresía activa del mismo plan
    const { data: existingMembership } = await (supabase as any)
      .from('memberships')
      .select('id, status, end_date')
      .eq('customer_id', customerId)
      .eq('organization_id', organizationId)
      .eq('membership_plan_id', planId)
      .in('status', ['active', 'pending_payment'])
      .limit(1)

    if (existingMembership && existingMembership.length > 0) {
      const existing = existingMembership[0]
      if (existing.status === 'active') {
        return NextResponse.json(
          { error: 'Ya tienes una membresía activa de este plan', membershipId: existing.id },
          { status: 409 }
        )
      }
      if (existing.status === 'pending_payment') {
        // Retornar la membresía pendiente para que pueda reintentar el pago
        return NextResponse.json({
          success: true,
          membershipId: existing.id,
          reference: `MEM-${existing.id}`,
          plan: { name: plan.name, price: plan.price },
          alreadyPending: true,
        })
      }
    }

    // 3. Calcular fechas
    const startDate = new Date()
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + plan.duration_days)

    // 4. Generar access_code único
    const accessCode = generateAccessCode()

    // 5. Calcular impuestos
    const { data: defaultTax } = await (supabase as any)
      .from('organization_taxes')
      .select('name, rate')
      .eq('organization_id', organizationId)
      .eq('is_default', true)
      .eq('is_active', true)
      .single()

    const taxRate = defaultTax ? Number(defaultTax.rate) : 0
    const subtotal = Number(plan.price)
    const taxAmount = Math.round(subtotal * taxRate) / 100
    const total = subtotal + taxAmount

    // 6. Crear membresía con status pending_payment
    const { data: membership, error: membershipError } = await (supabase as any)
      .from('memberships')
      .insert({
        organization_id: organizationId,
        customer_id: customerId,
        membership_plan_id: planId,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: 'pending_payment',
        access_code: accessCode,
        notes: `Compra online - ${plan.name}`,
      })
      .select()
      .single()

    if (membershipError || !membership) {
      console.error('[Membership Purchase] Error creando membresía:', membershipError)
      return NextResponse.json(
        { error: 'Error al crear la membresía' },
        { status: 500 }
      )
    }

    // 7. Registrar evento de creación
    await (supabase as any).from('membership_events').insert({
      membership_id: membership.id,
      organization_id: organizationId,
      event_type: 'created',
      description: `Membresía creada desde website - Plan: ${plan.name}`,
      new_value: {
        plan_name: plan.name,
        price: plan.price,
        total,
        tax: taxAmount,
        duration_days: plan.duration_days,
        frequency: plan.frequency,
      },
      metadata: {
        source: 'website',
        customer_email: customerEmail,
        customer_name: customerName,
      },
    })

    // 8. Referencia para la pasarela: MEM-{membershipId}
    const reference = `MEM-${membership.id}`

    return NextResponse.json({
      success: true,
      membershipId: membership.id,
      reference,
      plan: {
        name: plan.name,
        price: plan.price,
        duration_days: plan.duration_days,
        frequency: plan.frequency,
      },
      total,
      taxAmount,
      taxRate,
      taxName: defaultTax?.name || 'IVA',
      currency: 'COP',
      customerEmail,
    })
  } catch (error: any) {
    console.error('[Membership Purchase] Error:', error)
    return NextResponse.json(
      { error: 'Error interno al procesar la compra' },
      { status: 500 }
    )
  }
}

/**
 * Genera un código de acceso único de 8 caracteres alfanuméricos
 */
function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
