import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'El correo electrónico es requerido' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    const origin = request.headers.get('origin') || ''

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/reset-password`
    })

    if (error) {
      console.error('Forgot password error:', error)
    }

    // Siempre retornar éxito para no revelar si el email existe
    return NextResponse.json({
      success: true,
      message: 'Si el correo existe, recibirás un enlace para restablecer tu contraseña.'
    })
  } catch (error) {
    console.error('Forgot password API error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
