import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient, createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organizationId, email, password } = body
    
    if (!organizationId || !email || !password) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }
    
    // Usar client sin cookies para autenticación (evita Invalid API key)
    const authClient = createAdminClient() || createPublicClient()
    
    // Intentar login con Supabase Auth
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
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
    
    // Establecer sesión en cookies para que el usuario quede logueado
    if (authData.session) {
      try {
        const serverClient = await createServerSupabaseClient()
        await serverClient.auth.setSession({
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token
        })
      } catch (e) {
        console.error('Error setting session cookies:', e)
      }
    }
    
    // Verificar que el usuario es cliente de esta organización
    const { data: customer } = await authClient
      .from('customers')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('email', email)
      .single()
    
    const customerData = customer as any
    
    if (!customerData) {
      return NextResponse.json(
        { error: 'No tienes cuenta en esta organización' },
        { status: 403 }
      )
    }
    
    // Actualizar user_id si no está vinculado
    if (!customerData.user_id && authData.user) {
      await (authClient as any)
        .from('customers')
        .update({ 
          user_id: authData.user.id, 
          is_registered: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', customerData.id)
    }
    
    return NextResponse.json({ 
      success: true, 
      user: {
        id: customerData.id,
        email: customerData.email,
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
