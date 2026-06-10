import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { getOrganizationByHost } from '@/lib/supabase/queries'

export const dynamic = 'force-dynamic'

/**
 * GET /api/orders/lookup?q=...&type=order_number|email
 * Busca pedidos por número de pedido o email del cliente
 * Filtrado por organización del host actual
 */
export async function GET(request: NextRequest) {
  try {
    const headersList = await headers()
    const identifier = headersList.get('x-custom-domain') || headersList.get('x-subdomain')
    if (!identifier) {
      return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })
    }

    const org = await getOrganizationByHost(identifier)
    if (!org) {
      return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()
    const type = searchParams.get('type') || 'order_number'

    if (!q || q.length < 3) {
      return NextResponse.json({ error: 'Ingresa al menos 3 caracteres' }, { status: 400 })
    }

    const supabase = (createAdminClient() || createPublicClient()) as any

    let query = supabase
      .from('web_orders')
      .select(`
        id, order_number, status, delivery_type,
        subtotal, tax_total, delivery_fee, discount_total, total,
        customer_name, customer_email,
        payment_status, payment_method,
        created_at,
        web_order_items (
          id, product_name, quantity, unit_price, total
        )
      `)
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (type === 'email') {
      query = query.ilike('customer_email', q)
    } else {
      query = query.ilike('order_number', `%${q}%`)
    }

    const { data: orders, error } = await query

    if (error) {
      console.error('Lookup error:', error)
      return NextResponse.json({ error: 'Error al buscar pedidos', detail: error.message }, { status: 500 })
    }

    // Sanitizar datos sensibles - solo mostrar info relevante
    const sanitized = (orders || []).map((o: any) => ({
      id: o.id,
      order_number: o.order_number,
      status: o.status,
      delivery_type: o.delivery_type,
      subtotal: o.subtotal,
      tax_total: o.tax_total,
      delivery_fee: o.delivery_fee,
      discount_total: o.discount_total,
      total: o.total,
      customer_name: o.customer_name,
      payment_status: o.payment_status,
      payment_method: o.payment_method,
      created_at: o.created_at,
      items: (o.web_order_items || []).map((item: any) => ({
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
      })),
    }))

    return NextResponse.json({ orders: sanitized })
  } catch (err: any) {
    console.error('Lookup catch:', err)
    return NextResponse.json({ error: 'Error interno', detail: err?.message }, { status: 500 })
  }
}
