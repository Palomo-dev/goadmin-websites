/**
 * verify-carta-qr.mjs — contrato y reglas de la Carta QR en la mesa, sin dependencias.
 *
 *   node --disable-warning=ExperimentalWarning scripts/verify-carta-qr.mjs
 *   ERP_REPO=/ruta/a/go-admin-erp node … scripts/verify-carta-qr.mjs
 *
 * Qué comprueba:
 * 1. Contrato de secciones (lib/website/v2/contrato/seccionesMesa.ts): defaults iguales a las
 *    láminas, normalizadores que no rompen con basura, marcadores y la copia idéntica en el ERP.
 * 2. Lector del sitio: el SECTION_MAP registra los cuatro tipos con sus variantes, la variante
 *    «mesa» de restaurant_hero y «qr» de menu_full, y cada envoltura declara las CONTENT_KEYS
 *    del contrato (lo que lee el manifiesto que compara el ERP).
 * 3. Modelo de la mesa (lib/restaurant/mesa-modelo.ts): partes iguales y propina como la base,
 *    lectura defensiva del pedido y de la cuenta.
 * 4. Reglas de seguridad en el fuente: las rutas /api/mesa toman la organización del host, la
 *    mesa del QR, limitan por IP y por mesa (1 llamado al mesero por mesa cada 60 s), usan el
 *    cliente estricto y nunca pasan una organización del body a las RPC; checkout/init lee el
 *    abono con la organización del host; el webhook despacha CQR- con firma obligatoria y la
 *    organización del abono; /api/orders solo crea ficha de cliente con correo.
 * 5. Si el ERP está al lado: cada RPC que llama el sitio existe en las migraciones con
 *    EXACTAMENTE esos parámetros; las migraciones son aditivas y tienen rollback.
 */
import { readFile, writeFile, mkdtemp, mkdir, rm, access, readdir } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { stripTypeScriptTypes } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ERP = resolve(process.env.ERP_REPO || join(ROOT, '..', 'go-admin-erp'))
let fallos = 0
let total = 0
const notas = []
function check(cond, msg) {
  total++
  if (!cond) {
    fallos++
    console.error('✗', msg)
  }
}
const existe = (p) => access(p).then(() => true, () => false)
const leer = (rel) => readFile(join(ROOT, rel), 'utf8')

// Módulos TS puros → .mjs temporales dentro del repo.
const tmp = await mkdtemp(join(ROOT, 'node_modules', '.verify-carta-qr-'))
let contrato, modelo, ronda
try {
  await writeFile(join(tmp, 'contrato.mjs'), stripTypeScriptTypes(await leer('lib/website/v2/contrato/seccionesMesa.ts'), { mode: 'strip' }))
  await writeFile(join(tmp, 'modelo.mjs'), stripTypeScriptTypes(await leer('lib/restaurant/mesa-modelo.ts'), { mode: 'strip' }))
  contrato = await import(pathToFileURL(join(tmp, 'contrato.mjs')).href)
  modelo = await import(pathToFileURL(join(tmp, 'modelo.mjs')).href)
  const rondaTs = (await leer('lib/orders/rondaMesa.ts')).replace("'@/lib/restaurant/mesa-modelo'", "'./modelo.mjs'")
  await writeFile(join(tmp, 'ronda.mjs'), stripTypeScriptTypes(rondaTs, { mode: 'strip' }))
  ronda = await import(pathToFileURL(join(tmp, 'ronda.mjs')).href)
} finally {
  await rm(tmp, { recursive: true, force: true })
}

// ─── 1. Contrato de secciones ────────────────────────────────────────────────
check(JSON.stringify(contrato.TIPOS_SECCION_MESA) === JSON.stringify(['table_service', 'table_order', 'table_bill', 'visit_feedback']), 'cuatro tipos nuevos')
check(contrato.VARIANTE_PORTADA_MESA === 'mesa' && contrato.VARIANTE_CARTA_QR === 'qr', 'variantes mesa y qr')
check(contrato.VARIANTES_SECCION_MESA.table_bill[0] === 'hoja', 'table_bill: variante «hoja» por defecto')
const portada = contrato.normalizarPortadaMesa({})
check(portada.eyebrow === 'Bienvenidos a la' && portada.title === '{mesa}' && portada.primaryCtaText === 'Ver la carta', 'portada mesa: defaults de la lámina 01')
check(contrato.normalizarPortadaMesa({ allergy_note: '' }).allergyNote === '', 'portada mesa: aviso de alergias se puede vaciar')
const servicio = contrato.normalizarServicioMesa({ reasons: [{ label: '' }, 'x', { id: 'Mala Id!', label: 'Hielo', icon: 'nope' }], cooldown_seconds: 5 })
check(servicio.reasons.length === 1 && servicio.reasons[0].id === 'motivo_3' && servicio.reasons[0].icon === 'help', 'servicio: motivos saneados')
check(servicio.cooldownSeconds === 60, 'servicio: espera fuera de rango = 60 s')
check(contrato.normalizarServicioMesa({}).reasons.length === 4, 'servicio: cuatro motivos por defecto (lámina 07)')
const cuenta = contrato.normalizarCuentaMesa({ pay_online: false, pay_at_table: false, tip_options: [15, 'x', 10, 99, 10, 0] })
check(cuenta.payAtTable === true, 'cuenta: sin pago en línea ni en la mesa, queda «pagar en la mesa»')
check(JSON.stringify(cuenta.tipOptions) === JSON.stringify([0, 10, 15]), 'cuenta: propinas saneadas y ordenadas')
check(JSON.stringify(contrato.normalizarCuentaMesa({}).splitModes) === JSON.stringify(['todo', 'iguales', 'comensal']), 'cuenta: tres formas de dividir')
check(contrato.normalizarCuentaMesa({}).title === 'La cuenta de la {mesa}', 'cuenta: título de la lámina 08')
check(contrato.normalizarValorarVisita({ reviews_url: 'http://x.co' }).reviewsUrl === '', 'valorar: reseñas solo https')
check(contrato.normalizarValorarVisita({}).aspects.join('|') === 'La comida|El servicio|Rapidez|Ambiente', 'valorar: aspectos de la lámina 10')
check(contrato.normalizarPedidoMesa({ default_view: 'otra' }).defaultView === 'ronda', 'pedido: vista por ronda por defecto')
check(contrato.reemplazarMarcadores('{zona} · {sede}', { zona: 'Terraza', sede: null }) === 'Terraza', 'marcadores: sin valor se quita el separador')
check(contrato.reemplazarMarcadores('La cuenta de la {mesa}', { mesa: 'Mesa 7' }) === 'La cuenta de la Mesa 7', 'marcadores: {mesa}')
check(contrato.reemplazarMarcadores('¿Enviamos la ronda {n} a cocina?', { n: 3 }) === '¿Enviamos la ronda 3 a cocina?', 'marcadores: {n}')
check(contrato.normalizarCartaQr({ show_search: 'false' }).showSearch === false && contrato.normalizarCartaQr({}).askDiner === true, 'carta qr: booleanos')
check(JSON.stringify(contrato.SECCIONES_PAGINA_CARTA_QR.map((s) => s.tipo)) === JSON.stringify(['restaurant_hero', 'table_service', 'menu_full', 'table_order', 'table_bill', 'visit_feedback', 'hours_location']), 'plantilla de página en el orden de la lámina 17')
const contratoTs = await leer('lib/website/v2/contrato/seccionesMesa.ts')
check(!/^import /m.test(contratoTs), 'contrato sin imports (se copia tal cual al ERP)')
const copiaErp = join(ERP, 'src/lib/website/contrato/seccionesMesa.ts')
if (await existe(copiaErp)) check((await readFile(copiaErp, 'utf8')) === contratoTs, 'la copia del ERP es idéntica')
else notas.push(`Sin el ERP en ${ERP}: no se compara la copia del contrato.`)

// ─── 2. Lector del sitio ─────────────────────────────────────────────────────
const renderer = await leer('components/sections/SectionRenderer.tsx')
const bloque = (tipo) => new RegExp(`\\n  ${tipo}: \\{([^}]*)\\}`).exec(renderer)?.[1] ?? ''
for (const [tipo, variantes] of Object.entries(contrato.VARIANTES_SECCION_MESA)) {
  for (const v of variantes) check(new RegExp(`\\b${v}:`).test(bloque(tipo)), `SECTION_MAP: ${tipo}.${v}`)
}
check(/\bmesa: SeccionPortadaMesa/.test(bloque('restaurant_hero')), 'SECTION_MAP: restaurant_hero.mesa')
check(/\bqr: MenuFull/.test(bloque('menu_full')), 'SECTION_MAP: menu_full.qr')
const secciones = await leer('components/sections/restaurant/mesa/secciones.tsx')
check(!/^'use client'/m.test(secciones), 'envolturas sin «use client» (el manifiesto lee CONTENT_KEYS)')
for (const [envoltura, claves] of [['SeccionPortadaMesa', 'CLAVES_PORTADA_MESA'], ['SeccionServicioMesa', 'CLAVES_SERVICIO_MESA'], ['SeccionPedidoMesa', 'CLAVES_PEDIDO_MESA'], ['SeccionCuentaMesa', 'CLAVES_CUENTA_MESA'], ['SeccionValorarVisita', 'CLAVES_VALORAR_VISITA']]) {
  check(secciones.includes(`${envoltura}.CONTENT_KEYS = ${claves}`), `${envoltura} declara ${claves}`)
}
check(/organization: \{ id: p\.organization\.id, name: p\.organization\.name, subdomain/.test(secciones), 'al navegador solo viaja id, nombre y subdominio de la organización')
const menuFull = await leer('components/sections/restaurant/MenuFull.tsx')
check(/\.\.\.CLAVES_CARTA_QR/.test(menuFull) && /'qr'\]/.test(menuFull), 'menu_full: claves y variante qr')

// ─── 3. Modelo de la mesa ────────────────────────────────────────────────────
check(modelo.parteIgual(236000, 4, 236000, 1) === 59000, 'partes iguales: 236.000 / 4 = 59.000 (lámina 08)')
check(modelo.parteIgual(100000, 3, 100000, 1) === 33334, 'partes iguales: redondeo hacia arriba a la unidad (como la base)')
check(modelo.parteIgual(236000, 4, 20000, 1) === 20000, 'partes iguales: tope en el saldo')
check(modelo.propinaPorcentaje(59000, 10, 1) === 5900, 'propina 10 % de 59.000 = 5.900 (lámina 08)')
// Impuesto del pedido (lámina 04): es el de la venta y cubre solo lo enviado. 150.000 con 11.111 de
// impoconsumo da 8 %; la ronda local de 86.000 no tiene impuesto calculado y no se le imputa.
{
  const sinLocal = modelo.impuestoDelPedido(150000, 11111, true, 0)
  check(sinLocal?.tasa === 8 && sinLocal?.valor === 11111 && sinLocal?.soloEnviado === false, 'impuesto: 11.111 sobre 150.000 enviados = 8 %')
  const conLocal = modelo.impuestoDelPedido(150000, 11111, true, 86000)
  check(conLocal?.valor === 11111 && conLocal?.soloEnviado === true, 'impuesto: con ronda local sin enviar, la línea dice «Lo enviado incluye» y no lo atribuye al total de 236.000')
  const todo = modelo.impuestoDelPedido(236000, 17481, true, 0)
  check(todo?.tasa === 8 && todo?.valor === 17481, 'impuesto: con las tres rondas en la venta, 17.481 sobre 236.000 (lámina)')
  check(modelo.impuestoDelPedido(150000, 0, true, 0) === null && modelo.impuestoDelPedido(150000, 11111, false, 0) === null, 'impuesto: sin impuesto o no incluido, no hay línea')
}
const ped = modelo.parsePedidoMesa({ mesa: { id: 'm', nombre: 'Mesa 7' }, sesion: null, rondas: [{ clave: 'a', numero: 1, estado: 'raro', items: [{ id: 1, nombre: 'X', cantidad: '2', total: '10', comensal: 'Ana', estado: null }] }], total: '10' })
check(ped && ped.sesion === null && ped.rondas[0].estado === 'enviada' && ped.rondas[0].items[0].cantidad === 2, 'pedido: lectura defensiva')
check(modelo.parsePedidoMesa({}) === null, 'pedido: sin mesa = null')
const cu = modelo.parseCuentaMesa({ mesa: { id: 'm' }, cuenta: { total: 100, saldo: 40, pasarela: null, abonos: [{ id: 'a', modo: 'iguales', estado: 'paid' }] } })
check(cu?.cuenta?.pasarela === null && modelo.progresoPartes(cu.cuenta.abonos, 4).faltan === 3, 'cuenta: sin pasarela y avance de partes')
check(modelo.sanearComensal('  Ana\u0000 María  ') === 'Ana María' && modelo.sanearComensal('x'.repeat(60)).length === 40, 'comensal saneado (≤ 40, sin controles)')

// ─── 4. Reglas en el fuente ──────────────────────────────────────────────────
const servidor = await leer('lib/restaurant/mesa-servidor.ts')
const ruta = await leer('app/api/mesa/[mesa]/[accion]/route.ts')
check(/organizacionDePeticion\(/.test(servidor), '/api/mesa: organización del host')
check(/createAdminClient\(\)/.test(servidor) && !/createPublicClient|createServerSupabaseClient/.test(servidor), '/api/mesa: cliente estricto')
check(/mesa:\$\{accion\}:ip:/.test(servidor) && /mesa:\$\{accion\}:mesa:/.test(servidor), '/api/mesa: límite por IP y por mesa')
check(/solicitar: \{ ip: \[\d+, [^\]]+\], mesa: \[1, 60_000\] \}/.test(servidor), 'llamar al mesero: 1 por mesa cada 60 s')
check(/p_organization_id: ctx\.organizationId/.test(ruta) && !/p_organization_id: body/.test(ruta), 'las RPC reciben la organización del contexto, nunca del body')
check(/UUID_RE\.test\(valor\)/.test(servidor), 'la mesa de la ruta es un uuid')
const init = await leer('app/api/checkout/init/route.ts')
check(/abonoMesaPorCobrar\(supabase, sourceId, hostOrgId\)/.test(init), 'checkout/init lee el abono con la organización del host')
check(/else if \(isAbonoMesa\) \{\s*\/\/ Abono de la mesa/.test(init), 'checkout/init no escribe web_orders para el abono')
const hook = await leer('app/api/webhooks/wompi_co/route.ts')
check(hook.indexOf('esReferenciaAbonoMesa(reference)') > 0 && hook.indexOf('esReferenciaAbonoMesa(reference)') < hook.indexOf('isReservationReference(reference)'), 'webhook: CQR- se despacha antes del flujo de pedidos')
const abonoHook = await leer('lib/restaurant/abono-mesa-webhook.ts')
const esqueleto = await leer('lib/payments/wompi-cobro-firmado.ts')
check(/procesarCobroFirmadoWompi/.test(abonoHook) && /verdict !== 'match'[\s\S]{0,300}status: 401/.test(esqueleto), 'webhook del abono: firma obligatoria (401)')
check(/\.from\('table_online_payments'\)[\s\S]{0,120}\.eq\('reference', reference\)/.test(abonoHook) && /p_organization_id: abono\.organizationId/.test(abonoHook), 'webhook del abono: la organización sale del abono')
const ordenes = await leer('app/api/orders/route.ts')
check(/if \(!customerId && mesaPedido && !tieneCorreo\(customer\.email\)\) \{[\s\S]{0,300}\} else if \(!customerId\)/.test(ordenes), '/api/orders: sin correo en la mesa no crea ficha de cliente (y conserva lo de siempre)')
// Un pedido que NO es de la Carta QR (domicilio, recoger, cualquier organización) sale igual:
const filas = [{ web_order_id: 'w', product_id: 1, quantity: 1 }, { web_order_id: 'w', product_id: 2, quantity: 2 }]
check(ronda.filasConComensal(filas, [0, 1], [{ diner: 'Ana' }, { diner: 'Luis' }], false) === filas, 'sin mesa: las líneas del pedido son exactamente las de siempre (sin diner_label)')
check(ronda.comensalDeRonda('Ana', false) === null, 'sin mesa: el pedido no lleva comensal')
check(JSON.stringify(ronda.filasConComensal(filas, [0, 1], [{ diner: 'Ana' }, {}], true).map((f) => f.diner_label ?? null)) === JSON.stringify(['Ana', null]), 'con mesa: comensal por línea')
check(ronda.rechazaComensal({ code: 'PGRST204', message: "Could not find the 'diner_label' column" }) && !ronda.rechazaComensal({ code: '23514', message: 'delivery_type' }), 'solo el error de la columna nueva reintenta sin comensal')
check(ronda.tieneCorreo('a@b.co') && !ronda.tieneCorreo('') && !ronda.tieneCorreo(undefined), 'correo plausible')
// Cada if nuevo en los archivos sensibles conserva el camino de siempre en su else.
check(/if \(!customerId && mesaPedido && !tieneCorreo\(customer\.email\)\) \{[\s\S]{0,300}\} else if \(!customerId\) \{\s*\/\/ Invitado: búsqueda o alta por correo, como antes\.\s*customerId = await buscarOCrearCliente/.test(ordenes), '/api/orders: invitado con correo → buscarOCrearCliente como antes')
check(/\} else if \(orderError && rechazaComensal\(orderError\)\) \{[\s\S]{0,500}\} else \{\s*\/\/ Sin mesa, o la base aceptó dine_in/.test(ordenes), '/api/orders: insert del pedido con su else de siempre')
check(/if \(error && rechazaComensal\(error\)\) \{[\s\S]{0,300}\} else \{\s*\/\/ Insert de siempre/.test(ordenes), '/api/orders: insert de líneas con su else de siempre')
check(/if \(mesaPedido && !tieneCorreo\(customer\.email\)\) \{[\s\S]{0,200}\} else if \(!PASARELAS_CON_CORREO_AL_PAGAR\.has/.test(ordenes), '/api/orders: el correo del pedido sale como antes fuera de la mesa')
check(/if \(mesaPedido\) \{\s*rondaMesa = await avisarErpRondaMesa\(webOrder\.id\)\s*\} else \{/.test(ordenes), '/api/orders: solo las rondas de mesa avisan al ERP')
check(/checkRateLimit\(`orders:ip:\$\{ip\}`/.test(ordenes) && /checkRateLimit\(`orders:email:\$\{correo\}`/.test(ordenes), '/api/orders: límite por IP y por correo')
check(/checkRateLimit\(`checkout-init:ip:\$\{ip\}`/.test(init) && /checkRateLimit\(`checkout-init:email:\$\{correo\}`/.test(init), '/api/checkout/init: límite por IP y por correo')
check(/if \(esReferenciaAbonoMesa\(reference\)\) \{[\s\S]{0,200}\} else \{\s*\/\/ Cualquier otra referencia: el flujo de siempre\./.test(hook), 'webhook: el ramal CQR- con su else de siempre')
check(/'pedir-cuenta': \{ ip: \[\d+, [^\]]+\], mesa: \[3, 60_000\] \}/.test(servidor), 'pedir la cuenta: límite por mesa')
check(/const org = await organizacionDePeticion\(organizacionCliente, 'Carta QR'\)/.test(servidor) && /organizationId: org\.organizationId/.test(servidor), '/api/mesa: la organización es la del host (el valor del cliente solo se compara: 403)')

const store = await leer('lib/restaurant/mesaStore.ts')
check(/deliveryType: 'dine_in'/.test(store) && /tableRef: mesa\.mesa/.test(store) && /email: ''/.test(store), 'la ronda va como «Comer aquí» con la mesa del QR y sin correo')
check(/source: 'table_bill'/.test(store), 'el pago en línea usa la fuente table_bill')

// ─── 5. Contra las migraciones del ERP ───────────────────────────────────────
const llamadas = {}
const base = ['p_organization_id', 'p_table_id']
for (const m of ruta.matchAll(/rpc = '([a-z_]+)'\s*\n\s*args = \{ \.\.\.base,([^}]*)\}/g)) {
  llamadas[m[1]] = [...base, ...[...m[2].matchAll(/(p_[a-z_]+)\s*:/g)].map((x) => x[1])].sort()
}
for (const m of ruta.matchAll(/rpc = '([a-z_]+)'\s*\n\s*args = \{\s*\n\s*\.\.\.base,([\s\S]*?)\n\s*\}/g)) {
  llamadas[m[1]] = [...base, ...[...m[2].matchAll(/(p_[a-z_]+)\s*:/g)].map((x) => x[1])].sort()
}
llamadas.fn_mesa_pedido_publico = [...base].sort()
llamadas.fn_mesa_cuenta_publica = [...base].sort()
for (const m of abonoHook.matchAll(/\.rpc\('([a-z_]+)', \{([\s\S]*?)\}\)/g)) {
  llamadas[m[1]] = [...m[2].matchAll(/(p_[a-z_]+)\s*:/g)].map((x) => x[1]).sort()
}
check(Object.keys(llamadas).length === 8, `el sitio llama a las 8 RPC de mesa (${Object.keys(llamadas).length})`)
const dirMig = join(ERP, 'supabase/migrations')
if (await existe(dirMig)) {
  const archivos = (await readdir(dirMig)).filter((f) => /carta_qr/.test(f)).sort()
  const sql = (await Promise.all(archivos.map((f) => readFile(join(dirMig, f), 'utf8')))).join('\n')
  for (const [fn, params] of Object.entries(llamadas)) {
    const defs = [...sql.matchAll(new RegExp(`create or replace function public\\.${fn}\\(([\\s\\S]*?)\\)\\s*returns`, 'gi'))]
    check(defs.length > 0, `una migración define ${fn}`)
    if (defs.length === 0) continue
    const firma = defs[defs.length - 1][1]
    const definidos = [...firma.matchAll(/(p_[a-z_]+)\s+[a-z]/g)].map((x) => x[1])
    for (const p of params) check(definidos.includes(p), `${fn}: el parámetro ${p} no existe en la migración`)
    const obligatorios = firma.split(',').filter((l) => /p_[a-z_]+/.test(l) && !/default/i.test(l)).map((l) => /(p_[a-z_]+)/.exec(l)[1])
    for (const p of obligatorios) check(params.includes(p), `${fn}: falta el parámetro obligatorio ${p}`)
    check(new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated`).test(sql), `${fn}: revocada a anon y authenticated`)
  }
  for (const f of archivos) {
    const cuerpo = (await readFile(join(dirMig, f), 'utf8')).replace(/^--.*$/gm, '')
    check(!/drop/i.test(cuerpo) && !/\bdelete\s+from\b/i.test(cuerpo), `${f}: aditiva, sin la palabra prohibida ni DELETE`)
    check(await existe(join(ERP, 'supabase/rollbacks', f.replace(/\.sql$/, '_rollback.sql'))), `${f}: tiene rollback`)
  }
} else {
  notas.push(`Sin el ERP en ${ERP}: no se cruzan los parámetros con las migraciones (ERP_REPO=…).`)
}

for (const n of notas) console.log(`· ${n}`)
if (fallos > 0) {
  console.error(`✗ verify-carta-qr: ${fallos} de ${total} comprobaciones fallaron`)
  process.exit(1)
}
console.log(`✓ verify-carta-qr: ${total} comprobaciones OK`)
