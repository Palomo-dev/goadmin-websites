import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rateLimit'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { sendOrderConfirmationEmail } from '@/lib/email/send-order-confirmation'
import { evaluateCartPromotions } from '@/lib/promotions'
import { getDefaultTax } from '@/lib/supabase/queries'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { esSede, leerCartaSede, resolverSedeCarta, type CartaSede } from '@/lib/products/carta-sede'
import { construirFilasPedido, lineasCorreoPedido } from '@/lib/orders/lineas-pedido'
import { calcularImpuestoPedido } from '@/lib/orders/impuestoPedido'
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
import { buscarOCrearCliente, cancelarPedidoWeb, guardarDireccionPrincipal, leerContextoPedido, tipoEntregaCliente } from '@/lib/orders/pedidoWeb'
import { evaluarDisponibilidadPedido } from '@/lib/orders/disponibilidadPedido'
import { hoyEnZona, parseHorario } from '@/lib/restaurant/horario'
import { resolverEnvio } from '@/lib/shipping/resolveShipping'
import { esDomicilio, etiquetaTipoEntrega } from '@/lib/orders/estados-pedido'
import { rutaSeguimiento, tokenSeguimiento } from '@/lib/orders/tokenSeguimiento'
import { momentoPedido } from '@/lib/restaurant/ventanaPedido'
import { buscarMesaDeOrganizacion, notaMesa, type MesaPedido } from '@/lib/orders/mesaPedido'

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

/** Pasarelas cuyo webhook envía el correo al pasar el pago a `paid` (app/api/webhooks/wompi_co). */
const PASARELAS_CON_CORREO_AL_PAGAR: ReadonlySet<string> = new Set(['wompi', 'wompi_co'])

/** Interruptor de despliegue: cobrar el envío calculado en el servidor (por defecto, solo observar). */
const ENVIO_SERVIDOR_OBLIGATORIO = process.env.ORDERS_ENFORCE_SERVER_SHIPPING === 'true'

/**
 * El insert con `dine_in` falló porque la base aún no tiene la migración E1: CHECK de
 * `delivery_type` (23514) o columna `restaurant_table_id` inexistente (PGRST204 / 42703).
 */
function rechazaComerAqui(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const msg = String(error.message || '')
  if (error.code === '23514') return msg.includes('delivery_type')
  return (error.code === 'PGRST204' || error.code === '42703') && msg.includes('restaurant_table_id')
}

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
 * - Envío: lo decide el servidor con lib/shipping/resolveShipping.ts (tarifa elegida o tarifa
 *   plana); se cobra cuando ORDERS_ENFORCE_SERVER_SHIPPING=true, si no solo se registra el desfase.
 *   Propina: sale del cliente, nunca negativa.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      organizationId, branchId, customer, customerId: authCustomerId, items: itemsCliente,
      subtotal, shipping, total, paymentMethod,
      deliveryType, deliveryAddress,
      tipAmount, isScheduled, scheduledAt, tableName, tableRef, shippingRateId,
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
    let resolvedShipping = importeNoNegativo(shipping)
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

    const sedeExplicita: number | null = Number.isFinite(branchId) ? Number(branchId) : null

    // ── Comer aquí: la mesa se valida en el servidor (lib/orders/mesaPedido.ts) ──
    // Solo con deliveryType 'dine_in'. La referencia (uuid que guardó useMesaQR, o el nombre de
    // un QR antiguo en `tableName`) debe ser una mesa de esta organización y de la sede de la
    // carta; si no, 400 MESA_INVALIDA. La sede del pedido pasa a ser la de la mesa. Cualquier otro
    // tipo ignora la mesa: un QR viejo ya no convierte un domicilio en «comer aquí».
    let mesaPedido: MesaPedido | null = null
    if (deliveryType === 'dine_in') {
      const ref = tableRef ?? tableName
      if (!ref) {
        return NextResponse.json(
          { error: 'Indica tu mesa para pedir «Comer aquí».', code: 'MESA_REQUERIDA' },
          { status: 400 }
        )
      }
      const sedeCarta = await resolverSedeCarta(contextOrgId, sedeExplicita)
      const resultadoMesa = await buscarMesaDeOrganizacion(supabase as any, contextOrgId, ref, sedeCarta)
      if (!resultadoMesa.ok) {
        console.warn('[Orders] Mesa no válida', { organizationId: contextOrgId, sedeCarta, motivo: resultadoMesa.motivo })
        return NextResponse.json(
          {
            error: resultadoMesa.motivo === 'otra_sede'
              ? 'Esa mesa es de otra sede. Escanea el QR de tu mesa o elige otra forma de entrega.'
              : 'No encontramos esa mesa. Escanea de nuevo el QR de tu mesa o elige otra forma de entrega.',
            code: 'MESA_INVALIDA',
          },
          { status: resultadoMesa.motivo === 'error' ? 503 : 400 }
        )
      }
      mesaPedido = resultadoMesa.mesa
      resolvedBranchId = mesaPedido.branch_id
      // En la mesa no hay envío, diga lo que diga el cliente.
      resolvedShipping = 0
    } else {
      // Domicilio o recoger: sin mesa, exactamente como antes.
    }

    // ── Contexto del pedido: organización, ajustes de venta y sede (filtrados por la org del host) ──
    const contexto = await leerContextoPedido(
      supabase as any, contextOrgId, Number.isFinite(resolvedBranchId) ? Number(resolvedBranchId) : null, sedeExplicita,
    )

    // ── Disponibilidad: pedido en línea apagado (403) y horario de la sede (422) ──
    // Solo restaurante (lib/orders/disponibilidadPedido.ts): «lo antes posible» con la sede cerrada
    // → 422 SEDE_CERRADA con la próxima apertura; hora programada ilegible, pasada, fuera del
    // horario de la sede (en su zona) o a más de 2 días → 422 HORA_PROGRAMADA_INVALIDA. Sin fila de
    // ajustes, sede sin horario u otras verticales: se acepta exactamente como antes.
    const disponibilidad = evaluarDisponibilidadPedido({
      esRestaurante: contexto.esRestaurante,
      pedidoEnLinea: contexto.ajustes?.pedidoEnLinea ?? null,
      // En la mesa el cliente ya está en el local: no se le pide programar aunque el horario guardado
      // diga otra cosa (los horarios por defecto del ERP no siempre son los reales).
      horario: mesaPedido ? null : parseHorario(contexto.horarioSede),
      zona: contexto.zona,
      programadoPara: isScheduled && scheduledAt ? String(scheduledAt) : null,
    })
    if (!disponibilidad.ok) {
      console.warn('[Orders] Pedido rechazado por disponibilidad', {
        organizationId: contextOrgId, branchId: resolvedBranchId, code: disponibilidad.code,
      })
      return NextResponse.json(
        { error: disponibilidad.error, code: disponibilidad.code, proximaApertura: disponibilidad.proximaApertura },
        { status: disponibilidad.status }
      )
    } else {
      // Disponible: sigue el flujo de siempre.
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

    // ── Cliente: el de la sesión, nunca el `customerId` del body ──
    // getAuthCustomer filtra por la organización del host y el user_id de la cookie de sesión. El
    // id del body solo se compara para registrar un desfase (sin datos personales).
    const authCustomer = await getAuthCustomer(contextOrgId)
    if (authCustomerId && String(authCustomerId) !== String(authCustomer?.id ?? '')) {
      console.warn('[Orders] customerId del body distinto al de la sesión; se ignora', {
        organizationId: contextOrgId, conSesion: !!authCustomer,
      })
    }
    let customerId: string | null = authCustomer?.id ?? null
    if (!customerId) {
      // Invitado: búsqueda o alta por correo, como antes.
      customerId = await buscarOCrearCliente(supabase as any, contextOrgId, Number.isFinite(branchId) ? branchId : null, customer)
    } else {
      // Con sesión: el pedido queda ligado a su ficha.
    }

    // ── Auto-guardar dirección como principal si no tiene ninguna ──
    if (customerId && customer.address) {
      await guardarDireccionPrincipal(supabase as any, contextOrgId, customerId, customer)
    }

    // Subtotal e impuesto con precios del servidor
    const calculatedSubtotal = subtotalDeLineas(lineas)

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
    // Impuesto sobre la base con descuento (cupón + promociones prorrateados por línea), con la
    // regla del POS (lib/orders/impuestoPedido.ts). Antes iba sobre el subtotal bruto. Si el
    // impuesto está incluido en el precio, no se suma al total.
    const impuesto = calcularImpuestoPedido({
      brutos: lineas.map((l) => redondear2(l.precioUnitario * l.cantidad)),
      descuento: totalDiscountAmount,
      tasa: taxRate,
      incluido: taxIncluded,
    })
    const taxTotal = impuesto.total
    const taxForTotal = impuesto.sumaAlTotal
    // ── Envío: decidido en el servidor (lib/shipping/resolveShipping.ts) ──
    // Misma función que /api/shipping/calculate: la tarifa que eligió el checkout
    // (`shippingRateId`, de esta organización, vigente y aplicable a la ciudad) o la tarifa plana de
    // los ajustes, sobre el subtotal del servidor. Detrás de ORDERS_ENFORCE_SERVER_SHIPPING (igual
    // que la firma de Wompi): en `false` solo se registra la diferencia y se cobra el envío del
    // cliente; en `true` se cobra el del servidor. Si el servidor no puede decidir (tarifa ajena o
    // sin ajustes), se cobra el del cliente como siempre.
    const tipoGuardado = mesaPedido ? 'dine_in' : tipoEntregaCliente(deliveryType, resolvedShipping)
    if (!mesaPedido) {
      const envioServidor = await resolverEnvio(supabase as any, {
        organizationId: contextOrgId,
        esDomicilio: esDomicilio(tipoGuardado),
        tarifaId: typeof shippingRateId === 'string' && shippingRateId ? shippingRateId : null,
        ciudad: String(deliveryAddress?.city ?? customer.city ?? ''),
        subtotal: calculatedSubtotal,
        ajustes: contexto.ajustes,
        hoy: hoyEnZona(contexto.zona),
      })
      if (envioServidor && Math.abs(envioServidor.costo - resolvedShipping) > 0.5) {
        console.warn('[Orders] Envío del cliente distinto al del servidor', {
          organizationId: contextOrgId, cliente: resolvedShipping, servidor: envioServidor.costo,
          fuente: envioServidor.fuente, aplicado: ENVIO_SERVIDOR_OBLIGATORIO ? 'servidor' : 'cliente',
        })
      }
      if (ENVIO_SERVIDOR_OBLIGATORIO && envioServidor) {
        resolvedShipping = envioServidor.costo
      } else {
        // Observación (o sin decisión del servidor): se cobra el envío del cliente, como antes.
      }
    } else {
      // Comer aquí: sin envío (ya puesto en 0 al validar la mesa).
    }
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
    const filaPedido: Record<string, unknown> = {
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
        // Comer aquí: `dine_in` real con la mesa (migración E1 del ERP). Si la base aún no lo admite,
        // se reintenta abajo con el mapeo temporal a `pickup`.
        delivery_type: tipoGuardado,
        ...(mesaPedido && { restaurant_table_id: mesaPedido.id }),
        delivery_address: mesaPedido ? {} : deliveryAddress || {
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
        // Hora programada ya validada y normalizada a ISO (UTC) por evaluarDisponibilidadPedido.
        ...(isScheduled && disponibilidad.programadoPara && { is_scheduled: true, scheduled_at: disponibilidad.programadoPara }),
        // Mesa validada (respaldo legible para el ERP y la cocina: «[Comer aquí] Mesa: 4 (Terraza)»).
        ...(mesaPedido && { internal_notes: notaMesa(mesaPedido) }),
        ...(resolvedCoupon && { coupon_code: resolvedCoupon.code }),
        ...(totalDiscountAmount > 0 && { discount_total: totalDiscountAmount }),
    }
    const insertarPedido = (fila: Record<string, unknown>) =>
      (supabase as any).from('web_orders').insert(fila).select('id, order_number').single()
    let { data: webOrder, error: orderError } = await insertarPedido(filaPedido)
    if (orderError && mesaPedido && rechazaComerAqui(orderError)) {
      // E1 sin aplicar: el CHECK aún no admite 'dine_in' o falta restaurant_table_id. Mapeo
      // temporal: se guarda como `pickup` y la mesa queda en internal_notes con la marca.
      console.warn('[Orders] web_orders aún no admite dine_in; se guarda como pickup con la mesa en notas', {
        organizationId: contextOrgId, code: orderError.code,
      })
      const { restaurant_table_id: _sinColumna, ...filaTemporal } = filaPedido
      ;({ data: webOrder, error: orderError } = await insertarPedido({ ...filaTemporal, delivery_type: 'pickup' }))
    } else {
      // Sin mesa, o la base aceptó dine_in: el resultado del insert es el definitivo.
    }

    if (orderError) {
      console.error('Error creating web_order:', orderError)
      return NextResponse.json(
        { error: `Error al crear el pedido: ${orderError.message || orderError.code || JSON.stringify(orderError)}` },
        { status: 500 }
      )
    }

    // ── Pasos críticos: líneas del pedido y reserva de stock ──
    // Fuera del try de post-procesamiento: un pedido sin líneas (o con la reserva a medias) no
    // puede responder `success` ni llegar a /api/checkout/init. Si fallan, el pedido se cancela y
    // se responde con error. Así quedaron 2 pedidos sin líneas, uno de ellos pagado.
    // Crear web_order_items con el precio unitario real (base + extras, una sola vez)
    const orderItems = construirFilasPedido(lineas, webOrder.id, impuesto.porLinea)
    let itemsError: unknown = null
    try {
      // Las filas van tipadas (`WebOrderItemInsert`, columnas verificadas por MCP) desde
      // construirFilasPedido; el cliente genérico sigue sin inferir tablas de types/database.ts.
      const { error } = await (supabase as any)
        .from('web_order_items')
        .insert(orderItems)
      itemsError = error
    } catch (err) {
      itemsError = err
    }
    if (itemsError) {
      console.error('[Orders] No se pudieron guardar las líneas del pedido; se cancela', {
        organizationId: contextOrgId, webOrderId: webOrder.id, error: itemsError,
      })
      await cancelarPedidoWeb(supabase as any, webOrder.id, 'Error al guardar los ítems del pedido')
      return NextResponse.json(
        { error: 'No pudimos registrar tu pedido. No se hizo ningún cobro; intenta de nuevo en un momento.', code: 'PEDIDO_SIN_LINEAS' },
        { status: 500 }
      )
    } else {
      // Líneas guardadas: sigue el flujo de siempre.
    }

    // Reservar stock atómicamente via RPC (FOR UPDATE evita overselling)
    // Van TODAS las líneas, no solo las de productos con track_stock: el núcleo
    // (fn_inv_int_expandir_items) expande la receta de cada plato y se queda solo con lo que
    // rastrea inventario. Un producto simple sin rastreo desaparece; un plato con receta reserva
    // sus insumos en la sede, que antes se vendían aunque faltaran. La validación previa (B1)
    // sigue para los productos rastreados directos; la RPC es el todo o nada.
    const cantidadPorProducto = new Map<number, number>()
    for (const l of lineas) {
      cantidadPorProducto.set(l.productId, (cantidadPorProducto.get(l.productId) || 0) + l.cantidad)
    }
    if (resolvedBranchId && cantidadPorProducto.size > 0) {
      const rpcItems = Array.from(cantidadPorProducto.entries()).map(([pid, qty]) => ({
        product_id: pid,
        quantity: qty,
      }))

      let reserveResult: any = null
      let reserveError: unknown = null
      try {
        const r = await (supabase as any)
          .rpc('reserve_stock_for_web_order', {
            p_organization_id: contextOrgId,
            p_branch_id: resolvedBranchId,
            p_order_id: webOrder.id,
            p_items: rpcItems,
          })
        reserveResult = r.data
        reserveError = r.error
      } catch (err) {
        // Una excepción (red, timeout) se trata igual que un error de la RPC: sin reserva no hay pedido.
        reserveError = err
      }

      if (reserveError || !reserveResult?.ok) {
        // La reserva atómica falló: cancelar la orden y devolver 409
        console.error('[Orders] Reserva atómica falló:', reserveError || reserveResult?.shortages)
        await cancelarPedidoWeb(supabase as any, webOrder.id, 'Stock insuficiente al reservar')

        const shortages: { product_id: number; available: number; requested: number }[] = reserveResult?.shortages || []
        // Nombres para el cliente: los del carrito y, si falta un insumo de receta, el del insumo
        // (sin cantidades exactas del inventario de la sede).
        const idsInsumo = shortages.map((f) => Number(f.product_id)).filter((id) => !lineas.some((l) => l.productId === id))
        const nombresInsumo = new Map<number, string>()
        if (idsInsumo.length > 0) {
          const { data: insumos } = await (supabase as any)
            .from('products').select('id, name').eq('organization_id', contextOrgId).in('id', idsInsumo)
          for (const p of insumos || []) nombresInsumo.set(Number(p.id), String(p.name))
        }
        const outOfStock = shortages.map((f) => {
          const linea = lineas.find((l) => l.productId === Number(f.product_id))
          if (linea) return `${linea.nombre} (disponible: ${Math.max(0, Math.floor(f.available))}, solicitado: ${f.requested})`
          return `No alcanza ${nombresInsumo.get(Number(f.product_id)) ?? 'un ingrediente'} en esta sede para preparar tu pedido`
        })
        return NextResponse.json(
          { error: 'Stock insuficiente', details: outOfStock },
          { status: 409 }
        )
      }
    }

    // Post-procesamiento: propina, cupones, promociones, email
    // Envolvemos en try/catch para que si algo falla aquí, la orden ya creada no se pierda
    try {
      // La propina NO se inserta aquí en `tips`: viaja en `web_orders.tip_amount` y el ERP crea la
      // fila al confirmar el pedido (webOrderConfirmationService). El insert de antes violaba la FK
      // de `server_id` y, con `.catch` sobre un builder sin ese método, lanzaba un TypeError que
      // saltaba la reserva de stock, el cupón y el correo de todo pedido con propina.

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

      // Correo al cliente (fire-and-forget). Pago fuera de línea (efectivo, contraentrega,
      // transferencia…): «Recibimos tu pedido» ahora. Wompi: lo envía el webhook cuando el pago
      // pasa a `paid` («Pago confirmado»), así nadie recibe un «confirmado» de un pago que falló.
      // Las demás pasarelas aún no envían correo desde su webhook: siguen recibiéndolo aquí.
      if (!PASARELAS_CON_CORREO_AL_PAGAR.has(String(paymentMethod))) {
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
          organizationName: contexto.nombreOrganizacion,
          trackingUrl: `${origin}${rutaSeguimiento(contextOrgId, webOrder)}`,
          paymentStatus: 'pending',
          tipoEntrega: `${etiquetaTipoEntrega(tipoGuardado, contexto.esRestaurante)}${mesaPedido ? ` · Mesa ${mesaPedido.name}` : ''}`,
          programadoPara: isScheduled && disponibilidad.programadoPara ? momentoPedido(disponibilidad.programadoPara, contexto.zona) : null,
        }).catch(err => console.error('[Orders] Email error:', err))
      } else {
        // Wompi: el correo sale del webhook al confirmarse el pago.
      }
    } catch (postErr) {
      console.error('[Orders] Post-processing error (order already created):', postErr)
    }

    return NextResponse.json({
      success: true,
      orderId: webOrder.id,
      orderNumber: webOrder.order_number,
      // Enlace de seguimiento con su token (lib/orders/tokenSeguimiento.ts): con él, /pedido/<n>
      // muestra también dirección, conductor y entrega. Sin secreto configurado, null.
      trackingToken: tokenSeguimiento(contextOrgId, webOrder.id),
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
