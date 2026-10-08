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
 * 6. Modo mesa (lib/restaurant/modoMesa.ts): qué página lo activa, cuándo el QR impreso
 *    (/menu?mesa=…) se manda a /carta-qr (solo con «Pedido de la mesa» visible), que el layout cambie
 *    encabezado, pie y barra móvil solo con él, y contraste AA de las superficies de las secciones
 *    de mesa (estilo.ts + app/globals.css) en Editorial Marfil, Noir Omakase y Pop Callejero.
 * 7. Carta QR por pasos (lib/restaurant/pasosMesa.ts): mapa sección↔paso, pasos que existen según
 *    las secciones visibles, transiciones permitidas, «paso inexistente → bienvenida», la entrada
 *    por el QR (/menu?mesa=… → bienvenida SOLA) y que fuera del modo mesa todo siga como siempre.
 * 8. Ronda por confirmar e idempotencia: la ronda enviada se ve de inmediato «por confirmar» aunque
 *    la mesa no tenga sesión, no se dejan reenviar los mismos platos, /api/orders reconoce la
 *    `roundKey` (y conserva su else de siempre) y la migración del ERP quita el corte sin sesión.
 * 9. Carta QR de una SEDE (bug de la org 326: hotel con una sede restaurante servida en /<slug>):
 *    arnés con la decisión real del sitio (lib/restaurant/cartaDeSede.ts, con un cliente falso) y,
 *    si el ERP está al lado, la URL real del QR (src/lib/pos/mesas/qrMesa.ts): la mesa de la sede
 *    lleva a /<slug>/menu, un QR viejo sin sede leído en el principal redirige a la sede de la
 *    MESA, y una organización de una sola sede (org 140) sigue igual y sin consultas de más.
 *    También que el lienzo del editor del ERP pida la dirección de la sede que se edita.
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
let contrato, modelo, ronda, modoMesa, contrasteMod, sobreMod, pasos
try {
  await writeFile(join(tmp, 'pasosMesa.mjs'), stripTypeScriptTypes(await leer('lib/restaurant/pasosMesa.ts'), { mode: 'strip' }))
  pasos = await import(pathToFileURL(join(tmp, 'pasosMesa.mjs')).href)
  await writeFile(join(tmp, 'modoMesa.mjs'), stripTypeScriptTypes(await leer('lib/restaurant/modoMesa.ts'), { mode: 'strip' }))
  modoMesa = await import(pathToFileURL(join(tmp, 'modoMesa.mjs')).href)
  await writeFile(join(tmp, 'contrasteColor.mjs'), stripTypeScriptTypes(await leer('lib/website/v2/contrasteColor.ts'), { mode: 'strip' }).replace(/^import\s+type[^\n]*\n/gm, ''))
  contrasteMod = await import(pathToFileURL(join(tmp, 'contrasteColor.mjs')).href)
  await writeFile(join(tmp, 'textoSobreAcento.mjs'), stripTypeScriptTypes(await leer('lib/website/v2/textoSobreAcento.ts'), { mode: 'strip' }).replace("from './contrasteColor'", "from './contrasteColor.mjs'"))
  sobreMod = await import(pathToFileURL(join(tmp, 'textoSobreAcento.mjs')).href)
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

// ─── 6. Modo mesa y colores de las secciones de mesa ─────────────────────────
{
  const { esPaginaModoMesa: es, variablesColorMesa } = modoMesa
  const sec = (t, v = 'default') => ({ section_type: t, section_variant: v })
  check(es({ slug: 'carta-qr', page_type: 'carta_qr', website_page_sections: [sec('menu_full', 'anchors')] }), 'modo mesa: página de tipo carta_qr (aunque solo tenga la carta)')
  check(es({ slug: 'mi-carta', page_type: 'carta_qr', website_page_sections: [] }), 'modo mesa: el tipo manda sobre el slug')
  check(es({ slug: 'carta-qr', page_type: 'custom', website_page_sections: [sec('table_order')] }), 'modo mesa: /carta-qr con «Pedido de la mesa»')
  check(es({ slug: 'carta-qr', page_type: 'custom', website_page_sections: [sec('restaurant_hero', 'mesa')] }), 'modo mesa: /carta-qr con la portada «mesa»')
  check(!es({ slug: 'carta-qr', page_type: 'custom', website_page_sections: [sec('menu_full', 'qr')] }), 'modo mesa: /carta-qr sin secciones de mesa → layout de siempre')
  check(!es({ slug: 'menu', page_type: 'builtin', website_page_sections: [sec('menu_full', 'qr'), sec('table_order')] }), 'modo mesa: otra página, aunque tenga secciones de mesa → layout de siempre')
  check(!es(null) && !es({ slug: 'home', page_type: 'builtin', website_page_sections: [] }), 'modo mesa: inicio y página nula → layout de siempre')

  // QR impreso /menu?mesa=…: va a /carta-qr solo si esa página tiene «Pedido de la mesa» visible.
  const { cartaQrRecibeMesa: recibe } = modoMesa
  const qr = (...secciones) => ({ slug: 'carta-qr', page_type: 'carta_qr', website_page_sections: secciones })
  check(recibe(qr(sec('restaurant_hero', 'mesa'), sec('menu_full', 'qr'), sec('table_order', 'rondas'))), 'QR de mesa: /carta-qr con «Pedido de la mesa» visible → redirige')
  check(!recibe(qr(sec('table_service', 'barra'), sec('menu_full', 'qr'))), 'QR de mesa: /carta-qr con solo «Servicio de mesa» → se queda en /menu')
  check(!recibe(qr({ ...sec('table_order'), is_visible: false }, sec('table_service'))), 'QR de mesa: «Pedido de la mesa» oculto (ojo cerrado) → se queda en /menu')
  check(!recibe(qr({ ...sec('table_order'), settings: { visibilidad: { computador: true, tableta: true, celular: false } } })), 'QR de mesa: «Pedido de la mesa» oculto en el celular → se queda en /menu')
  check(recibe(qr({ ...sec('table_order'), is_visible: true, settings: { visibilidad: { computador: false, tableta: false, celular: true } } })), 'QR de mesa: «Pedido de la mesa» visible solo en el celular → redirige')
  check(recibe(qr({ ...sec('table_order'), settings: { visibilidad: 'basura' } })), 'QR de mesa: visibilidad fina ilegible → manda el ojo (visible)')
  check(!recibe(null) && !recibe(undefined) && !recibe(qr()) && !recibe({ slug: 'carta-qr' }), 'QR de mesa: sin página Carta QR o sin secciones → se queda en /menu')

  const medir = { sobre: sobreMod.textoSobreAcentoSiHex, contraste: contrasteMod.contraste }
  const PLANTILLAS = {
    'Editorial Marfil': { fondo: '#F6F1E7', texto: '#1F1B16', primario: '#8C2F1B' },
    'Noir Omakase': { fondo: '#0E0E0E', texto: '#F2EDE4', primario: '#C8A97E' },
    'Pop Callejero': { fondo: '#FFE94D', texto: '#111111', primario: '#E11D48' },
  }
  const vNoir = variablesColorMesa('#C8A97E', PLANTILLAS['Noir Omakase'], medir)
  check(vNoir['--texto-sobre-primario'] === '#111111' && !vNoir['--primario-texto'], 'colores: Noir → texto oscuro sobre el dorado y el dorado sirve como texto')
  check(variablesColorMesa('#8C2F1B', PLANTILLAS['Editorial Marfil'], medir)['--texto-sobre-primario'] === '#FFFFFF', 'colores: Marfil → texto blanco sobre el primario')
  check(variablesColorMesa('#E11D48', PLANTILLAS['Pop Callejero'], medir)['--primario-texto'] === '#111111', 'colores: Pop → el rosa no llega a AA como texto sobre el amarillo, se usa el texto del tema')
  check(Object.keys(variablesColorMesa('rgb(1,2,3)', null, medir)).length === 0 && Object.keys(variablesColorMesa(null, null, medir)).length === 0, 'colores: sin hex no se emite nada')

  // Los valores se leen del fuente (estilo.ts y app/globals.css): si alguien los cambia, se mide de nuevo.
  const estilo = await leer('components/sections/restaurant/mesa/estilo.ts')
  const css = await leer('app/globals.css')
  const num = (re, txt, msg) => { const m = re.exec(txt); check(!!m, msg); return m ? Number(m[1]) : NaN }
  const pctTarjetaClara = num(/tarjeta: 'var\(--mesa-superficie, color-mix\(in srgb, var\(--background-color[^)]*\) (\d+)%, #ffffff\)\)'/, estilo, 'estilo.ts: la tarjeta clara cambió de forma (actualiza este verify)')
  const pctSuave = num(/suave: 'color-mix\(in srgb, var\(--text-color[^)]*\) (\d+)%, transparent\)'/, estilo, 'estilo.ts: el texto suave cambió de forma')
  const bloqueOscuro = /\[data-tema-fondo='oscuro'\],\s*\.dark:not\(\[data-tema-fondo='claro'\]\) \{([^}]*)\}/.exec(css)?.[1] ?? ''
  check(bloqueOscuro.length > 0, "app/globals.css: falta el bloque de la Carta QR para fondo oscuro ([data-tema-fondo='oscuro'])")
  const pctSupOscura = num(/--mesa-superficie: color-mix\(in srgb, var\(--text-color[^)]*\) (\d+)%/, bloqueOscuro, 'globals.css: --mesa-superficie cambió de forma')
  const varCss = (n) => new RegExp(`--${n}: (#[0-9a-fA-F]{6});`).exec(bloqueOscuro)?.[1]
  const fallback = (n) => new RegExp(`var\\(--${n}, (#[0-9A-Fa-f]{6})\\)`).exec(estilo)?.[1]
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const aHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
  const mezcla = (a, b, p) => aHex(hex(a).map((v, i) => v * p + hex(b)[i] * (1 - p)))
  const cr = (a, b) => contrasteMod.contraste(a, b) ?? 0
  for (const [nombre, t] of Object.entries(PLANTILLAS)) {
    const oscuro = sobreMod.fondoOscuro(t.fondo)
    const sup = oscuro ? mezcla(t.texto, t.fondo, pctSupOscura / 100) : mezcla(t.fondo, '#FFFFFF', pctTarjetaClara / 100)
    const v = variablesColorMesa(t.primario, t, medir)
    const sobre = v['--texto-sobre-primario'] ?? '#FFFFFF'
    const primTexto = v['--primario-texto'] ?? t.primario
    const ok = oscuro ? [varCss('mesa-ok-fondo'), varCss('mesa-ok-texto')] : [fallback('mesa-ok-fondo'), fallback('mesa-ok-texto')]
    const alerta = oscuro ? [varCss('mesa-alerta-fondo'), varCss('mesa-alerta-texto')] : [fallback('mesa-alerta-fondo'), fallback('mesa-alerta-texto')]
    const error = oscuro ? varCss('mesa-error-texto') : fallback('mesa-error-texto')
    const pares = [
      ['texto sobre la tarjeta', t.texto, sup],
      ['texto suave sobre el fondo', mezcla(t.texto, t.fondo, pctSuave / 100), t.fondo],
      ['texto suave sobre la tarjeta', mezcla(t.texto, sup, pctSuave / 100), sup],
      ['texto sobre el primario (botones, «+», barra del pedido)', sobre, t.primario],
      ['primario como texto sobre el fondo', primTexto, t.fondo],
      ['primario como texto sobre la tarjeta', primTexto, sup],
      ['estado OK', ok[1], ok[0]],
      ['estado alerta', alerta[1], alerta[0]],
      ['error sobre el fondo', error, t.fondo],
      ['chip «picante» sobre la tarjeta', mezcla('#B5371F', t.texto, 0.55), mezcla('#B5371F', sup, 0.14)],
      ['chip «vegetariano» sobre la tarjeta', mezcla('#2E6B3A', t.texto, 0.55), mezcla('#2E6B3A', sup, 0.14)],
    ]
    for (const [que, a, b] of pares) {
      const razon = a && b ? cr(a, b) : 0
      check(razon >= 4.5, `contraste AA en ${nombre}: ${que} = ${razon.toFixed(2)}:1 (${a} sobre ${b})`)
    }
  }

  // Quién aplica el modo mesa (se lee el fuente): sin él, el layout de siempre.
  const layout = await leer('components/site/OrganizationLayoutCliente.tsx')
  check(/!frozenReason && modoMesa \? \(\s*<ZonaGlobalPreview zona="header">\s*<EncabezadoMesa/.test(layout), 'layout: en modo mesa el encabezado es EncabezadoMesa (y si no, SiteHeader)')
  check(/!frozenReason && modoMesa \? \(\s*<ZonaGlobalPreview zona="footer">\s*<PieMesa/.test(layout), 'layout: en modo mesa el pie es PieMesa (y si no, SiteFooter)')
  check(/const rutaAdmiteBarra = !frozenReason && !modoMesa &&/.test(layout), 'layout: en modo mesa no va la barra móvil del sitio')
  check(/modoMesa = false,/.test(layout), 'layout: modoMesa es opcional y por defecto false (las ~25 rutas no cambian)')
  const pagina = await leer('app/[[...slug]]/page.tsx')
  check(/const modoMesa = esPaginaModoMesa\(page\)/.test(pagina) && /modoMesa=\{modoMesa\}/.test(pagina), 'page.tsx: la página del constructor pasa modoMesa al layout')
  check(/if \(refQr && cartaQrRecibeMesa\(paginaQr\)\) \{\s*(?:\/\/[^\n]*\n\s*)?redirect\(conPrefijo\(`\/carta-qr\?mesa=/.test(pagina), 'page.tsx: /menu?mesa= redirige a /carta-qr solo con cartaQrRecibeMesa (pedido de la mesa visible)')
  check(!/section_type === 'table_service'\)\) \{\s*redirect/.test(pagina), 'page.tsx: «Servicio de mesa» solo ya no basta para redirigir el QR a /carta-qr')
  const vista = await leer('components/sections/restaurant/MenuFullView.tsx')
  check(/!modoQr && !modoMesa && <BannerMesa/.test(vista) && /!hayServicioMesa && !modoMesa &&/.test(vista), 'carta: sin la franja «Pides en Mesa N» en modo mesa')
  // Barra fija «Ver pedido de la mesa»: reserva su alto real al final de la página solo mientras se ve.
  const pedidoSrc = await leer('components/sections/restaurant/mesa/PedidoMesa.tsx')
  check(/useReservaAlFinal\(barra, !escondida\)/.test(pedidoSrc) && /ref=\{setBarra\}\s*data-barra-ver-pedido=""/.test(pedidoSrc), 'barra del pedido: mide su contenedor fijo (useReservaAlFinal) y quita la reserva mientras está escondida')
  // Lámina 01: sin barra mientras los botones de la bienvenida están a la vista.
  const portadaSrc = await leer('components/sections/restaurant/mesa/PortadaMesa.tsx')
  check(/new IntersectionObserver\(/.test(portadaSrc) && /botonesPortadaALaVista: e\.isIntersecting/.test(portadaSrc) && /<div ref=\{setBotones\}/.test(portadaSrc), 'bienvenida: IntersectionObserver sobre los botones publica botonesPortadaALaVista')
  check(/const escondida = useMesaQRStore\(\(e\) => e\.botonesPortadaALaVista\)/.test(pedidoSrc) && /motion-reduce:transition-none/.test(pedidoSrc) && /escondida \? 'invisible translate-y-full opacity-0'/.test(pedidoSrc), 'barra del pedido: se esconde con los botones de la bienvenida a la vista, con transición y sin ella con prefers-reduced-motion')
  check(/body\[data-barra-pedido-mesa\] \[data-raiz-sitio\] \{\s*padding-bottom: var\(--barra-pedido-mesa-h, 0px\);/.test(css) && /data-raiz-sitio=""/.test(layout), 'barra del pedido: la raíz del sitio reserva --barra-pedido-mesa-h solo con la barra visible')
  for (const f of ['CartaQrMenu', 'PedidoMesa', 'CuentaMesa', 'comun', 'ServicioMesa', 'ValorarVisita']) {
    const src = await leer(`components/sections/restaurant/mesa/${f}.tsx`)
    check(!/\btext-white\b/.test(src) && !/\bbg-white\b/.test(src), `${f}.tsx: blanco fijo (text-white / bg-white): usa C.sobrePrimario o las superficies del tema`)
  }
}

// ─── 7. Carta QR por pasos ───────────────────────────────────────────────────
{
  const P = pasos
  const sec = (t, v = 'default', extra = {}) => ({ section_type: t, section_variant: v, ...extra })
  // Mapa sección → paso (lo que pide el lienzo del editor al seleccionarla).
  const mapa = [
    [['restaurant_hero', 'mesa'], 'bienvenida'], [['table_service', 'barra'], 'carta'], [['menu_full', 'qr'], 'carta'],
    [['table_order', 'rondas'], 'pedido'], [['table_bill', 'hoja'], 'cuenta'], [['visit_feedback', 'tarjeta'], 'valorar'],
    [['hours_location', 'cards'], 'horario'], [['header'], 'bienvenida'], [['footer'], 'bienvenida'], [['marquee', 'text'], 'carta'],
  ]
  for (const [[t, v], paso] of mapa) check(P.pasoDeSeccion(t, v) === paso, `pasos: ${t}${v ? '.' + v : ''} → ${paso}`)
  check(P.pasoDeSeccion('table_bill', 'hoja') === 'cuenta', 'pasos: «Cuenta de la mesa» seleccionada → el lienzo muestra la cuenta (lámina 17)')
  check(JSON.stringify(P.pasosDeSeccion('table_order', 'rondas')) === JSON.stringify(['carta', 'pedido', 'estado']), 'pasos: «Pedido de la mesa» se pinta en la carta (su barra) y en pedido/estado')
  check(JSON.stringify(P.pasosDeSeccion('table_bill', 'hoja')) === JSON.stringify(['cuenta', 'pagar']), 'pasos: «Cuenta de la mesa» se pinta en cuenta y pagar')
  // Entrada por el QR: la bienvenida va SOLA. Nada de la carta, la barra de la mesa ni «Ver pedido».
  for (const [t, v] of [['menu_full', 'qr'], ['table_service', 'barra'], ['table_order', 'rondas'], ['table_bill', 'hoja'], ['visit_feedback', 'tarjeta'], ['hours_location', 'cards']]) {
    check(!P.pasosDeSeccion(t, v).includes('bienvenida'), `QR → bienvenida: ${t} no se pinta debajo de la bienvenida`)
  }
  check(JSON.stringify(P.pasosDeSeccion('restaurant_hero', 'mesa')) === JSON.stringify(['bienvenida']), 'QR → bienvenida: la portada solo se pinta en la bienvenida')

  const completa = [sec('restaurant_hero', 'mesa'), sec('table_service', 'barra'), sec('menu_full', 'qr'), sec('table_order', 'rondas'), sec('table_bill', 'hoja'), sec('visit_feedback', 'tarjeta'), sec('hours_location', 'cards')]
  const d = P.pasosDisponibles(completa)
  check(JSON.stringify(d.pasos) === JSON.stringify(['bienvenida', 'carta', 'pedido', 'estado', 'cuenta', 'pagar', 'valorar', 'horario']) && d.mesero, 'pasos: la plantilla Carta QR tiene los 8 pasos y la hoja del mesero')
  const sinCuenta = P.pasosDisponibles([sec('restaurant_hero', 'mesa'), sec('menu_full', 'qr'), sec('table_bill', 'hoja', { is_visible: false }), sec('table_service', 'barra', { settings: { visibilidad: { computador: true, tableta: true, celular: false } } })])
  check(!sinCuenta.pasos.includes('cuenta') && !sinCuenta.pasos.includes('pagar'), 'pasos: «Cuenta de la mesa» oculta (ojo) → no existen cuenta ni pagar (ni su botón)')
  check(sinCuenta.mesero === false, 'pasos: «Servicio de mesa» oculto en el celular → sin hoja del mesero (ni su botón)')
  check(!P.pasosDisponibles([sec('restaurant_hero', 'mesa'), sec('menu_full', 'qr')]).pasos.includes('pedido'), 'pasos: sin «Pedido de la mesa» no hay paso de pedido')

  // Paso de la URL: existe → ese; inexistente o basura → bienvenida (o la carta si no hay bienvenida).
  check(P.resolverPaso('cuenta', d.pasos) === 'cuenta', 'URL: ?paso=cuenta → cuenta')
  check(P.resolverPaso('bienvenida', d.pasos) === 'bienvenida', 'URL: ?paso=bienvenida (redirección del QR) → bienvenida')
  check(P.resolverPaso('cuenta', sinCuenta.pasos) === 'bienvenida', 'URL: paso inexistente en la página → bienvenida')
  check(P.resolverPaso('<script>', d.pasos) === 'bienvenida' && P.resolverPaso(undefined, d.pasos) === 'bienvenida' && P.resolverPaso(['carta'], d.pasos) === 'bienvenida', 'URL: paso basura o ausente → bienvenida')
  check(P.resolverPaso('nada', ['carta', 'pedido', 'estado']) === 'carta', 'URL: sin bienvenida en la página, el inicio es la carta')

  // Transiciones permitidas (botones de cada lámina).
  const permitidas = [
    ['bienvenida', 'carta'], ['bienvenida', 'cuenta'], ['bienvenida', 'horario'], ['carta', 'pedido'], ['carta', 'cuenta'],
    ['carta', 'bienvenida'], ['pedido', 'estado'], ['pedido', 'carta'], ['estado', 'carta'], ['estado', 'pedido'],
    ['cuenta', 'pagar'], ['cuenta', 'valorar'], ['cuenta', 'carta'], ['pagar', 'cuenta'], ['pagar', 'valorar'], ['valorar', 'carta'], ['horario', 'bienvenida'],
  ]
  for (const [a, b] of permitidas) check(P.puedeIrAPaso(a, b, d.pasos), `transición permitida: ${a} → ${b}`)
  for (const [a, b] of [['bienvenida', 'pagar'], ['bienvenida', 'estado'], ['carta', 'pagar'], ['carta', 'valorar'], ['pedido', 'cuenta'], ['valorar', 'pagar']]) {
    check(!P.puedeIrAPaso(a, b, d.pasos), `transición NO permitida: ${a} → ${b}`)
  }
  check(!P.puedeIrAPaso('carta', 'cuenta', sinCuenta.pasos), 'transición: a un paso que no existe en la página, no')
  for (const [paso, antes] of [['pedido', 'carta'], ['estado', 'carta'], ['cuenta', 'carta'], ['pagar', 'cuenta'], ['horario', 'bienvenida'], ['carta', 'bienvenida']]) {
    check(P.pasoAnterior(paso, d.pasos) === antes && P.puedeIrAPaso(paso, antes, d.pasos), `← atrás: ${paso} → ${antes}`)
  }
  check(P.pasoConEncabezado('bienvenida', d.pasos) && !P.pasoConEncabezado('carta', d.pasos) && !P.pasoConEncabezado('cuenta', d.pasos), 'encabezado y pie del sitio solo en la bienvenida (lámina 01); carta y pantallas sin él (02, 04, 08)')
  check(P.pantallaDePaso('carta') === '' && P.pantallaDePaso('pagar') === 'pagar', 'pantalla del almacén de cada paso')

  // Fuente: quién usa los pasos y que fuera del modo mesa todo siga igual.
  const pagina = await leer('app/[[...slug]]/page.tsx')
  check(/redirect\(conPrefijo\(`\/carta-qr\?mesa=\$\{encodeURIComponent\(refQr\)\}&paso=bienvenida`/.test(pagina), 'QR impreso: /menu?mesa=… redirige a /carta-qr?mesa=…&paso=bienvenida')
  check(/const pasosMesa = disponiblesMesa\s*\?[\s\S]{0,200}resolverPaso\(sp\?\.paso, disponiblesMesa\.pasos\)[\s\S]{0,200}: null/.test(pagina) && /pasosMesa=\{pasosMesa\}/.test(pagina), 'page.tsx: el servidor resuelve ?paso= (sin modo mesa, null)')
  const layoutSrc = await leer('components/site/OrganizationLayoutCliente.tsx')
  check(/<PasosMesaProvider value=\{modoMesa \? pasosMesa : null\}>/.test(layoutSrc), 'layout: los pasos solo con modoMesa')
  const prev = await leer('components/sections/PreviewableSections.tsx')
  check(/if \(porPasos\) \{\s*return \(\s*<PasosMesa/.test(prev) && /\/\/ Cualquier otra página: todas las secciones apiladas, como siempre\./.test(prev), 'PreviewableSections: por pasos solo en modo mesa; si no, apiladas como siempre')
  check(/porPasos \? \([\s\S]{0,200}<PasosMesa[\s\S]{0,200}\) : \(\s*<>\{liveSections\.map/.test(prev), 'lienzo: por pasos solo en modo mesa; si no, como siempre')
  const pasosSrc = await leer('components/sections/restaurant/mesa/PasosMesa.tsx')
  check(/hidden=\{!activa\}/.test(pasosSrc), 'PasosMesa: las secciones de otros pasos se ocultan sin desmontarse (el almacén no recarga)')
  check(/@media \(prefers-reduced-motion: no-preference\) \{\s*\[data-pasos-mesa\] \[data-entrada-paso\] \{ animation: paso-mesa-entra 160ms/.test(pasosSrc), 'PasosMesa: fundido corto del contenido, sin él con prefers-reduced-motion')

  // ── Bug de producción (org 140, Mesa 1, iPhone): tras enviar la ronda la pantalla quedó muerta
  // (≈400 px vacíos arriba, ni la ← respondía) hasta recargar. Tres causas; cada una con su check.
  // a) Pantallas como capa `fixed` sobre una página que se acababa de encoger (la carta oculta):
  //    iOS Safari las pintaba corridas y recibía los toques en otro sitio. Por pasos van en el flujo.
  const comunSrc = await leer('components/sections/restaurant/mesa/comun.tsx')
  const ramaPasos = /if \(porPasos\) \{([\s\S]*?)\n  \}\n  \/\/ Sin pasos/.exec(comunSrc)?.[1] ?? ''
  check(ramaPasos !== '' && /data-pantalla-mesa="flujo"/.test(ramaPasos) && !/className="[^"]*\bfixed\b/.test(ramaPasos) && /sticky bottom-0/.test(ramaPasos), 'pantallas por pasos en el flujo del documento (sin capa fixed), pie sticky')
  check(/\/\/ Sin pasos \(la página de siempre[^\n]*\n\s*return \(\s*<div className="fixed inset-0 z-\[60\]/.test(comunSrc), 'pantallas sin pasos: la capa fixed de siempre')
  // b) Animar la opacidad del contenedor de los pasos (ancestro de la barra, hojas y avisos fixed).
  check(!/\.animate\(/.test(pasosSrc) && /useAntesDePintar\(\(\) => \{[\s\S]{0,160}window\.scrollTo\(0, 0\)/.test(pasosSrc), 'PasosMesa: arriba antes de pintar y sin animar el ancestro de capas fixed')
  const pedidoPasos = await leer('components/sections/restaurant/mesa/PedidoMesa.tsx')
  check(/const conBarra = porPasos \? paso === 'carta' : true/.test(pedidoPasos) && /\{conBarra && <BarraVerPedido/.test(pedidoPasos), 'por pasos, la barra «Ver pedido» solo en la carta (sin pasos, como siempre)')
  // c) Bucle de renders: la bienvenida llamaba useEstadosEnVivo([sede]) con un arreglo nuevo en cada
  //    render y el efecto dependía de su identidad: miles de renders por segundo, sin fin.
  const apertura = await leer('components/sections/restaurant/EstadoApertura.tsx')
  const hook = /export function useEstadosEnVivo[\s\S]*?\n\}/.exec(apertura)?.[0] ?? ''
  check(/\}, \[firma\]\)/.test(hook) && !/\}, \[sedes\]\)/.test(hook) && /const firma = firmaSedesConHorario\(sedes\)/.test(hook), 'useEstadosEnVivo depende del contenido de las sedes (firma), no de la identidad del arreglo')
  check(/if \(serie === previa\) return/.test(hook), 'useEstadosEnVivo: sin render si el estado no cambió')
  check(/^\s*<AvisosMesa \/>/m.test(pasosSrc), 'PasosMesa: avisos y hoja del mesero en cualquier paso')
  const storeSrc = await leer('lib/restaurant/mesaStore.ts')
  check(/if \(estado\.pasos && estado\.paso\) \{\s*\/\/ Carta QR por pasos[\s\S]{0,200}irAPaso\([\s\S]{0,400}\} else if \(pantalla === 'bienvenida'[\s\S]{0,800}if \(window\.location\.hash !== `#\$\{pantalla\}`\) window\.location\.hash = pantalla/.test(storeSrc), 'irA: por pasos usa ?paso=; sin pasos, el hash de siempre')
  check(/history\.pushState\(st, '', urlConPaso\(destino\)\)/.test(storeSrc) && /addEventListener\('popstate'/.test(storeSrc), 'pasos: entrada en el historial (atrás del celular) y popstate')
  check(/if \(estado\.pasos\) \{\s*\/\/ Carta QR por pasos: la pantalla la da `\?paso=`/.test(storeSrc), 'pasos: el hash no pisa el paso')
  const bridge = await leer('components/sections/PreviewBridge.tsx')
  check(/case 'goadmin:paso':[\s\S]{0,300}EVENTO_PASO_LIENZO/.test(bridge), 'puente: goadmin:paso del editor → paso de la sección')
  const portadaSrc = await leer('components/sections/restaurant/mesa/PortadaMesa.tsx')
  check(/const verCarta = porPasos\.activo \? porPasos\.pasos\.includes\('carta'\) : true/.test(portadaSrc) && /const verCuenta = c\.showBillButton && \(porPasos\.activo \? porPasos\.pasos\.includes\('cuenta'\) : true\)/.test(portadaSrc) && /const verMesero = c\.showWaiterButton && \(porPasos\.activo \? porPasos\.mesero : true\)/.test(portadaSrc), 'bienvenida: cada botón solo si existe su paso (sin pasos, como siempre)')
}

// ─── 8. Ronda por confirmar e idempotencia ───────────────────────────────────
{
  const linea = (id, nombre, total, comensal) => ({ id, nombre, cantidad: 1, total, modificadores: [], nota: null, comensal, estado: 'por_confirmar', pagada: false })
  const ahora = Date.parse('2026-10-07T17:00:00Z')
  const local = { clave: 'wo-1', creada: '2026-10-07T16:51:00Z', comensal: 'Yo', items: [linea('a', 'Lomo al carbón', 72000, 'Yo'), linea('b', 'Limonada de coco', 14000, 'Ana')], subtotal: 86000, firma: 'f1' }
  const mesaPub = { id: 'm3', nombre: 'Mesa 3', zona: null, sedeId: 1, sede: null }
  // Mesa SIN sesión: la base devuelve la mesa sin rondas (antes de la migración) → la ronda se ve igual.
  const sinSesion = { mesa: mesaPub, sesion: null, rondas: [], total: 0, impuesto: 0, impuestoIncluido: false, solicitudes: [] }
  const f = modelo.fusionarRondasLocales(sinSesion, [local], mesaPub, ahora)
  check(f.pedido.rondas.length === 1 && f.pedido.rondas[0].estado === 'por_confirmar' && f.pedido.rondas[0].items.length === 2 && f.pedido.rondas[0].subtotal === 86000, 'ronda enviada sin sesión: se ve «por confirmar» con sus platos y su total')
  check(modelo.TEXTO_POR_CONFIRMAR === 'Enviada · esperando que el mesero la confirme', 'texto: «Enviada · esperando que el mesero la confirme»')
  check(modelo.totalPorConfirmar(f.pedido) === 86000, 'total de la mesa: suma lo por confirmar')
  check(modelo.fusionarRondasLocales(null, [local], mesaPub, ahora).pedido?.rondas.length === 1, 'sin lectura de la base aún: la ronda enviada se ve igual')
  // La base ya la devuelve (misma clave): no se repite.
  const conBase = { ...sinSesion, rondas: [{ clave: 'wo-1', numero: 1, origen: 'web', creada: local.creada, comensal: 'Yo', estado: 'por_confirmar', listaAt: null, items: local.items, subtotal: 86000 }] }
  const g = modelo.fusionarRondasLocales(conBase, [local], mesaPub, ahora)
  check(g.pedido.rondas.length === 1 && g.locales.length === 1, 'la base ya la devuelve: no se pinta dos veces (y se recuerda mientras esté por confirmar)')
  // El equipo la confirma en el POS: pasa en vivo a «En cocina».
  const confirmada = { ...conBase, sesion: { estado: 'active', abiertaDesde: null, personas: null, mesero: null }, rondas: [{ ...conBase.rondas[0], estado: 'enviada' }] }
  const h = modelo.fusionarRondasLocales(confirmada, [local], mesaPub, ahora)
  check(h.pedido.rondas[0].estado === 'enviada' && modelo.ETIQUETA_ESTADO_RONDA.enviada === 'En cocina' && h.locales.length === 0, 'confirmada en el POS: «En cocina» (lámina 06) y se olvida la copia local')
  check(modelo.fusionarRondasLocales(sinSesion, [local], mesaPub, ahora + modelo.VIGENCIA_RONDA_LOCAL_MS).pedido.rondas.length === 0, 'la copia local se olvida a las 4 h')
  // No reenviar los mismos platos mientras esperan.
  const firma = modelo.firmaRonda([{ productId: 2001, cantidad: 1, modificadores: ['Término medio'], nota: null, comensal: 'Yo' }, { productId: 5001, cantidad: 1, modificadores: [], nota: 'Sin hielo', comensal: 'Ana' }])
  const firmaOtroOrden = modelo.firmaRonda([{ productId: 5001, cantidad: 1, modificadores: [], nota: 'Sin hielo', comensal: 'Ana' }, { productId: 2001, cantidad: 1, modificadores: ['Término medio'], nota: null, comensal: 'Yo' }])
  check(firma === firmaOtroOrden, 'firma de la ronda: no depende del orden de las líneas')
  const loc2 = { ...local, firma }
  check(modelo.rondaPendienteIgual(firma, [loc2], f.pedido) !== null, 'mismos platos por confirmar: no se reenvían')
  check(modelo.rondaPendienteIgual(firma + 'x', [loc2], f.pedido) === null, 'otros platos: se pueden enviar')
  check(modelo.rondaPendienteIgual(firma, [loc2], { ...confirmada, rondas: [{ ...confirmada.rondas[0], clave: 'wo-1' }] }) === null, 'ya confirmada: se puede pedir otra igual')
  check(modelo.parseRondasLocales([{ clave: 'x' }, 'basura', { clave: 'y', creada: 'no', items: [] }]).length === 0, 'rondas locales: lectura defensiva')

  // Idempotencia en /api/orders.
  check(ronda.claveRondaValida('3f2a-9c1b-77aa', true) === '3f2a-9c1b-77aa' && ronda.claveRondaValida('3f2a-9c1b-77aa', false) === null && ronda.claveRondaValida('x', true) === null && ronda.claveRondaValida("a'; drop--", true) === null, 'roundKey: solo con mesa y con forma segura')
  check(ronda.esRondaDuplicada({ code: '23505', message: 'duplicate key value violates unique constraint "idx_web_orders_round_key"' }) && !ronda.esRondaDuplicada({ code: '23505', message: 'web_orders_order_number_key' }), 'roundKey: 23505 del índice de la ronda = duplicado')
  check(ronda.rechazaClaveRonda({ code: 'PGRST204', message: "Could not find the 'round_key' column" }) && !ronda.rechazaClaveRonda({ code: 'PGRST204', message: 'diner_label' }), 'roundKey: columna ausente → se reintenta sin la clave')
  const ordenes = await leer('app/api/orders/route.ts')
  check(/const claveRonda = claveRondaValida\(roundKey, !!mesaPedido\)\s*if \(mesaPedido && claveRonda\) \{\s*const previa = await buscarRondaPorClave\(supabase as any, contextOrgId, mesaPedido\.id, claveRonda\)\s*if \(previa\) \{[\s\S]{0,500}\} else \{[\s\S]{0,120}\}\s*\} else \{\s*\/\/ Sin mesa o sin clave: exactamente como antes\./.test(ordenes), '/api/orders: misma roundKey en la mesa → devuelve la ronda ya creada (con su else de siempre)')
  check(/\.\.\.\(claveRonda && \{ round_key: claveRonda \}\)/.test(ordenes), '/api/orders: la ronda guarda su round_key')
  check(/\} else if \(orderError && rechazaClaveRonda\(orderError\)\) \{[\s\S]{0,500}\} else if \(orderError && rechazaComensal\(orderError\)\)/.test(ordenes), '/api/orders: sin la columna, reintento sin la clave')
  check(/if \(orderError && mesaPedido && claveRonda && esRondaDuplicada\(orderError\)\) \{[\s\S]{0,700}\} else \{\s*\/\/ Sin choque de la clave de ronda: el error \(o el éxito\) de siempre\./.test(ordenes), '/api/orders: choque simultáneo (23505) → la ronda de la otra petición, con su else de siempre')
  const rondaSrc = await leer('lib/orders/rondaMesa.ts')
  check(/\.eq\('organization_id', organizationId\)\s*\.eq\('restaurant_table_id', mesaId\)\s*\.eq\('round_key', roundKey\)/.test(rondaSrc), 'buscarRondaPorClave: filtra por la organización del contexto y la mesa validada')
  const storeSrc = await leer('lib/restaurant/mesaStore.ts')
  check(/if \(rondaPendienteIgual\(firma, estado\.rondasLocales, estado\.pedido\)\) \{/.test(storeSrc) && storeSrc.indexOf('rondaPendienteIgual(firma, estado.rondasLocales') < storeSrc.indexOf("fetch('/api/orders'"), 'enviarRonda: los mismos platos por confirmar no llegan a /api/orders')
  check(/roundKey,\s*\}\),/.test(storeSrc) && /claveIdempotencia\(mesa\.mesa, firma\)/.test(storeSrc), 'enviarRonda: manda roundKey (la misma en cada reintento)')
  check(/if \(enCurso\) \{\s*repetir = true/.test(storeSrc), 'refrescarMesa: una lectura pedida durante otra no se pierde (tras enviar, el estado trae la ronda)')
  const pedidoSrc = await leer('components/sections/restaurant/mesa/PedidoMesa.tsx')
  check(/const pie = repetida \?/.test(pedidoSrc) && /data-ronda-por-confirmar=""/.test(pedidoSrc), 'pedido/estado: botón sin reenvío y ronda «por confirmar» a la vista')

  // Migración del ERP: sin el corte «sin sesión → rondas: []» y con el índice de la ronda.
  const dirMig = join(ERP, 'supabase/migrations')
  if (await existe(dirMig)) {
    const archivos = (await readdir(dirMig)).filter((f) => /carta_qr/.test(f)).sort()
    const sql = (await Promise.all(archivos.map((f) => readFile(join(dirMig, f), 'utf8')))).join('\n')
    const defs = [...sql.matchAll(/create or replace function public\.fn_mesa_pedido_publico\([\s\S]*?\n\$f\$;/gi)]
    const ultima = defs.length ? defs[defs.length - 1][0] : ''
    check(ultima !== '' && !/if c\.session_id is null then\s*return/.test(ultima), 'fn_mesa_pedido_publico: sin sesión ya no corta antes de las rondas por confirmar')
    check(/'sesion', case when c\.session_id is null then null/.test(ultima), 'fn_mesa_pedido_publico: sin sesión, sesion = null')
    check(!/wo\.created_at >= coalesce\(c\.opened_at/.test(ultima), 'fn_mesa_pedido_publico: la ronda enviada antes de abrir la sesión no queda fuera')
    check(/create unique index if not exists idx_web_orders_round_key[\s\S]{0,200}where round_key is not null and status not in \('cancelled', 'rejected', 'expired'\)/.test(sql), 'migración: índice único de la ronda entre pedidos vivos')
  } else {
    notas.push(`Sin el ERP en ${ERP}: no se revisa la migración de la ronda por confirmar.`)
  }
}

// ─── 9. Carta QR de una sede: la sede la decide la MESA ─────────────────────
{
  // Módulos con sus importaciones reescritas a módulos temporales (puros o falsos).
  async function cargar(dir, archivos, falsos = {}) {
    const nombres = Object.keys(archivos)
    for (const [nombre, codigo] of Object.entries(falsos)) await writeFile(join(dir, `${nombre}.mjs`), codigo)
    const todos = new Set([...nombres, ...Object.keys(falsos)])
    for (const [nombre, { raiz, ruta, alias }] of Object.entries(archivos)) {
      let js = stripTypeScriptTypes(await readFile(join(raiz, ruta), 'utf8'), { mode: 'strip' }).replace(/^import\s+type[^\n]*\n/gm, '')
      js = js.replace(/from\s+'([^']+)'/g, (m, spec) => {
        const destino = alias?.[spec] ?? spec.split('/').pop()
        if (!todos.has(destino)) throw new Error(`${ruta}: importación sin módulo en el arnés: ${spec}`)
        return `from './${destino}.mjs'`
      })
      await writeFile(join(dir, `${nombre}.mjs`), js)
    }
    const m = {}
    for (const nombre of nombres) m[nombre] = await import(pathToFileURL(join(dir, `${nombre}.mjs`)).href)
    return m
  }

  // Datos calcados de la org 326 (sin nombres): sede principal 530 sin sitio aparte, sede 531
  // restaurante publicada en /<slug> con su «Carta QR», y la Mesa 1 de la sede 531.
  const ORG = 326
  const SLUG = 'restaurante'
  const MESA_SEDE = 'dfae6652-3e00-4763-92f5-0bf19f4afb3a'
  const MESA_PRINCIPAL = '6c1f8f5e-0d1b-4c7a-9a40-1e2f3a4b5c6d'
  const MESA_OTRA_ORG = '0b9e7c1d-2a3f-4e5d-8c6b-7a8f9e0d1c2b'
  const MESAS = [
    { id: MESA_SEDE, organization_id: ORG, name: 'Mesa 1', zone: null, branch_id: 531 },
    { id: MESA_PRINCIPAL, organization_id: ORG, name: 'Mesa 2', zone: null, branch_id: 530 },
    { id: MESA_OTRA_ORG, organization_id: 999, name: 'Mesa 1', zone: null, branch_id: 77 },
  ]
  const falsos = {
    server: `export const consultas = { n: 0 }
export function createAdminClient() {
  const filas = globalThis.__mesasArnes
  return { from() {
    consultas.n++
    const filtros = []
    const q = {
      select() { return q },
      eq(col, val) { filtros.push((f) => f[col] === val); return q },
      order() { return q },
      limit(n) { return Promise.resolve({ data: filas.filter((f) => filtros.every((p) => p(f))).slice(0, n), error: null }) },
      maybeSingle() { return Promise.resolve({ data: filas.find((f) => filtros.every((p) => p(f))) ?? null, error: null }) },
    }
    return q
  } }
}`,
    sedes: `export async function getSedesWeb(org) { return globalThis.__sedesArnes[org] ?? [] }`,
    'carta-sede': `export async function resolverSedeCarta(org, b) { return typeof b === 'number' ? b : (globalThis.__principalArnes[org] ?? null) }`,
  }
  globalThis.__mesasArnes = MESAS
  globalThis.__sedesArnes = {
    [ORG]: [
      { id: 530, nombre: 'Principal', slug: null, customDomain: null, esPrincipal: true },
      { id: 531, nombre: 'Sede', slug: SLUG, customDomain: null, esPrincipal: false },
    ],
    140: [{ id: 1, nombre: 'Principal', slug: null, customDomain: null, esPrincipal: true }],
  }
  globalThis.__principalArnes = { [ORG]: 530, 140: 1 }

  const dirArnes = await mkdtemp(join(ROOT, 'node_modules', '.verify-carta-qr-sede-'))
  try {
    let sitio = null
    try {
      sitio = await cargar(dirArnes, {
        mesaQR: { raiz: ROOT, ruta: 'lib/restaurant/mesaQR.ts' },
        nombreMesa: { raiz: ROOT, ruta: 'lib/orders/nombreMesa.ts' },
        'estados-pedido': { raiz: ROOT, ruta: 'lib/orders/estados-pedido.ts' },
        mesaPedido: { raiz: ROOT, ruta: 'lib/orders/mesaPedido.ts' },
        rutaSitio: { raiz: ROOT, ruta: 'lib/outlet/rutaSitio.ts' },
        cartaDeSede: { raiz: ROOT, ruta: 'lib/restaurant/cartaDeSede.ts' },
      }, falsos)
    } catch (e) {
      check(false, `arnés del sitio: no se pudo cargar lib/restaurant/cartaDeSede.ts (${e.message})`)
    }
    const { consultas } = await import(pathToFileURL(join(dirArnes, 'server.mjs')).href)
    const decidir = sitio?.cartaDeSede?.cartaDeLaSedeDeLaMesa
    check(typeof decidir === 'function', 'cartaDeSede.ts exporta cartaDeLaSedeDeLaMesa (la sede la decide la mesa)')
    if (typeof decidir === 'function') {
      // QR viejo (sin sede) leído en el principal: a la carta de la sede de la MESA.
      check(await decidir(ORG, MESA_SEDE) === `/${SLUG}/menu?mesa=${MESA_SEDE}`, 'QR sin sede de una mesa de la sede 531 → /<slug>/menu?mesa=… (allí está su Carta QR)')
      check(await decidir(ORG, 'Mesa 1') === `/${SLUG}/menu?mesa=${MESA_SEDE}`, 'QR antiguo por nombre («Mesa 1») → la misma sede de la mesa')
      // Sin regresión: la mesa de la sede principal se queda en el principal.
      check(await decidir(ORG, MESA_PRINCIPAL) === null, 'mesa de la sede principal → sin redirección (como hoy)')
      // La mesa se valida contra la organización del host: la de otra organización no existe aquí.
      check(await decidir(ORG, MESA_OTRA_ORG) === null, 'mesa de OTRA organización → sin redirección (filtro por organization_id)')
      // Sede sin sitio aparte: cae al principal como hoy.
      globalThis.__sedesArnes[ORG][1] = { ...globalThis.__sedesArnes[ORG][1], slug: null }
      check(await decidir(ORG, MESA_SEDE) === null, 'sede sin sitio aparte → el QR sigue en el principal (como hoy)')
      globalThis.__sedesArnes[ORG][1] = { ...globalThis.__sedesArnes[ORG][1], slug: SLUG }
      // Una sola sede (org 140): ni una consulta a restaurant_tables.
      const antes = consultas.n
      check(await decidir(140, MESA_SEDE) === null && consultas.n === antes, 'org de una sola sede (140): sin redirección y sin consultas de más')
      // El destino es una sede que el sitio sí resuelve por prefijo (no un slug reservado).
      check(!sitio.rutaSitio.esSlugReservado(SLUG), 'el slug de la sede no es una ruta reservada del sitio')
    }

    // La página /menu usa la decisión solo en el principal y conserva su else.
    const pagina = await leer('app/[[...slug]]/page.tsx')
    const iQr = pagina.indexOf("getPaginaPublica(organization.id, 'carta-qr'")
    const iSede = pagina.indexOf('await cartaDeLaSedeDeLaMesa(organization.id, refQr)')
    check(iSede !== -1 && iSede < iQr, 'page.tsx: /menu?mesa= resuelve la sede de la mesa ANTES de buscar «carta-qr» en el sitio servido')
    check(/if \(refQr && !outlet\) \{[\s\S]{0,200}if \(cartaSedeMesa\) \{\s*redirect\(cartaSedeMesa\)\s*\} else \{[\s\S]{0,200}\} else \{/.test(pagina), 'page.tsx: solo en el principal (!outlet), con su else que conserva lo de hoy')
    const resolver = await leer('app/api/restaurant-tables/resolve/route.ts')
    check(/from '@\/lib\/restaurant\/cartaDeSede'/.test(resolver) && !/async function cartaDeSede/.test(resolver), 'resolve de la mesa: usa la misma cartaDeSede (una sola regla)')

    // ERP al lado: la URL real del QR y la dirección del lienzo del editor.
    const qrErp = join(ERP, 'src/lib/pos/mesas/qrMesa.ts')
    if (await existe(qrErp)) {
      let erp = null
      try {
        erp = await cargar(dirArnes, {
          cupo: { raiz: ERP, ruta: 'src/lib/organizacion/cupo.ts' },
          invitaciones: { raiz: ERP, ruta: 'src/lib/organizacion/invitaciones.ts' },
          horarioSede: { raiz: ERP, ruta: 'src/lib/organizacion/horarioSede.ts' },
          sucursales: { raiz: ERP, ruta: 'src/lib/organizacion/sucursales.ts' },
          qrMesaErp: { raiz: ERP, ruta: 'src/lib/pos/mesas/qrMesa.ts' },
        })
      } catch (e) {
        check(false, `arnés del ERP: no se pudo cargar qrMesa.ts (${e.message})`)
      }
      if (erp) {
        const host = 'hotel-ejemplo.goadmin.io'
        const sede531 = { is_main: false, is_active: true, is_web_published: true, slug: SLUG, custom_domain: null }
        const sede530 = { is_main: true, is_active: true, is_web_published: false, slug: null, custom_domain: null }
        const url = erp.qrMesaErp.urlQrMesa(host, MESA_SEDE, sede531)
        check(url === `https://${host}/${SLUG}/menu?mesa=${MESA_SEDE}`, `ERP: el QR de la Mesa 1 lleva a la carta de su sede (${url})`)
        // Lo que el sitio hace con esa URL: primer segmento = sede publicada → la página /menu de la sede.
        const segmentos = url ? new URL(url).pathname.split('/').filter(Boolean) : []
        check(segmentos[0] === SLUG && segmentos[1] === 'menu', 'ERP→sitio: el primer segmento del QR es el slug que el sitio resuelve como sede')
        check(erp.qrMesaErp.urlQrMesa(host, MESA_PRINCIPAL, sede530) === `https://${host}/menu?mesa=${MESA_PRINCIPAL}`, 'ERP: mesa de la sede principal → el QR de siempre')
        check(erp.qrMesaErp.urlQrMesa(host, MESA_PRINCIPAL) === `https://${host}/menu?mesa=${MESA_PRINCIPAL}`, 'ERP: sin sede → el QR de siempre (org 140)')
      }
      const dialogo = await readFile(join(ERP, 'src/components/pos/mesas/MesaQrDialog.tsx'), 'utf8')
      check(/urlQrMesa\(sitio\.host, mesa\.id, sedeDe\(mesa\.branchId\)\)/.test(dialogo), 'ERP POS › Mesas: el QR se arma con la sede de la mesa')
      const cartaErp = await readFile(join(ERP, 'src/lib/website/carta.server.ts'), 'utf8')
      check(/urlQrMesa\(host, m\.id, sedeWeb\)/.test(cartaErp), 'ERP Sitio web › Carta QR: el QR se arma con la sede elegida')
      const editor = await readFile(join(ERP, 'src/components/sitio-web/editor/useEditorSitio.ts'), 'utf8')
      check(/baseWebDeSede\(previewUrlBase, sede\) \?\? previewUrlBase/.test(editor) && /const base = baseLienzo;/.test(editor), 'ERP editor: el lienzo de una sede usa la dirección de ESA sede (no la del principal)')
    } else {
      notas.push(`Sin el ERP en ${ERP}: no se revisa la URL del QR ni el lienzo del editor.`)
    }
  } finally {
    await rm(dirArnes, { recursive: true, force: true })
  }
}

for (const n of notas) console.log(`· ${n}`)
if (fallos > 0) {
  console.error(`✗ verify-carta-qr: ${fallos} de ${total} comprobaciones fallaron`)
  process.exit(1)
}
console.log(`✓ verify-carta-qr: ${total} comprobaciones OK`)
