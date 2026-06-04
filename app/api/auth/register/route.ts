import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

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

    // Debug: verificar que las variables de entorno están presentes
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('Missing env vars:', { url: !!SUPABASE_URL, key: !!SUPABASE_ANON_KEY })
      return NextResponse.json(
        { error: 'Configuración incompleta del servidor (faltan variables de entorno)' },
        { status: 500 }
      )
    }

    // Usar cliente vanilla de supabase-js para auth (evita problemas con @supabase/ssr)
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Verificar si ya existe un customer con este email en esta organización
    const { data: existingCustomerData } = await supabase
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
    
    // Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
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
      // Actualizar customer existente
      await (supabase as any)
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
      // Crear nuevo customer
      await (supabase as any)
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
    
    return NextResponse.json({ 
      success: true, 
      message: 'Cuenta creada exitosamente. Revisa tu correo para verificar tu cuenta.',
      user: authData.user
    })
  } catch (error) {
    console.error('Register API error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
