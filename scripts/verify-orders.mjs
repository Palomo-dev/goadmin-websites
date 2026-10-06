/**
 * verify-orders.mjs — compuerta del pedido web: franjas y horario de la sede, impuesto y estados.
 *
 *   node --disable-warning=ExperimentalWarning scripts/verify-orders.mjs
 *   npm run verify:orders           (corre con TZ=UTC y con TZ=America/Bogota)
 *
 * Sin base de datos ni dependencias nuevas: carga los módulos PUROS reales del sitio con
 * `module.stripTypeScriptTypes` de Node 22 (mismo método que verify-precios-pedido.mjs) y los
 * ejercita con casos fijos. Cubre lo que pide el plan del paquete A:
 *
 * 1. Franjas y validación del momento (lib/restaurant/ventanaPedido.ts):
 *    - a las 2 a. m. en Bogotá con el proceso en UTC: «lo antes posible» = SEDE_CERRADA y la
 *      primera franja es la apertura de la sede en su zona;
 *    - día `{closed:true}`: sin franjas y cerrado;
 *    - turno que pasa la medianoche: abierto a la 1 a. m. del día siguiente, fuera a las 2:30;
 *    - sede en otra zona; hora pasada; hora lejana.
 * 2. Impuesto (lib/orders/impuestoPedido.ts) contra la regla del POS del ERP
 *    (`calcularLineaVenta` de go-admin-erp/src/lib/pos/lineaVenta.ts, transcrita abajo como
 *    oráculo): incluido y no incluido, con y sin cupón, y suma de líneas = impuesto del pedido.
 * 3. Estados (lib/orders/estados-pedido.ts): cada valor de los CHECK de `web_orders` tiene
 *    etiqueta. La lista de valores es la de `pg_get_constraintdef` leída por MCP el 2026-10-06
 *    (consulta al pie); si el CHECK cambia, se actualiza aquí y el script obliga a etiquetarlo.
 * 4. Disponibilidad (lib/orders/disponibilidadPedido.ts) y envío (lib/shipping/resolveShipping.ts).
 * 5. Mesa escrita a mano (lib/orders/nombreMesa.ts y lib/orders/mesaPedido.ts): «4» encuentra
 *    «Mesa 4», la etiqueta no repite «Mesa» y una mesa de otra sede se distingue. Con un cliente
 *    falso que filtra como PostgREST; los nombres reales son «Mesa N» / «Mesa A1» (MCP 2026-10-06).
 */

import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { stripTypeScriptTypes } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const MODULOS = {
  horario: 'lib/restaurant/horario.ts',
  ventanaPedido: 'lib/restaurant/ventanaPedido.ts',
  impuestoPedido: 'lib/orders/impuestoPedido.ts',
  'estados-pedido': 'lib/orders/estados-pedido.ts',
  disponibilidadPedido: 'lib/orders/disponibilidadPedido.ts',
  resolveShipping: 'lib/shipping/resolveShipping.ts',
  nombreMesa: 'lib/orders/nombreMesa.ts',
  mesaQR: 'lib/restaurant/mesaQR.ts',
  mesaPedido: 'lib/orders/mesaPedido.ts',
}

function aMjs(ts) {
  const js = stripTypeScriptTypes(ts, { mode: 'strip' })
  return js
    .replace(/from\s+'(?:@\/lib\/[a-z]+\/|\.\/)([A-Za-z-]+)'/g, (_, nombre) => {
      if (!MODULOS[nombre]) throw new Error(`import no puro en un módulo puro: ${nombre}`)
      return `from './${nombre}.mjs'`
    })
    .replace(/^import\s+type[^\n]*\n/gm, '')
}

const dir = await mkdtemp(join(tmpdir(), 'verify-orders-'))
const m = {}
try {
  for (const [nombre, ruta] of Object.entries(MODULOS)) {
    await writeFile(join(dir, `${nombre}.mjs`), aMjs(await readFile(join(ROOT, ruta), 'utf8')))
  }
  for (const nombre of Object.keys(MODULOS)) {
    m[nombre] = await import(pathToFileURL(join(dir, `${nombre}.mjs`)).href)
  }
} finally {
  await rm(dir, { recursive: true, force: true })
}

const problemas = []
let casos = 0
function check(cond, msg) {
  casos++
  if (!cond) problemas.push(msg)
}
function igual(a, b, msg) {
  check(JSON.stringify(a) === JSON.stringify(b), `${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`)
}

const { parseHorario } = m.horario
const { franjasPedido, validarMomentoPedido, horaPedido, diaPedido } = m.ventanaPedido

// ─── 1. Franjas y momento ───────────────────────────────────────────────────────────────────
const BOG = 'America/Bogota'
const semana = parseHorario({
  monday: { open: '11:30', close: '22:00' },
  tuesday: { open: '11:30', close: '22:00' },
  wednesday: { open: '11:30', close: '22:00' },
  thursday: { open: '11:30', close: '22:00' },
  friday: { open: '18:00', close: '02:00' },
  saturday: { open: '12:00', close: '23:00' },
  sunday: { closed: true },
})

// Miércoles 2026-10-07 02:00 en Bogotá = 07:00Z.
const dosAm = new Date('2026-10-07T07:00:00Z')
const f1 = franjasPedido(semana, BOG, dosAm, { pasoMin: 30, antelacionMin: 30, diasAdelante: 2 })
igual(f1[0], '2026-10-07T16:30:00.000Z', '2 a. m. Bogotá: primera franja = 11:30 de la sede')
check(f1.every((iso) => validarMomentoPedido(semana, BOG, iso, dosAm).ok === true), '2 a. m.: toda franja ofrecida es aceptada por el servidor')
check(!f1.includes('2026-10-08T03:00:00.000Z'), '22:00 (cierre) no se ofrece')
igual(f1.includes('2026-10-08T02:30:00.000Z'), true, '21:30 sí se ofrece')
const inm = validarMomentoPedido(semana, BOG, null, dosAm)
igual(inm.ok ? 'ok' : inm.code, 'SEDE_CERRADA', '2 a. m.: lo antes posible con la sede cerrada')
check(!inm.ok && /hoy a las 11:30/.test(inm.proximaApertura || ''), '2 a. m.: próxima apertura «hoy a las 11:30»')
igual(horaPedido('2026-10-07T16:30:00.000Z', BOG), '11:30 a. m.', 'hora en la zona de la sede')
igual(diaPedido('2026-10-07T16:30:00.000Z', BOG, dosAm), 'Hoy', 'día en la zona de la sede (UTC ya es otro día no importa)')
igual(diaPedido('2026-10-08T16:30:00.000Z', BOG, dosAm), 'Mañana', 'mañana en la zona de la sede')

// Domingo cerrado: 2026-10-11 12:00 Bogotá = 17:00Z.
const domingo = new Date('2026-10-11T17:00:00Z')
const fDom = franjasPedido(semana, BOG, domingo, { diasAdelante: 1 })
igual(fDom.length, 0, 'día {closed:true}: sin franjas ese día')
const vDom = validarMomentoPedido(semana, BOG, null, domingo)
igual(vDom.ok ? 'ok' : vDom.code, 'SEDE_CERRADA', 'día {closed:true}: cerrado')
check(!vDom.ok && /mañana a las 11:30/.test(vDom.proximaApertura || ''), 'domingo: abre mañana 11:30')

// Turno que pasa la medianoche: viernes 18:00–02:00. Sábado 2026-10-10 01:00 Bogotá = 06:00Z.
const sab1am = new Date('2026-10-10T06:00:00Z')
igual(validarMomentoPedido(semana, BOG, null, sab1am).ok, true, 'medianoche: abierta a la 1 a. m. del sábado')
igual(validarMomentoPedido(semana, BOG, '2026-10-10T06:30:00Z', sab1am).ok, true, 'medianoche: 1:30 a. m. válida')
const fuera = validarMomentoPedido(semana, BOG, '2026-10-10T07:30:00Z', sab1am)
igual(fuera.ok ? 'ok' : fuera.motivo, 'fuera_de_horario', 'medianoche: 2:30 a. m. fuera de horario')
const fVie = franjasPedido(semana, BOG, new Date('2026-10-09T22:00:00Z'), { diasAdelante: 1, antelacionMin: 30 })
check(fVie.includes('2026-10-10T06:30:00.000Z'), 'medianoche: franja 1:30 a. m. ofrecida el viernes')
check(!fVie.includes('2026-10-10T07:00:00.000Z'), 'medianoche: 2:00 a. m. (cierre) no se ofrece')

// Pasado y lejano.
const pasado = validarMomentoPedido(semana, BOG, '2026-10-07T16:30:00Z', new Date('2026-10-07T18:00:00Z'))
igual(pasado.ok ? 'ok' : pasado.motivo, 'pasado', 'hora programada en el pasado')
const lejos = validarMomentoPedido(semana, BOG, '2026-10-20T17:00:00Z', dosAm)
igual(lejos.ok ? 'ok' : lejos.motivo, 'demasiado_lejos', 'hora a más de 2 días')
const basura = validarMomentoPedido(semana, BOG, 'mañana', dosAm)
igual(basura.ok ? 'ok' : basura.motivo, 'invalida', 'hora ilegible')
const normal = validarMomentoPedido(semana, BOG, '2026-10-07T11:30:00-05:00', dosAm)
igual(normal.ok ? normal.programadoPara : null, '2026-10-07T16:30:00.000Z', 'hora con offset se normaliza a ISO UTC')

// Otra zona: misma hora de pared en Madrid (UTC+2 en octubre). 2026-10-07 10:00 Madrid = 08:00Z.
const madrid = new Date('2026-10-07T08:00:00Z')
const fMad = franjasPedido(semana, 'Europe/Madrid', madrid, { diasAdelante: 1 })
igual(fMad[0], '2026-10-07T09:30:00.000Z', 'sede en Madrid: primera franja 11:30 hora de Madrid')
// La misma sede en Bogotá a ese instante (03:00) está cerrada.
igual(validarMomentoPedido(semana, BOG, null, madrid).ok, false, 'mismo instante en Bogotá: cerrada')

// Sin horario: no restringe.
igual(validarMomentoPedido(null, BOG, null, dosAm).ok, true, 'sin horario: lo antes posible permitido')
igual(franjasPedido(null, BOG, dosAm).length, 0, 'sin horario: el selector usa su generación anterior')

// ─── 2. Impuesto ────────────────────────────────────────────────────────────────────────────
// Oráculo: regla del POS (calcularLineaVenta, go-admin-erp/src/lib/pos/lineaVenta.ts).
function oraculoLinea(neto, tasa, incluido) {
  const imp = incluido ? neto - neto / (1 + tasa / 100) : (neto * tasa) / 100
  return Math.round(imp * 100) / 100
}
const { calcularImpuestoPedido } = m.impuestoPedido

const incSin = calcularImpuestoPedido({ brutos: [119000], descuento: 0, tasa: 19, incluido: true })
igual([incSin.total, incSin.sumaAlTotal], [19000, 0], 'incluido sin cupón')
const incCon = calcularImpuestoPedido({ brutos: [119000], descuento: 11900, tasa: 19, incluido: true })
igual([incCon.total, incCon.sumaAlTotal], [17100, 0], 'incluido con cupón: impuesto sobre la base con descuento')
const noIncSin = calcularImpuestoPedido({ brutos: [60000, 40000], descuento: 0, tasa: 19, incluido: false })
igual([noIncSin.total, noIncSin.sumaAlTotal], [19000, 19000], 'no incluido sin cupón')
const noIncCon = calcularImpuestoPedido({ brutos: [60000, 40000], descuento: 10000, tasa: 19, incluido: false })
igual([noIncCon.porLinea, noIncCon.total, noIncCon.sumaAlTotal], [[10260, 6840], 17100, 17100], 'no incluido con cupón prorrateado')
const raro = calcularImpuestoPedido({ brutos: [10000, 10000, 10000], descuento: 1000, tasa: 8, incluido: false })
const sumaLineas = Math.round(raro.porLinea.reduce((s, x) => s + x, 0) * 100) / 100
igual(sumaLineas, raro.total, 'Σ impuesto de líneas = impuesto del pedido')
igual(raro.porLinea, [oraculoLinea(9666.67, 8, false), oraculoLinea(9666.67, 8, false), oraculoLinea(9666.66, 8, false)], 'línea a línea = regla del POS')
const sinTasa = calcularImpuestoPedido({ brutos: [50000], descuento: 0, tasa: 0, incluido: false })
igual(sinTasa.total, 0, 'sin impuesto')
const descuentoMayor = calcularImpuestoPedido({ brutos: [5000], descuento: 9000, tasa: 19, incluido: false })
igual(descuentoMayor.total, 0, 'descuento mayor que el subtotal: impuesto 0, nunca negativo')

// ─── 3. Estados ─────────────────────────────────────────────────────────────────────────────
// select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='web_orders'::regclass and contype='c'
const CHECK_STATUS = ['pending', 'confirmed', 'preparing', 'ready', 'in_delivery', 'delivered', 'cancelled', 'rejected', 'refunded', 'expired']
const CHECK_PAGO = ['pending', 'paid', 'partial', 'refunded', 'failed']
const CHECK_TIPO = ['pickup', 'delivery_own', 'delivery_third_party']
const E = m['estados-pedido']
for (const s of CHECK_STATUS) check(!!E.ESTILO_ESTADO[s], `estado ${s} del CHECK sin etiqueta`)
for (const s of E.ESTADOS_PEDIDO) check(CHECK_STATUS.includes(s), `estado ${s} no existe en el CHECK`)
for (const s of CHECK_PAGO) check(!!E.ETIQUETA_PAGO[s], `pago ${s} del CHECK sin etiqueta`)
for (const t of [...CHECK_TIPO, 'dine_in']) {
  check(E.etiquetaTipoEntrega(t, true) !== t, `tipo ${t} sin etiqueta de restaurante`)
  check(E.etiquetaTipoEntrega(t, false) !== t, `tipo ${t} sin etiqueta de comercio`)
}
igual(E.esDomicilio('delivery_own') && E.esDomicilio('delivery_third_party') && !E.esDomicilio('delivery'), true, 'esDomicilio con los valores reales')
igual(E.esComerAqui('pickup', '[Comer aquí] Mesa: 4 (Terraza)'), true, 'comer aquí con el mapeo temporal')
for (const s of ['delivered', 'cancelled', 'rejected', 'refunded', 'expired']) check(E.esEstadoFinal(s), `${s} debe ser final`)

// ─── 4. Disponibilidad y envío ──────────────────────────────────────────────────────────────
const { evaluarDisponibilidadPedido } = m.disponibilidadPedido
const apagado = evaluarDisponibilidadPedido({ esRestaurante: true, pedidoEnLinea: false, horario: semana, zona: BOG, programadoPara: null, ahora: dosAm })
igual(apagado.ok ? 'ok' : [apagado.status, apagado.code], [403, 'PEDIDO_EN_LINEA_APAGADO'], 'pedido en línea apagado en restaurante')
const tienda = evaluarDisponibilidadPedido({ esRestaurante: false, pedidoEnLinea: false, horario: semana, zona: BOG, programadoPara: null, ahora: dosAm })
igual(tienda.ok, true, 'tienda (no restaurante): sin cambios aunque la columna esté en false')
const cerrada = evaluarDisponibilidadPedido({ esRestaurante: true, pedidoEnLinea: true, horario: semana, zona: BOG, programadoPara: null, ahora: dosAm })
igual(cerrada.ok ? 'ok' : [cerrada.status, cerrada.code], [422, 'SEDE_CERRADA'], 'restaurante cerrado: 422')
const sinFila = evaluarDisponibilidadPedido({ esRestaurante: true, pedidoEnLinea: null, horario: null, zona: BOG, programadoPara: null, ahora: dosAm })
igual(sinFila.ok, true, 'sin ajustes ni horario: se acepta como antes')

const { calcularTarifas, tarifasParaDestino } = m.resolveShipping
const tarifas = [
  { id: 'a', rate_name: 'Ciudad', base_rate: 8000, free_shipping_threshold: 50000, destination_city: 'Bogotá', valid_from: null, valid_until: null },
  { id: 'b', rate_name: 'Genérica', base_rate: 12000, free_shipping_threshold: 0, destination_city: null, valid_from: null, valid_until: '2026-01-01' },
]
igual(tarifasParaDestino(tarifas, 'bogotá', null, '2026-10-06').map((t) => t.id), ['a'], 'tarifa por ciudad (la genérica venció)')
igual(calcularTarifas([tarifas[0]], null, 60000).rates[0].cost, 0, 'envío gratis por umbral de la tarifa')
igual(calcularTarifas([tarifas[0]], null, 30000).rates[0].cost, 8000, 'tarifa bajo el umbral')

// ─── 5. Mesa escrita a mano ─────────────────────────────────────────────────────────────────
const { claveNombreMesa, etiquetaMesa } = m.nombreMesa
for (const [entrada, clave] of [['4', '4'], ['Mesa 4', '4'], ['mesa-04', '4'], ['MESA 4', '4'], ['Mesa4', '4'], ['Mesa A1', 'a1'], ['a1', 'a1'], ['Mesa', ''], ['Terraza 2', 'terraza2'], ['10', '10']]) {
  igual(claveNombreMesa(entrada), clave, `claveNombreMesa(${JSON.stringify(entrada)})`)
}
igual(etiquetaMesa('Mesa 4'), 'Mesa 4', 'etiqueta sin duplicar «Mesa»')
igual(etiquetaMesa('Mesa4'), 'Mesa4', 'etiqueta «Mesa4» tal cual')
igual(etiquetaMesa('4'), 'Mesa 4', 'etiqueta con «Mesa» si el nombre no la trae')
igual(etiquetaMesa('Mesana'), 'Mesa Mesana', '«Mesana» no empieza por la palabra «Mesa»')

const MESAS = [
  { id: '11111111-1111-4111-8111-111111111111', organization_id: 140, name: 'Mesa 4', zone: 'Terraza', branch_id: 1 },
  { id: '22222222-2222-4222-8222-222222222222', organization_id: 140, name: 'Mesa 4', zone: null, branch_id: 2 },
  { id: '33333333-3333-4333-8333-333333333333', organization_id: 140, name: 'Mesa 7', zone: null, branch_id: 2 },
  { id: '44444444-4444-4444-8444-444444444444', organization_id: 999, name: 'Mesa 9', zone: null, branch_id: 5 },
]
function clienteFalso(filas) {
  return {
    from() {
      const filtros = []
      const q = {
        select() { return q },
        eq(col, val) { filtros.push((f) => f[col] === val); return q },
        order() { return q },
        limit(n) { return Promise.resolve({ data: filas.filter((f) => filtros.every((p) => p(f))).slice(0, n), error: null }) },
        maybeSingle() { return Promise.resolve({ data: filas.find((f) => filtros.every((p) => p(f))) ?? null, error: null }) },
      }
      return q
    },
  }
}
const { buscarMesaDeOrganizacion } = m.mesaPedido
const db = clienteFalso(MESAS)
const r4 = await buscarMesaDeOrganizacion(db, 140, '4', 1)
igual(r4.ok ? r4.mesa.id : r4.motivo, MESAS[0].id, '«4» en la sede 1 → Mesa 4 de la sede 1')
const r4b = await buscarMesaDeOrganizacion(db, 140, 'mesa 4', 2)
igual(r4b.ok ? r4b.mesa.id : r4b.motivo, MESAS[1].id, '«mesa 4» en la sede 2 → Mesa 4 de la sede 2')
const r7 = await buscarMesaDeOrganizacion(db, 140, '7', 1)
igual(r7.ok ? 'ok' : [r7.motivo, r7.mesa?.id], ['otra_sede', MESAS[2].id], '«7» en la sede 1 → mesa de otra sede (con la mesa, para redirigir)')
const r9 = await buscarMesaDeOrganizacion(db, 140, '9', null)
igual(r9.ok ? 'ok' : r9.motivo, 'invalida', 'mesa de otra organización → inválida')
const rAmb = await buscarMesaDeOrganizacion(db, 140, '4', null)
igual(rAmb.ok ? 'ok' : rAmb.motivo, 'invalida', '«4» sin sede y repetida en dos sedes → inválida (sin adivinar)')
const rUuid = await buscarMesaDeOrganizacion(db, 140, MESAS[2].id.toUpperCase(), 2)
igual(rUuid.ok ? rUuid.mesa.name : rUuid.motivo, 'Mesa 7', 'uuid del QR')
const rVacia = await buscarMesaDeOrganizacion(db, 140, 'Mesa', 1)
igual(rVacia.ok ? 'ok' : rVacia.motivo, 'invalida', '«Mesa» sola → inválida')

// ─── Resultado ──────────────────────────────────────────────────────────────────────────────
const tz = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone
if (problemas.length > 0) {
  console.error(`verify-orders: ${problemas.length} de ${casos} comprobaciones fallaron (TZ del proceso: ${tz})`)
  for (const p of problemas) console.error(`  ✗ ${p}`)
  process.exit(1)
}
console.log(`verify-orders: ${casos} comprobaciones OK (TZ del proceso: ${tz})`)
