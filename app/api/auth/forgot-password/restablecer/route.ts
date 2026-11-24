import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient, createAuthClient } from '@/lib/supabase/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'
import { MARCA_SESION_CORTA, opcionesMarcaSesionCorta } from '@/lib/auth/sesionCorta'
import { fichaPorCorreo, vincularClienteDeSesion } from '@/lib/auth/clienteSesion'
import { abrirSesionSinCorreo } from '@/lib/auth/sesionSinCorreo'
import { verificarCodigo } from '@/lib/cuenta/codigoTienda'
import { codigoValido, errorContrasena, mensajeResultadoCodigo, normalizarCorreo } from '@/lib/cuenta/reglasCuenta'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/forgot-password/restablecer — nueva contraseña con el código de la tienda.
 *
 * Body: { email, codigo, password, confirmPassword, recordarme? }. Comprueba el código (propósito
 * `reset`: hash, 5 intentos, un solo uso; lib/cuenta/codigoTienda.ts), pone la contraseña con
 * `auth.admin.updateUserById` y deja la sesión abierta sin correos de Supabase
 * (lib/auth/sesionSinCorreo.ts). La organización sale del HOST, nunca del body.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!checkRateLimit(`restablecer:ip:${ip}`, 12, 10 * 60 * 1000).allowed) {
      return NextResponse.json({ error: 'Hiciste muchos intentos. Espera unos minutos.' }, { status: 429 })
    }
    const orgId = await getOrgIdDelHost()
    if (orgId === null) return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const correo = normalizarCorreo(body?.email)
    const codigo = codigoValido(body?.codigo)
    if (!correo || !codigo) return NextResponse.json({ error: 'Escribe los 6 dígitos del código.' }, { status: 400 })
    const password = typeof body?.password === 'string' ? body.password : ''
    const invalido = errorContrasena({ password, confirmPassword: typeof body?.confirmPassword === 'string' ? body.confirmPassword : '' })
    if (invalido) return NextResponse.json({ error: invalido }, { status: 400 })
    if (!checkRateLimit(`restablecer:correo:${orgId}:${correo}`, 6, 10 * 60 * 1000).allowed) {
      return NextResponse.json({ error: 'Hiciste muchos intentos. Pide un código nuevo en unos minutos.' }, { status: 429 })
    }
    const recordarme = body?.recordarme !== false

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'No pudimos cambiar la contraseña. Intenta de nuevo.' }, { status: 503 })

    const resultado = await verificarCodigo(admin as any, { organizationId: orgId, correo, proposito: 'reset', codigo })
    if (resultado === 'error') return NextResponse.json({ error: 'No pudimos verificar el código. Intenta de nuevo.' }, { status: 502 })
    if (resultado !== 'ok') {
      return NextResponse.json({ error: mensajeResultadoCodigo(resultado) }, { status: resultado === 'intentos' ? 429 : 400 })
    }

    // El código de cambio solo se emite a cuentas de esta tienda; se comprueba otra vez.
    const ficha = await fichaPorCorreo(admin as any, orgId, correo)
    if (!ficha?.user_id) return NextResponse.json({ error: mensajeResultadoCodigo('vencido') }, { status: 400 })

    const supabase = await createAuthClient({ sesionCorta: !recordarme })
    const sesion = await abrirSesionSinCorreo(supabase as any, { correo, password })
    if (!sesion.ok) {
      console.error('[restablecer] El código acertó pero no se pudo cambiar la contraseña', { orgId, motivo: sesion.motivo })
      return NextResponse.json({ error: 'No pudimos guardar la contraseña. Prueba con otra o pide un código nuevo.' }, { status: 502 })
    }

    const cookieStore = await cookies()
    if (recordarme) cookieStore.delete(MARCA_SESION_CORTA)
    else cookieStore.set(MARCA_SESION_CORTA, '1', opcionesMarcaSesionCorta(request.nextUrl.protocol === 'https:'))

    await vincularClienteDeSesion(admin, orgId, sesion.user, { verificado: true })

    return NextResponse.json({ success: true, user: { email: sesion.user.email ?? correo }, session: sesion.session })
  } catch (error) {
    console.error('[restablecer] Error', error)
    return NextResponse.json({ error: 'No pudimos cambiar la contraseña. Intenta de nuevo.' }, { status: 500 })
  }
}
