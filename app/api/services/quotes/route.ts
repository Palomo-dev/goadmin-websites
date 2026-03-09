import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/services/quotes
 *
 * Solicita una cotización. Crea una opportunity en el pipeline default con status 'open'.
 * El admin gestiona la oportunidad desde el CRM del ERP.
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
      projectDescription,
      estimatedBudget,
      currency,
    } = body

    if (!organizationId || !customerEmail) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: organizationId, customerEmail' },
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
      // Actualizar company_name si viene y no lo tiene
      if (customerCompany) {
        await (supabase as any)
          .from('customers')
          .update({ company_name: customerCompany })
          .eq('id', customerId)
          .is('company_name', null)
      }
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

    // 2. Buscar pipeline default de la org
    let pipelineId: string | null = null
    let firstStageId: string | null = null

    const { data: defaultPipeline } = await (supabase as any)
      .from('pipelines')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('is_default', true)
      .limit(1)
      .maybeSingle()

    if (defaultPipeline) {
      pipelineId = defaultPipeline.id
    } else {
      // Si no hay default, tomar el primero
      const { data: anyPipeline } = await (supabase as any)
        .from('pipelines')
        .select('id')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      pipelineId = anyPipeline?.id || null
    }

    if (!pipelineId) {
      return NextResponse.json(
        { error: 'No hay pipeline configurado. El administrador debe configurar el CRM.' },
        { status: 400 }
      )
    }

    // 3. Obtener primera etapa del pipeline
    const { data: firstStage } = await (supabase as any)
      .from('stages')
      .select('id')
      .eq('pipeline_id', pipelineId)
      .order('position', { ascending: true })
      .limit(1)
      .maybeSingle()

    firstStageId = firstStage?.id || null

    if (!firstStageId) {
      return NextResponse.json(
        { error: 'Pipeline sin etapas configuradas. El administrador debe configurar las etapas.' },
        { status: 400 }
      )
    }

    // 4. Crear opportunity
    const oppName = serviceName
      ? `Cotización Web: ${serviceName} - ${customerCompany || customerName || emailNorm}`
      : `Cotización Web: ${customerCompany || customerName || emailNorm}`

    const { data: opportunity, error: oppError } = await (supabase as any)
      .from('opportunities')
      .insert({
        organization_id: organizationId,
        pipeline_id: pipelineId,
        stage_id: firstStageId,
        customer_id: customerId,
        name: oppName.substring(0, 255),
        amount: estimatedBudget || 0,
        currency: currency || 'COP',
        status: 'open',
      })
      .select('id, name, amount, status')
      .single()

    if (oppError || !opportunity) {
      console.error('Error creando oportunidad:', oppError)
      return NextResponse.json({ error: 'Error al crear la cotización' }, { status: 500 })
    }

    // 5. Si hay descripción del proyecto, guardarla en notes del customer
    if (projectDescription) {
      const { data: cust } = await (supabase as any)
        .from('customers')
        .select('notes')
        .eq('id', customerId)
        .single()

      const existingNotes = cust?.notes || ''
      const newNote = `[Cotización ${opportunity.id.substring(0, 8)}] ${projectDescription}`
      await (supabase as any)
        .from('customers')
        .update({ notes: existingNotes ? `${existingNotes}\n\n${newNote}` : newNote })
        .eq('id', customerId)
    }

    return NextResponse.json({
      opportunityId: opportunity.id,
      reference: `QTE-${opportunity.id.substring(0, 8).toUpperCase()}`,
      status: 'open',
      message: 'Solicitud de cotización recibida. Nos pondremos en contacto pronto.',
    })
  } catch (err: any) {
    console.error('Error en /api/services/quotes:', err)
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
