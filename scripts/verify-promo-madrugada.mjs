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

// ── Franjas semanales que cruzan días (ERP 20261120180000, `schedule_windows`) ──
// Mismos casos que src/lib/promotions/__tests__/franjasSemanales.test.ts del ERP.
const FINDE = { desde_dia: 'saturday', desde_hora: '16:00', hasta_dia: 'sunday', hasta_hora: '14:00' }
const VIERNES_NOCHE = { desde_dia: 'friday', desde_hora: '20:00', hasta_dia: 'saturday', hasta_hora: '02:00' }
const DOMINGO_A_LUNES = { desde_dia: 'sunday', desde_hora: '22:00', hasta_dia: 'monday', hasta_hora: '03:00' }
const conFranjas = (franjas, extra = {}) => ({ ...promo, id: 'franjas', applicable_days: null, start_time: null, end_time: null, schedule_windows: franjas, ...extra })
const aplicaEn = (p, instante, timeZone = 'America/Bogota') => filterActivePromotions([p], { date: instante, timeZone }).length === 1

// Oráculo independiente: minuto de la semana en Bogotá (UTC−5 fijo), lunes = 0.
const minutoSemana = (t) => {
  const local = new Date(t.getTime() - 5 * 3600 * 1000)
  return ((local.getUTCDay() + 6) % 7) * 1440 + local.getUTCHours() * 60 + local.getUTCMinutes()
}
const oraculo = (tramos, t) => {
  const m = minutoSemana(t)
  return tramos.some(([a, b]) => (a <= m && m < b) || (a <= m + 10080 && m + 10080 < b))
}
const M = (dia, hh, mm = 0) => dia * 1440 + hh * 60 + mm
const recorrer = (p, tramos, dias, etiqueta) => {
  const inicio = new Date('2026-11-16T00:00:00-05:00').getTime()
  let fallos = 0
  for (let i = 0; i < dias * 1440; i++) {
    const t = new Date(inicio + i * 60000)
    if (aplicaEn(p, t) !== oraculo(tramos, t)) fallos++
  }
  check(fallos === 0, `${etiqueta}: ${fallos} minutos difieren del oráculo`)
}
recorrer(conFranjas([FINDE]), [[M(5, 16), M(6, 14)]], 8, 'sábado 16:00 → domingo 14:00 minuto a minuto')
recorrer(
  conFranjas([VIERNES_NOCHE, FINDE, DOMINGO_A_LUNES]),
  [[M(4, 20), M(5, 2)], [M(5, 16), M(6, 14)], [M(6, 22), M(7, 3)]],
  15,
  'tres franjas y cruce domingo → lunes minuto a minuto',
)
const bog = (local) => new Date(`${local}:00-05:00`)
check(aplicaEn(conFranjas([FINDE]), bog('2026-11-22T13:59')), 'franja: domingo 13:59 aplica')
check(!aplicaEn(conFranjas([FINDE]), bog('2026-11-22T14:00')), 'franja: domingo 14:00 ya no (fin exclusivo)')
check(aplicaEn(conFranjas([DOMINGO_A_LUNES]), bog('2026-11-23T02:59')), 'domingo → lunes: lunes 02:59 aplica')
check(!aplicaEn(conFranjas([DOMINGO_A_LUNES]), bog('2026-11-23T03:00')), 'domingo → lunes: lunes 03:00 no')
check(aplicaEn(conFranjas([FINDE]), new Date('2026-11-22T05:30:00Z')), 'franja: domingo 00:30 Bogotá leído desde UTC aplica')
check(aplicaEn(conFranjas([FINDE]), bog('2026-11-21T10:00'), 'Europe/Madrid'), 'franja: sábado 16:00 de Madrid = 10:00 de Bogotá aplica')
// end_date con cola: la ocurrencia es del día en que empezó.
const venceSabado = conFranjas([FINDE], { end_date: '2026-11-21T23:59:59.999-05:00' })
check(aplicaEn(venceSabado, bog('2026-11-22T13:59')), 'franja vence el sábado: domingo 13:59 aplica')
check(!aplicaEn(venceSabado, bog('2026-11-28T17:00')), 'franja vence el sábado: el sábado siguiente no')
const tresDias = conFranjas([{ desde_dia: 'friday', desde_hora: '18:00', hasta_dia: 'monday', hasta_hora: '06:00' }], { end_date: '2026-11-20T23:59:59.999-05:00' })
check(aplicaEn(tresDias, bog('2026-11-23T05:59')), 'franja de tres días que vence el viernes: lunes 05:59 aplica')
check(!aplicaEn(tresDias, bog('2026-11-23T06:00')), 'franja de tres días: lunes 06:00 no')
const vence17 = conFranjas([FINDE], { end_date: '2026-11-21T17:00:00-05:00' })
check(!aplicaEn(vence17, bog('2026-11-21T17:30')), 'franja que vence a las 17:00 del mismo día: 17:30 no')
// Columna rara: lista con solo franjas ilegibles = nunca; lista vacía = esquema de siempre.
check(!aplicaEn(conFranjas([{ desde_dia: 'x' }]), bog('2026-11-21T17:00')), 'franjas ilegibles: no aplica')
check(aplicaEn(conFranjas([]), bog('2026-11-18T03:00')), 'lista vacía: esquema de siempre (todo el día)')
// schedule_windows manda sobre las columnas viejas.
check(!aplicaEn({ ...finde(), schedule_windows: [VIERNES_NOCHE] }, bog('2026-11-21T17:00')), 'con franjas, applicable_days/start_time se ignoran')

if (problemas.length) {
  console.error(problemas.join('\n'))
  process.exit(1)
}
console.log(`verify-promo-madrugada: ${casos} casos en verde`)
