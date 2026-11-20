/**
 * verify-promo-madrugada.mjs — franja que cruza la medianoche.
 *
 *   npm run verify:promo-madrugada
 *
 * Sin base de datos. Una promo «lunes a miércoles 18:00–02:00» debe seguir
 * aplicando el jueves entre las 00:00 y las 02:00 (cola del miércoles) y no
 * el lunes de madrugada (cola del domingo). Mismo criterio que el ERP.
 */
import { filterActivePromotions } from '../lib/promotions.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const promo = {
  id: 'p1', name: 'lun-mie', promotion_type: 'percentage', discount_value: 10, applies_to: 'all',
  start_date: null, end_date: null, is_active: true, usage_limit: null, usage_count: 0, is_combinable: false,
  priority: 0, branches: null, applies_to_web: true, applicable_days: ['monday', 'tuesday', 'wednesday'],
  start_time: '18:00:00', end_time: '02:00:00', promotion_rules: [],
}
const aplica = (iso) => filterActivePromotions([promo], { date: new Date(iso), timeZone: 'America/Bogota' }).length === 1

check(aplica('2026-10-08T06:00:00Z'), 'jueves 01:00 Bogotá aplica (cola del miércoles)')
check(aplica('2026-10-08T07:00:00Z'), 'jueves 02:00 Bogotá aplica (último minuto)')
check(!aplica('2026-10-08T07:01:00Z'), 'jueves 02:01 Bogotá ya no aplica')
check(!aplica('2026-10-09T01:00:00Z'), 'jueves 20:00 Bogotá no aplica')
check(!aplica('2026-10-05T06:00:00Z'), 'lunes 01:00 Bogotá no aplica (cola del domingo)')
check(aplica('2026-10-06T06:00:00Z'), 'martes 01:00 Bogotá aplica (cola del lunes)')
check(aplica('2026-10-08T01:00:00Z'), 'miércoles 20:00 Bogotá aplica')

// «Sábado 16:00 a domingo 14:00» (sábado + 16:00–14:00), caso de un cliente (2026-11-20).
const finde = (extra = {}) => ({ ...promo, id: 'finde', applicable_days: ['saturday'], start_time: '16:00:00', end_time: '14:00:00', ...extra })
const aplicaFinde = (p, local) => filterActivePromotions([p], { date: new Date(`${local}:00-05:00`), timeZone: 'America/Bogota' }).length === 1
check(!aplicaFinde(finde(), '2026-11-21T15:59'), 'sábado 15:59 no aplica')
check(aplicaFinde(finde(), '2026-11-21T16:00'), 'sábado 16:00 aplica')
check(aplicaFinde(finde(), '2026-11-22T00:30'), 'domingo 00:30 aplica')
check(aplicaFinde(finde(), '2026-11-22T14:00'), 'domingo 14:00 aplica')
check(!aplicaFinde(finde(), '2026-11-22T14:01'), 'domingo 14:01 no aplica')
check(!aplicaFinde(finde(), '2026-11-21T10:00'), 'sábado 10:00 no aplica (cola del viernes)')
// Vence el sábado: la cola del domingo sigue contando; el fin de semana siguiente no.
const vence = finde({ end_date: '2026-11-21T23:59:59.999-05:00' })
check(aplicaFinde(vence, '2026-11-22T09:00'), 'vence el sábado: domingo 09:00 aplica')
check(!aplicaFinde(vence, '2026-11-22T14:01'), 'vence el sábado: domingo 14:01 no aplica')
check(!aplicaFinde(vence, '2026-11-29T01:00'), 'vence el sábado: el domingo siguiente no aplica')
check(!aplicaFinde(finde({ end_date: 'basura' }), '2026-11-21T20:00'), 'fecha fin ilegible: no aplica (igual que el ERP)')

if (problemas.length) {
  console.error(problemas.join('\n'))
  process.exit(1)
}
console.log(`verify-promo-madrugada: ${casos} casos en verde`)
