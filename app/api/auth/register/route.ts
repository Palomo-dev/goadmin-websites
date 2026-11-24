import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { MARCA_SESION_CORTA } from '@/lib/auth/sesionCorta'
import { createAuthClient, createPublicClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { fichaPorCorreo, vincularClienteDeSesion } from '@/lib/auth/clienteSesion'
import { correoVerificado, normalizarCorreo } from '@/lib/cuenta/reglasCuenta'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { firstName, lastName, phone, password } = body
    const email = normalizarCorreo(body.email)
    // La organización sale del HOST, nunca del body (CLAUDE.md).
    const organizationId = await getOrgIdDelHost()
    if (organizationId === null) {
      return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })
    }
    if (body.organizationId != null && Number(body.organizationId) !== organizationId) {
      console.warn('[Register] organizationId del body distinto al del host; se ignora', { organizationId })
    }

    if (!organizationId || !firstName || !lastName || !email || !password) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    // Cliente para queries (admin si disponible, público como fallback)
    const adminClient = createAdminClient()
    const queryClient = adminClient || createPublicClient()

    // Verificar si ya existe un customer con este email en esta organización
    const existingCustomer = await fichaPorCorreo(queryClient as any, organizationId, email)
    
    if (existingCustomer?.is_registered) {
      return NextResponse.json(
        { error: 'Ya existe una cuenta con este correo electrónico' },
        { status: 400 }
      )
    }
    
    // Crear usuario en Supabase Auth (usar queryClient para signUp)
    const { data: authData, error: authError } = await queryClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          phone: phone
        }
      }
    })
    
    if (authError) {
      console.error('Auth signup error:', authError)
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }
    
    // Crear o actualizar customer: la misma ruta del ingreso y del código (lib/auth/clienteSesion.ts).
    // Registrarse reemplaza nombre, apellido y teléfono, como siempre.
    if (authData.user) {
      await vincularClienteDeSesion(queryClient as any, organizationId, authData.user, {
        firstName,
        lastName,
        phone,
        sobrescribir: true,
        verificado: correoVerificado(authData.user),
      })
    }
    
    // Auto-login: establecer sesión con cookies para redirigir directo a /mi-cuenta
    const authClient = await createAuthClient()
    const { data: loginData } = await authClient.auth.signInWithPassword({ email, password })
    // Cuenta nueva = la sesión larga de siempre: se borra una marca de «Recordarme» que haya quedado.
    if (loginData?.session) (await cookies()).delete(MARCA_SESION_CORTA)
    
    return NextResponse.json({ 
      success: true, 
      message: '¡Cuenta creada exitosamente!',
      user: authData.user,
      session: loginData?.session || null
    })
  } catch (error) {
    console.error('Register API error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
