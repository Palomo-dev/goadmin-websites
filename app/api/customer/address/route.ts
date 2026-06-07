import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createAdminClient() || createPublicClient()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organizationId, address_line, city, state, label, is_default } = body

    if (!organizationId || !address_line) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Obtener el usuario autenticado
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
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const supabase = getSupabase() as any

    // Buscar customer por email
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('email', user.email)
      .limit(1)
      .single()

    if (!customer) {
      // Crear customer si no existe
      const { data: newCustomer } = await supabase
        .from('customers')
        .insert({
          organization_id: organizationId,
          email: user.email,
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || '',
          full_name: `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || user.email,
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
          address_line,
          city: city || null,
          state: state || null,
          is_default: true,
        })
        .select('id, label, address_line, city, state, is_default')
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
        address_line,
        city: city || null,
        state: state || null,
        is_default: is_default || false,
      })
      .select('id, label, address_line, city, state, is_default')
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
