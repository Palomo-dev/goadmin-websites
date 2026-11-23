import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { MARCA_SESION_CORTA } from '@/lib/auth/sesionCorta'

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    await supabase.auth.signOut()
    // Sin sesión no queda «Recordarme» pendiente (lib/auth/sesionCorta.ts).
    ;(await cookies()).delete(MARCA_SESION_CORTA)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout API error:', error)
    return NextResponse.json(
      { error: 'Error al cerrar sesión' },
      { status: 500 }
    )
  }
}
