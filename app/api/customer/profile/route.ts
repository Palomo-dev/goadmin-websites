import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { customer_id, organization_id, first_name, last_name, phone, doc_type, doc_number, address, city } = body

    if (!customer_id || !organization_id) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Verificar que el customer pertenece al usuario autenticado
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customer_id)
      .eq('user_id', user.id)
      .single()

    if (!customer) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { error } = await supabase
      .from('customers')
      .update({
        first_name: first_name || null,
        last_name: last_name || null,
        full_name: [first_name, last_name].filter(Boolean).join(' ') || null,
        phone: phone || null,
        doc_type: doc_type || null,
        doc_number: doc_number || null,
        address: address || null,
        city: city || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customer_id)
      .eq('organization_id', organization_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}

