/**
 * verify-metodos-sede.mjs — métodos de pago por sede (ERP 20261028180000, branch_ids NULL = todas).
 *
 *   node --disable-warning=ExperimentalWarning scripts/verify-metodos-sede.mjs
 *   npm run verify:metodos-sede
 *
 * Sin base de datos: carga lib/payments/metodosPorSucursal.ts con `module.stripTypeScriptTypes`
 * y comprueba el filtro del checkout y la validación de /api/orders (caso Space Cocktails:
 * DIDI solo en El Socorro 117, no en San Javier 120 ni en La 88 121).
 */
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import assert from 'node:assert/strict'

const src = readFileSync(new URL('../lib/payments/metodosPorSucursal.ts', import.meta.url), 'utf8')
const m = await import('data:text/javascript,' + encodeURIComponent(stripTypeScriptTypes(src)))
const { filtrarMetodosPorSede, metodoPermitidoEnSede, validarMetodoEnSede, esColumnaAusente } = m

let n = 0
const caso = (nombre, fn) => { fn(); n++; console.log('✓', nombre) }

caso('sin configuración (NULL, vacío, ausente) el checkout muestra lo mismo que hoy en cualquier sede', () => {
  const metodos = [{ code: 'cash' }, { code: 'didi', branchIds: null }, { code: 'x', branchIds: [] }]
  for (const sede of [117, 120, 121, null, undefined]) assert.deepEqual(filtrarMetodosPorSede(metodos, sede), metodos)
})
caso('DIDI [117]: visible en 117, oculto en 120 y 121; sin sede se muestra', () => {
  const metodos = [{ code: 'cash' }, { code: 'didi_transferencia', branchIds: [117] }]
  assert.deepEqual(filtrarMetodosPorSede(metodos, 117).map((x) => x.code), ['cash', 'didi_transferencia'])
  assert.deepEqual(filtrarMetodosPorSede(metodos, 120).map((x) => x.code), ['cash'])
  assert.deepEqual(filtrarMetodosPorSede(metodos, 121).map((x) => x.code), ['cash'])
  assert.equal(metodoPermitidoEnSede([117], null), true)
  assert.equal(metodoPermitidoEnSede(['117'], 117), true)
})
caso('/api/orders: sin fila (pasarela), sin método o sin restricción → se acepta como antes', () => {
  assert.deepEqual(validarMetodoEnSede([], 'wompi', 120), { ok: true })
  assert.deepEqual(validarMetodoEnSede(null, 'wompi', 120), { ok: true })
  assert.deepEqual(validarMetodoEnSede([{ branch_ids: [117] }], '', 120), { ok: true })
  assert.deepEqual(validarMetodoEnSede([{ branch_ids: [117] }], undefined, 120), { ok: true })
  assert.deepEqual(validarMetodoEnSede([{ branch_ids: null }], 'cash', 120), { ok: true })
  assert.deepEqual(validarMetodoEnSede([{ branch_ids: [] }], 'cash', 120), { ok: true })
})
caso('/api/orders: DIDI [117] se acepta en 117 y se rechaza en 120/121 con mensaje en español', () => {
  const filas = [{ branch_ids: [117], website_display_name: 'DIDI transferencia', payment_methods: { name: 'DIDI  transferen' } }]
  assert.deepEqual(validarMetodoEnSede(filas, 'didi_transferencia', 117), { ok: true })
  for (const sede of [120, 121]) {
    const r = validarMetodoEnSede(filas, 'didi_transferencia', sede)
    assert.equal(r.ok, false)
    assert.equal(r.code, 'METODO_PAGO_NO_DISPONIBLE_EN_SEDE')
    assert.equal(r.error, 'El método de pago «DIDI transferencia» no está disponible en esta sede. Elige otro método de pago.')
  }
  const sinNombreWeb = validarMetodoEnSede([{ branch_ids: [117], payment_methods: { name: 'Didi' } }], 'didi_transferencia', 120)
  assert.match(sinNombreWeb.error, /«Didi»/)
})
caso('columna ausente (migración sin aplicar) se detecta; otros errores no', () => {
  assert.equal(esColumnaAusente({ code: '42703', message: 'column organization_payment_methods.branch_ids does not exist' }, 'branch_ids'), true)
  assert.equal(esColumnaAusente({ code: 'PGRST204', message: "Could not find the 'branch_ids' column" }, 'branch_ids'), true)
  assert.equal(esColumnaAusente({ code: '42501', message: 'permission denied' }, 'branch_ids'), false)
})

caso('sin sede elegida, el checkout filtra con la sede por defecto de /api/orders (sedeMetodos = sedePromocion ?? sedePorDefectoId)', () => {
  const metodos = [{ code: 'cash', branchIds: null }, { code: 'didi_transferencia', branchIds: [117] }]
  const sedeMetodos = (sedePromocion, sedePorDefectoId) => sedePromocion ?? sedePorDefectoId
  // Por defecto San Javier (120): DIDI no se ofrece, igual que el 422 del servidor.
  assert.deepEqual(m.filtrarMetodosPorSede(metodos, sedeMetodos(null, 120)).map((x) => x.code), ['cash'])
  assert.equal(m.validarMetodoEnSede([{ branch_ids: [117] }], 'didi_transferencia', 120).ok, false)
  // La sede elegida gana sobre la de por defecto.
  assert.deepEqual(m.filtrarMetodosPorSede(metodos, sedeMetodos(117, 120)).map((x) => x.code), ['cash', 'didi_transferencia'])
  // Sin branch_ids configurados (la página manda null): todo igual que hoy.
  const sinSedes = [{ code: 'cash', branchIds: null }, { code: 'nequi', branchIds: null }]
  assert.deepEqual(m.filtrarMetodosPorSede(sinSedes, sedeMetodos(null, null)).map((x) => x.code), ['cash', 'nequi'])
})

// ── Promociones por método de pago (promotions.payment_method_codes) ──
const srcPromo = readFileSync(new URL('../lib/promotions.ts', import.meta.url), 'utf8')
const P = await import('data:text/javascript,' + encodeURIComponent(stripTypeScriptTypes(srcPromo)))
const promoBase = (extra = {}) => ({
  id: 'p1', name: '10 % DIDI', is_active: true, applies_to_web: true, applies_to: 'all', promotion_type: 'percentage',
  discount_value: 10, start_date: '2026-01-01T00:00:00Z', end_date: null, branches: null, promotion_rules: [], ...extra,
})
const itemsPromo = [{ id: 1, productId: 1, product_id: 1, name: 'Mojito', price: 30000, quantity: 1, category_id: null, parent_product_id: null }]
const fecha = new Date('2026-10-28T20:00:00Z')
const descuento = (promo, paymentMethod) => P.calculatePromotions([promo], itemsPromo, { date: fecha, paymentMethod }).totalDiscount

caso('promoción sin payment_method_codes (NULL, [], columna ausente) aplica igual que hoy', () => {
  for (const extra of [{}, { payment_method_codes: null }, { payment_method_codes: [] }]) {
    for (const metodo of [undefined, null, 'cash', 'didi_transferencia']) assert.equal(descuento(promoBase(extra), metodo), 3000)
  }
})
caso('promoción solo DIDI: aplica con DIDI; no con efectivo ni sin método elegido', () => {
  const p = promoBase({ payment_method_codes: ['didi_transferencia'] })
  assert.equal(descuento(p, 'didi_transferencia'), 3000)
  assert.equal(descuento(p, 'cash'), 0)
  assert.equal(descuento(p, undefined), 0)
  assert.equal(descuento(p, ''), 0)
  assert.equal(P.promocionAplicaConMetodo(['didi_transferencia', 'nequi'], 'nequi'), true)
})
console.log(`\n${n} casos OK `)
