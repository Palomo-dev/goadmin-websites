import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'
import { normalizarCorreo } from '@/lib/cuenta/reglasCuenta'
import { emitirCodigo } from '@/lib/cuenta/codigoTienda'
import { enviarCodigoAcceso } from '@/lib/email/send-codigo-acceso'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/codigo — envía el código de 6 dígitos al correo (Figma «16 Sitio web» 2975:71911).
 *
 * Body: { email }. Desde el 2026-11-24 el código es de la tienda (lib/cuenta/codigoTienda.ts) y lo
 * envía la tienda con Resend y su marca (lib/email/send-codigo-acceso.ts): el comprador NUNCA
 * recibe correos de Supabase Auth ni de la plataforma. La cuenta (usuario de Auth y ficha de la
 * tienda) se crea al verificar el código (/api/auth/codigo/verificar).
 *
 * - Organización del HOST (para el límite, el hash y la marca), nunca del body.
 * - Límite por IP (lib/rateLimit.ts, en memoria) y por correo (en memoria y en la tabla de códigos:
 *   uno por minuto y pocos por ventana, entre instancias).
 * - La respuesta no dice si el correo tenía cuenta: el envío es igual.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!checkRateLimit(`codigo:ip:${ip}`, 6, 10 * 60 * 1000).allowed) {
      return NextResponse.json({ error: 'Pediste muchos códigos. Espera unos minutos.' }, { status: 429 })
    }

    const orgId = await getOrgIdDelHost()
    if (orgId === null) return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const correo = normalizarCorreo(body?.email)
    if (!correo) return NextResponse.json({ error: 'Escribe un correo válido.' }, { status: 400 })

    if (!checkRateLimit(`codigo:correo:${orgId}:${correo}`, 3, 10 * 60 * 1000).allowed) {
      return NextResponse.json({ error: 'Ya te enviamos varios códigos. Revisa tu correo (también en spam) o espera unos minutos.' }, { status: 429 })
    }

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'No pudimos enviar el código. Intenta de nuevo.' }, { status: 503 })

    const emision = await emitirCodigo(admin as any, { organizationId: orgId, correo, proposito: 'login', ip })
    if (!emision.ok) {
      if (emision.motivo === 'espera') return NextResponse.json({ error: 'Espera un minuto antes de pedir otro código.' }, { status: 429 })
      if (emision.motivo === 'limite') {
        return NextResponse.json({ error: 'Ya te enviamos varios códigos. Revisa tu correo (también en spam) o espera unos minutos.' }, { status: 429 })
      }
      return NextResponse.json({ error: 'No pudimos enviar el código. Intenta de nuevo.' }, { status: 502 })
    }

    const enviado = await enviarCodigoAcceso(admin as any, { organizationId: orgId, correo, codigo: emision.codigo, proposito: 'login' })
    if (!enviado) return NextResponse.json({ error: 'No pudimos enviar el código. Intenta de nuevo.' }, { status: 502 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[codigo] Error al enviar el código', error)
    return NextResponse.json({ error: 'No pudimos enviar el código. Intenta de nuevo.' }, { status: 500 })
  }
}
