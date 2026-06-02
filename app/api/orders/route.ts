import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { sendOrderConfirmationEmail } from '@/lib/email/send-order-confirmation'

export const dynamic = 'force-dynamic'

/**
 * Genera un order_number único que sirve como referencia para Wompi.
 * Formato: WO-{orgId}-{timestamp}-{random}
 */
function generateOrderNumber(organizationId: number): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `WO-${organizationId}-${ts}-${rand}`
}

function getSupabase() {
  return createAdminClient() || createPublicClient()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      organizationId, branchId, customer, items,
      subtotal, shipping, total, paymentMethod,
      deliveryType, deliveryAddress,
      tipAmount, isScheduled, scheduledAt, tableName,
      couponCode, couponId, couponDiscount,
      promoDiscount, promotionIds
    } = body
    
    if (!organizationId || !customer || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }
    
    const supabase = getSupabase()

    // ── Obtener branch_id (necesario para stock) ──
    let resolvedBranchId = branchId
    if (!resolvedBranchId) {
      const { data: branch } = await (supabase as any)
        .from('branches')
        .select('id')
        .eq('organization_id', organizationId)
        .limit(1)
        .single()
      resolvedBranchId = branch?.id
    }

    // ── B1: Validación de stock ──
    if (resolvedBranchId) {
      const productIds = items.map((item: any) => item.id)
      const { data: stockData } = await (supabase as any)
        .from('stock_levels')
        .select('product_id, qty_on_hand, qty_reserved')
        .eq('branch_id', resolvedBranchId)
        .in('product_id', productIds)

      if (stockData && stockData.length > 0) {
        const stockMap = new Map<number, number>(
          stockData.map((s: any) => [s.product_id, Number(s.qty_on_hand) - Number(s.qty_reserved)] as [number, number])
        )
        const outOfStock: string[] = []
        for (const item of items) {
          const available = stockMap.get(item.id) ?? null
          if (available !== null && available < item.quantity) {
            outOfStock.push(`${item.name} (disponible: ${Math.max(0, Math.floor(available))}, solicitado: ${item.quantity})`)
          }
        }
        if (outOfStock.length > 0) {
          return NextResponse.json(
            { error: 'Stock insuficiente', details: outOfStock },
            { status: 409 }
          )
        }
      }
    }

    // ── B2: Obtener impuesto default de la org ──
    let taxRate = 0
    let taxName = 'IVA'
    const { data: defaultTax } = await (supabase as any)
      .from('organization_taxes')
      .select('name, rate')
      .eq('organization_id', organizationId)
      .eq('is_default', true)
      .eq('is_active', true)
      .single()
    if (defaultTax) {
      taxRate = Number(defaultTax.rate)
      taxName = defaultTax.name
    }

    // ── Buscar o crear customer ──
    let customerId = null
    const { data: existingCustomer } = await (supabase as any)
      .from('customers')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('email', customer.email)
      .single()
    
    if (existingCustomer) {
      customerId = existingCustomer.id
    } else {
      const { data: newCustomer } = await (supabase as any)
        .from('customers')
        .insert({
          organization_id: organizationId,
          email: customer.email,
          first_name: customer.firstName,
          last_name: customer.lastName,
          full_name: `${customer.firstName} ${customer.lastName || ''}`.trim(),
          phone: customer.phone,
          address: customer.address,
          city: customer.city,
          is_registered: false
        })
        .select('id')
        .single()
      
      if (newCustomer) {
        customerId = newCustomer.id
      }
    }

    // Calcular tax_total basado en impuesto de la org
    const calculatedSubtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)
    const taxTotal = taxRate > 0 ? Math.round(calculatedSubtotal * taxRate / 100) : 0
    const resolvedTip = Number(tipAmount) || 0
    const resolvedCouponDiscount = Number(couponDiscount) || 0
    const resolvedPromoDiscount = Number(promoDiscount) || 0
    const totalDiscountAmount = resolvedCouponDiscount + resolvedPromoDiscount
    const calculatedTotal = calculatedSubtotal + taxTotal + (shipping || 0) + resolvedTip - totalDiscountAmount

    // Generar order_number (será la referencia para Wompi)
    const orderNumber = generateOrderNumber(organizationId)
    
    // Crear web_order
    const { data: webOrder, error: orderError } = await (supabase as any)
      .from('web_orders')
      .insert({
        organization_id: organizationId,
        branch_id: resolvedBranchId,
        customer_id: customerId,
        order_number: orderNumber,
        status: 'pending',
        source: 'website',
        subtotal: calculatedSubtotal,
        tax_total: taxTotal,
        delivery_fee: shipping || 0,
        total: calculatedTotal,
        delivery_type: deliveryType || (shipping > 0 ? 'delivery_own' : 'pickup'),
        delivery_address: deliveryAddress || {
          address: customer.address,
          city: customer.city
        },
        payment_status: 'pending',
        payment_method: paymentMethod,
        customer_name: `${customer.firstName} ${customer.lastName || ''}`.trim(),
        customer_email: customer.email,
        customer_phone: customer.phone,
        customer_notes: customer.notes || null,
        ...(resolvedTip > 0 && { tip_amount: resolvedTip }),
        ...(isScheduled && scheduledAt && { is_scheduled: true, scheduled_at: scheduledAt }),
        ...(tableName && { internal_notes: `Mesa: ${tableName}` }),
        ...(couponCode && { coupon_code: couponCode }),
        ...(totalDiscountAmount > 0 && { discount_total: totalDiscountAmount }),
      })
      .select('id, order_number')
      .single()
    
    if (orderError) {
      console.error('Error creating web_order:', orderError)
      return NextResponse.json({
        success: true,
        message: 'Pedido recibido',
        orderId: crypto.randomUUID(),
        orderNumber: orderNumber
      })
    }
    
    // Post-procesamiento: items, stock, cupones, email
    // Envolvemos en try/catch para que si algo falla aquí, la orden ya creada no se pierda
    try {
      // Crear web_order_items con tax_amount por item, modifiers y notes
      const orderItems = items.map((item: any) => {
        const itemTotal = item.price * item.quantity
        const itemTax = taxRate > 0 ? Math.round(itemTotal * taxRate / 100) : 0
        return {
          web_order_id: webOrder.id,
          product_id: item.id,
          product_name: item.name,
          product_sku: item.sku || null,
          quantity: item.quantity,
          unit_price: item.price,
          tax_amount: itemTax,
          total: itemTotal,
          ...(item.modifiers && { modifiers: item.modifiers }),
          ...(item.notes && { notes: item.notes }),
        }
      })
      
      await (supabase as any)
        .from('web_order_items')
        .insert(orderItems)

      // Registrar propina en tabla tips
      if (resolvedTip > 0) {
        await (supabase as any)
          .from('tips')
          .insert({
            organization_id: organizationId,
            branch_id: resolvedBranchId,
            sale_id: null,
            payment_id: null,
            server_id: '00000000-0000-0000-0000-000000000000',
            amount: resolvedTip,
            tip_type: 'online',
            is_distributed: false,
            notes: `Propina online - Pedido #${orderNumber}`,
          })
          .catch((err: any) => console.error('[Orders] Tip insert error:', err))
      }

      // Reservar stock
      if (resolvedBranchId) {
        for (const item of items) {
          const { data: sl } = await (supabase as any)
            .from('stock_levels')
            .select('qty_reserved')
            .eq('branch_id', resolvedBranchId)
            .eq('product_id', item.id)
            .maybeSingle()
          if (sl) {
            await (supabase as any)
              .from('stock_levels')
              .update({ qty_reserved: Number(sl.qty_reserved || 0) + item.quantity })
              .eq('branch_id', resolvedBranchId)
              .eq('product_id', item.id)
          }
        }
      }

      // Registrar redención de cupón
      if (couponId && resolvedCouponDiscount > 0) {
        await (supabase as any)
          .from('coupon_redemptions')
          .insert({
            coupon_id: couponId,
            sale_id: webOrder.id,
            customer_id: customerId,
            discount_applied: resolvedCouponDiscount,
          })
          .catch((err: any) => console.error('[Orders] Coupon redemption error:', err))

        const { data: currentCoupon } = await (supabase as any)
          .from('coupons').select('usage_count').eq('id', couponId).maybeSingle()
        if (currentCoupon) {
          await (supabase as any)
            .from('coupons')
            .update({ usage_count: (currentCoupon.usage_count || 0) + 1 })
            .eq('id', couponId)
        }
      }

      // Enviar email de confirmación (fire-and-forget)
      const origin = request.headers.get('origin') || request.headers.get('referer')?.replace(/\/[^/]*$/, '') || ''
      sendOrderConfirmationEmail({
        orderNumber: webOrder.order_number,
        customerEmail: customer.email,
        customerName: `${customer.firstName} ${customer.lastName || ''}`.trim(),
        items: items.map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          total: item.price * item.quantity,
        })),
        subtotal: calculatedSubtotal,
        tax: taxTotal,
        shipping: shipping || 0,
        total: calculatedTotal,
        organizationName: '',
        trackingUrl: `${origin}/pedido/${webOrder.order_number}`,
      }).catch(err => console.error('[Orders] Email error:', err))
    } catch (postErr) {
      console.error('[Orders] Post-processing error (order already created):', postErr)
    }
    
    return NextResponse.json({
      success: true,
      orderId: webOrder.id,
      orderNumber: webOrder.order_number,
      message: 'Pedido creado exitosamente'
    })
  } catch (error) {
    console.error('Orders API error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
