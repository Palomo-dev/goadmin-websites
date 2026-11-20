import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { getOrganizationByHost } from '@/lib/supabase/queries'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'
import type { Database } from '@/types/database'

export const dynamic = 'force-dynamic'

/**
 * POST /api/newsletter
 *
 * Guarda una suscripción al boletín del sitio en `website_newsletter_subscribers` (ERP
 * 20261120041740). Antes la sección «Boletín» le decía al visitante que quedó suscrito sin
 * guardar el correo en ningún lado.
 *
 * Seguridad (misma regla que /api/contact):
 *  - `organization_id` sale del Host (cabeceras del middleware), NUNCA del body. Si el body
 *    trae otra organización: 403.
 *  - Rate limit: 5 envíos/hora por IP y 3/hora por correo.
 *  - Honeypot `website`: si viene relleno, se descarta.
 *  - Sin service role no se guarda y se dice: jamás «quedaste suscrito» si no se guardó.
 *  - La tabla no admite escritura con la clave pública: solo este handler escribe.
 *
 * Body: { email, name?, phone?, birthday? (AAAA-MM-DD), consent?, source? ('section'|'footer'|'popup'),
 *         organizationId? (solo verificación cruzada), website? (honeypot) }
 */

type FilaSuscriptor = Database['public']['Tables']['website_newsletter_subscribers']['Insert']
type TablaSuscriptores = {
  upsert(fila: FilaSuscriptor, opciones: { onConflict: string }): PromiseLike<{ error: { message: string } | null }>
}

const MAX = { email: 160, name: 120, phone: 40 }
const FUENTES = new Set(['section', 'footer', 'popup'])
const HORA = 60 * 60 * 1000

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function demasiados(resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
  return NextResponse.json(
    { error: 'Has enviado demasiadas solicitudes. Inténtalo más tarde.', retryAfter },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  )
}

export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request)
    const porIp = checkRateLimit(`boletin:${clientIP}`, 5, HORA)
    if (!porIp.allowed) return demasiados(porIp.resetAt)

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
    }
    const b = body as Record<string, unknown>

    if (str(b.website)) {
      console.warn(`[newsletter] honeypot activado desde ${clientIP}; envío descartado`)
      return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
    }

    const email = str(b.email).toLowerCase()
    const name = str(b.name)
    const phone = str(b.phone)
    const birthday = str(b.birthday)
    const source = FUENTES.has(str(b.source)) ? str(b.source) : 'section'
    const consent = b.consent === true

    if (!/^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(email) || email.length > MAX.email) {
      return NextResponse.json({ error: 'El correo no es válido.' }, { status: 400 })
    }
    if (name.length > MAX.name || phone.length > MAX.phone) {
      return NextResponse.json({ error: 'Alguno de los campos es demasiado largo.' }, { status: 400 })
    }
    if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      return NextResponse.json({ error: 'La fecha de cumpleaños no es válida.' }, { status: 400 })
    }

    const porCorreo = checkRateLimit(`boletin-correo:${email}`, 3, HORA)
    if (!porCorreo.allowed) return demasiados(porCorreo.resetAt)

    // La organización sale del Host, no del body.
    const headersList = await headers()
    const identifier = headersList.get('x-custom-domain') || headersList.get('x-subdomain')
    if (!identifier) {
      console.error('[newsletter] petición sin host de tenant (x-custom-domain / x-subdomain)')
      return NextResponse.json({ error: 'Organización no encontrada.' }, { status: 404 })
    }
    const organization = await getOrganizationByHost(identifier)
    if (!organization) {
      console.error(`[newsletter] host sin organización: ${identifier}`)
      return NextResponse.json({ error: 'Organización no encontrada.' }, { status: 404 })
    }
    const claimedOrgId = b.organizationId
    if (claimedOrgId !== undefined && claimedOrgId !== null && Number(claimedOrgId) !== Number(organization.id)) {
      console.error(`[newsletter] organizationId del body (${String(claimedOrgId)}) no coincide con el host ${identifier} (org ${organization.id})`)
      return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 403 })
    }

    const supabase = createAdminClient()
    if (!supabase) {
      console.error('[newsletter] SUPABASE_SERVICE_ROLE_KEY no configurada: no se puede guardar la suscripción')
      return NextResponse.json({ error: 'No pudimos guardar tu suscripción ahora mismo. Inténtalo más tarde.' }, { status: 503 })
    }

    // Volver a suscribirse actualiza la fila (un correo por organización) y la reactiva.
    const fila: FilaSuscriptor = {
      organization_id: organization.id,
      email,
      source: source as 'section' | 'footer' | 'popup',
      consent,
      status: 'active',
      updated_at: new Date().toISOString(),
      ...(name ? { name } : {}),
      ...(phone ? { phone } : {}),
      ...(birthday ? { birthday } : {}),
    }

    // El `Database` escrito a mano no infiere los métodos de escritura (`never[]`, como en
    // track-visit): se tipa solo esta llamada, con la fila declarada en types/database.ts.
    const tabla = supabase.from('website_newsletter_subscribers') as unknown as TablaSuscriptores
    const { error } = await tabla.upsert(fila, { onConflict: 'organization_id,email' })
    if (error) {
      console.error(`[newsletter] no se pudo guardar la suscripción (org ${organization.id}): ${error.message}`)
      return NextResponse.json({ error: 'No pudimos guardar tu suscripción ahora mismo. Inténtalo más tarde.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[newsletter] error inesperado', e)
    return NextResponse.json({ error: 'No pudimos guardar tu suscripción ahora mismo. Inténtalo más tarde.' }, { status: 500 })
  }
}
