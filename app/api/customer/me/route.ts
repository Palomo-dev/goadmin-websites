import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { facturaDePerfil, type FichaFactura } from '@/components/site/checkout/facturaPerfil'

export const dynamic = 'force-dynamic'

/** Columnas de `customers` que lee esta ruta (todas existen: MCP 2026-11-25). */
const COLUMNAS_CLIENTE =
  'id, first_name, last_name, email, phone, address, city, identification_type, identification_number, dv, company_name, full_name, billing_email, parent_customer_id'

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
      // Datos de la factura electrónica de la cuenta (prellenan «Necesito factura a nombre de
      // empresa» sin pisar lo escrito). null si la ficha no tiene documento.
      factura: null,
    }

    // Buscar customer por user_id (mismo método que getAuthCustomer en perfil)
    let customer = null
    const { data: customerByUserId } = await supabase
      .from('customers')
      .select(COLUMNAS_CLIENTE)
      .eq('organization_id', Number(organizationId))
      .eq('user_id', user.id)
      .single()

    if (customerByUserId) {
      customer = customerByUserId
    } else {
      // Fallback: buscar por email
      const { data: customerByEmail } = await supabase
        .from('customers')
        .select(COLUMNAS_CLIENTE)
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

      // Empresa del cliente (la que guardó una compra con factura a nombre de empresa), misma
      // organización. Sin empresa, el documento del propio cliente.
      let empresa: FichaFactura | null = null
      if (customer.parent_customer_id) {
        const { data: fichaEmpresa } = await supabase
          .from('customers')
          .select('identification_type, identification_number, dv, company_name, full_name, first_name, last_name, email, billing_email')
          .eq('organization_id', Number(organizationId))
          .eq('id', customer.parent_customer_id)
          .maybeSingle()
        empresa = fichaEmpresa ?? null
      } else {
        // Sin empresa enlazada: solo la ficha del cliente.
      }
      result.factura = facturaDePerfil(customer, empresa)

      // Cargar direcciones guardadas
      const { data: addresses } = await supabase
        .from('customer_addresses')
        .select('id, label, address_line1, city, department, country_code, is_default')
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
