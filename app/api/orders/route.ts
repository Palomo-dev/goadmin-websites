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
      organizationId, branchId, customer, customerId: authCustomerId, items,
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

    // ── F5: Validar branchId pertenece a la organización ──
    // Si el cliente envía un branchId numérico (outlet), verificar que la
    // sucursal existe y pertenece a la organización antes de usarlo.
    if (Number.isFinite(branchId)) {
      const { data: validBranch } = await (supabase as any)
        .from('branches')
        .select('id')
        .eq('id', branchId)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (!validBranch) {
        return NextResponse.json(
          { error: 'branch_id no pertenece a la organización' },
          { status: 400 }
        )
      }
    }

    // ── Obtener branch_id (necesario para stock) ──
    // Prioridad: sucursal marcada como fuente de inventario web > principal > primera.
    // F5: Si branchId es numérico y válido, se usa explícitamente sin fallback.
    let resolvedBranchId = branchId
    if (!Number.isFinite(resolvedBranchId)) {
      const { data: branches } = await (supabase as any)
        .from('branches')
        .select('id, is_main, is_web_stock_source')
        .eq('organization_id', organizationId)
        .eq('status', 'active')
        .order('id', { ascending: true })

      const list = branches || []
      resolvedBranchId =
        list.find((b: any) => b.is_web_stock_source)?.id ??
        list.find((b: any) => b.is_main)?.id ??
        list[0]?.id
    }

    // El id del carrito puede ser compuesto (`123_4-5`) cuando hay modificadores;
    // el id real del producto viene en `productId`.
    const realProductId = (item: any): number => Number(item.productId ?? item.id)

    // ── B1: Validación de stock (solo productos con track_stock=true) ──
    const productIds: number[] = Array.from(new Set<number>(items.map(realProductId)))
    const { data: productsData } = await (supabase as any)
      .from('products')
      .select('id, track_stock')
      .in('id', productIds)
    const trackStockMap = new Map<number, boolean>(
      (productsData || []).map((p: any) => [p.id, p.track_stock === true] as [number, boolean])
    )
    const trackableProductIds = productIds.filter((id: number) => trackStockMap.get(id) === true)

    if (resolvedBranchId && trackableProductIds.length > 0) {
      const { data: stockData } = await (supabase as any)
        .from('stock_levels')
        .select('product_id, qty_on_hand, qty_reserved')
        .eq('branch_id', resolvedBranchId)
        .in('product_id', trackableProductIds)

      // Acumular por producto: un producto puede tener varias filas (lotes)
      const stockMap = new Map<number, number>()
      for (const s of stockData || []) {
        const available = Number(s.qty_on_hand) - Number(s.qty_reserved)
        stockMap.set(s.product_id, (stockMap.get(s.product_id) || 0) + available)
      }

      // Acumular cantidad solicitada por producto real (varias líneas del carrito
      // pueden apuntar al mismo producto con distintos modificadores)
      const requestedMap = new Map<number, number>()
      for (const item of items) {
        const pid = realProductId(item)
        if (trackStockMap.get(pid) !== true) continue
        requestedMap.set(pid, (requestedMap.get(pid) || 0) + Number(item.quantity))
      }

      const outOfStock: string[] = []
      for (const [pid, requested] of requestedMap) {
        // Producto que rastrea inventario sin fila de stock = 0 disponible
        const available = stockMap.get(pid) ?? 0
        if (available < requested) {
          const item = items.find((i: any) => realProductId(i) === pid)
          outOfStock.push(`${item?.name ?? `Producto ${pid}`} (disponible: ${Math.max(0, Math.floor(available))}, solicitado: ${requested})`)
        }
      }
      if (outOfStock.length > 0) {
        return NextResponse.json(
          { error: 'Stock insuficiente', details: outOfStock },
          { status: 409 }
        )
      }
    }

    // ── B2: Obtener impuesto default de la org ──
    let taxRate = 0
    let taxName = 'IVA'
    const { data: defaultTax } = await (supabase as any)
      .from('organization_taxes')
      .select('name, rate, tax_included')
      .eq('organization_id', organizationId)
      .eq('is_default', true)
      .eq('is_active', true)
      .single()
    let taxIncluded = false
    if (defaultTax) {
      taxRate = Number(defaultTax.rate)
      taxName = defaultTax.name
      taxIncluded = defaultTax.tax_included === true
    }

    // ── Buscar o crear customer ──
    let customerId = authCustomerId || null
    if (!customerId) {
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
            // full_name es GENERATED ALWAYS AS (CASE ...), no se puede insertar.
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
    }

    // ── Auto-guardar dirección como principal si no tiene ninguna ──
    if (customerId && customer.address) {
      const { data: existingAddresses } = await (supabase as any)
        .from('customer_addresses')
        .select('id')
        .eq('customer_id', customerId)
        .limit(1)

      if (!existingAddresses || existingAddresses.length === 0) {
        await (supabase as any)
          .from('customer_addresses')
          .insert({
            customer_id: customerId,
            label: 'Principal',
            address_line1: customer.address,
            city: customer.city || null,
            country_code: customer.countryCode || null,
            department: customer.department || null,
            is_default: true,
            is_active: true,
          })
        // Actualizar dirección en el customer también
        await (supabase as any)
          .from('customers')
          .update({ address: customer.address, city: customer.city || null })
          .eq('id', customerId)
      }
    }

    // Calcular tax_total basado en impuesto de la org
    const calculatedSubtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)
    const taxTotal = taxRate > 0 ? Math.round(calculatedSubtotal * taxRate / 100) : 0
    const resolvedTip = Number(tipAmount) || 0
    const resolvedCouponDiscount = Number(couponDiscount) || 0
    const resolvedPromoDiscount = Number(promoDiscount) || 0
    const totalDiscountAmount = resolvedCouponDiscount + resolvedPromoDiscount
    // Si el impuesto está incluido en el precio, no sumarlo al total
    const taxForTotal = taxIncluded ? 0 : taxTotal
    const calculatedTotal = calculatedSubtotal + taxForTotal + (shipping || 0) + resolvedTip - totalDiscountAmount

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
        delivery_type: deliveryType === 'delivery' ? 'delivery_own' : (deliveryType || (shipping > 0 ? 'delivery_own' : 'pickup')),
        delivery_address: deliveryAddress || {
          address: customer.address,
          city: customer.city,
          ...(customer.countryCode && { country: customer.countryCode }),
          ...(customer.stateName && { state: customer.stateName, department: customer.department || customer.stateName }),
          ...(customer.stateCode && { state_code: customer.stateCode }),
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
      return NextResponse.json(
        { error: `Error al crear el pedido: ${orderError.message || orderError.code || JSON.stringify(orderError)}` },
        { status: 500 }
      )
    }
    
    // Post-procesamiento: items, stock, cupones, email
    // Envolvemos en try/catch para que si algo falla aquí, la orden ya creada no se pierda
    try {
      // Crear web_order_items con tax_amount por item, modifiers y notes
      const orderItems = items.map((item: any) => {
        const newModsExtraTotal = (item.newModifiers || []).reduce(
          (sum: number, m: any) => sum + (Number(m.extraPrice) || 0), 0
        )
        const effectiveUnitPrice = Number(item.price) + newModsExtraTotal
        const itemTotal = effectiveUnitPrice * item.quantity
        const itemTax = taxRate > 0 ? Math.round(itemTotal * taxRate / 100) : 0
        const allModifiers = [
          ...(item.modifiers || []),
          ...(item.newModifiers || []),
        ]
        return {
          web_order_id: webOrder.id,
          product_id: realProductId(item),
          product_name: item.name,
          product_sku: item.sku || null,
          quantity: item.quantity,
          unit_price: effectiveUnitPrice,
          tax_amount: itemTax,
          total: itemTotal,
          ...(allModifiers.length > 0 && { modifiers: allModifiers }),
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

      // Reservar stock atómicamente via RPC (FOR UPDATE evita overselling)
      // Solo productos con track_stock=true
      if (resolvedBranchId) {
        // Acumular cantidad por producto (varias líneas del carrito pueden
        // apuntar al mismo producto con distintos modificadores)
        const reserveMap = new Map<number, number>()
        for (const item of items) {
          const pid = realProductId(item)
          if (trackStockMap.get(pid) !== true) continue
          reserveMap.set(pid, (reserveMap.get(pid) || 0) + Number(item.quantity))
        }

        if (reserveMap.size > 0) {
          const rpcItems = Array.from(reserveMap.entries()).map(([pid, qty]) => ({
            product_id: pid,
            quantity: qty,
          }))

          const { data: reserveResult, error: reserveError } = await (supabase as any)
            .rpc('reserve_stock_for_web_order', {
              p_organization_id: organizationId,
              p_branch_id: resolvedBranchId,
              p_order_id: webOrder.id,
              p_items: rpcItems,
            })

          if (reserveError || !reserveResult?.ok) {
            // La reserva atómica falló: cancelar la orden y devolver 409
            console.error('[Orders] Reserva atómica falló:', reserveError || reserveResult?.shortages)
            await (supabase as any)
              .from('web_orders')
              .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                cancellation_reason: 'Stock insuficiente al reservar',
              })
              .eq('id', webOrder.id)

            const shortages = reserveResult?.shortages || []
            const outOfStock = shortages.map((s: any) =>
              `Producto ${s.product_id} (disponible: ${Math.max(0, Math.floor(s.available))}, solicitado: ${s.requested})`
            )
            return NextResponse.json(
              { error: 'Stock insuficiente', details: outOfStock },
              { status: 409 }
            )
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
