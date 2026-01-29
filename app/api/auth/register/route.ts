import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/server'

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
    
    const supabase = createPublicClient()
    
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
