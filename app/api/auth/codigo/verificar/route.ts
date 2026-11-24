import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient, createAuthClient } from '@/lib/supabase/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'
import { MARCA_SESION_CORTA, opcionesMarcaSesionCorta } from '@/lib/auth/sesionCorta'
import { vincularClienteDeSesion } from '@/lib/auth/clienteSesion'
import { codigoValido, mensajeErrorCodigo, normalizarCorreo } from '@/lib/cuenta/reglasCuenta'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/codigo/verificar — entra con el código de 6 dígitos (Figma 2975:72023).
 *
 * Body: { email, codigo, recordarme? }. `verifyOtp` de Supabase (tipo `email`: sirve para el
 * código de un usuario nuevo y para el de uno que ya existía) deja las cookies de sesión, como
 * /api/auth/login. Después se crea o vincula la ficha de cliente de la organización del HOST
 * (lib/auth/clienteSesion.ts, la misma ruta de registrarse): los pedidos hechos sin cuenta con ese
 * correo quedan en Mis pedidos.
 *
 * Límite por IP y por correo: el código tiene un millón de combinaciones y Supabase lo invalida
 * al vencer; aquí se cortan los intentos seguidos antes de llegar a Supabase.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!checkRateLimit(`codigo-verificar:ip:${ip}`, 12, 10 * 60 * 1000).allowed) {
      return NextResponse.json({ error: 'Hiciste muchos intentos. Espera unos minutos.' }, { status: 429 })
    }

    const orgId = await getOrgIdDelHost()
    if (orgId === null) return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const correo = normalizarCorreo(body?.email)
    const codigo = codigoValido(body?.codigo)
    if (!correo || !codigo) return NextResponse.json({ error: 'Escribe los 6 dígitos del código.' }, { status: 400 })
    if (!checkRateLimit(`codigo-verificar:correo:${orgId}:${correo}`, 6, 10 * 60 * 1000).allowed) {
      return NextResponse.json({ error: 'Hiciste muchos intentos. Pide un código nuevo en unos minutos.' }, { status: 429 })
    }
    // «Recordarme en este celular»: solo `false` acorta la sesión (lib/auth/sesionCorta.ts).
    const recordarme = body?.recordarme !== false

    const supabase = await createAuthClient({ sesionCorta: !recordarme })
    const { data, error } = await supabase.auth.verifyOtp({ email: correo, token: codigo, type: 'email' })
    if (error || !data?.user || !data.session) {
      return NextResponse.json({ error: mensajeErrorCodigo(error) }, { status: error?.status === 429 ? 429 : 400 })
    }

    const cookieStore = await cookies()
    if (recordarme) cookieStore.delete(MARCA_SESION_CORTA)
    else cookieStore.set(MARCA_SESION_CORTA, '1', opcionesMarcaSesionCorta(request.nextUrl.protocol === 'https:'))

    // verifyOtp confirma el correo: es del dueño de la sesión.
    const admin = createAdminClient()
    const clienteId = admin
      ? await vincularClienteDeSesion(admin, orgId, data.user, { verificado: true, autorizacionDatos: true })
      : null
    if (!clienteId) console.error('[codigo] Entró pero no se pudo crear o vincular su ficha', { orgId })

    return NextResponse.json({
      success: true,
      user: { email: data.user.email ?? correo },
      session: data.session,
    })
  } catch (error) {
    console.error('[codigo] Error al verificar el código', error)
    return NextResponse.json({ error: 'No pudimos verificar el código. Intenta de nuevo.' }, { status: 500 })
  }
}
