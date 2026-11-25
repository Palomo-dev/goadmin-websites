import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { bajaResenasValida } from '@/lib/resenas/firmaResena'

export const dynamic = 'force-dynamic'

/**
 * Baja de las solicitudes de opinión («No quiero recibir más solicitudes de opinión», Figma 3A).
 *
 * - GET: página con el botón para confirmar (los antivirus del correo abren los enlaces; un GET no
 *   debe dar de baja a nadie).
 * - POST: da de baja ese correo en ESTA tienda (todas sus solicitudes). Es también el «un clic»
 *   de `List-Unsubscribe-Post` (RFC 8058).
 *
 * `?s=<solicitud>&t=<firma>`: la firma incluye la organización, que sale del host. Sin la marca
 * de la plataforma: la página solo dice lo que pasó.
 */
const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function pagina(titulo: string, cuerpo: string, status = 200) {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${titulo}</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#F9FAFB;color:#111827;">
<main style="max-width:440px;margin:15vh auto;padding:24px;background:#fff;border:1px solid #E5E7EB;border-radius:16px;">
<h1 style="font-size:20px;margin:0 0 8px 0;">${titulo}</h1>${cuerpo}</main></body></html>`
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' } })
}

async function validar(request: NextRequest): Promise<{ org: number; s: string } | null> {
  const org = await getOrgIdDelHost()
  const p = request.nextUrl.searchParams
  const s = p.get('s') ?? ''
  if (!org || !PATRON_UUID.test(s) || !bajaResenasValida(org, s, p.get('t'))) return null
  return { org, s }
}

export async function GET(request: NextRequest) {
  const ok = await validar(request)
  if (!ok) return pagina('Enlace no válido', '<p style="color:#4B5563;font-size:14px;">Este enlace no es válido o está incompleto.</p>', 400)
  const accion = `${request.nextUrl.pathname}?${request.nextUrl.searchParams.toString()}`
  return pagina(
    '¿Dejar de recibir solicitudes de opinión?',
    `<p style="color:#4B5563;font-size:14px;">No te volveremos a escribir para pedirte tu opinión sobre tus compras. Seguirás recibiendo los correos de tus pedidos.</p>
<form method="post" action="${accion.replace(/"/g, '&quot;')}"><button type="submit" style="margin-top:12px;height:44px;padding:0 20px;border:0;border-radius:8px;background:#111827;color:#fff;font-size:15px;font-weight:600;cursor:pointer;">Sí, no quiero recibirlas</button></form>`,
  )
}

export async function POST(request: NextRequest) {
  const ok = await validar(request)
  if (!ok) return pagina('Enlace no válido', '<p style="color:#4B5563;font-size:14px;">Este enlace no es válido o está incompleto.</p>', 400)
  const sb = createAdminClient() as any
  if (!sb) return pagina('No pudimos completar la baja', '<p style="color:#4B5563;font-size:14px;">Intenta de nuevo más tarde.</p>', 500)
  const { data: solicitud } = await sb.from('product_review_requests').select('email').eq('id', ok.s).eq('organization_id', ok.org).maybeSingle()
  if (!solicitud?.email) return pagina('Enlace no válido', '<p style="color:#4B5563;font-size:14px;">No encontramos esta solicitud.</p>', 404)
  const { error } = await sb
    .from('product_review_requests')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('organization_id', ok.org)
    .eq('email', solicitud.email)
    .is('unsubscribed_at', null)
  if (error) {
    console.error('[api/reviews/baja] No se pudo dar de baja', { org: ok.org, error: error.message })
    return pagina('No pudimos completar la baja', '<p style="color:#4B5563;font-size:14px;">Intenta de nuevo más tarde.</p>', 500)
  }
  return pagina('Listo', '<p style="color:#4B5563;font-size:14px;">No te volveremos a pedir opiniones por correo.</p>')
}
