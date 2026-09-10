import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { getOrganizationByHost } from '@/lib/supabase/queries'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * POST /api/services/quotes
 *
 * Solicita una cotización. Crea una opportunity con record_type 'lead' en el
 * pipeline default, con status 'open'. El admin gestiona el lead desde el CRM
 * del ERP y lo convierte a 'deal' cuando lo califica.
 *
 * Por qué 'lead' y no 'deal': una cotización web sin calificar entrando como
 * negocio infla el pronóstico del ERP (pantallas de Pronóstico y Salud). El
 * importe estimado se conserva en la MISMA fila, así que al convertir no se
 * pierde nada.
 *
 * La organización se resuelve desde el host del sitio; el organizationId del
 * body solo se admite si coincide.
 *
 * Defensas (las mismas que `/api/contact`, que es el otro formulario público
 * que escribe en el CRM; esta ruta no las tenía y era el hueco por el que se
 * podía llenar el pipeline de basura):
 *  - Límite de tasa: 5 envíos por hora y por IP.
 *  - Señuelo: campo oculto `website`; si viene relleno se descarta.
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient() || createPublicClient()

  try {
    // ── Límite de tasa: 5 envíos/hora/IP ──
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
      console.warn(`[quotes] señuelo activado desde ${clientIP}; envío descartado`)
      // No se le da ninguna pista al bot, pero tampoco se le dice que se guardó.
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }
    // El formulario público (app/cotizar/QuoteForm.tsx) usa nombres cortos;
    // se aceptan ambos esquemas para no perder solicitudes.
    const { serviceId, serviceName, currency } = body

    const customerEmail = body.customerEmail || body.email
    const customerName =
      body.customerName ||
      [body.firstName, body.lastName].filter(Boolean).join(' ').trim() ||
      undefined
    const customerPhone = body.customerPhone || body.phone
    const customerCompany = body.customerCompany || body.companyName
    const projectDescription = body.projectDescription || body.description
    const estimatedBudget = body.estimatedBudget ?? body.budget

    // ── La organización sale del host, no se acepta a ciegas del body ──
    const headersList = await headers()
    const identifier = headersList.get('x-custom-domain') || headersList.get('x-subdomain')
    if (!identifier) {
      console.error('[quotes] petición sin host de tenant (x-custom-domain / x-subdomain)')
      return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })
    }

    const organizationFromHost = await getOrganizationByHost(identifier)
    if (!organizationFromHost) {
      console.error(`[quotes] host sin organización: ${identifier}`)
      return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })
    }

    if (
      body.organizationId !== undefined &&
      body.organizationId !== null &&
      Number(body.organizationId) !== Number(organizationFromHost.id)
    ) {
      console.error(
        `[quotes] organizationId del body (${body.organizationId}) no coincide con el host ${identifier} (org ${organizationFromHost.id})`
      )
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 403 })
    }

    const organizationId = organizationFromHost.id

    // ── El servicio solicitado ────────────────────────────────────────────────
    // `serviceId` llegaba del formulario y se descartaba: el comercial recibía
    // el lead sin saber QUÉ le habían pedido. Y `serviceName` no lo envía nadie
    // (`app/cotizar/QuoteForm.tsx` manda sólo el id), así que el nombre de la
    // oportunidad salía siempre genérico.
    //
    // El id es de `organization_services` (así lo construye `cotizar/page.tsx`
    // desde `getOrgServiceCatalog`), que sí lleva `organization_id`: se valida
    // contra la organización del host, nunca contra lo que diga el body.
    let servicioResuelto: { id: string; nombre: string; precio: number | null } | null = null
    let servicioNoResuelto: string | null = null

    if (typeof serviceId === 'string' && serviceId.trim() !== '') {
      const { data: os } = await (supabase as any)
        .from('organization_services')
        .select('id, custom_name, price, is_active, services(name)')
        .eq('id', serviceId.trim())
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (os && os.is_active !== false) {
        servicioResuelto = {
          id: os.id,
          nombre: os.custom_name || os.services?.name || 'Servicio',
          precio: os.price ?? null,
        }
      } else {
        // Un id que no es de esta organización, o que ya no está activo. NO se
        // rechaza la cotización: perder un lead es peor que perder el dato. Pero
        // tampoco se ignora en silencio, para que nadie lo dé por atribuido.
        servicioNoResuelto = serviceId.trim()
        console.warn(
          `[quotes] servicio ${serviceId} no pertenece a la organización ${organizationId} o está inactivo; la cotización sigue sin él`
        )
      }
    }

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
          // Todo lo que entra por la web nace como lead.
          lifecycle_stage: 'lead',
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
    const quien = customerCompany || customerName || emailNorm
    // `serviceName` se sigue aceptando por si otro cliente de la API lo manda.
    const etiquetaServicio = servicioResuelto?.nombre || (typeof serviceName === 'string' ? serviceName : '')
    const oppName = etiquetaServicio
      ? `Cotización Web: ${etiquetaServicio} - ${quien}`
      : `Cotización Web: ${quien}`

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
        // Una cotización web sin calificar es un LEAD, no un negocio: si entra
        // como 'deal' (el valor por defecto de la columna) infla el pronóstico.
        record_type: 'lead',
        source: 'website',
        // Traza de lo que pidió el visitante. `metadata` es jsonb en
        // `opportunities`; se guarda el servicio ya validado, y si el id no se
        // pudo atribuir se deja constancia en vez de perderlo.
        metadata: {
          web_quote: {
            organization_service_id: servicioResuelto?.id ?? null,
            service_name: servicioResuelto?.nombre ?? null,
            service_list_price: servicioResuelto?.precio ?? null,
            unresolved_service_id: servicioNoResuelto,
          },
        },
      })
      .select('id, name, amount, status, record_type')
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
