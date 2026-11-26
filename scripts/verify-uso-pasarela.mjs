/**
 * verify-uso-pasarela.mjs — «Usar en la tienda para» de cada pasarela (ERP Finanzas › Métodos de
 * pago, `organization_payment_methods.website_usage`, migración 20261126120000).
 *
 *   npm run verify:uso-pasarela
 *
 * Sin base ni red: importa los módulos REALES (`getWebsitePaymentMethods`, `pasarelasActivasSede`,
 * `pasarelaPermitidaParaAnticipo`, `evaluarContraentregaServidor`) con una base en memoria
 * (verify-uso-pasarela.bd.mjs en lugar de `@/lib/supabase/server`).
 *
 * Casos:
 *  1. Sin ajuste (columna ausente o todo «ambos»): checkout y anticipo IDÉNTICOS a hoy.
 *  2. «Solo anticipo»: no sale en los métodos del checkout; sí cobra el anticipo.
 *  3. «Solo pago completo»: sale en el checkout; no se usa para el anticipo (la primera que lo
 *     permita, en el mismo orden de hoy).
 *  4. Un anticipo en curso con su pasarela ya asignada se sigue cobrando con ella.
 *  5. Los métodos nativos nunca se filtran.
 *  6. El fuente usa todo lo anterior (checkout, consulta del pedido, lectura con respaldo) y los
 *     webhooks no miran el uso.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BD = pathToFileURL(join(ROOT, 'scripts/verify-uso-pasarela.bd.mjs')).href
register(pathToFileURL(join(ROOT, 'scripts/verify-uso-pasarela.cargador.mjs')).href, import.meta.url, {
  data: { root: ROOT, stub: BD },
})

const { getWebsitePaymentMethods } = await import('../lib/checkout/metodosPagoSitio.ts')
const { metodosPagoCompleto, sirveAnticipo, sirvePagoCompleto, usoTienda } = await import('../lib/payments/usoPasarela.ts')
const { pasarelasActivasSede, pasarelaPermitidaParaAnticipo, evaluarContraentregaServidor, pasarelaElegida } = await import('../lib/contraentrega/contraentregaServidor.ts')
const supabase = (await import(BD)).createAdminClient()

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const igual = (msg, real, esperado) => check(JSON.stringify(real) === JSON.stringify(esperado), `${msg}: ${JSON.stringify(real)} ≠ ${JSON.stringify(esperado)}`)

const ORG = 7
const SEDE = 3
const fila = (id, code, conexion, orden, uso) => ({
  id, organization_id: ORG, payment_method_code: code, is_active: true, show_on_website: true,
  website_display_order: orden, website_display_name: null, website_description: null, website_icon: null,
  integration_connection_id: conexion, payment_methods: { name: code, requires_reference: false }, branch_ids: null,
  ...(uso === undefined ? {} : { website_usage: uso }),
})
const condicionesAnticipo = {
  contraentrega: { version: 1, sedes: { [SEDE]: { ofrecer: true, anticipo: { tipo: 'fijo', valorFijo: 10000, pasarela: null, plazoMinutos: 30 } } } },
}
const base = (usos, extra = {}) => ({
  sinColumnaUso: false,
  conexiones: [],
  metodos: [
    { ...fila(1, 'cash', null, 0, 'ambos'), settings: condicionesAnticipo },
    fila(2, 'wompi', 'c-wompi', 1, usos.wompi),
    fila(3, 'mp', 'c-mp', 2, usos.mp),
    fila(4, 'bold_link', 'c-bold', 3, usos.bold),
    fila(5, 'transfer', null, 4, usos.transfer),
  ],
  ...extra,
})
const codigos = (ms) => ms.map((m) => m.code)
const checkout = async () => codigos(metodosPagoCompleto(await getWebsitePaymentMethods(ORG)))
const anticipo = () => pasarelasActivasSede(ORG, SEDE)
const evaluar = () => evaluarContraentregaServidor(supabase, {
  organizationId: ORG, branchId: SEDE, tipoEntrega: 'delivery_own', subtotalProductos: 100000, envio: 8000,
  total: 108000, zonaId: null, items: [], customerId: null,
})
const permitida = (gateway, extra = {}) => pasarelaPermitidaParaAnticipo(supabase, { organization_id: ORG, branch_id: SEDE, ...extra }, gateway)

// ── 0. La regla pura ──
igual('0a: sin valor = ambos', [usoTienda(undefined), usoTienda(null), usoTienda('x')], ['ambos', 'ambos', 'ambos'])
check(!sirvePagoCompleto({ type: 'gateway', uso: 'solo_anticipo' }), '0b: pasarela «solo anticipo» no es pago completo')
check(sirvePagoCompleto({ type: 'native', uso: 'solo_anticipo' }), '0c: un nativo nunca se filtra (pago completo)')
check(!sirveAnticipo({ type: 'gateway', uso: 'solo_pago_completo' }), '0d: pasarela «solo pago completo» no cobra anticipo')
check(sirveAnticipo({ type: 'native', uso: 'solo_pago_completo' }), '0e: un nativo nunca se filtra (anticipo)')

// ── 1. Sin ajuste: idéntico a hoy ──
const HOY_CHECKOUT = ['cash', 'wompi', 'mp', 'bold_link', 'transfer']
const HOY_ANTICIPO = ['wompi_co', 'mp_checkout', 'bold_link']
const AMBOS = { wompi: 'ambos', mp: 'ambos', bold: 'ambos', transfer: 'ambos' }
globalThis.__bdUso = base({}, { sinColumnaUso: true })
igual('1a: columna ausente → checkout de siempre', await checkout(), HOY_CHECKOUT)
igual('1b: columna ausente → anticipo de siempre', await anticipo(), HOY_ANTICIPO)
check((await getWebsitePaymentMethods(ORG)).every((m) => m.uso === 'ambos'), '1c: columna ausente → todas «ambos»')
const sinUso = (ms) => ms.map(({ uso, ...resto }) => resto)
const antes = sinUso(await getWebsitePaymentMethods(ORG))
globalThis.__bdUso = base(AMBOS)
igual('1d: todo «ambos» → checkout de siempre', await checkout(), HOY_CHECKOUT)
igual('1e: todo «ambos» → anticipo de siempre', await anticipo(), HOY_ANTICIPO)
igual('1f: con la columna en «ambos», los métodos son los mismos campo por campo', sinUso(await getWebsitePaymentMethods(ORG)), antes)
igual('1g: la primera pasarela del anticipo sigue siendo la de hoy', pasarelaElegida(await anticipo(), null), 'wompi_co')
igual('1h: contraentrega con anticipo ofrecida con las de siempre', (await evaluar()).resultado.anticipo?.pasarelas, HOY_ANTICIPO)
igual('1i: el anticipo se paga con cualquiera de las de siempre', [await permitida('wompi'), await permitida('mp'), await permitida('bold_link')], HOY_ANTICIPO)

// ── 2. «Solo anticipo» ──
globalThis.__bdUso = base({ ...AMBOS, wompi: 'solo_anticipo' })
igual('2a: «solo anticipo» no sale en el checkout', await checkout(), ['cash', 'mp', 'bold_link', 'transfer'])
igual('2b: «solo anticipo» sí cobra el anticipo (mismo orden)', await anticipo(), HOY_ANTICIPO)
igual('2c: y sigue siendo la primera para el anticipo', pasarelaElegida(await anticipo(), null), 'wompi_co')
igual('2d: el anticipo se puede pagar con ella', await permitida('wompi'), 'wompi_co')
igual('2e: la evaluación la ofrece para el anticipo', (await evaluar()).resultado.anticipo?.pasarelas, HOY_ANTICIPO)

// ── 3. «Solo pago completo» ──
globalThis.__bdUso = base({ ...AMBOS, wompi: 'solo_pago_completo' })
igual('3a: «solo pago completo» sale en el checkout', await checkout(), HOY_CHECKOUT)
igual('3b: «solo pago completo» no cobra el anticipo', await anticipo(), ['mp_checkout', 'bold_link'])
igual('3c: el anticipo toma la primera que lo permite (mismo orden)', pasarelaElegida(await anticipo(), null), 'mp_checkout')
igual('3d: pedirla para el anticipo se rechaza', await permitida('wompi_co'), null)
igual('3e: la evaluación ofrece el anticipo con las demás', (await evaluar()).resultado.anticipo?.pasarelas, ['mp_checkout', 'bold_link'])
globalThis.__bdUso = base({ ...AMBOS, wompi: 'solo_pago_completo', mp: 'solo_pago_completo', bold: 'solo_pago_completo' })
const r3 = await evaluar()
check(r3.resultado.disponible === false && r3.resultado.motivos.some((m) => m.codigo === 'sin_pasarela'), '3f: ninguna para anticipo → no se ofrece (como hoy sin pasarelas)')
igual('3g: y el checkout sigue con todas', await checkout(), HOY_CHECKOUT)

// ── 4. Anticipo en curso con su pasarela ya asignada ──
globalThis.__bdUso = base({ ...AMBOS, wompi: 'solo_pago_completo' })
igual('4a: anticipo en curso con wompi se sigue cobrando con wompi', await permitida('wompi', { advance_gateway: 'wompi_co' }), 'wompi_co')
igual('4b: otra pasarela «solo pago completo» no entra por esa puerta', await permitida('wompi', { advance_gateway: 'mp_checkout' }), null)
globalThis.__bdUso.metodos = globalThis.__bdUso.metodos.filter((m) => m.payment_method_code !== 'wompi')
igual('4c: si ya no está activa, no', await permitida('wompi', { advance_gateway: 'wompi_co' }), null)

// ── 5. Nativos ──
globalThis.__bdUso = base({ ...AMBOS, transfer: 'solo_anticipo' })
check((await checkout()).includes('transfer'), '5a: un nativo con un uso raro sigue en el checkout')

// ── 6. Fuente (regex tolerantes a CRLF) ──
const leer = (r) => readFileSync(join(ROOT, r), 'utf8')
check(/getWebsitePaymentMethods\(organization\.id\)\.then\(metodosPagoCompleto\)/.test(leer('app/checkout/page.tsx')), '6a: el checkout filtra con metodosPagoCompleto')
const consultaPedido = leer('app/api/orders/[id]/tracking/route.ts')
check(/advance_status === 'pending' \? sirveAnticipo : sirvePagoCompleto/.test(consultaPedido), '6b: «Pagar con otro medio» filtra por anticipo o pago completo')
check(/m\.type === 'gateway' && sirve\(m\)/.test(consultaPedido), '6c: la consulta del pedido aplica el filtro')
check(/esColumnaAusente\(orgError, 'website_usage'\)\)\s*\{\s*\(\{ data: orgMethods, error: orgError \} = await leer\(', branch_ids'\)\)/.test(leer('lib/checkout/metodosPagoSitio.ts')), '6d: sin la columna se lee como antes')
check(/codigosPasarela\(enSede\.filter\(sirveAnticipo\)\)/.test(leer('lib/contraentrega/contraentregaServidor.ts')), '6e: el anticipo filtra con sirveAnticipo')
const webhooks = ['wompi_co', 'bold', 'mercadopago'].map((w) => leer(`app/api/webhooks/${w}/route.ts`)).join('\n')
check(!/website_usage|usoPasarela|sirveAnticipo|sirvePagoCompleto/.test(webhooks), '6f: los webhooks no miran el uso (se procesan como hoy)')

if (problemas.length > 0) {
  console.error(`✗ verify-uso-pasarela: ${problemas.length} de ${casos} casos fallan`)
  for (const p of problemas) console.error('  - ' + p)
  process.exit(1)
}
console.log(`✓ verify-uso-pasarela: ${casos} casos`)
