import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'
import { normalizarCorreo } from '@/lib/cuenta/reglasCuenta'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/codigo — envía el código de 6 dígitos al correo (Figma «16 Sitio web» 2975:71911).
 *
 * Body: { email }. Usa el OTP de Supabase (`signInWithOtp`, `shouldCreateUser: true`): si es la
 * primera vez, Supabase crea el usuario y la ficha de la tienda se crea al verificar el código
 * (/api/auth/codigo/verificar). No se inventa un OTP propio ni tablas nuevas.
 *
 * - Organización del HOST (solo para el límite y el enlace de la tienda), nunca del body.
 * - Límite por IP y por correo (lib/rateLimit.ts, en memoria por instancia); Supabase además
 *   limita un código por minuto por correo y un tope de correos por hora del proyecto.
 * - La respuesta no dice si el correo tenía cuenta: con `shouldCreateUser` el envío es igual.
 * - El correo sale con la plantilla «Magic Link» (o «Confirm signup» si el usuario es nuevo o no
 *   había confirmado) del proyecto: ambas deben llevar `{{ .Token }}`. La plantilla es una sola
 *   para todas las tiendas; `{{ .RedirectTo }}` trae la dirección de esta tienda.
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

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !clave) return NextResponse.json({ error: 'No pudimos enviar el código. Intenta de nuevo.' }, { status: 503 })

    // Flujo implícito y sin sesión guardada: aquí solo se pide el envío; la sesión la crea la
    // verificación (con las cookies de la tienda).
    const supabase = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false, flowType: 'implicit' } })
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
    const protocolo = request.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
    const { error } = await supabase.auth.signInWithOtp({
      email: correo,
      options: {
        shouldCreateUser: true,
        // Solo sirve a la plantilla ({{ .RedirectTo }}) para nombrar la tienda; el código se escribe en ella.
        ...(host ? { emailRedirectTo: `${protocolo}://${host}/auth` } : {}),
      },
    })
    if (error) {
      const limite = error.status === 429 || /rate limit|security purposes/i.test(error.message || '')
      console.error('[codigo] Supabase no envió el código', { orgId, status: error.status, code: (error as { code?: string }).code })
      return NextResponse.json(
        { error: limite ? 'Espera un minuto antes de pedir otro código.' : 'No pudimos enviar el código. Intenta de nuevo.' },
        { status: limite ? 429 : 502 },
      )
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[codigo] Error al enviar el código', error)
    return NextResponse.json({ error: 'No pudimos enviar el código. Intenta de nuevo.' }, { status: 500 })
  }
}
