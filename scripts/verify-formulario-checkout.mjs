/**
 * verify-formulario-checkout.mjs — Checkout v2, Parte F: formulario del checkout configurable desde
 * el ERP (Figma «16 Sitio web» › Checkout v2 3141-93709; encargo aprobado por el dueño 2026-11-25).
 *
 *   node --experimental-strip-types --import ./scripts/resolver-ts.mjs \
 *     --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/verify-formulario-checkout.mjs
 *
 * Prueba con los módulos REALES (lib/website/formularioCheckout.ts —copia del ERP—,
 * components/site/checkout/camposCheckout.ts, ordenCampos.ts y reglasCheckout.ts,
 * lib/orders/formularioPedido.ts) y revisa en el fuente que el checkout, la página y /api/orders
 * sigan conectados. Sin red ni base.
 *
 * 1. Sin ajustes = hoy: la lista, las filas, el bloque de la dirección, la validación y el servidor.
 * 2. Orden elegido en Contacto y en Entrega (las indicaciones no se mueven).
 * 3. Ocultar un campo opcional (celular, apto, factura, indicaciones).
 * 4. Los indispensables no se pueden ocultar ni volver opcionales (ni en la lectura ni en el PUT).
 * 5. Obligatorios en el servidor (/api/orders) con configuración; sin ella, nada nuevo.
 */
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CAMPOS_FORMULARIO,
  CLAVE_FORMULARIO_CHECKOUT,
  esFormularioRecomendado,
  faltantesPedido,
  formularioRecomendado,
  leerFormularioCheckout,
  ordenFormulario,
  resolverFormulario,
  validarFormularioCheckout,
} from '../lib/website/formularioCheckout.ts'
import { CAMPOS_CHECKOUT_POR_DEFECTO, camposDelCheckout, campo, sinOpcional } from '../components/site/checkout/camposCheckout.ts'
import { ejemploPropio, filasContacto, planEntrega } from '../components/site/checkout/ordenCampos.ts'
import { validarDatosCheckout, errorDe } from '../components/site/checkout/reglasCheckout.ts'
import { FACTURA_VACIA, lineaFacturaNotas, notasConFactura } from '../components/site/checkout/facturaEmpresa.ts'
import { faltantesFormularioPedido, mensajeFaltantes } from '../lib/orders/formularioPedido.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const fuente = (r) => readFileSync(join(ROOT, r), 'utf8').replace(/\r\n/g, '\n')

let casos = 0
const fallos = []
function igual(nombre, obtenido, esperado) {
  casos += 1
  try {
    assert.deepStrictEqual(obtenido, esperado)
  } catch {
    fallos.push(`${nombre}\n      esperado ${JSON.stringify(esperado)}\n      obtuvo   ${JSON.stringify(obtenido)}`)
  }
}

const claves = (lista) => lista.map((c) => c.clave)
/** Un formulario completo como lo guarda el ERP (9 campos), con cambios encima. */
const completo = (cambios = {}, orden = null) => {
  const base = formularioRecomendado().map((c) => ({ clave: c.clave, visible: c.visible, obligatorio: c.obligatorio, ...(cambios[c.clave] ?? {}) }))
  return orden ? orden.map((k) => base.find((c) => c.clave === k)) : base
}
const datos = {
  nombreCompleto: 'Laura Pérez',
  email: 'laura@correo.com',
  phone: '+57 3001234567',
  address: 'Cra 7 # 45-12',
  city: 'Bogotá, D.C.',
  countryCode: 'COL',
  factura: FACTURA_VACIA,
  entrega: 'delivery',
}

// ── 1. Sin ajustes = hoy ────────────────────────────────────────────────────────────────────────
igual('sin ajustes: la lista de siempre', camposDelCheckout(null), CAMPOS_CHECKOUT_POR_DEFECTO.map((c) => ({ ...c })))
igual('lista vacía: la de siempre', camposDelCheckout([]), CAMPOS_CHECKOUT_POR_DEFECTO.map((c) => ({ ...c })))
igual('lo guardado sin campos válidos: null', [leerFormularioCheckout(null), leerFormularioCheckout({}), leerFormularioCheckout({ campos: [{ clave: 'otro' }] }), leerFormularioCheckout('x')], [null, null, null, null])
igual('sin ajustes no hay resolución', resolverFormulario(null), null)
igual('sin ajustes: correo · celular, nombre, factura (las filas de siempre)', filasContacto(camposDelCheckout(null)), [['email', 'celular'], ['nombre'], ['factura']])
igual('sin ajustes: dirección, apto y municipio; el barrio con la zona', planEntrega(camposDelCheckout(null)), { bloque: ['direccion', 'complemento', 'ciudad'], barrioEnZona: true })
igual('sin ajustes: el celular y el municipio con su ejemplo de siempre', [ejemploPropio(camposDelCheckout(null), 'celular'), ejemploPropio(camposDelCheckout(null), 'ciudad')], [undefined, undefined])
igual('sin ajustes: apto, barrio e indicaciones vacíos no bloquean', validarDatosCheckout({ ...datos, complemento: '', barrio: '', notas: '', direccionManual: true, barrioPedido: true }), [])
igual('sin ajustes: el servidor no revisa nada nuevo', faltantesPedido(null, {}), [])
igual('el recomendado es «sin configuración»', [esFormularioRecomendado(null), esFormularioRecomendado(resolverFormulario(completo()))], [true, true])
// Mismos textos en el ERP (configurador) y en la tienda: un solo formulario recomendado.
igual('los textos del recomendado son los de la tienda', CAMPOS_FORMULARIO.map((c) => [c.clave, c.etiqueta, c.ayuda, c.placeholder, c.visible, c.obligatorio]), CAMPOS_CHECKOUT_POR_DEFECTO.map((c) => [c.clave, sinOpcional(c.etiqueta), c.ayuda, c.placeholder, c.visible, c.obligatorio]))
igual('el orden del recomendado es el de la pantalla', claves(CAMPOS_FORMULARIO), claves(CAMPOS_CHECKOUT_POR_DEFECTO))

// ── 2. Orden ────────────────────────────────────────────────────────────────────────────────────
const nombrePrimero = camposDelCheckout(completo({}, ['nombre', 'email', 'celular', 'factura', 'direccion', 'complemento', 'ciudad', 'barrio', 'notas']))
igual('orden: nombre primero', filasContacto(nombrePrimero), [['nombre'], ['email', 'celular'], ['factura']])
const celularPrimero = camposDelCheckout(completo({}, ['celular', 'email', 'nombre', 'factura', 'direccion', 'complemento', 'ciudad', 'barrio', 'notas']))
igual('orden: celular antes del correo, en la misma fila', filasContacto(celularPrimero), [['celular', 'email'], ['nombre'], ['factura']])
const separados = camposDelCheckout(completo({}, ['email', 'nombre', 'celular', 'factura', 'direccion', 'complemento', 'ciudad', 'barrio', 'notas']))
igual('orden: correo y celular separados, una fila cada uno', filasContacto(separados), [['email'], ['nombre'], ['celular'], ['factura']])
const barrioArriba = camposDelCheckout(completo({}, ['email', 'celular', 'nombre', 'factura', 'direccion', 'complemento', 'barrio', 'ciudad', 'notas']))
igual('orden: barrio antes del municipio (dentro del bloque)', planEntrega(barrioArriba), { bloque: ['direccion', 'complemento', 'barrio', 'ciudad'], barrioEnZona: false })
igual('las indicaciones no se mueven', claves(camposDelCheckout(completo({}, ['notas', 'email', 'celular', 'nombre', 'factura', 'direccion', 'complemento', 'ciudad', 'barrio']))).at(-1), 'notas')
igual('una lista parcial solo permuta lo que nombra', ordenFormulario([{ clave: 'ciudad' }, { clave: 'direccion' }]), ['email', 'celular', 'nombre', 'factura', 'ciudad', 'complemento', 'direccion', 'barrio', 'notas'])
igual('un ajuste suelto no mueve nada', claves(camposDelCheckout([{ clave: 'barrio', obligatorio: true }])), claves(CAMPOS_CHECKOUT_POR_DEFECTO))
igual('una sección no invade la otra', ordenFormulario([{ clave: 'direccion' }, { clave: 'email' }]), claves(CAMPOS_CHECKOUT_POR_DEFECTO))

// ── 3. Ocultar un opcional ──────────────────────────────────────────────────────────────────────
const sinCelular = camposDelCheckout(completo({ celular: { visible: false } }))
igual('celular oculto: no sale', filasContacto(sinCelular), [['email'], ['nombre'], ['factura']])
igual('celular oculto: no se pide', validarDatosCheckout({ ...datos, phone: '' }, sinCelular), [])
const celularOpcional = camposDelCheckout(completo({ celular: { obligatorio: false } }))
igual('celular opcional: vacío pasa', validarDatosCheckout({ ...datos, phone: '' }, celularOpcional), [])
igual('celular opcional: escrito mal, se avisa', validarDatosCheckout({ ...datos, phone: '+57 31' }, celularOpcional).map((e) => e.campo), ['celular'])
igual('celular opcional: «(opcional)» en la etiqueta', campo(celularOpcional, 'celular').etiqueta, 'Celular (opcional)')
igual('factura oculta: sin la casilla', filasContacto(camposDelCheckout(completo({ factura: { visible: false } }))), [['email', 'celular'], ['nombre']])
igual('apto oculto: fuera del bloque', planEntrega(camposDelCheckout(completo({ complemento: { visible: false } }))).bloque, ['direccion', 'ciudad'])
igual('indicaciones ocultas', campo(camposDelCheckout(completo({ notas: { visible: false } })), 'notas').visible, false)

// ── 4. Indispensables ───────────────────────────────────────────────────────────────────────────
const intento = camposDelCheckout(['email', 'nombre', 'direccion', 'ciudad'].map((k) => ({ clave: k, visible: false, obligatorio: false })))
igual('correo, nombre, dirección y municipio siguen visibles y obligatorios', ['email', 'nombre', 'direccion', 'ciudad'].map((k) => [campo(intento, k).visible, campo(intento, k).obligatorio]), [[true, true], [true, true], [true, true], [true, true]])
igual('el barrio no se esconde (la zona lo necesita)', campo(camposDelCheckout([{ clave: 'barrio', visible: false }]), 'barrio').visible, true)
igual('la casilla de factura no se vuelve obligatoria', campo(camposDelCheckout([{ clave: 'factura', obligatorio: true }]), 'factura').obligatorio, false)
igual('sin correo ni celular: imposible (el correo queda)', [campo(camposDelCheckout([{ clave: 'email', visible: false }, { clave: 'celular', visible: false }]), 'email').visible], [true])
const rechazo = (raw) => {
  const v = validarFormularioCheckout(raw)
  return v.ok ? 'ok' : v.errores.map((e) => `${e.codigo}:${e.clave ?? ''}:${e.propiedad ?? ''}`)
}
igual('PUT: ocultar el correo se rechaza', rechazo({ version: 1, campos: completo({ email: { visible: false } }) }), ['fijo:email:visible'])
igual('PUT: nombre opcional se rechaza', rechazo({ version: 1, campos: completo({ nombre: { obligatorio: false } }) }), ['fijo:nombre:obligatorio'])
igual('PUT: dirección oculta se rechaza', rechazo({ version: 1, campos: completo({ direccion: { visible: false } }) }), ['fijo:direccion:visible'])
igual('PUT: municipio opcional se rechaza', rechazo({ version: 1, campos: completo({ ciudad: { obligatorio: false } }) }), ['fijo:ciudad:obligatorio'])
igual('PUT: barrio oculto se rechaza', rechazo({ version: 1, campos: completo({ barrio: { visible: false } }) }), ['fijo:barrio:visible'])
igual('PUT: clave desconocida, propiedad extra y texto largo', rechazo({ version: 1, campos: [{ clave: 'otro' }, { clave: 'email', color: 'rojo' }, { clave: 'barrio', etiqueta: 'x'.repeat(61) }] }), ['clave::', 'propiedad:email:color', 'largo:barrio:etiqueta'])
igual('PUT: ejemplo en la casilla de factura se rechaza', rechazo({ version: 1, campos: [{ clave: 'factura', placeholder: 'x' }] }), ['propiedad:factura:placeholder'])
igual('PUT: null = volver al de siempre', validarFormularioCheckout(null), { ok: true, formulario: null })
{
  const v = validarFormularioCheckout({ version: 1, campos: completo({ barrio: { obligatorio: true, etiqueta: '  Barrio  o vereda ' } }) })
  igual('PUT válido: guarda los 9 campos con el texto limpio', v.ok ? [v.formulario.campos.length, v.formulario.campos.find((c) => c.clave === 'barrio')] : v, [9, { clave: 'barrio', visible: true, obligatorio: true, etiqueta: 'Barrio o vereda' }])
}

// ── Obligatorios en el checkout (los que el ERP puede pedir) ───────────────────────────────────
const exigentes = camposDelCheckout(completo({ complemento: { obligatorio: true }, barrio: { obligatorio: true }, notas: { obligatorio: true } }))
igual('apto obligatorio: sin «(opcional)»', campo(exigentes, 'complemento').etiqueta, 'Apto, casa u oficina')
igual('apto, barrio e indicaciones obligatorios: se piden', validarDatosCheckout({ ...datos, complemento: '', barrio: '', notas: '', direccionManual: true, barrioPedido: true }, exigentes).map((e) => e.campo), ['complemento', 'barrio', 'notas'])
igual('con dirección guardada no se pide el apto', validarDatosCheckout({ ...datos, complemento: '', barrio: 'Centro', notas: 'x', direccionManual: false, barrioPedido: true }, exigentes), [])
igual('sin zona no se pide el barrio', validarDatosCheckout({ ...datos, complemento: 'Apto 1', barrio: '', notas: 'x', direccionManual: true, barrioPedido: false }, exigentes), [])
igual('al recoger no se pide apto ni barrio', validarDatosCheckout({ ...datos, entrega: 'pickup', address: '', city: '', complemento: '', barrio: '', notas: 'x', barrioPedido: false }, exigentes), [])
igual('mensaje del barrio', errorDe(validarDatosCheckout({ ...datos, complemento: 'A', barrio: ' ', notas: 'x', barrioPedido: true }, exigentes), 'barrio'), 'Escribe tu barrio para saber la zona del envío.')
const etiquetaPropia = camposDelCheckout(completo({ celular: { etiqueta: 'Celular o WhatsApp', ayuda: null, placeholder: '300 123 4567' } }))
igual('etiqueta, ayuda y ejemplo propios', [campo(etiquetaPropia, 'celular').etiqueta, campo(etiquetaPropia, 'celular').ayuda, ejemploPropio(etiquetaPropia, 'celular'), campo(etiquetaPropia, 'celular').etiquetaPropia], ['Celular o WhatsApp', null, '300 123 4567', true])

// ── 5. Servidor (/api/orders) ───────────────────────────────────────────────────────────────────
const conf = completo()
const pedido = { email: 'laura@correo.com', phone: '+57 3001234567', firstName: 'Laura', address: 'Cra 7', city: 'Bogotá', notes: '', entrega: 'delivery' }
igual('servidor: pedido completo pasa', faltantesPedido(conf, pedido), [])
igual('servidor: sin correo, nombre, dirección ni municipio', faltantesPedido(conf, { ...pedido, email: '', firstName: ' ', address: '', city: '' }), ['email', 'nombre', 'direccion', 'ciudad'])
igual('servidor: correo sin @', faltantesPedido(conf, { ...pedido, email: 'laura.correo.com' }), ['email'])
igual('servidor: solo «+57» no es celular', faltantesPedido(conf, { ...pedido, phone: '+57' }), ['celular'])
igual('servidor: celular opcional u oculto no se exige', [faltantesPedido(completo({ celular: { obligatorio: false } }), { ...pedido, phone: '' }), faltantesPedido(completo({ celular: { visible: false } }), { ...pedido, phone: '' })], [[], []])
igual('servidor: al recoger no pide dirección', faltantesPedido(conf, { ...pedido, entrega: 'pickup', address: '', city: '' }), [])
igual('servidor: el ERP no puede apagar el correo (lo guardado a mano tampoco)', faltantesPedido([{ clave: 'email', visible: false, obligatorio: false }], { ...pedido, email: '' }), ['email'])
const notasObl = completo({ notas: { obligatorio: true } })
const factura = { activa: true, tipo: 'NIT', numero: '890903938', dv: '8', razonSocial: 'Empresa de ejemplo S.A.S.', correo: 'f@e.com' }
igual('servidor: indicaciones obligatorias; la línea de la factura no cuenta', [faltantesPedido(notasObl, { ...pedido, notes: notasConFactura('', factura) }), faltantesPedido(notasObl, { ...pedido, notes: notasConFactura('Llamar', factura) })], [['notas'], []])
igual('la línea de la factura empieza como espera el servidor', lineaFacturaNotas(factura).startsWith('[Factura electrónica]'), true)
igual('mensaje del 400', mensajeFaltantes(['email', 'direccion', 'ciudad']), 'Faltan datos del pedido: correo, dirección y ciudad o municipio.')
{
  const cliente = (respuesta) => ({ from: (t) => ({ select: () => ({ eq: (c1, v1) => ({ eq: (c2, v2) => ({ maybeSingle: async () => (typeof respuesta === 'function' ? respuesta(t, c1, v1, c2, v2) : respuesta) }) }) }) }) })
  const consultas = []
  const r1 = await faltantesFormularioPedido(cliente((t, c1, v1, c2, v2) => { consultas.push([t, c1, v1, c2, v2]); return { data: null, error: null } }), 7, { email: '' })
  const r2 = await faltantesFormularioPedido(cliente({ data: null, error: { message: 'x' } }), 7, { email: '' })
  const r3 = await faltantesFormularioPedido(cliente({ data: { settings: { version: 1, campos: conf } }, error: null }), 7, { ...pedido, email: '' })
  const r4 = await faltantesFormularioPedido({ from: () => { throw new Error('caída') } }, 7, { email: '' })
  igual('servidor: sin fila, nada nuevo; con fallo, nada nuevo; con fila, lo que falta', [r1, r2, r3, r4], [[], [], ['email'], []])
  igual('servidor: lee la clave de la organización del host', consultas[0], ['organization_settings', 'organization_id', 7, 'key', CLAVE_FORMULARIO_CHECKOUT])
}

// ── Conexiones en el fuente ─────────────────────────────────────────────────────────────────────
const wiz = fuente('components/site/CheckoutWizard.tsx')
igual('el checkout aplica la configuración (sin ella, null)', wiz.includes('const formularioCampos = checkoutSettings?.formularioCampos ?? null') && wiz.includes('camposDelCheckout(formularioCampos)'), true)
igual('el checkout pinta en el orden de filasContacto y planEntrega', wiz.includes('filasContacto(camposCheckout).map(') && wiz.includes('planEntrega(camposCheckout).bloque.map(') && wiz.includes('planEntrega(camposCheckout).barrioEnZona'), true)
igual('1 paso y 3 pasos usan las mismas secciones', (wiz.match(/\{seccionContacto\}/g) || []).length >= 2 && (wiz.match(/\{seccionEntrega\}/g) || []).length >= 2, true)
igual('el checkout manda a validar apto, barrio e indicaciones', wiz.includes('complemento,\n    barrio: customerData.barrio,\n    notas: customerData.notes,') && wiz.includes("barrioPedido: orderType === 'delivery' && grupoEnvio === 'own' && !!cotZona"), true)
igual('indicaciones: ocultas no salen, obligatorias salen abiertas', wiz.includes('{!cNotas.visible ? null : notasAbiertas || customerData.notes || cNotas.obligatorio ? ('), true)
igual('apto opcional: sin error ni check (como hoy)', wiz.includes("mostrarError={cComplemento.obligatorio ? mostrarErrores || !!tocados.complemento : false}"), true)
const pagina = fuente('app/checkout/page.tsx')
igual('la página lee la clave del ERP y la pasa al checkout', pagina.includes('.eq(\'key\', CLAVE_FORMULARIO_CHECKOUT)') && pagina.includes('formularioCampos: leerFormularioCheckout(filaFormulario?.settings ?? null)'), true)
const orders = fuente('app/api/orders/route.ts')
igual('/api/orders: revisa solo sin ronda de mesa, con su else', /if \(!mesaPedido\) \{\n\s+const faltan = await faltantesFormularioPedido\(supabase as any, contextOrgId, \{/.test(orders) && orders.includes("code: 'DATOS_INCOMPLETOS'") && orders.includes('// Ronda de la mesa (Carta QR): no pide estos datos, como antes.'), true)
igual('/api/orders: la organización del host, nunca la del body', orders.includes('faltantesFormularioPedido(supabase as any, contextOrgId,'), true)

// Copia del ERP: idéntica byte a byte (verify-copias-erp también lo revisa).
const ERP = resolve(process.env.ERP_REPO || join(ROOT, '..', 'CascadeProjects', 'go-admin-erp'))
const enErp = join(ERP, 'src/lib/website/formularioCheckout.ts')
if (existsSync(enErp)) {
  igual('módulo compartido idéntico al del ERP', fuente('lib/website/formularioCheckout.ts') === readFileSync(enErp, 'utf8').replace(/\r\n/g, '\n'), true)
} else {
  console.log('· Sin el ERP al lado: no se compara la copia (ERP_REPO=…).')
}

if (fallos.length > 0) {
  console.error(`✗ verify-formulario-checkout: ${fallos.length} de ${casos} fallaron`)
  for (const f of fallos) console.error(`  - ${f}`)
  process.exit(1)
}
console.log(`✓ verify-formulario-checkout: ${casos} comprobaciones (sin ajustes = hoy, orden, ocultar opcionales, indispensables fijos, obligatorios en el checkout y en /api/orders, conexiones, copia del ERP)`)
