import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/customer/sesiones — «Cerrar las demás» (Mis datos › Seguridad, Figma F). Cierra la
 * sesión en los demás navegadores y celulares (`signOut({ scope: 'others' })` de Supabase) y deja
 * abierta esta. La lista de sesiones abiertas no se muestra: el cliente de la tienda no puede
 * leerla (vive en el esquema `auth`).
 */
export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase.auth.getUser()
    if (!data?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const { error } = await supabase.auth.signOut({ scope: 'others' })
    if (error) {
      console.error('[sesiones] No se pudieron cerrar las demás sesiones', { error: error.message })
      return NextResponse.json({ error: 'No pudimos cerrar las demás sesiones' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[sesiones] Error', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
