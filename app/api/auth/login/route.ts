import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createPublicClient, createAdminClient } from '@/lib/supabase/server'

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

    // createAuthClient: no lee cookies stale (evita Invalid API key) pero SÍ escribe cookies nuevas
    const supabase = await createAuthClient()

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
    
    // Para queries admin usar admin client si disponible
    const queryClient = createAdminClient() || createPublicClient()
    
    // Verificar que el usuario es cliente de esta organización
    const { data: customer } = await queryClient
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
      await (queryClient as any)
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
