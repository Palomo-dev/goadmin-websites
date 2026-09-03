import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organizationId, address_line, city, state, country_code, department, label, is_default } = body

    if (!organizationId || !address_line) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Usar el mismo cliente que funciona en perfil
    const supabase = await createServerSupabaseClient() as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Buscar customer por user_id primero, luego por email
    let customer = null
    const { data: customerByUserId } = await supabase
      .from('customers')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single()

    if (customerByUserId) {
      customer = customerByUserId
    } else {
      const { data: customerByEmail } = await supabase
        .from('customers')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('email', user.email)
        .limit(1)
        .single()
      customer = customerByEmail
    }

    if (!customer) {
      // Crear customer si no existe
      const { data: newCustomer } = await supabase
        .from('customers')
        .insert({
          organization_id: organizationId,
          email: user.email,
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || '',
          // full_name es GENERATED ALWAYS AS (CASE ...), no se puede insertar.
          is_registered: true,
          address: address_line,
          city: city || null,
        })
        .select('id')
        .single()

      if (!newCustomer) {
        return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 })
      }

      // Crear dirección para el nuevo customer
      const { data: address } = await supabase
        .from('customer_addresses')
        .insert({
          customer_id: newCustomer.id,
          label: label || 'Principal',
          address_line1: address_line,
          city: city || null,
          department: department || state || null,
          country_code: country_code || null,
          is_default: true,
          is_active: true,
        })
        .select('id, label, address_line1, city, department, country_code, is_default')
        .single()

      return NextResponse.json({ address })
    }

    // Si is_default, quitar default de las demás
    if (is_default) {
      await supabase
        .from('customer_addresses')
        .update({ is_default: false })
        .eq('customer_id', customer.id)
    }

    // Crear la dirección
    const { data: address, error } = await supabase
      .from('customer_addresses')
      .insert({
        customer_id: customer.id,
        label: label || 'Dirección',
        address_line1: address_line,
        city: city || null,
        department: department || state || null,
        country_code: country_code || null,
        is_default: is_default || false,
        is_active: true,
      })
      .select('id, label, address_line1, city, department, country_code, is_default')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Error al guardar dirección' }, { status: 500 })
    }

    // Actualizar dirección principal del customer
    if (is_default) {
      await supabase
        .from('customers')
        .update({ address: address_line, city: city || null })
        .eq('id', customer.id)
    }

    return NextResponse.json({ address })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
