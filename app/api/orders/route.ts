import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rateLimit'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { sendOrderConfirmationEmail } from '@/lib/email/send-order-confirmation'
import { evaluateCartPromotions } from '@/lib/promotions'
import { getDefaultTax } from '@/lib/supabase/queries'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { esSede, leerCartaSede, type CartaSede } from '@/lib/products/carta-sede'
import { construirFilasPedido, lineasCorreoPedido } from '@/lib/orders/lineas-pedido'
import {
  desfasesDePrecio,
  productIdDeLinea,
  resolverLineasPedido,
  subtotalDeLineas,
  type LineaCliente,
  type MotivoProblema,
} from '@/lib/products/precio-servidor'
import { leerDatosPrecio } from '@/lib/products/precio-servidor-lectura'
import { validarCupon } from '@/lib/coupons/validar-cupon'

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

/** Importe opcional del cliente (envío, propina): ausente = 0; negativo o ilegible = inválido. */
function importeNoNegativo(valor: unknown): number | null {
  if (valor === undefined || valor === null || valor === '') return 0
  const n = Number(valor)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** Motivos que significan «este producto no se puede pedir» (el resto: la línea está mal armada). */
const MOTIVOS_PRODUCTO: ReadonlySet<MotivoProblema> = new Set<MotivoProblema>([
  'no_disponible', 'inactivo', 'sin_precio', 'no_disponible_en_sede',
])

const redondear2 = (n: number): number => Math.round(n * 100) / 100

/**
 * POST /api/orders — crea un pedido web.
 *
 * Todo lo que es dinero se calcula aquí (lib/products/precio-servidor.ts):
 * - Precio de cada línea: `web_price` de la sede → precio vigente que muestra el sitio (o el del
 *   padre si la variante no tiene). Extras de modificadores: los de la base, validados contra el
 *   producto de la línea. El `price` y los `extraPrice` del cliente solo sirven para detectar
 *   que vio otro precio: en ese caso 409 PRECIOS_CAMBIARON con los precios nuevos.
 * - Subtotal, impuesto, promociones y cupón se recalculan sobre esos precios. El `subtotal`, el
 *   `total` y el `couponDiscount` del cliente se ignoran (solo se registra el desfase).
 * - Envío y propina siguen saliendo del cliente (pendiente: ver nota en el cálculo del total),
 *   pero ya no se aceptan negativos.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      organizationId, branchId, customer, customerId: authCustomerId, items: itemsCliente,
      subtotal, shipping, total, paymentMethod,
      deliveryType, deliveryAddress,
      tipAmount, isScheduled, scheduledAt, tableName,
      couponCode, couponId, couponDiscount,
      promoDiscount, promotionIds
    } = body

    // Límite de pedidos por IP y por correo (CLAUDE.md: /api/orders). Generoso por IP porque
    // en un restaurante muchos clientes piden en mesa desde la misma red; en memoria por
    // instancia: frena ráfagas, no reemplaza un limitador distribuido.
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'sin-ip'
    const correo = typeof customer?.email === 'string' ? customer.email.trim().toLowerCase() : ''
    const porIp = checkRateLimit(`orders:ip:${ip}`, 60, 10 * 60 * 1000)
    const porCorreo = correo ? checkRateLimit(`orders:email:${correo}`, 10, 10 * 60 * 1000) : { allowed: true }
    if (!porIp.allowed || !porCorreo.allowed) {
      console.warn('[Orders] Límite de pedidos alcanzado', { ip, porCorreo: !porCorreo.allowed })
      return NextResponse.json(
        { error: 'Recibimos demasiados pedidos seguidos. Espera unos minutos e inténtalo de nuevo.', code: 'DEMASIADOS_PEDIDOS' },
        { status: 429 }
      )
    }

    if (!organizationId || !customer || !Array.isArray(itemsCliente) || itemsCliente.length === 0) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }
    const items: LineaCliente[] = itemsCliente

    // ── Organización del contexto (host), nunca la del body ──
    // Si el host resuelve una organización y el body trae otra: 403 y se registra.
    // Si el host no resuelve (p. ej. localhost sin subdominio), se conserva el
    // comportamiento anterior: se usa la del body.
    const hostOrgId = await getOrgIdDelHost()
    if (hostOrgId !== null && Number(organizationId) !== hostOrgId) {
      console.warn('[Orders] organizationId del body distinto al del host', {
        hostOrgId, bodyOrgId: organizationId,
      })
      return NextResponse.json(
        { error: 'La organización del pedido no corresponde a este sitio' },
        { status: 403 }
      )
    }
    const contextOrgId: number = hostOrgId ?? Number(organizationId)
    if (!Number.isInteger(contextOrgId) || contextOrgId <= 0) {
      return NextResponse.json({ error: 'Organización inválida' }, { status: 400 })
    }

    // ── Envío y propina: importes del cliente, nunca negativos (restarían del total) ──
    const resolvedShipping = importeNoNegativo(shipping)
    const resolvedTip = importeNoNegativo(tipAmount)
    if (resolvedShipping === null || resolvedTip === null) {
      console.warn('[Orders] Envío o propina inválidos', { organizationId: contextOrgId, shipping, tipAmount })
      return NextResponse.json({ error: 'El valor del envío o de la propina no es válido' }, { status: 400 })
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
        .eq('organization_id', contextOrgId)
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
        .eq('organization_id', contextOrgId)
        .eq('is_active', true)
        .order('id', { ascending: true })

      const list = branches || []
      resolvedBranchId =
        list.find((b: any) => b.is_web_stock_source)?.id ??
        list.find((b: any) => b.is_main)?.id ??
        list[0]?.id
    }

    // ── B0: Productos, precios y modificadores del servidor ──
    // Falla cerrado: sin poder leer precios no se puede cobrar.
    const productIds: number[] = Array.from(new Set<number>(
      items.map(productIdDeLinea).filter((id) => !Number.isNaN(id))
    ))
    const lectura = await leerDatosPrecio(supabase, contextOrgId, productIds)
    if (!lectura.ok) {
      console.error('[Orders] No se pudieron leer los precios del carrito', {
        organizationId: contextOrgId, error: lectura.error,
      })
      return NextResponse.json(
        { error: 'No pudimos confirmar los precios de tu carrito. Intenta de nuevo en un momento.' },
        { status: 503 }
      )
    }

    // ── B0.1: Carta por sede (website_branch_products) ──
    // Solo con sede explícita y ya validada contra la organización (F5, arriba). `web_price` de la
    // sede manda sobre el precio vigente; oculto o agotado en la sede → 422.
    let carta: CartaSede | null = null
    if (esSede(branchId)) {
      const lecturaCarta = await leerCartaSede(supabase, contextOrgId, branchId, productIds)
      if (!lecturaCarta.ok) {
        // Sin carta legible se cobra el precio vigente del producto, igual que en cualquier sitio
        // sin carta: un fallo de lectura no puede tumbar los pedidos de los sitios que nunca la
        // configuraron. Si el cliente vio el precio de la sede, el 409 de abajo se lo muestra.
        console.error('[Orders] No se pudo leer la carta de la sede; se sigue sin carta', {
          organizationId: contextOrgId, branchId, error: lecturaCarta.error,
        })
      } else {
        carta = lecturaCarta.carta
      }
    } else {
      // Sin sede explícita: sin carta por sede, exactamente como antes.
    }

    const { lineas, problemas } = resolverLineasPedido(items, lectura.datos, {
      organizationId: contextOrgId,
      carta,
    })

    if (problemas.length > 0) {
      const soloProductos = problemas.every((p) => MOTIVOS_PRODUCTO.has(p.motivo))
      const lista = problemas.map((p) => `${p.nombre} (${p.detalle})`).join(', ')
      console.warn('[Orders] Carrito con líneas que no se pueden cobrar', {
        organizationId: contextOrgId, branchId, problemas,
      })
      return NextResponse.json(
        {
          error: soloProductos
            ? `Algunos productos de tu carrito no se pueden pedir: ${lista}. Quítalos del carrito para continuar.`
            : `Revisa tu carrito: ${lista}.`,
          code: soloProductos ? 'PRODUCTOS_NO_DISPONIBLES' : 'LINEAS_NO_VALIDAS',
          productIds: Array.from(new Set(problemas.map((p) => p.productId).filter((id): id is number => id !== null))),
          productos: problemas,
        },
        { status: 422 }
      )
    }

    // ── B0.2: El cliente vio otro precio → se le muestra antes de cobrar ──
    const desfases = desfasesDePrecio(lineas)
    if (desfases.length > 0) {
      console.warn('[Orders] Precio del cliente distinto al del servidor; se piden los precios nuevos', {
        organizationId: contextOrgId, branchId, desfases,
      })
      return NextResponse.json(
        {
          error: desfases.length === 1
            ? `El precio de ${desfases[0].nombre} cambió. Revisa tu carrito y confirma de nuevo.`
            : 'Algunos precios de tu carrito cambiaron. Revísalos y confirma de nuevo.',
          code: 'PRECIOS_CAMBIARON',
          lineas: desfases,
        },
        { status: 409 }
      )
    }

    // ── B1: Validación de stock (solo productos con track_stock=true) ──
    const trackStockMap = new Map<number, boolean>(
      lineas.map((l) => [l.productId, l.trackStock] as [number, boolean])
    )
    const trackableProductIds = productIds.filter((id: number) => trackStockMap.get(id) === true)

    // Cantidad solicitada por producto real (varias líneas del carrito pueden apuntar al mismo
    // producto con distintos modificadores).
    const requestedMap = new Map<number, number>()
    for (const l of lineas) {
      if (!l.trackStock) continue
      requestedMap.set(l.productId, (requestedMap.get(l.productId) || 0) + l.cantidad)
    }

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

      const outOfStock: string[] = []
      for (const [pid, requested] of requestedMap) {
        // Producto que rastrea inventario sin fila de stock = 0 disponible
        const available = stockMap.get(pid) ?? 0
        if (available < requested) {
          const linea = lineas.find((l) => l.productId === pid)
          outOfStock.push(`${linea?.nombre ?? `Producto ${pid}`} (disponible: ${Math.max(0, Math.floor(available))}, solicitado: ${requested})`)
        }
      }
      if (outOfStock.length > 0) {
        return NextResponse.json(
          { error: 'Stock insuficiente', details: outOfStock },
          { status: 409 }
        )
      }
    }

    // ── B2: Obtener impuesto default de la org (cacheado 300s) ──
    let taxRate = 0
    let taxName = 'IVA'
    const defaultTax = await getDefaultTax(contextOrgId)
    let taxIncluded = false
    if (defaultTax) {
      taxRate = Number(defaultTax.rate)
      taxName = defaultTax.name
      taxIncluded = defaultTax.taxIncluded === true
    }

    // ── Buscar o crear customer ──
    let customerId = authCustomerId || null
    if (!customerId) {
      const { data: existingCustomer } = await (supabase as any)
        .from('customers')
        .select('id')
        .eq('organization_id', contextOrgId)
        .eq('email', customer.email)
        .single()

      if (existingCustomer) {
        customerId = existingCustomer.id
      } else {
        const { data: newCustomer } = await (supabase as any)
          .from('customers')
          .insert({
            organization_id: contextOrgId,
            branch_id: Number.isFinite(branchId) ? branchId : null,
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

    // Subtotal e impuesto con precios del servidor
    const calculatedSubtotal = subtotalDeLineas(lineas)
    const taxTotal = taxRate > 0 ? Math.round(calculatedSubtotal * taxRate / 100) : 0

    // ── Cupón: misma regla que /api/coupons/validate, sobre el subtotal del servidor ──
    // Antes se cobraba el `couponDiscount` que mandaba el cliente.
    let resolvedCouponDiscount = 0
    let resolvedCoupon: { id: string; code: string } | null = null
    if (typeof couponCode === 'string' && couponCode.trim()) {
      const cupon = await validarCupon(supabase as any, {
        code: couponCode,
        organizationId: contextOrgId,
        subtotal: calculatedSubtotal,
        customerId,
      })
      if (!cupon.valid) {
        console.warn('[Orders] Cupón no válido al cobrar', { organizationId: contextOrgId, couponCode, motivo: cupon.error })
        return NextResponse.json(
          { error: `${cupon.error}. Quita el cupón para continuar.`, code: 'CUPON_NO_VALIDO' },
          { status: 409 }
        )
      }
      resolvedCoupon = { id: cupon.coupon.id, code: cupon.coupon.code }
      resolvedCouponDiscount = cupon.discount
      if (couponId && String(couponId) !== String(cupon.coupon.id)) {
        console.warn('[Orders] couponId del cliente distinto al del código', { organizationId: contextOrgId, couponId, servidor: cupon.coupon.id })
      }
    }
    const clientCouponDiscount = Number(couponDiscount) || 0
    if (clientCouponDiscount !== resolvedCouponDiscount) {
      console.warn('[Orders] Descuento de cupón distinto al del cliente', {
        organizationId: contextOrgId, cliente: clientCouponDiscount, servidor: resolvedCouponDiscount,
      })
    }

    // Promociones automáticas: se recalculan en servidor con el mismo motor que
    // usa /api/promotions/check (lib/promotions.ts), sobre los precios del servidor.
    // El `promoDiscount` que manda el cliente solo sirve para detectar desfases.
    const promoEval = await evaluateCartPromotions(supabase, {
      organizationId: contextOrgId,
      // Misma sucursal que vio el cliente en /api/promotions/check (outlet
      // explícito o ninguna); no el fallback de stock, para no aplicar aquí
      // promos por sucursal que el carrito nunca mostró.
      branchId: Number.isFinite(branchId) ? branchId : null,
      items: lineas.map((l) => ({
        id: l.productId, productId: l.productId, name: l.nombre, price: l.precioUnitario, quantity: l.cantidad,
      })),
    })
    const resolvedPromoDiscount = promoEval.totalDiscount
    const clientPromoDiscount = Number(promoDiscount) || 0
    if (clientPromoDiscount !== resolvedPromoDiscount) {
      console.warn('[Orders] Descuento de promociones distinto al del cliente', {
        organizationId: contextOrgId, cliente: clientPromoDiscount, servidor: resolvedPromoDiscount,
        promotionIdsCliente: promotionIds, promotionIdsServidor: promoEval.promotions.map(p => p.id),
      })
    }
    const totalDiscountAmount = resolvedCouponDiscount + resolvedPromoDiscount
    // Si el impuesto está incluido en el precio, no sumarlo al total
    const taxForTotal = taxIncluded ? 0 : taxTotal
    // PENDIENTE (envío): el costo sigue viniendo del cliente. El checkout elige la tarifa de
    // /api/shipping/calculate o la tarifa plana de los ajustes del sitio, pero no envía el id de
    // la tarifa, así que el servidor no puede recalcularlo sin cambiar el contrato del checkout
    // de los 83 sitios. Aquí solo se impide que sea negativo (arriba).
    const calculatedTotal = redondear2(calculatedSubtotal + taxForTotal + resolvedShipping + resolvedTip - totalDiscountAmount)

    // El subtotal/total del cliente no se usan: solo se registra si no coinciden.
    const clientSubtotal = Number(subtotal)
    const clientTotal = Number(total)
    if (
      (Number.isFinite(clientSubtotal) && Math.abs(clientSubtotal - calculatedSubtotal) > 0.5) ||
      (Number.isFinite(clientTotal) && Math.abs(clientTotal - calculatedTotal) > 0.5)
    ) {
      console.warn('[Orders] Subtotal/total del cliente distinto al del servidor (se cobra el del servidor)', {
        organizationId: contextOrgId,
        cliente: { subtotal, total },
        servidor: { subtotal: calculatedSubtotal, total: calculatedTotal },
      })
    }

    // Generar order_number (será la referencia para Wompi)
    const orderNumber = generateOrderNumber(contextOrgId)

    // Crear web_order
    const { data: webOrder, error: orderError } = await (supabase as any)
      .from('web_orders')
      .insert({
        organization_id: contextOrgId,
        branch_id: resolvedBranchId,
        customer_id: customerId,
        order_number: orderNumber,
        status: 'pending',
        source: 'website',
        subtotal: calculatedSubtotal,
        tax_total: taxTotal,
        delivery_fee: resolvedShipping,
        total: calculatedTotal,
        delivery_type: deliveryType === 'delivery' ? 'delivery_own' : (deliveryType || (resolvedShipping > 0 ? 'delivery_own' : 'pickup')),
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
        ...(resolvedCoupon && { coupon_code: resolvedCoupon.code }),
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
      // Crear web_order_items con el precio unitario real (base + extras, una sola vez)
      const orderItems = construirFilasPedido(lineas, webOrder.id, taxRate)

      await (supabase as any)
        .from('web_order_items')
        .insert(orderItems)

      // Registrar propina en tabla tips
      if (resolvedTip > 0) {
        await (supabase as any)
          .from('tips')
          .insert({
            organization_id: contextOrgId,
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
      if (resolvedBranchId && requestedMap.size > 0) {
        const rpcItems = Array.from(requestedMap.entries()).map(([pid, qty]) => ({
          product_id: pid,
          quantity: qty,
        }))

        const { data: reserveResult, error: reserveError } = await (supabase as any)
          .rpc('reserve_stock_for_web_order', {
            p_organization_id: contextOrgId,
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

      // Registrar redención de cupón. El trigger `trg_coupon_redemption_increment`
      // de `coupon_redemptions` ya suma 1 a `coupons.usage_count`; aquí NO se
      // incrementa a mano (hacerlo contaba cada cupón dos veces y agotaba el
      // `usage_limit` a la mitad). El cupón es el que validó el servidor, no el
      // `couponId` del cliente.
      if (resolvedCoupon && resolvedCouponDiscount > 0) {
        const { error: redemptionError } = await (supabase as any)
          .from('coupon_redemptions')
          .insert({
            coupon_id: resolvedCoupon.id,
            sale_id: webOrder.id,
            customer_id: customerId,
            discount_applied: resolvedCouponDiscount,
          })
        if (redemptionError) console.error('[Orders] Coupon redemption error:', redemptionError)
      }

      // Registrar uso de promociones automáticas (las que aplicó el servidor).
      // Sin esto el descuento llegaba al ERP pero "Usos" seguía en 0 en el POS
      // y no había forma de saber de dónde salía el descuento del pedido.
      // La RPC `increment_promotion_usage` (migración 20260911020000 del ERP)
      // hace un solo UPDATE `usage_count + 1`: atómico, dos pedidos
      // simultáneos cuentan 2. Solo toca promociones de esta organización.
      if (resolvedPromoDiscount > 0 && promoEval.promotions.length > 0) {
        const { error: promoUsageError } = await (supabase as any).rpc('increment_promotion_usage', {
          p_organization_id: contextOrgId,
          p_promotion_ids: promoEval.promotions.map(p => p.id),
        })
        if (promoUsageError) console.error('[Orders] Promotion usage error:', promoUsageError)
      }

      // Enviar email de confirmación (fire-and-forget)
      const origin = request.headers.get('origin') || request.headers.get('referer')?.replace(/\/[^/]*$/, '') || ''
      sendOrderConfirmationEmail({
        orderNumber: webOrder.order_number,
        customerEmail: customer.email,
        customerName: `${customer.firstName} ${customer.lastName || ''}`.trim(),
        items: lineasCorreoPedido(lineas),
        subtotal: calculatedSubtotal,
        tax: taxTotal,
        shipping: resolvedShipping,
        discount: totalDiscountAmount,
        promotions: promoEval.promotions.map(p => ({ name: p.name, discount: p.discount })),
        ...(resolvedCoupon && resolvedCouponDiscount > 0 ? { couponCode: resolvedCoupon.code, couponDiscount: resolvedCouponDiscount } : {}),
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
