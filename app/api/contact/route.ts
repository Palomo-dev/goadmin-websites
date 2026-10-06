import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { getOrganizationByHost } from '@/lib/supabase/queries'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * POST /api/contact
 *
 * Recibe los formularios de contacto públicos del sitio y los guarda DONDE EL
 * CRM SÍ MIRA:
 *   1. `customers` con lifecycle_stage = 'lead' (nombre, correo, teléfono y el
 *      mensaje en `notes`). Si el correo ya existe en esa organización se
 *      reutiliza la ficha en vez de duplicarla.
 *   2. `opportunities` con record_type = 'lead' y source = 'website', enlazada a
 *      ese customer. Un lead y un negocio son la misma fila distinguida por
 *      record_type: naciendo como 'lead' no infla el pronóstico del ERP.
 *
 * Todo pasa por la función `web_capture_lead` (SECURITY DEFINER, EXECUTE solo
 * para service_role), de modo que no hace falta abrir escritura a `anon` sobre
 * `customers` ni `opportunities`.
 *
 * Seguridad:
 *  - `organization_id` se resuelve desde el Host de la petición (headers que
 *    pone el middleware), NUNCA se acepta a ciegas del body. Si el body trae
 *    uno distinto, se rechaza.
 *  - Rate limit: 5 envíos/hora/IP.
 *  - Honeypot: campo oculto `website`; si viene relleno se descarta.
 *  - Validación y acotado de longitudes/formato, aquí y otra vez en la BD.
 *
 * Body: {
 *   name, email, message, phone?, subject?, company?, sourceForm?,
 *   organizationId?,  // solo para verificación cruzada
 *   website?,         // honeypot — debe venir vacío
 * }
 */

const MAX = {
  name: 120,
  email: 160,
  phone: 40,
  subject: 200,
  company: 160,
  message: 4000,
}

// Mensajes de error de la RPC → respuesta HTTP legible.
const RPC_ERRORS: Record<string, { status: number; message: string }> = {
  invalid_email: { status: 400, message: 'El correo no es válido.' },
  invalid_name: { status: 400, message: 'El nombre no es válido.' },
  invalid_phone: { status: 400, message: 'El teléfono no es válido.' },
  invalid_company: { status: 400, message: 'El nombre de la empresa es demasiado largo.' },
  invalid_subject: { status: 400, message: 'El asunto es demasiado largo.' },
  message_too_long: { status: 400, message: 'El mensaje es demasiado largo.' },
  organization_not_found: { status: 404, message: 'Organización no encontrada.' },
  organization_inactive: { status: 403, message: 'Este sitio no está recibiendo mensajes.' },
  organization_without_site: { status: 403, message: 'Este sitio no está publicado.' },
  invalid_branch: { status: 403, message: 'La sede no pertenece a este sitio.' },
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Detalles estructurados del formulario (p. ej. evento privado): solo las
 * claves y tipos de la lista blanca, acotados. La RPC (migración D6) vuelve a
 * sanearlos. `null` si no queda nada.
 */
function detallesSaneados(valor: unknown): Record<string, string | number> | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null
  const v = valor as Record<string, unknown>
  const out: Record<string, string | number> = {}
  const tipo = str(v.event_type).slice(0, 60)
  if (tipo) out.event_type = tipo
  const fecha = str(v.event_date)
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) out.event_date = fecha
  const invitados = Number(v.guests)
  if (Number.isInteger(invitados) && invitados >= 1 && invitados <= 5000) out.guests = invitados
  const lugar = str(v.venue).slice(0, 120)
  if (lugar) out.venue = lugar
  const presupuesto = Number(v.budget_per_person)
  if (Number.isFinite(presupuesto) && presupuesto >= 0 && presupuesto < 1e9) out.budget_per_person = presupuesto
  return Object.keys(out).length > 0 ? out : null
}

export async function POST(request: NextRequest) {
  try {
    // ── 1. Rate limit: 5 envíos/hora/IP ──
    const clientIP = getClientIP(request)
    const rate = checkRateLimit(clientIP, 5, 60 * 60 * 1000)
    if (!rate.allowed) {
      const retryAfter = Math.ceil((rate.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { error: 'Has enviado demasiados mensajes. Inténtalo más tarde.', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
    }

    // ── 2. Honeypot: los bots rellenan el campo oculto ──
    if (str((body as any).website)) {
      console.warn(`[contact] honeypot activado desde ${clientIP}; envío descartado`)
      // No damos pistas al bot, pero tampoco decimos que se guardó.
      return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
    }

    const name = str((body as any).name)
    const email = str((body as any).email).toLowerCase()
    const message = str((body as any).message)
    const phone = str((body as any).phone)
    const subject = str((body as any).subject)
    const company = str((body as any).company)
    const sourceForm = str((body as any).sourceForm)

    // ── 3. Validación de entrada ──
    if (!name || !email) {
      return NextResponse.json(
        { error: 'El nombre y el correo son obligatorios.' },
        { status: 400 }
      )
    }
    if (!message && !subject) {
      return NextResponse.json({ error: 'Escribe un mensaje.' }, { status: 400 })
    }
    if (!/^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(email) || email.length > MAX.email) {
      return NextResponse.json({ error: 'El correo no es válido.' }, { status: 400 })
    }
    if (name.length > MAX.name) {
      return NextResponse.json({ error: 'El nombre es demasiado largo.' }, { status: 400 })
    }
    if (message.length > MAX.message) {
      return NextResponse.json({ error: 'El mensaje es demasiado largo.' }, { status: 400 })
    }
    if (phone.length > MAX.phone) {
      return NextResponse.json({ error: 'El teléfono no es válido.' }, { status: 400 })
    }
    if (subject.length > MAX.subject || company.length > MAX.company) {
      return NextResponse.json({ error: 'Alguno de los campos es demasiado largo.' }, { status: 400 })
    }

    // ── 4. La organización sale del Host, no del body ──
    const headersList = await headers()
    const identifier = headersList.get('x-custom-domain') || headersList.get('x-subdomain')
    if (!identifier) {
      console.error('[contact] petición sin host de tenant (x-custom-domain / x-subdomain)')
      return NextResponse.json({ error: 'Organización no encontrada.' }, { status: 404 })
    }

    const organization = await getOrganizationByHost(identifier)
    if (!organization) {
      console.error(`[contact] host sin organización: ${identifier}`)
      return NextResponse.json({ error: 'Organización no encontrada.' }, { status: 404 })
    }

    // Si el cliente manda organizationId, tiene que coincidir con la del sitio.
    const claimedOrgId = (body as any).organizationId
    if (
      claimedOrgId !== undefined &&
      claimedOrgId !== null &&
      Number(claimedOrgId) !== Number(organization.id)
    ) {
      console.error(
        `[contact] organizationId del body (${claimedOrgId}) no coincide con el host ${identifier} (org ${organization.id})`
      )
      return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 403 })
    }

    // ── 5. Escritura vía RPC con privilegios acotados ──
    const supabase = createAdminClient()
    if (!supabase) {
      // Sin service role key no podemos ejecutar la RPC. Fallamos fuerte:
      // jamás decir "mensaje recibido" si no se guardó.
      console.error(
        '[contact] SUPABASE_SERVICE_ROLE_KEY no configurada: no se puede guardar el contacto'
      )
      return NextResponse.json(
        { error: 'No pudimos guardar tu mensaje ahora mismo. Inténtalo más tarde.' },
        { status: 503 }
      )
    }

    const argsLead = {
      p_organization_id: organization.id,
      p_name: name,
      p_email: email,
      p_message: message,
      p_phone: phone || null,
      p_company: company || null,
      p_subject: subject || null,
      p_source_form: sourceForm || null,
    }

    // Sede y detalles estructurados (eventos privados, migración D6). La sede
    // se valida contra la organización del HOST: nunca se confía en el body.
    const branchPedida = (body as any).branchId
    let branchId: number | null = null
    if (branchPedida !== undefined && branchPedida !== null && branchPedida !== '') {
      const n = Number(branchPedida)
      const { data: sede } = Number.isInteger(n) && n > 0
        ? await (supabase as any).from('branches').select('id').eq('id', n).eq('organization_id', organization.id).maybeSingle()
        : { data: null }
      if (!sede) {
        console.warn(`[contact] sede ${String(branchPedida).slice(0, 20)} ajena a la org ${organization.id}`)
        return NextResponse.json({ error: 'La sede no pertenece a este sitio.' }, { status: 403 })
      }
      branchId = n
    }
    const detalles = detallesSaneados((body as any).details)

    let respuesta: { data: any; error: any }
    if (branchId !== null || detalles !== null) {
      respuesta = await (supabase as any).rpc('web_capture_lead', {
        ...argsLead,
        p_branch_id: branchId,
        p_details: detalles,
      })
      if (respuesta.error?.code === 'PGRST202') {
        // Sobrecarga de D6 aún no aplicada: la captura de siempre (el texto
        // del mensaje ya lleva los datos del evento).
        respuesta = await (supabase as any).rpc('web_capture_lead', argsLead)
      }
    } else {
      respuesta = await (supabase as any).rpc('web_capture_lead', argsLead)
    }
    const { data, error } = respuesta

    if (error) {
      const mapped = RPC_ERRORS[error.message?.trim() ?? '']
      console.error(
        `[contact] web_capture_lead falló para org ${organization.id} (${identifier}): ` +
          `${error.message} | code=${error.code ?? 'n/a'} | details=${error.details ?? 'n/a'}`
      )
      return NextResponse.json(
        { error: mapped?.message ?? 'No pudimos guardar tu mensaje. Inténtalo de nuevo.' },
        { status: mapped?.status ?? 500 }
      )
    }

    const result = (data ?? {}) as {
      customer_id?: string
      opportunity_id?: string | null
      crm_warning?: string | null
    }

    if (!result.customer_id) {
      console.error(
        `[contact] web_capture_lead no devolvió customer_id para org ${organization.id}`
      )
      return NextResponse.json(
        { error: 'No pudimos guardar tu mensaje. Inténtalo de nuevo.' },
        { status: 500 }
      )
    }

    if (result.crm_warning) {
      // El contacto SÍ quedó guardado en customers, pero el embudo no está
      // configurado, así que no hay lead en el pipeline. Queda registrado.
      console.error(
        `[contact] org ${organization.id}: contacto guardado (customer ${result.customer_id}) ` +
          `pero SIN lead en el pipeline (${result.crm_warning}). Configura el CRM.`
      )
    }

    return NextResponse.json({
      success: true,
      customerId: result.customer_id,
      leadId: result.opportunity_id ?? null,
      crmWarning: result.crm_warning ?? null,
      message: 'Mensaje recibido. Nos pondremos en contacto contigo.',
    })
  } catch (error: any) {
    console.error('[contact] error inesperado:', error?.message || error)
    return NextResponse.json(
      { error: 'No pudimos guardar tu mensaje. Inténtalo de nuevo.' },
      { status: 500 }
    )
  }
}
