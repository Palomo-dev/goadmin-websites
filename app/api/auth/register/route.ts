import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createPublicClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organizationId, firstName, lastName, email, phone, password } = body

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
    const { data: existingCustomerData } = await queryClient
      .from('customers')
      .select('id, is_registered')
      .eq('organization_id', organizationId)
      .eq('email', email)
      .single()
    
    const existingCustomer = existingCustomerData as any
    
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
    
    // Crear o actualizar customer
    if (existingCustomer) {
      await (queryClient as any)
        .from('customers')
        .update({
          first_name: firstName,
          last_name: lastName,
          phone: phone,
          user_id: authData.user?.id,
          is_registered: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCustomer.id)
    } else {
      await (queryClient as any)
        .from('customers')
        .insert({
          organization_id: organizationId,
          email,
          first_name: firstName,
          last_name: lastName,
          phone: phone,
          user_id: authData.user?.id,
          is_registered: true
        })
    }
    
    // Auto-login: establecer sesión con cookies para redirigir directo a /mi-cuenta
    const authClient = await createAuthClient()
    const { data: loginData } = await authClient.auth.signInWithPassword({ email, password })
    
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
