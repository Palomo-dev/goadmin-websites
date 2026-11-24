import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'
import { fichaPorCorreo } from '@/lib/auth/clienteSesion'
import { normalizarCorreo } from '@/lib/cuenta/reglasCuenta'
import { emitirCodigo } from '@/lib/cuenta/codigoTienda'
import { enviarCodigoAcceso } from '@/lib/email/send-codigo-acceso'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/forgot-password — «¿Olvidaste tu contraseña?».
 *
 * Desde el 2026-11-24 no usa `resetPasswordForEmail` (mandaba el correo de Supabase con la marca
 * de la plataforma). Envía el código de la tienda (propósito `reset`) con su marca; la nueva
 * contraseña se pone con ese código en /api/auth/forgot-password/restablecer.
 *
 * Solo se envía si el correo tiene cuenta en ESTA tienda (ficha con usuario). La respuesta es la
 * misma exista o no: no revela quién tiene cuenta. La organización sale del HOST.
 */
const RESPUESTA = { success: true, message: 'Si el correo tiene una cuenta en esta tienda, te enviamos un código para crear una nueva contraseña.' }

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!checkRateLimit(`recuperar:ip:${ip}`, 6, 10 * 60 * 1000).allowed) {
      return NextResponse.json({ error: 'Pediste muchos códigos. Espera unos minutos.' }, { status: 429 })
    }
    const orgId = await getOrgIdDelHost()
    if (orgId === null) return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const correo = normalizarCorreo(body?.email)
    if (!correo) return NextResponse.json({ error: 'Escribe un correo válido.' }, { status: 400 })
    if (!checkRateLimit(`recuperar:correo:${orgId}:${correo}`, 3, 10 * 60 * 1000).allowed) {
      return NextResponse.json({ error: 'Ya te enviamos varios códigos. Revisa tu correo (también en spam) o espera unos minutos.' }, { status: 429 })
    }

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'No pudimos enviar el código. Intenta de nuevo.' }, { status: 503 })

    const ficha = await fichaPorCorreo(admin as any, orgId, correo)
    if (!ficha?.user_id) return NextResponse.json(RESPUESTA)

    const emision = await emitirCodigo(admin as any, { organizationId: orgId, correo, proposito: 'reset', ip })
    // Espera o límite: la misma respuesta (un 429 aquí diría que el correo sí tiene cuenta).
    if (!emision.ok) {
      if (emision.motivo === 'error') console.error('[recuperar] No se pudo emitir el código', { orgId })
      return NextResponse.json(RESPUESTA)
    }
    const enviado = await enviarCodigoAcceso(admin as any, { organizationId: orgId, correo, codigo: emision.codigo, proposito: 'reset' })
    if (!enviado) console.error('[recuperar] No se pudo enviar el código', { orgId })
    return NextResponse.json(RESPUESTA)
  } catch (error) {
    console.error('Forgot password API error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
