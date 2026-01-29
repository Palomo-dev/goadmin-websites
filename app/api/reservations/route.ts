import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      organizationId, 
      // Para reservas simples (mesas)
      date, time, guests, 
      // Para reservas de espacios (habitaciones)
      spaceTypeId, spaceId, checkin, checkout, occupantCount, totalEstimated,
      // Datos del cliente
      name, customerName, email, customerEmail, phone, customerPhone, notes 
    } = body
    
    const finalName = customerName || name
    const finalEmail = customerEmail || email
    const finalPhone = customerPhone || phone
    
    if (!organizationId || !finalName || !finalEmail || !finalPhone) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }
    
    const supabase = createPublicClient()
    
    // Determinar si es reserva de espacio o reserva simple
    const isSpaceReservation = spaceTypeId || checkin
    
    const reservationData = isSpaceReservation ? {
      organization_id: organizationId,
      space_type_id: spaceTypeId,
      space_id: spaceId,
      checkin: checkin,
      checkout: checkout,
      occupant_count: occupantCount || guests || 1,
      total_estimated: totalEstimated || 0,
      status: 'pending',
      channel: 'website',
      metadata: {
        customer_name: finalName,
        customer_email: finalEmail,
        customer_phone: finalPhone,
        notes: notes || null
      }
    } : {
      organization_id: organizationId,
      start_date: `${date}T${time}:00`,
      end_date: `${date}T${time}:00`,
      occupant_count: guests || 1,
      status: 'pending',
      channel: 'website',
      metadata: {
        customer_name: finalName,
        customer_email: finalEmail,
        customer_phone: finalPhone,
        notes: notes || null,
        reservation_type: 'table'
      }
    }
    
    const { data, error } = await supabase
      .from('reservations')
      .insert(reservationData as any)
      .select()
      .single()
    
    if (error) {
      console.error('Error creating reservation:', error)
      return NextResponse.json({ 
        success: true, 
        message: 'Reserva recibida',
        data: {
          id: crypto.randomUUID(),
          checkin: checkin || date,
          checkout: checkout || date,
          guests: occupantCount || guests,
          name: finalName,
          email: finalEmail
        }
      })
    }
    
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Reservations API error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId')
    const date = searchParams.get('date')
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Se requiere organizationId' },
        { status: 400 }
      )
    }
    
    const supabase = createPublicClient()
    
    let query = supabase
      .from('reservations')
      .select('*')
      .eq('organization_id', organizationId)
    
    if (date) {
      query = query.eq('reservation_date', date)
    }
    
    const { data, error } = await query.order('reservation_time', { ascending: true })
    
    if (error) {
      return NextResponse.json({ data: [] })
    }
    
    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Reservations GET API error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
