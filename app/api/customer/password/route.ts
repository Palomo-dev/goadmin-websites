import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'
import { errorContrasena } from '@/lib/cuenta/reglasCuenta'

export const dynamic = 'force-dynamic'

/**
 * POST /api/customer/password — crear o cambiar la contraseña (Mis datos › Seguridad, Figma F).
 * Opcional: se puede entrar siempre con el código al correo. Usa la sesión de la cookie
 * (`auth.updateUser`); la misma validación del registro (6 caracteres y confirmación).
 */
export async function POST(request: NextRequest) {
  try {
    if (!checkRateLimit(`password:ip:${getClientIP(request)}`, 8, 10 * 60 * 1000).allowed) {
      return NextResponse.json({ error: 'Hiciste muchos intentos. Espera unos minutos.' }, { status: 429 })
    }
    if ((await getOrgIdDelHost()) === null) return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })
    const body = await request.json().catch(() => ({}))
    const password = typeof body.password === 'string' ? body.password : ''
    const invalido = errorContrasena({ password, confirmPassword: typeof body.confirmPassword === 'string' ? body.confirmPassword : '' })
    if (invalido) return NextResponse.json({ error: invalido }, { status: 400 })

    const supabase = await createServerSupabaseClient()
    const { data } = await supabase.auth.getUser()
    if (!data?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      const reautenticar = /reauthenticat|nonce/i.test(error.message || '')
      return NextResponse.json(
        { error: reautenticar ? 'Por seguridad, sal y vuelve a entrar con el código antes de cambiar la contraseña.' : 'No pudimos guardar la contraseña. Prueba con otra.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[contraseña] Error', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
