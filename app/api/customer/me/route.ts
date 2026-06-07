import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const organizationId = request.nextUrl.searchParams.get('organizationId')
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId requerido' }, { status: 400 })
    }

    // Obtener usuario autenticado via cookies del servidor
    const cookieStore = await cookies()
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )

    const { data: { user } } = await supabaseAuth.auth.getUser()
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
    }

    // Buscar customer en la base de datos
    const supabase = (createAdminClient() || createPublicClient()) as any
    const { data: customer } = await supabase
      .from('customers')
      .select('id, first_name, last_name, email, phone, address, city')
      .eq('organization_id', Number(organizationId))
      .eq('email', user.email)
      .order('is_registered', { ascending: false })
      .limit(1)
      .single()

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
