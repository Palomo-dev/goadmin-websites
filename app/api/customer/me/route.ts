import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const organizationId = request.nextUrl.searchParams.get('organizationId')
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId requerido' }, { status: 400 })
    }

    // Usar exactamente el mismo cliente que usa la página de perfil (getAuthCustomer)
    const supabase = await createServerSupabaseClient() as any
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ authenticated: false })
    }

    const meta = user.user_metadata || {}
    const result: any = {
      authenticated: true,
      email: user.email,
      firstName: meta.first_name || '',
      lastName: meta.last_name || '',
      phone: meta.phone || '',
      addresses: [],
      customerId: null,
      address: '',
      city: '',
    }

    // Buscar customer por user_id (mismo método que getAuthCustomer en perfil)
    let customer = null
    const { data: customerByUserId } = await supabase
      .from('customers')
      .select('id, first_name, last_name, email, phone, address, city')
      .eq('organization_id', Number(organizationId))
      .eq('user_id', user.id)
      .single()

    if (customerByUserId) {
      customer = customerByUserId
    } else {
      // Fallback: buscar por email
      const { data: customerByEmail } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email, phone, address, city')
        .eq('organization_id', Number(organizationId))
        .eq('email', user.email)
        .limit(1)
        .single()
      customer = customerByEmail
    }

    if (customer) {
      result.customerId = customer.id
      result.firstName = customer.first_name || result.firstName
      result.lastName = customer.last_name || result.lastName
      result.phone = customer.phone || result.phone
      result.address = customer.address || ''
      result.city = customer.city || ''

      // Cargar direcciones guardadas
      const { data: addresses } = await supabase
        .from('customer_addresses')
        .select('id, label, address_line, city, state, is_default')
        .eq('customer_id', customer.id)
        .order('is_default', { ascending: false })

      if (addresses) {
        result.addresses = addresses
      }
    }

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ authenticated: false, error: err.message }, { status: 500 })
  }
}
