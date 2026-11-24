import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'
import { fichaPorCorreo } from '@/lib/auth/clienteSesion'
import { errorContrasena, normalizarCorreo } from '@/lib/cuenta/reglasCuenta'
import { emitirCodigo } from '@/lib/cuenta/codigoTienda'
import { enviarCodigoAcceso } from '@/lib/email/send-codigo-acceso'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/register — «Crear cuenta» con contraseña.
 *
 * Desde el 2026-11-24 no usa `auth.signUp` (mandaba el correo «Confirm signup» de Supabase con la
 * marca de la plataforma). Ahora:
 * 1. Valida el formulario y envía el código de la tienda (propósito `verify`) con su marca
 *    (lib/email/send-codigo-acceso.ts). Aquí no se crea nada: ni usuario ni ficha.
 * 2. La pantalla pide el código y lo manda con los datos a /api/auth/codigo/verificar
 *    (`proposito: 'verify'`): con el correo probado se crea el usuario
 *    (`auth.admin.createUser`, sin correo), se fija la contraseña, se abre la sesión y se crea o
 *    vincula la ficha (lib/auth/clienteSesion.ts). Los pedidos sin cuenta solo se vinculan así,
 *    con el correo verificado.
 *
 * La organización sale del HOST, nunca del body (CLAUDE.md).
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!checkRateLimit(`registro:ip:${ip}`, 6, 10 * 60 * 1000).allowed) {
      return NextResponse.json({ error: 'Hiciste muchos intentos. Espera unos minutos.' }, { status: 429 })
    }
    const body = await request.json().catch(() => ({}))
    const { firstName, lastName, password } = body
    const email = normalizarCorreo(body.email)
    const organizationId = await getOrgIdDelHost()
    if (organizationId === null) {
      return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })
    }
    if (body.organizationId != null && Number(body.organizationId) !== organizationId) {
      console.warn('[Register] organizationId del body distinto al del host; se ignora', { organizationId })
    }

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }
    const invalido = errorContrasena({ password: String(password), confirmPassword: String(password) })
    if (invalido) return NextResponse.json({ error: invalido }, { status: 400 })

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'No pudimos crear la cuenta. Intenta de nuevo.' }, { status: 503 })

    // Ya registrado en esta tienda: que entre (con código o contraseña), como antes.
    const existingCustomer = await fichaPorCorreo(admin as any, organizationId, email)
    if (existingCustomer?.is_registered && existingCustomer.user_id) {
      return NextResponse.json(
        { error: 'Ya existe una cuenta con este correo electrónico. Entra con un código a tu correo.' },
        { status: 400 },
      )
    }

    if (!checkRateLimit(`registro:correo:${organizationId}:${email}`, 3, 10 * 60 * 1000).allowed) {
      return NextResponse.json({ error: 'Ya te enviamos varios códigos. Revisa tu correo (también en spam) o espera unos minutos.' }, { status: 429 })
    }
    const emision = await emitirCodigo(admin as any, { organizationId, correo: email, proposito: 'verify', ip })
    if (!emision.ok) {
      const espera = emision.motivo === 'espera' || emision.motivo === 'limite'
      return NextResponse.json(
        { error: espera ? 'Espera un minuto antes de pedir otro código.' : 'No pudimos enviar el código. Intenta de nuevo.' },
        { status: espera ? 429 : 502 },
      )
    }
    const enviado = await enviarCodigoAcceso(admin as any, { organizationId, correo: email, codigo: emision.codigo, proposito: 'verify' })
    if (!enviado) return NextResponse.json({ error: 'No pudimos enviar el código. Intenta de nuevo.' }, { status: 502 })

    return NextResponse.json({
      success: true,
      verificar: true,
      message: `Te enviamos un código a ${email} para confirmar tu correo.`,
    })
  } catch (error) {
    console.error('Register API error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
