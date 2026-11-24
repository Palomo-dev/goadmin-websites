import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAuthClient } from '@/lib/supabase/server'
import { MARCA_SESION_CORTA, opcionesMarcaSesionCorta } from '@/lib/auth/sesionCorta'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { fichaPorCorreo, vincularClienteDeSesion } from '@/lib/auth/clienteSesion'
import { correoVerificado } from '@/lib/cuenta/reglasCuenta'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body
    // La organización sale del HOST, nunca del body (CLAUDE.md). El `organizationId` que aún manda
    // el navegador solo se compara para registrar un desfase.
    const organizationId = await getOrgIdDelHost()
    if (organizationId === null) {
      return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })
    }
    if (body.organizationId != null && Number(body.organizationId) !== organizationId) {
      console.warn('[Login] organizationId del body distinto al del host; se ignora', { organizationId })
    }
    // «Recordarme»: solo `false` acorta la sesión; sin el campo (clientes viejos), la de siempre.
    const recordarme = body.recordarme !== false

    if (!organizationId || !email || !password) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    // createAuthClient: usa service role key + escribe cookies de sesión en la respuesta
    // (sin vencimiento si no marcó «Recordarme»: lib/auth/sesionCorta.ts)
    const supabase = await createAuthClient({ sesionCorta: !recordarme })

    // Intentar login con Supabase Auth (las cookies se setean automáticamente)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (authError) {
      console.error('Login auth error:', authError.message)
      const msg = authError.message === 'Invalid login credentials'
        ? 'Credenciales inválidas'
        : authError.message
      return NextResponse.json(
        { error: msg },
        { status: 401 }
      )
    }
    
    // La marca acompaña a las cookies que acaba de escribir el ingreso: la leen el middleware y el
    // navegador para no volver a ponerles vencimiento al refrescar el token.
    const cookieStore = await cookies()
    if (recordarme) cookieStore.delete(MARCA_SESION_CORTA)
    else cookieStore.set(MARCA_SESION_CORTA, '1', opcionesMarcaSesionCorta(request.nextUrl.protocol === 'https:'))

    // Verificar que el usuario es cliente de esta organización (correo con otras mayúsculas incluido)
    const customerData = authData.user?.email
      ? await fichaPorCorreo(supabase as any, organizationId, authData.user.email.toLowerCase())
      : null

    if (!customerData) {
      return NextResponse.json(
        { error: 'No tienes cuenta en esta organización' },
        { status: 403 }
      )
    }

    // Vincular la ficha al usuario si no lo está (la misma ruta del registro y del código).
    if (authData.user) {
      await vincularClienteDeSesion(supabase as any, organizationId, authData.user, { verificado: correoVerificado(authData.user) })
    }

    return NextResponse.json({ 
      success: true, 
      user: {
        id: customerData.id,
        email: authData.user?.email ?? email,
        firstName: customerData.first_name,
        lastName: customerData.last_name
      },
      session: authData.session
    })
  } catch (error) {
    console.error('Login API error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
