/**
 * verify-domicilio-transportadora.mjs — «Domicilio» y «Transportadora» en el checkout
 * (Figma «16 Sitio web» 2686:57152, aprobado el 2026-11-19).
 *
 *   npm run verify:domicilio-transportadora
 *
 * 1. Tipos activos: delivery_own → Domicilio, delivery_third_party → Transportadora; sin lista, el
 *    Domicilio de siempre.
 * 2. Grupo de cada tarifa por su transportadora (tercero → Transportadora; propia o sin → Domicilio);
 *    con un solo tipo activo, ese tipo usa todas las tarifas.
 * 3. Precio y tiempo de cada tarjeta (desde, gratis, plana sin tiempo; Hoy / Mañana / n–m días).
 * 4. Tipo que se guarda: el del grupo elegido si está activo; si no, el que tenga la tienda; nunca un
 *    valor fuera del CHECK de web_orders.
 * 5. `calcularTarifas` trae grupo y días; `resolverEnvio` no acepta una tarifa del otro grupo.
 * 6. El checkout, el selector y /api/orders usan todo lo anterior.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
register(pathToFileURL(join(ROOT, 'scripts/verify-pasarelas-bold-mp.cargador.mjs')).href, import.meta.url, {
  data: { root: ROOT, stub: pathToFileURL(join(ROOT, 'scripts/verify-pasarelas-bold-mp.efectos.mjs')).href },
})
const od = await import('../lib/shipping/opcionesDomicilio.ts')
const rs = await import('../lib/shipping/resolveShipping.ts')
const pw = await import('../lib/orders/pedidoWeb.ts')

const problemas = []
let casos = 0
const check = (cond, msg) => { casos++; if (!cond) problemas.push(msg) }
const igual = (a, e, msg) => check(JSON.stringify(a) === JSON.stringify(e), `${msg}: esperado ${JSON.stringify(e)}, obtenido ${JSON.stringify(a)}`)

// 1. Tipos activos
igual(od.gruposActivos(undefined), ['own'], 'sin lista: el Domicilio de siempre')
igual(od.gruposActivos(['pickup', 'delivery_own', 'delivery_third_party']), ['own', 'third_party'], 'los dos')
igual(od.gruposActivos(['delivery_third_party']), ['third_party'], 'solo transportadora')
igual(od.gruposActivos(['pickup']), [], 'sin domicilio')

// 2. Grupos de tarifas
igual([od.grupoDeTransportadora('third_party'), od.grupoDeTransportadora('own_fleet'), od.grupoDeTransportadora(null)], ['third_party', 'own', 'own'], 'grupo por transportadora')
const T = [{ id: 'a', cost: 8000, grupo: 'own', dias: 0 }, { id: 'b', cost: 15000, grupo: 'third_party', dias: 3 }, { id: 'c', cost: 12500, grupo: 'third_party', dias: 5 }]
igual(od.tarifasDelGrupo(T, 'third_party', ['own', 'third_party']).map((t) => t.id), ['b', 'c'], 'con los dos: las del grupo')
igual(od.tarifasDelGrupo(T, 'own', ['own']).map((t) => t.id), ['a', 'b', 'c'], 'con uno solo: todas (como antes)')

// 3. Tarjetas
igual([od.textoDias([0]), od.textoDias([1]), od.textoDias([3]), od.textoDias([2, 5]), od.textoDias([0, 1]), od.textoDias([null])], ['Hoy', 'Mañana', '3 días', '2–5 días', 'Hoy o mañana', null], 'texto de días')
const plana = { activo: true, tarifa: 8000, umbralGratis: 200000 }
const ambos = ['own', 'third_party']
igual(od.resumenDomicilio('third_party', T.slice(1), plana, 50000, ambos), { grupo: 'third_party', titulo: 'Transportadora', detalle: 'Envío con transportadora', costo: 12500, desde: true, tiempo: '3–5 días' }, 'transportadora con dos tarifas')
igual(od.resumenDomicilio('own', T.slice(0, 1), plana, 50000, ambos), { grupo: 'own', titulo: 'Domicilio', detalle: 'Lo lleva la tienda', costo: 8000, desde: false, tiempo: 'Hoy' }, 'domicilio con una tarifa')
igual(od.resumenDomicilio('own', [], plana, 50000, ['own']), { grupo: 'own', titulo: 'Domicilio', detalle: 'Te lo llevamos a tu dirección', costo: 8000, desde: false, tiempo: null }, 'sin tarifas: la plana y sin tiempo')
igual(od.resumenDomicilio('own', [], plana, 250000, ['own']).costo, 0, 'plana con envío gratis por monto')
igual(od.resumenDomicilio('own', [], { ...plana, activo: false }, 1000, ['own']).costo, 0, 'envío apagado: sin costo')

// 4. Tipo guardado
igual(od.tipoDomicilioGuardado('third_party', ['delivery_own', 'delivery_third_party']), 'delivery_third_party', 'eligió transportadora')
igual(od.tipoDomicilioGuardado('third_party', ['delivery_own']), 'delivery_own', 'transportadora no activa: propio')
igual(od.tipoDomicilioGuardado(null, ['delivery_third_party']), 'delivery_third_party', 'sin grupo y solo tercero: tercero')
igual(od.tipoDomicilioGuardado('basura', null), 'delivery_own', 'sin ajustes: propio')
igual(pw.tipoEntregaCliente('delivery', 0, ['pickup', 'delivery_own', 'delivery_third_party'], 'third_party'), 'delivery_third_party', 'pedido a transportadora')
igual(pw.tipoEntregaCliente('pickup', 0, null, 'third_party'), 'pickup', 'recoger no cambia')
igual(pw.tipoEntregaCliente('envio_raro', 0, null, null), 'pickup', 'un tipo fuera del CHECK no se guarda tal cual')
igual(pw.tipoEntregaCliente(undefined, 5000, ['delivery_third_party'], null), 'delivery_third_party', 'sin tipo con envío: el de la tienda')

// 5. Cálculo y cobro
const FILAS = [
  { id: 'r1', rate_name: 'Mensajero', base_rate: 8000, service_level: 'same_day', estimated_transit_days: 0, transport_carriers: { id: 'm', name: 'Propios', carrier_type: 'own_fleet' }, valid_from: null, valid_until: null, destination_city: null },
  { id: 'r2', rate_name: 'Nacional', base_rate: 15000, service_level: 'standard', estimated_transit_days: 3, transport_carriers: { id: 'n', name: 'Transportadora', carrier_type: 'third_party' }, valid_from: null, valid_until: null, destination_city: null },
]
const calc = rs.calcularTarifas(FILAS, null, 10000)
igual(calc.rates.map((r) => [r.id, r.grupo, r.dias]), [['r1', 'own', 0], ['r2', 'third_party', 3]], 'calcularTarifas trae grupo y días')
check(/estimated_transit_days, transport_carriers:carrier_id\(id, name, carrier_type\)/.test(rs.SELECT_TARIFAS), 'la consulta pide días y tipo de transportadora')
const sb = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: FILAS, error: null }) }) }) }) }) }
const base = { organizationId: 1, esDomicilio: true, ciudad: '', subtotal: 10000, ajustes: { enableShipping: true, tarifaPlana: 8000, umbralGratis: 0 }, hoy: '2026-11-19' }
igual(await rs.resolverEnvio(sb, { ...base, tarifaId: 'r2', grupo: 'third_party', activos: ambos }), { costo: 15000, fuente: 'tarifa', tarifaId: 'r2' }, 'tarifa del grupo elegido')
igual(await rs.resolverEnvio(sb, { ...base, tarifaId: 'r2', grupo: 'own', activos: ambos }), null, 'tarifa del otro grupo: no se decide')
igual(await rs.resolverEnvio(sb, { ...base, tarifaId: 'r2', grupo: 'own', activos: ['own'] }), { costo: 15000, fuente: 'tarifa', tarifaId: 'r2' }, 'con un solo tipo: cualquier tarifa (como antes)')

// 6. Uso
const fuente = (r) => readFileSync(join(ROOT, r), 'utf8')
const wiz = fuente('components/site/CheckoutWizard.tsx')
check(/gruposActivos\(settings\.availableDeliveryTypes\)/.test(wiz), 'checkout: tipos activos de los ajustes')
check(/opcionesDomicilio=\{opcionesDomicilio\}/.test(wiz) && /onGrupoDomicilio=\{setGrupoEnvio\}/.test(wiz), 'checkout: tarjetas de domicilio en el selector')
check(/tarifasGrupo\.length > 1 &&/.test(wiz), 'checkout: «Método de envío» solo con más de una tarifa del grupo')
check(/orderPayload\.grupoEnvio = grupoEnvio/.test(wiz), 'checkout: manda el grupo elegido')
const sel = fuente('components/site/OrderTypeSelector.tsx')
check(/role="radiogroup"/.test(sel) && /aria-checked=\{isSelected\}/.test(sel), 'selector accesible')
const ruta = fuente('app/api/orders/route.ts')
check(/tipoEntregaCliente\(deliveryType, resolvedShipping, tiposEntrega, grupoEnvio\)/.test(ruta), '/api/orders: guarda el tipo del grupo validado')
check(/activos: gruposActivos\(tiposEntrega\)/.test(ruta), '/api/orders: el cobro valida el grupo de la tarifa')

if (problemas.length) {
  console.error(`✗ ${problemas.length} de ${casos} comprobaciones fallaron:`)
  for (const p of problemas) console.error('  -', p)
  process.exit(1)
}
console.log(`✓ domicilio y transportadora: ${casos} comprobaciones`)
