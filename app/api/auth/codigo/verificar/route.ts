import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient, createAuthClient } from '@/lib/supabase/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'
import { MARCA_SESION_CORTA, opcionesMarcaSesionCorta } from '@/lib/auth/sesionCorta'
import { vincularClienteDeSesion } from '@/lib/auth/clienteSesion'
import { abrirSesionSinCorreo } from '@/lib/auth/sesionSinCorreo'
import { verificarCodigo } from '@/lib/cuenta/codigoTienda'
import { codigoValido, errorContrasena, mensajeResultadoCodigo, normalizarCorreo, propositoCodigo } from '@/lib/cuenta/reglasCuenta'

export const dynamic = 'force-dynamic'

const texto = (v: unknown, max = 120) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : '')

/**
 * POST /api/auth/codigo/verificar — entra con el código de 6 dígitos (Figma 2975:72023).
 *
 * Body: { email, codigo, recordarme?, proposito? }.
 * - `proposito: 'login'` (por defecto): el código de «Recibir código» (/api/auth/codigo).
 * - `proposito: 'verify'`: el código de «Crear cuenta» (/api/auth/register). Trae además
 *   { firstName, lastName, phone, password }: la cuenta se crea (o se le pone esa contraseña) solo
 *   ahora, con el correo ya probado.
 *
 * El código es de la tienda (lib/cuenta/codigoTienda.ts: hash, 5 intentos, un solo uso). Al
 * acertar, la sesión se abre SIN correos de Supabase (lib/auth/sesionSinCorreo.ts) y deja las
 * cookies, como /api/auth/login. Después se crea o vincula la ficha de cliente de la organización
 * del HOST (lib/auth/clienteSesion.ts): los pedidos hechos sin cuenta con ese correo quedan en Mis
 * pedidos.
 *
 * Límite por IP y por correo además de los 5 intentos por código.
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
    const proposito = propositoCodigo(body?.proposito) === 'verify' ? 'verify' : 'login'
    // «Recordarme en este celular»: solo `false` acorta la sesión (lib/auth/sesionCorta.ts).
    const recordarme = body?.recordarme !== false

    // Registro: los datos del formulario viajan con el código (no se guardan antes de probar el correo).
    const registro = proposito === 'verify'
      ? { firstName: texto(body?.firstName), lastName: texto(body?.lastName), phone: texto(body?.phone, 40), password: typeof body?.password === 'string' ? body.password : '' }
      : null
    if (registro) {
      if (!registro.firstName || !registro.lastName) return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
      const invalido = errorContrasena({ password: registro.password, confirmPassword: registro.password })
      if (invalido) return NextResponse.json({ error: invalido }, { status: 400 })
    }

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'No pudimos verificar el código. Intenta de nuevo.' }, { status: 503 })

    const resultado = await verificarCodigo(admin as any, { organizationId: orgId, correo, proposito, codigo })
    if (resultado === 'error') return NextResponse.json({ error: 'No pudimos verificar el código. Intenta de nuevo.' }, { status: 502 })
    if (resultado !== 'ok') {
      return NextResponse.json({ error: mensajeResultadoCodigo(resultado) }, { status: resultado === 'intentos' ? 429 : 400 })
    }

    const supabase = await createAuthClient({ sesionCorta: !recordarme })
    const sesion = await abrirSesionSinCorreo(supabase as any, {
      correo,
      password: registro?.password ?? null,
      metadatos: registro ? { first_name: registro.firstName, last_name: registro.lastName, phone: registro.phone || null } : null,
      descartarClaveSinVerificar: !registro,
      soloClaveSiNueva: !!registro,
    })
    if (!sesion.ok) {
      console.error('[codigo] El código acertó pero no se pudo abrir la sesión', { orgId, motivo: sesion.motivo })
      return NextResponse.json({ error: 'No pudimos abrir tu sesión. Pide un código nuevo.' }, { status: 502 })
    }

    const cookieStore = await cookies()
    if (recordarme) cookieStore.delete(MARCA_SESION_CORTA)
    else cookieStore.set(MARCA_SESION_CORTA, '1', opcionesMarcaSesionCorta(request.nextUrl.protocol === 'https:'))

    // El código prueba que el correo es de quien entra. Registro: sus datos reemplazan los de la ficha.
    const clienteId = await vincularClienteDeSesion(admin, orgId, sesion.user, {
      verificado: true,
      autorizacionDatos: true,
      ...(registro ? { firstName: registro.firstName, lastName: registro.lastName, phone: registro.phone || null, sobrescribir: true } : {}),
    })
    if (!clienteId) console.error('[codigo] Entró pero no se pudo crear o vincular su ficha', { orgId })

    return NextResponse.json({
      success: true,
      user: { email: sesion.user.email ?? correo },
      session: sesion.session,
    })
  } catch (error) {
    console.error('[codigo] Error al verificar el código', error)
    return NextResponse.json({ error: 'No pudimos verificar el código. Intenta de nuevo.' }, { status: 500 })
  }
}
