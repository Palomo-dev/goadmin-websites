/**
 * verify-precio-volumen.mjs — el precio por volumen de la tienda es el MISMO que cobra el POS.
 *
 *   npm run verify:precio-volumen
 *   ERP_REPO=/ruta/a/go-admin-erp npm run verify:precio-volumen
 *
 * Sin base de datos. Importa el motor real (`lib/promotions.ts`) y el módulo compartido
 * (`lib/promociones/precioVolumen.ts`).
 *
 * 1. `lib/promociones/precioVolumen.ts` es idéntico byte a byte al del ERP
 *    (`src/lib/promotions/precioVolumen.ts`), si el ERP está al lado.
 * 2. Los casos y los números son los MISMOS del test de contrato del ERP
 *    (`src/lib/promotions/__tests__/precioVolumen.contrato.test.ts`): 6 gaseosas de $ 11.000 con
 *    escalones 6 → $ 9.500 y 12 → $ 8.800 descuentan 9.000 y 12 descuentan 26.400, en los dos.
 * 3. El 2x1 que ya existe sigue igual; si chocan y no se suman, gana el que más ahorra.
 * 4. «Solo para un grupo de clientes»: sin cliente de sesión no aplica; con él, sí.
 * 5. Las pistas del carrito («Agrega 6 más y cada una te queda en $ 8.800»).
 * 7. El empujón de «compra X lleva Y» («Agrega 1 más y llévala gratis (2×1)», `freeHints`).
 */
import { readFile, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { calculatePromotions } from '../lib/promotions.ts'
import {
  calcularDescuentoVolumen,
  grupoDeLinea,
  normalizarEscalones,
  normalizarMarca,
  promocionHabilitadaParaCliente,
  reglaMarcaCoincide,
  siguienteEscalon,
} from '../lib/promociones/precioVolumen.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ERP = resolve(process.env.ERP_REPO || join(ROOT, '..', 'CascadeProjects', 'go-admin-erp'))

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const igual = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), `${msg}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`)

// 1. Copia byte a byte ---------------------------------------------------------------------------
const original = join(ERP, 'src', 'lib', 'promotions', 'precioVolumen.ts')
try {
  await access(original)
  const [aqui, alla] = await Promise.all([readFile(join(ROOT, 'lib', 'promociones', 'precioVolumen.ts')), readFile(original)])
  check(aqui.equals(alla), 'lib/promociones/precioVolumen.ts difiere del ERP (src/lib/promotions/precioVolumen.ts)')
} catch {
  console.warn(`verify-precio-volumen: no encontré el ERP en ${ERP}; se omite la comparación byte a byte`)
}

// 2. Casos compartidos con el ERP ----------------------------------------------------------------
const FIJOS = [
  { min_quantity: 6, unit_price: 9500, discount_percent: null, sort_order: 0 },
  { min_quantity: 12, unit_price: 8800, discount_percent: null, sort_order: 1 },
]
const PORCENTAJES = [
  { min_quantity: 6, unit_price: null, discount_percent: 5 },
  { min_quantity: 12, unit_price: null, discount_percent: 10 },
  { min_quantity: 24, unit_price: null, discount_percent: 15 },
]
const total = (r) => r.porLinea.reduce((s, d) => s + d, 0)

igual(
  normalizarEscalones([
    { min_quantity: '12', unit_price: '8800.00' },
    { min_quantity: 6, unit_price: 9500 },
    { min_quantity: 0, unit_price: 1 },
    { min_quantity: 3 },
    { min_quantity: 6, discount_percent: 50, sort_order: 9 },
    null,
  ]),
  [{ desde: 6, precioUnidad: 9500, porcentaje: null }, { desde: 12, precioUnidad: 8800, porcentaje: null }],
  'normalizar escalones',
)
const e = normalizarEscalones(FIJOS)
const una = (q) => [{ producto: 1, cantidad: q, precio: 11000 }]
check(total(calcularDescuentoVolumen(e, una(5), 'promotion_mix')) === 0, '5 unidades: sin escalón')
check(total(calcularDescuentoVolumen(e, una(6), 'promotion_mix')) === 9000, '6 unidades → 9.000')
check(total(calcularDescuentoVolumen(e, una(12), 'promotion_mix')) === 26400, '12 unidades → 26.400')
check(total(calcularDescuentoVolumen(normalizarEscalones(PORCENTAJES), [{ producto: 1, cantidad: 12, precio: 6000 }], 'same_product')) === 7200, '12 × 6.000 al 10 % → 7.200')

const distintos = [
  { producto: 10, padre: null, cantidad: 3, precio: 11000 },
  { producto: 11, padre: null, cantidad: 3, precio: 11000 },
]
check(total(calcularDescuentoVolumen(e, distintos, 'promotion_mix')) === 9000, 'mezcla: 3 + 3 = 6')
check(total(calcularDescuentoVolumen(e, distintos, 'same_product')) === 0, 'mismo producto: 3 y 3 no llegan')
check(total(calcularDescuentoVolumen(e, distintos, 'same_variant')) === 0, 'misma variante: 3 y 3 no llegan')
const variantes = distintos.map((l) => ({ ...l, padre: 1 }))
check(total(calcularDescuentoVolumen(e, variantes, 'same_product')) === 9000, 'variantes del mismo padre suman')
check(total(calcularDescuentoVolumen(e, variantes, 'same_variant')) === 0, 'cada variante aparte')

const reglas = [
  { rule_type: 'include_product', product_id: 10, tier_group: 1 },
  { rule_type: 'include_product', product_id: 11, tier_group: '1' },
  { rule_type: 'include_product', product_id: 12, tier_group: null },
]
const conGrupo = [10, 11, 12].map((p) => ({ producto: p, cantidad: p === 12 ? 6 : 3, precio: 11000, grupo: grupoDeLinea(reglas, p, null) }))
igual(calcularDescuentoVolumen(e, conGrupo, 'product_group').porLinea, [4500, 4500, 0], 'grupo elegido')
check(total(calcularDescuentoVolumen(e, [{ producto: 1, cantidad: 6, precio: 9000 }], 'promotion_mix')) === 0, 'precio ya menor: sin extra')
igual(siguienteEscalon(e, 6), { escalon: { desde: 12, precioUnidad: 8800, porcentaje: null }, faltan: 6 }, 'siguiente escalón')
check(siguienteEscalon(e, 12) === null, 'sin siguiente escalón')

check(normalizarMarca('  Café   Águila ') === 'cafe aguila', 'marca normalizada')
check(reglaMarcaCoincide({ brand: 'Café Águila' }, { product_id: 1, brand: 'cafe aguila' }), 'marca coincide')
check(!reglaMarcaCoincide({ brand: 'Otra' }, { product_id: 1, brand: 'cafe aguila' }), 'marca distinta')
check(reglaMarcaCoincide({ brand: null, product_id: 5 }, { product_id: 9, parent_product_id: 5 }), 'regla de marca antigua por producto')

const pc = { id: 'p1', customer_segment_id: 'seg-1', usage_limit_per_customer: 2 }
check(!promocionHabilitadaParaCliente(pc, null), 'grupo sin cliente: no')
check(!promocionHabilitadaParaCliente(pc, { id: 'c1', segmentos: ['otro'], usos: {} }), 'cliente de otro grupo: no')
check(promocionHabilitadaParaCliente(pc, { id: 'c1', segmentos: ['seg-1'], usos: { p1: 1 } }), 'cliente del grupo con 1 uso: sí')
check(!promocionHabilitadaParaCliente(pc, { id: 'c1', segmentos: ['seg-1'], usos: { p1: 2 } }), 'cliente sin usos: no')
check(promocionHabilitadaParaCliente({ id: 'p2' }, null), 'promoción abierta sin cliente: sí')

// 3–5. Motor de la tienda --------------------------------------------------------------------------
function promo(extra) {
  return {
    id: 'x', name: 'x', description: null, promotion_type: 'percentage', discount_value: null,
    buy_quantity: null, get_quantity: null, min_purchase_amount: 0, min_quantity: null,
    max_discount_amount: null, applies_to: 'all', start_date: '2026-12-01T05:00:00Z', end_date: null,
    is_active: true, usage_limit: null, usage_count: 0, is_combinable: false, priority: 0,
    created_at: '2026-11-24T00:00:00Z', branches: null, applies_to_web: true, applicable_days: null,
    promotion_rules: [], ...extra,
  }
}
const volumen = promo({ id: 'vol', name: 'Mayoristas de bebidas', promotion_type: 'volume_tiers', tiers_count_mode: 'promotion_mix', promotion_tiers: FIJOS })
const dosPorUno = promo({ id: '2x1', name: '2x1', promotion_type: 'buy_x_get_y', buy_quantity: 2, get_quantity: 1 })
const OPTS = { date: new Date('2026-12-10T15:00:00Z'), timeZone: 'America/Bogota', branchId: 1 }
const gaseosa = (q, id = 1) => ({ id: String(id), product_id: id, parent_product_id: null, category_id: null, name: 'Gaseosa 400 ml', price: 11000, quantity: q })

check(calculatePromotions([volumen], [gaseosa(6)], OPTS).totalDiscount === 9000, 'tienda: 6 gaseosas → 9.000 (igual que el POS)')
check(calculatePromotions([volumen], [gaseosa(12)], OPTS).totalDiscount === 26400, 'tienda: 12 gaseosas → 26.400 (igual que el POS)')
check(calculatePromotions([volumen], [gaseosa(3, 10), gaseosa(3, 11)], OPTS).totalDiscount === 9000, 'tienda: 3 + 3 mezcladas → 9.000')

const r2x1 = calculatePromotions([dosPorUno], [{ id: '7', product_id: 7, parent_product_id: null, category_id: null, name: 'Galletas', price: 4500, quantity: 2 }], OPTS)
check(r2x1.totalDiscount === 4500, 'el 2x1 de siempre: 2 → 1 gratis')
igual(r2x1.promotions.map((p) => p.id), ['2x1'], 'el 2x1 aplicado')
igual(calculatePromotions([volumen, dosPorUno], [gaseosa(6)], OPTS).promotions.map((p) => p.id), ['2x1'], 'si chocan gana el que más ahorra')

const soloGrupo = { ...volumen, customer_segment_id: 'seg-mayoristas' }
check(calculatePromotions([soloGrupo], [gaseosa(6)], OPTS).totalDiscount === 0, 'grupo de clientes sin sesión: no aplica')
check(
  calculatePromotions([soloGrupo], [gaseosa(6)], { ...OPTS, cliente: { id: 'c1', segmentos: ['seg-mayoristas'], usos: {} } }).totalDiscount === 9000,
  'grupo de clientes con el cliente de la sesión: aplica',
)

const pistas = calculatePromotions([volumen], [gaseosa(6)], OPTS).volumeHints
igual(pistas?.['1'], { promotionId: 'vol', promotionName: 'Mayoristas de bebidas', units: 6, unitPrice: 9500, next: { missing: 6, unitPrice: 8800 } }, 'pista del carrito con 6')
igual(calculatePromotions([volumen], [gaseosa(2)], OPTS).volumeHints?.['1']?.next, { missing: 4, unitPrice: 9500 }, 'pista del carrito con 2')
check(calculatePromotions([dosPorUno], [gaseosa(2)], OPTS).volumeHints === undefined, 'sin volumen no hay pistas (respuesta de siempre)')

// 6. Desempate: con el MISMO ahorro gana la MÁS RECIENTE (mismos casos del test de contrato del ERP)
const diezVieja = promo({ id: 'vieja', name: '10 % vieja', promotion_type: 'percentage', discount_value: 10, created_at: '2026-11-01T00:00:00Z' })
const diezNueva = promo({ id: 'nueva', name: '10 % nueva', promotion_type: 'percentage', discount_value: 10, created_at: '2026-11-20T00:00:00Z' })
igual(calculatePromotions([diezVieja, diezNueva], [gaseosa(1)], OPTS).promotions.map((p) => p.id), ['nueva'], 'mismo ahorro: gana la más reciente')
igual(calculatePromotions([diezNueva, diezVieja], [gaseosa(1)], OPTS).promotions.map((p) => p.id), ['nueva'], 'mismo ahorro: no depende del orden de las filas')
const veinteVieja = { ...diezVieja, id: 'vieja20', discount_value: 20 }
igual(calculatePromotions([veinteVieja, diezNueva], [gaseosa(1)], OPTS).promotions.map((p) => p.id), ['vieja20'], 'si una ahorra más, gana esa aunque sea más vieja')
check(calculatePromotions([diezNueva], [gaseosa(2)], OPTS).promotions[0]?.perItem?.['1'] === 2200, 'perItem: lo que la promoción descontó en la línea')

// 7. Empujón de «compra X lleva Y» en el carrito («Agrega 1 más y llévala gratis (2×1)», Figma S5/S6).
//    Pista nueva y aditiva (`freeHints`): no cambia lo que se cobra.
const galletas = (q, id = 7, extra = {}) => ({ id: String(id), product_id: id, parent_product_id: null, category_id: null, name: 'Galletas de avena', price: 4500, quantity: q, ...extra })
const r1 = calculatePromotions([dosPorUno], [galletas(1)], OPTS)
igual(r1.freeHints?.['7'], { promotionId: '2x1', promotionName: '2x1', missing: 1, freeUnits: 1, label: '2×1' }, '2×1 con 1: agrega 1 más y llévala gratis')
check(r1.totalDiscount === 0 && r1.promotions.length === 0, '2×1 con 1: la pista no descuenta nada')
check(calculatePromotions([dosPorUno], [galletas(2)], OPTS).freeHints === undefined, '2×1 con 2 (ciclo completo): sin empujón')
igual(calculatePromotions([dosPorUno], [galletas(3)], OPTS).freeHints?.['7']?.missing, 1, '2×1 con 3: falta 1 para la segunda gratis')
check(calculatePromotions([dosPorUno], [galletas(3)], OPTS).totalDiscount === 4500, '2×1 con 3: el cobro de siempre (1 gratis)')
const tresPorDos = promo({ id: '3x2', name: 'Lleve 3 pague 2', promotion_type: 'buy_x_get_y', buy_quantity: 3, get_quantity: 2 })
igual(calculatePromotions([tresPorDos], [galletas(1)], OPTS).freeHints?.['7'], { promotionId: '3x2', promotionName: 'Lleve 3 pague 2', missing: 2, freeUnits: 1, label: '3×2' }, '3×2 con 1: faltan 2')
igual(calculatePromotions([tresPorDos], [galletas(2)], OPTS).freeHints?.['7']?.missing, 1, '3×2 con 2: falta 1')
check(calculatePromotions([tresPorDos], [galletas(3)], OPTS).freeHints === undefined, '3×2 con 3: sin empujón')
const unoMasUno = promo({ id: '1+1', name: 'Compra 1 lleva 1', promotion_type: 'buy_x_get_y', buy_quantity: 1, get_quantity: 1 })
igual(calculatePromotions([unoMasUno], [galletas(1)], OPTS).freeHints?.['7']?.label, '2×1', 'compra 1 lleva 1 se lee 2×1')
// Mismo producto en dos líneas (opciones distintas): cuentan juntas, como en el cobro.
check(calculatePromotions([dosPorUno], [galletas(1, 7), galletas(1, 7, { id: '7_1' })], OPTS).freeHints === undefined, 'dos líneas del mismo producto suman el ciclo')
igual(Object.keys(calculatePromotions([dosPorUno], [galletas(1, 7), galletas(1, 8)], OPTS).freeHints ?? {}), ['7', '8'], 'productos distintos: cada uno su empujón')
// Tope de descuento ya alcanzado: la unidad de más no saldría gratis → sin empujón.
check(calculatePromotions([{ ...dosPorUno, max_discount_amount: 4500 }], [galletas(3)], OPTS).freeHints === undefined, 'con el tope alcanzado no promete')
// Compra mínima: solo si al sumar las unidades se alcanza.
check(calculatePromotions([{ ...dosPorUno, min_purchase_amount: 100000 }], [galletas(1)], OPTS).freeHints === undefined, 'compra mínima inalcanzable: sin empujón')
igual(calculatePromotions([{ ...dosPorUno, min_purchase_amount: 9000 }], [galletas(1)], OPTS).freeHints?.['7']?.missing, 1, 'compra mínima que se alcanza al sumar: empuja')
check(calculatePromotions([volumen], [gaseosa(1)], OPTS).freeHints === undefined, 'sin «compra X lleva Y» no hay freeHints (respuesta de siempre)')
check(calculatePromotions([dosPorUno], [galletas(1, 7, { promo_excluded: true })], OPTS).freeHints === undefined, 'línea excluida de promociones: sin empujón')

if (problemas.length > 0) {
  console.error(`verify-precio-volumen: ${problemas.length} de ${casos} casos fallan`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`verify-precio-volumen: ${casos} casos en verde`)
