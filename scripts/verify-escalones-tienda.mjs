/**
 * verify-escalones-tienda.mjs — «Compra más, paga menos» en la tienda y envío gratis medido
 * DESPUÉS de los descuentos (Figma «16 Sitio web» 3006:75498; decisión del dueño 2026-11-24).
 *
 *   npm run verify:escalones-tienda
 *
 * Sin base de datos. Importa los módulos reales:
 *  - lib/shipping/envioGratisDescontado.ts: el umbral se compara con el subtotal menos promociones
 *    y cupón; la cotización por zona solo puede PERDER el envío gratis, nunca ganarlo.
 *  - lib/promociones/escalonesTienda.ts: qué escalones se pintan en la ficha y en las tarjetas
 *    (vigencia, reglas, grupo de clientes, método de pago, datos desconocidos) y que el precio que
 *    promete la ficha es el MISMO que cobra el motor (`calculatePromotions`).
 * Y lee el fuente de las rutas para comprobar que el cobro usa el subtotal descontado solo para
 * el envío gratis.
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { calculatePromotions } from '../lib/promotions.ts'
import {
  alcanzaEnvioGratis,
  cotizacionConEnvioGratisDescontado,
  faltaParaEnvioGratis,
  subtotalParaEnvioGratis,
} from '../lib/shipping/envioGratisDescontado.ts'
import {
  botonConVolumen,
  cotizarCantidad,
  escalonesParaProducto,
  etiquetaFila,
  filasEscalones,
  prepararEscalonesTienda,
  promoAlcanzaProducto,
  resumenTarjeta,
  textoAgregarConCantidad,
  textoModoConteo,
} from '../lib/promociones/escalonesTienda.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const igual = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), `${msg}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`)
const fuente = (ruta) => readFile(join(ROOT, ruta), 'utf8')

// ── 1. Envío gratis después de los descuentos ────────────────────────────────────────────────────
igual(subtotalParaEnvioGratis(160000, 20000), 140000, 'subtotal descontado')
igual(subtotalParaEnvioGratis(10000, 25000), 0, 'nunca negativo')
igual(subtotalParaEnvioGratis(10000, -5), 10000, 'descuento negativo no suma')
igual(subtotalParaEnvioGratis(NaN, 1000), 0, 'subtotal ilegible')
check(!alcanzaEnvioGratis(subtotalParaEnvioGratis(160000, 20000), 150000), '$ 160.000 con $ 20.000 de descuento NO alcanza un umbral de $ 150.000')
check(alcanzaEnvioGratis(subtotalParaEnvioGratis(192000, 36300), 150000), 'el ejemplo del Figma S7 (192.000 − 36.300 = 155.700) sí alcanza 150.000')
check(alcanzaEnvioGratis(150000, 150000), 'el umbral exacto alcanza')
check(!alcanzaEnvioGratis(999999, 0), 'sin umbral no hay envío gratis')
igual(faltaParaEnvioGratis(140000, 150000), 10000, 'lo que falta')
igual(faltaParaEnvioGratis(160000, 150000), 0, 'ya alcanzó')

const cot = (o) => ({ precio: 0, tarifa: 8000, envio_gratis: true, envio_gratis_desde: 150000, falta_para_envio_gratis: null, subtotal: 160000, zona: { nombre: 'Norte' }, ...o })
{
  const base = cot()
  check(cotizacionConEnvioGratisDescontado(base, undefined) === base, 'sin subtotal descontado: la cotización tal cual (mismo objeto)')
  check(cotizacionConEnvioGratisDescontado(base, null) === base, 'subtotal descontado null: tal cual')
  const perdida = cotizacionConEnvioGratisDescontado(base, 140000)
  igual([perdida.envio_gratis, perdida.precio, perdida.falta_para_envio_gratis, perdida.zona.nombre], [false, 8000, 10000, 'Norte'], 'con descuentos bajo el umbral: se cobra la tarifa de la zona')
  igual(cotizacionConEnvioGratisDescontado(base, 155000).envio_gratis, true, 'con descuentos sobre el umbral: sigue gratis')
  const noGana = cotizacionConEnvioGratisDescontado(cot({ envio_gratis: false, precio: 8000, subtotal: 100000, falta_para_envio_gratis: 50000 }), 999999)
  igual([noGana.envio_gratis, noGana.precio, noGana.falta_para_envio_gratis], [false, 8000, 50000], 'un subtotal descontado mayor que el de la base NO da envío gratis')
  const falta = cotizacionConEnvioGratisDescontado(cot({ envio_gratis: false, precio: 8000, subtotal: 120000, falta_para_envio_gratis: 30000 }), 100000)
  igual(falta.falta_para_envio_gratis, 50000, '«Te faltan» con el subtotal descontado')
  const fuera = cot({ precio: null, envio_gratis: false, envio_gratis_desde: null })
  check(cotizacionConEnvioGratisDescontado(fuera, 1) === fuera, 'fuera de cobertura: tal cual')
  const sinUmbral = cot({ envio_gratis_desde: null, envio_gratis: false, precio: 8000 })
  check(cotizacionConEnvioGratisDescontado(sinUmbral, 1) === sinUmbral, 'zona sin envío gratis: tal cual')
  const sinTarifa = cot({ tarifa: null })
  check(cotizacionConEnvioGratisDescontado(sinTarifa, 1) === sinTarifa, 'sin tarifa conocida no se inventa un cobro')
}

// ── 2. Escalones que pinta la tienda ─────────────────────────────────────────────────────────────
const AHORA = new Date('2026-11-24T15:00:00Z') // martes, 10:00 en Bogotá
const promo = (o = {}) => ({
  id: 'p-gaseosa', name: 'Mayoristas de bebidas', description: null, promotion_type: 'volume_tiers',
  discount_value: 0, buy_quantity: null, get_quantity: null, min_purchase_amount: null, max_discount_amount: null,
  applies_to: 'products', start_date: '2026-11-01T00:00:00Z', end_date: '2026-12-31T23:59:59-05:00', is_active: true,
  usage_limit: null, usage_count: 0, is_combinable: false, priority: 0, created_at: '2026-11-01T00:00:00Z', branches: null,
  applies_to_web: true, payment_method_codes: null, applicable_days: null, start_time: null, end_time: null, schedule_windows: null,
  tiers_count_mode: 'promotion_mix', customer_segment_id: null, usage_limit_per_customer: null,
  promotion_rules: [{ rule_type: 'include_product', product_id: 10, category_id: null, brand: null, tier_group: null }],
  promotion_tiers: [{ min_quantity: 12, unit_price: '8800', discount_percent: null, sort_order: 1 }, { min_quantity: 6, unit_price: 9500, discount_percent: null, sort_order: 0 }],
  ...o,
})
const filas = [
  promo(),
  promo({ id: 'p-grupo', name: 'Solo mayoristas', customer_segment_id: 'seg-1', promotion_rules: [{ rule_type: 'include_product', product_id: 30 }] }),
  promo({ id: 'p-nequi', payment_method_codes: ['nequi'], promotion_rules: [{ rule_type: 'include_product', product_id: 40 }] }),
  promo({ id: 'p-minimo', min_purchase_amount: 50000, promotion_rules: [{ rule_type: 'include_product', product_id: 50 }] }),
  promo({ id: 'p-vencida', end_date: '2026-11-01T00:00:00Z', promotion_rules: [{ rule_type: 'include_product', product_id: 60 }] }),
  promo({ id: 'p-sede', branches: [7], promotion_rules: [{ rule_type: 'include_product', product_id: 70 }] }),
  promo({ id: 'p-2x1', promotion_type: 'buy_x_get_y', buy_quantity: 2, get_quantity: 1 }),
  promo({ id: 'p-sin-escalones', promotion_tiers: [], promotion_rules: [{ rule_type: 'include_product', product_id: 80 }] }),
]
const listas = prepararEscalonesTienda(filas, { date: AHORA, timeZone: 'America/Bogota', branchId: 3 })
igual(listas.map((p) => p.id).sort(), ['p-gaseosa', 'p-grupo'], 'solo las vigentes, sin método de pago ni compra mínima, de esta sede y con escalones')
const grupo = listas.find((p) => p.id === 'p-grupo')
igual([grupo?.requiereCliente, grupo?.escalones.length], [true, 0], 'la de grupo de clientes viaja SIN escalones (no se promete el precio)')
igual(listas.find((p) => p.id === 'p-gaseosa')?.escalones.map((e) => [e.desde, e.precioUnidad]), [[6, 9500], [12, 8800]], 'escalones ordenados y normalizados')
igual(prepararEscalonesTienda(filas, { date: AHORA, branchId: 7 }).some((p) => p.id === 'p-sede'), true, 'la limitada a una sede aparece en esa sede')
igual(prepararEscalonesTienda(null), [], 'sin filas')

const v = escalonesParaProducto(listas, { id: 10, parent_product_id: null, category_id: 1, brand: null })
igual([v?.promoId, v?.requiereCliente, v?.escalones.length], ['p-gaseosa', false, 2], 'producto de la promoción')
igual(escalonesParaProducto(listas, { id: 11, parent_product_id: 10, category_id: 1, brand: null })?.promoId, 'p-gaseosa', 'variante de un padre incluido')
igual(escalonesParaProducto(listas, { id: 20, parent_product_id: null, category_id: 1, brand: null }), null, 'producto fuera de la promoción')
igual(escalonesParaProducto(listas, { id: 30, parent_product_id: null, category_id: 1, brand: null }), { promoId: 'p-grupo', nombre: 'Solo mayoristas', modo: 'promotion_mix', escalones: [], requiereCliente: true, fin: grupo.fin }, 'solo para clientes: marcada, sin escalones (S1b)')

const porCategoria = { appliesTo: 'categories', modo: 'promotion_mix', reglas: [{ rule_type: 'include_category', category_id: 5, product_id: null }] }
igual(promoAlcanzaProducto(porCategoria, { id: 1, parent_product_id: null, category_id: 5 }), true, 'por categoría')
igual(promoAlcanzaProducto(porCategoria, { id: 1, parent_product_id: null }), null, 'categoría desconocida: no se promete')
const porMarca = { appliesTo: 'brands', modo: 'promotion_mix', reglas: [{ rule_type: 'include_brand', brand: 'Postobón', product_id: null, category_id: null }] }
igual(promoAlcanzaProducto(porMarca, { id: 1, parent_product_id: null, category_id: null, brand: ' postobon ' }), true, 'marca sin tildes ni mayúsculas, como el motor')
igual(promoAlcanzaProducto(porMarca, { id: 1, parent_product_id: null, category_id: null }), null, 'marca desconocida: no se promete')
const conExclusion = { appliesTo: 'all', modo: 'promotion_mix', reglas: [{ rule_type: 'exclude_product', product_id: 9 }] }
igual(promoAlcanzaProducto(conExclusion, { id: 9, parent_product_id: null }), true, "applies_to 'all' entra siempre (igual que el motor)")
const soloExclusion = { appliesTo: 'products', modo: 'promotion_mix', reglas: [{ rule_type: 'exclude_product', product_id: 9 }] }
igual(promoAlcanzaProducto(soloExclusion, { id: 9, parent_product_id: null }), false, 'excluido')
igual(promoAlcanzaProducto(soloExclusion, { id: 8 }), null, 'padre desconocido con reglas de producto: no se promete')
const porGrupo = { appliesTo: 'products', modo: 'product_group', reglas: [{ rule_type: 'include_product', product_id: 1, tier_group: 1 }, { rule_type: 'include_product', product_id: 2 }] }
igual([promoAlcanzaProducto(porGrupo, { id: 1, parent_product_id: null }), promoAlcanzaProducto(porGrupo, { id: 2, parent_product_id: null })], [true, false], 'product_group: sin grupo no hay precio por volumen')

// ── 3. Vista: tabla, cantidad, tarjeta ───────────────────────────────────────────────────────────
const esc = v.escalones
igual(filasEscalones(esc, 11000), [
  { desde: 1, hasta: 5, precio: 11000, ahorroPct: 0, esBase: true },
  { desde: 6, hasta: 11, precio: 9500, ahorroPct: 14, esBase: false },
  { desde: 12, hasta: null, precio: 8800, ahorroPct: 20, esBase: false },
], 'tabla del Figma S1')
igual(filasEscalones(esc, 11000).map((f) => etiquetaFila(f)), ['1 a 5 unidades', '6 a 11 unidades', '12 o más'], 'etiquetas')
igual(filasEscalones(esc, 11000).map((f) => etiquetaFila(f, true)), ['1 a 5 u.', '6 a 11 u.', '12 o más u.'], 'etiquetas del celular (S2)')
{
  const c6 = cotizarCantidad(esc, 11000, 6)
  igual([c6.unitario, c6.total, c6.ahorro, c6.ahorroPct, c6.siguiente], [9500, 57000, 9000, 14, { faltan: 6, unitario: 8800, desde: 12 }], '6 unidades: $ 9.500 c/u, Total $ 57.000, Ahorras $ 9.000, «Agrega 6 más… $ 8.800»')
  const c1 = cotizarCantidad(esc, 11000, 1)
  igual([c1.unitario, c1.total, c1.ahorro, c1.siguiente?.faltan], [11000, 11000, 0, 5], '1 unidad: precio normal, faltan 5')
  const c12 = cotizarCantidad(esc, 11000, 12)
  igual([c12.unitario, c12.total, c12.ahorro, c12.siguiente], [8800, 105600, 26400, null], '12: último escalón')
  igual(cotizarCantidad(esc, 9000, 6).unitario, 9000, 'precio base ya por debajo del escalón: sin descuento extra (lista de precios futura)')
  // Lo que promete la ficha = lo que cobra el motor (mismo carrito de una sola línea).
  const promoCruda = filas[0]
  for (const q of [1, 5, 6, 11, 12, 30]) {
    const motor = calculatePromotions([promoCruda], [{ id: 10, productId: 10, name: 'Gaseosa', price: 11000, quantity: q, product_id: 10, parent_product_id: null, category_id: 1, brand: null }], { date: AHORA, timeZone: 'America/Bogota' })
    igual(cotizarCantidad(esc, 11000, q).total, 11000 * q - motor.totalDiscount, `ficha = cobro con ${q} unidades`)
  }
  const pct = cotizarCantidad([{ desde: 3, precioUnidad: null, porcentaje: 10 }], 4999, 3)
  igual([pct.unitario, pct.total], [4499, 13497], 'escalón en porcentaje redondeado a pesos por unidad')
}
igual(resumenTarjeta(esc, 11000), { desde: 6, unitario: 9500, ahorroPct: 14 }, 'tarjeta: «Desde 6: −14 %» y «6 o más: $ 9.500 c/u»')
igual(resumenTarjeta(esc, 9000), { desde: 12, unitario: 8800, ahorroPct: 2 }, 'tarjeta: el primer escalón que baja el precio')
igual(resumenTarjeta(esc, 8000), null, 'tarjeta: si ningún escalón baja el precio, nada')
igual(resumenTarjeta(esc, 0), null, 'tarjeta sin precio')
check(textoModoConteo('promotion_mix').includes('puedes mezclar'), 'texto de promotion_mix')
// Botón de la ficha y de la barra fija (S1/S2): «Agregar 6 al carrito · $ 57.000», el mismo «Total».
igual(botonConVolumen(v, 11000, 6), { cantidad: 6, unitario: 9500, total: 57000, ahorro: 9000 }, 'botón con 6: total del escalón')
igual(botonConVolumen(v, 11000, 6)?.total, cotizarCantidad(esc, 11000, 6).total, 'botón = «Total» de la ficha')
igual(botonConVolumen(v, 11000, 5), null, 'fuera de escalón: el botón de siempre')
igual(botonConVolumen(v, 8000, 12), null, 'escalón que no baja el precio: el botón de siempre')
igual(botonConVolumen({ escalones: esc, requiereCliente: true }, 11000, 6), null, 'solo para clientes: no se promete en el botón')
igual(botonConVolumen(null, 11000, 6), null, 'sin precio por volumen')
igual(textoAgregarConCantidad('Agregar al carrito', 6), 'Agregar 6 al carrito', 'texto del botón con la cantidad')
igual(textoAgregarConCantidad('Agregar', 12), 'Agregar 12', 'texto corto con la cantidad')
igual(textoAgregarConCantidad('¡Lo quiero!', 6), '¡Lo quiero!', 'texto propio: queda igual')
check(textoModoConteo('same_variant') !== textoModoConteo('promotion_mix'), 'cada modo con su texto')

// ── 4. Fuente: el cobro y lo que se muestra usan el subtotal descontado solo para el envío gratis ──
{
  const ordenes = await fuente('app/api/orders/route.ts')
  check(/const subtotalEnvioGratis = subtotalParaEnvioGratis\(calculatedSubtotal, totalDiscountAmount\)/.test(ordenes), '/api/orders: subtotalEnvioGratis = subtotal − (promociones + cupón)')
  check(ordenes.indexOf('const totalDiscountAmount') < ordenes.indexOf('const subtotalEnvioGratis'), '/api/orders: el descuento se calcula antes del envío')
  check(/subtotal: calculatedSubtotal,\s*\n\s*subtotalEnvioGratis,/.test(ordenes), '/api/orders: la zona cotiza el mínimo con el subtotal normal y el envío gratis con el descontado')
  check(/resolverEnvio\([\s\S]{0,700}subtotal: subtotalEnvioGratis,/.test(ordenes), '/api/orders: resolverEnvio recibe el subtotal descontado')
  const resolver = await fuente('lib/shipping/resolveShipping.ts')
  const usos = resolver.slice(resolver.indexOf('export async function resolverEnvio')).match(/e\.subtotal/g) ?? []
  igual(usos.length, 2, 'resolverEnvio usa el subtotal solo en el envío gratis (tarifa y plana)')
  const quote = await fuente('app/api/shipping/quote/route.ts')
  check(/subtotalEnvioGratis: typeof body\?\.subtotalEnvioGratis === 'number'/.test(quote), '/api/shipping/quote: acepta subtotalEnvioGratis')
  const zonas = await fuente('lib/shipping/cotizarZonas.ts')
  check(/cotizacionConEnvioGratisDescontado\(leerCotizacion\(data\), e\.subtotalEnvioGratis\)/.test(zonas), 'cotizarDomicilioWeb aplica el envío gratis descontado')
  check(/p_subtotal: Math\.max\(Number\(e\.subtotal\)/.test(zonas), 'la RPC sigue recibiendo el subtotal normal (pedido mínimo y reglas sin cambios)')
  const checkout = await fuente('components/site/CheckoutWizard.tsx')
  check(/subtotalParaEnvioGratis\(subtotal, couponDiscount \+ promoDiscount\)/.test(checkout), 'checkout: subtotal descontado con promociones y cupón')
  check(/subtotalEnvioGratis >= settings\.freeShippingThreshold/.test(checkout), 'checkout: tarifa plana con el descontado')
  check(/subtotal: subtotalEnvioGratis \}\)/.test(checkout), 'checkout: /api/shipping/calculate con el descontado')
  check(!/subtotal >= settings\.freeShippingThreshold/.test(checkout), 'checkout: ya no compara el umbral con el subtotal normal')
  const cajon = await fuente('components/site/CartDrawer.tsx')
  check(/subtotalParaEnvioGratis\(subtotal, promoDiscount\)/.test(cajon) && !/subtotal < shippingSettings\.freeShippingThreshold/.test(cajon), 'cajón: «Te faltan» y envío con el descontado')
  const pagina = await fuente('app/carrito/CartPageClient.tsx')
  check(/subtotalParaEnvioGratis\(subtotal, promoDiscount\)/.test(pagina) && !/subtotal >= cartSettings\.freeShippingThreshold/.test(pagina), '/carrito: envío con el descontado')
}

// ── 5. Consulta del servidor: columnas verificadas por MCP el 2026-11-24 ────────────────────────────
{
  const srv = await fuente('lib/promociones/escalonesTienda.server.ts')
  const sel = srv.match(/SELECT_PROMOS_VOLUMEN =\s*\n?\s*'([^']+)'/)?.[1] ?? ''
  const PROMOTIONS = 'id organization_id name description promotion_type discount_value buy_quantity get_quantity min_purchase_amount max_discount_amount applies_to start_date end_date is_active usage_limit usage_count is_combinable priority branches created_by created_at updated_at applies_to_web applies_to_pos applies_to_finances applicable_days start_time end_time bundle_price min_quantity repeat_every_quantity min_purchase_scope payment_method_codes schedule_windows tiers_count_mode customer_segment_id usage_limit_per_customer'.split(' ')
  const RULES = 'id promotion_id rule_type product_id category_id created_at quantity brand tier_group'.split(' ')
  const TIERS = 'id promotion_id organization_id min_quantity unit_price discount_percent sort_order created_at'.split(' ')
  const embebido = (tabla) => (sel.match(new RegExp(`${tabla}\\(([^)]*)\\)`))?.[1] ?? '').split(',').map((c) => c.trim()).filter(Boolean)
  const planas = sel.replace(/\w+\([^)]*\)/g, '').split(',').map((c) => c.trim()).filter(Boolean)
  check(sel.length > 0, 'SELECT_PROMOS_VOLUMEN encontrado')
  for (const c of planas) check(PROMOTIONS.includes(c), `promotions.${c} no existe`)
  for (const c of embebido('promotion_rules')) check(RULES.includes(c), `promotion_rules.${c} no existe`)
  for (const c of embebido('promotion_tiers')) check(TIERS.includes(c), `promotion_tiers.${c} no existe`)
  check(/\.eq\('organization_id', organizationId\)/.test(srv), 'la lectura filtra por organización')
  check(/cacheCatalog\('leerPromosVolumen'/.test(srv) && /export const getEscalonesTienda = cache\(/.test(srv), 'una lectura por organización: caché del catálogo + react.cache')
}

if (problemas.length > 0) {
  console.error(`✗ verify-escalones-tienda: ${problemas.length} de ${casos} casos fallan`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-escalones-tienda: ${casos} casos (envío gratis después de descuentos, escalones de la ficha y las tarjetas = lo que cobra el motor, rutas)`)
