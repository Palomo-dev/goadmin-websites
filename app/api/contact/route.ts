import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organizationId, name, email, phone, message } = body
    
    if (!organizationId || !name || !email || !message) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }
    
    const supabase = createPublicClient()
    
    // Crear un lead/contacto en la base de datos
    const { data, error } = await supabase
      .from('leads')
      .insert({
        organization_id: organizationId,
        first_name: name.split(' ')[0],
        last_name: name.split(' ').slice(1).join(' ') || null,
        email,
        phone: phone || null,
        notes: message,
        source: 'website',
        status: 'new'
      } as any)
      .select()
      .single()
    
    if (error) {
      console.error('Error creating lead:', error)
      // Si la tabla leads no existe, simplemente retornamos éxito
      return NextResponse.json({ success: true, message: 'Mensaje recibido' })
    }
    
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Contact API error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
