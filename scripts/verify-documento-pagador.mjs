/**
 * verify-documento-pagador.mjs — documento de la factura del checkout en el perfil del cliente y en
 * las pasarelas (pedido del dueño 2026-11-25: «no llenar dos veces el mismo dato»; ERP
 * 20261125061424).
 *
 *   node --experimental-strip-types --import ./scripts/resolver-ts.mjs \
 *     --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     scripts/verify-documento-pagador.mjs
 *
 * Prueba lo PURO con los módulos reales (lib/payments/documentoPagador.ts,
 * components/site/checkout/facturaEmpresa.ts y facturaPerfil.ts) y revisa en el fuente que las
 * rutas del dinero sigan conectadas con su `else` de hoy. Sin red ni base.
 *
 * - Mapeo de tipos por pasarela (Wompi, Mercado Pago, Bold, PayU; Stripe y PayPal no reciben nada).
 * - Quién puede recibir el documento: token del pedido o sesión del cliente del pedido; la ficha
 *   solo con sesión.
 * - Bold: el documento nunca en la URL de /checkout/bold.
 * - Prellenado: solo lo vacío; la casilla no se marca sola.
 * - No sobrescribir una identificación distinta: la regla vive en la RPC del ERP
 *   (fn_web_order_documento_cliente; probada en seco en la base). Si el repo del ERP está al lado
 *   (ERP_DIR o ../CascadeProjects/go-admin-erp), se revisa que la rama «distinto» no escriba la ficha.
 */
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  TIPOS_POR_PASARELA,
  customerDataBoldConDocumento,
  documentoDeFacturaPedido,
  documentoDePerfil,
  documentoParaPasarela,
  elegirDocumentoPagador,
  normalizarNumero,
} from '../lib/payments/documentoPagador.ts'
import { FACTURA_VACIA, facturaParaPedido, leerFacturaDelPedido, notasConFactura } from '../components/site/checkout/facturaEmpresa.ts'
import { facturaDePerfil, facturaParaGuardar, leerPerfilFactura, mezclarFacturaPerfil } from '../components/site/checkout/facturaPerfil.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (r) => readFileSync(join(ROOT, r), 'utf8').replace(/\r\n/g, '\n')
let pruebas = 0
const prueba = (nombre, fn) => {
  try {
    fn()
    pruebas++
  } catch (e) {
    console.error(`✗ ${nombre}`)
    throw e
  }
}

// ── 1. Mapeo de tipos por pasarela ──────────────────────────────────────────
prueba('mapeo por pasarela', () => {
  const cc = { tipo: 'CC', numero: '1020304050' }
  const ce = { tipo: 'CE', numero: 'E12345' }
  const nit = { tipo: 'NIT', numero: '900123456' }
  const pa = { tipo: 'PA', numero: 'AB12345' }
  // Wompi: CC, CE, NIT, PP.
  assert.deepEqual(documentoParaPasarela('wompi_co', cc), { tipo: 'CC', numero: '1020304050' })
  assert.deepEqual(documentoParaPasarela('wompi_co', nit), { tipo: 'NIT', numero: '900123456' })
  assert.deepEqual(documentoParaPasarela('wompi_co', pa), { tipo: 'PP', numero: 'AB12345' })
  // Mercado Pago: CC, CE, NIT; pasaporte no.
  assert.deepEqual(documentoParaPasarela('mp_checkout', ce), { tipo: 'CE', numero: 'E12345' })
  assert.equal(documentoParaPasarela('mp_checkout', pa), null)
  // Bold: CC, CE, PA, NIT.
  assert.deepEqual(documentoParaPasarela('bold_link', pa), { tipo: 'PA', numero: 'AB12345' })
  assert.deepEqual(documentoParaPasarela('bold_link', nit), { tipo: 'NIT', numero: '900123456' })
  // PayU: CC, CE, NIT; pasaporte no.
  assert.deepEqual(documentoParaPasarela('payu_co', cc), { tipo: 'CC', numero: '1020304050' })
  assert.equal(documentoParaPasarela('payu_co', pa), null)
  // Stripe y PayPal: nada. Pasarela desconocida o sin documento: nada.
  for (const doc of [cc, ce, nit, pa]) {
    assert.equal(documentoParaPasarela('stripe_payments', doc), null)
    assert.equal(documentoParaPasarela('paypal_checkout', doc), null)
  }
  assert.equal(documentoParaPasarela('otra', cc), null)
  assert.equal(documentoParaPasarela('wompi_co', null), null)
  // La tabla cubre los 4 tipos del checkout en las 6 pasarelas del switch de /api/checkout/init.
  for (const tabla of Object.values(TIPOS_POR_PASARELA)) assert.deepEqual(Object.keys(tabla).sort(), ['CC', 'CE', 'NIT', 'PA'])
})

// ── 2. Normalización y lectura ──────────────────────────────────────────────
prueba('normalización del número y del perfil del ERP', () => {
  assert.equal(normalizarNumero('NIT', '900.123.456'), '900123456')
  assert.equal(normalizarNumero('NIT', '12345'), null)
  assert.equal(normalizarNumero('CC', '1.020.304.050'), '1020304050')
  assert.equal(normalizarNumero('PA', ' ab 12345 '), 'AB12345')
  assert.equal(normalizarNumero('CE', 'a!'), null)
  // billing_data del pedido (lo que escribe la RPC del ERP).
  assert.deepEqual(documentoDeFacturaPedido({ tipo: 'NIT', numero: '900123456', dv: 8 }), { tipo: 'NIT', numero: '900123456' })
  assert.equal(documentoDeFacturaPedido({ tipo: 'XX', numero: '1' }), null)
  assert.equal(documentoDeFacturaPedido(null), null)
  // Códigos de customers.identification_type (minúscula, country_identification_types).
  assert.deepEqual(documentoDePerfil('cc', '1020304050'), { tipo: 'CC', numero: '1020304050' })
  assert.deepEqual(documentoDePerfil('passport', 'ab12345'), { tipo: 'PA', numero: 'AB12345' })
  assert.deepEqual(documentoDePerfil('nit', '900.123.456'), { tipo: 'NIT', numero: '900123456' })
  assert.equal(documentoDePerfil('ti', '1020304050'), null)
  assert.equal(documentoDePerfil(null, '1020304050'), null)
  assert.equal(documentoDePerfil('cc', ''), null)
})

// ── 3. Quién puede recibir el documento ─────────────────────────────────────
prueba('documento solo para el comprador (token o sesión); ficha solo con sesión', () => {
  const billing = { tipo: 'CC', numero: '1020304050', dv: null, razon_social: 'Ana', correo: 'a@ejemplo.test' }
  const perfil = { tipo: 'nit', numero: '900123456' }
  // Sin token ni sesión (solo el número del pedido): nada.
  assert.equal(elegirDocumentoPagador({ billing, perfil, tokenValido: false, sesionEsDelPedido: false }), null)
  // Token: la factura del pedido.
  assert.deepEqual(elegirDocumentoPagador({ billing, perfil: null, tokenValido: true, sesionEsDelPedido: false }), { tipo: 'CC', numero: '1020304050' })
  // Token sin factura: NO la ficha (un invitado pudo escribir el correo de otra persona).
  assert.equal(elegirDocumentoPagador({ billing: null, perfil, tokenValido: true, sesionEsDelPedido: false }), null)
  // Sesión del cliente sin factura: la ficha.
  assert.deepEqual(elegirDocumentoPagador({ billing: null, perfil, tokenValido: false, sesionEsDelPedido: true }), { tipo: 'NIT', numero: '900123456' })
  // Sesión con factura: manda la del pedido.
  assert.deepEqual(elegirDocumentoPagador({ billing, perfil, tokenValido: false, sesionEsDelPedido: true }), { tipo: 'CC', numero: '1020304050' })
})

// ── 4. Bold: el documento nunca en la URL de la tienda ──────────────────────
prueba('Bold: customerData con documento aparte de la URL', () => {
  const url = JSON.stringify({ email: 'a@ejemplo.test', fullName: 'Ana', phone: '3001234567', dialCode: '+57' })
  const con = JSON.parse(customerDataBoldConDocumento(url, { tipo: 'CC', numero: '1020304050' }))
  assert.deepEqual(con, { email: 'a@ejemplo.test', fullName: 'Ana', phone: '3001234567', dialCode: '+57', documentNumber: '1020304050', documentType: 'CC' })
  assert.equal(JSON.parse(customerDataBoldConDocumento(null, { tipo: 'PA', numero: 'AB1' + '2345' })).documentType, 'PA')
  assert.equal(customerDataBoldConDocumento(url, null), null)
  assert.equal(JSON.parse(customerDataBoldConDocumento('{roto', { tipo: 'NIT', numero: '900123456' })).documentType, 'NIT')
})

// ── 5. Payload de /api/orders y validación del servidor ─────────────────────
prueba('factura estructurada: misma regla en navegador y servidor', () => {
  // Sin casilla: no viaja (payload de siempre) y las notas quedan igual.
  assert.equal(facturaParaPedido(FACTURA_VACIA), undefined)
  assert.equal(notasConFactura('Sin cebolla', FACTURA_VACIA), 'Sin cebolla')
  const nit = { activa: true, tipo: 'NIT', numero: '900.123.456', dv: '8', razonSocial: ' Empresa de Prueba S.A.S. ', correo: 'factura@ejemplo.test' }
  const p = facturaParaPedido(nit)
  assert.deepEqual(p, { tipo: 'NIT', numero: '900123456', dv: '8', razonSocial: 'Empresa de Prueba S.A.S.', correo: 'factura@ejemplo.test' })
  assert.deepEqual(leerFacturaDelPedido(p), { tipo: 'NIT', numero: '900123456', dv: '8', razon_social: 'Empresa de Prueba S.A.S.', correo: 'factura@ejemplo.test' })
  // La línea de las notas se conserva.
  assert.match(notasConFactura('', nit), /^\[Factura electrónica\] NIT 900\.123\.456-8 · Empresa de Prueba S\.A\.S\. · factura@ejemplo\.test$/)
  // El servidor no confía: NIT sin DV, correo malo, tipo raro o basura → null (el pedido se crea igual).
  assert.equal(leerFacturaDelPedido({ ...p, dv: '' }), null)
  assert.equal(leerFacturaDelPedido({ ...p, correo: 'no-es-correo' }), null)
  assert.equal(leerFacturaDelPedido({ ...p, tipo: 'TI' }), null)
  assert.equal(leerFacturaDelPedido('NIT 900123456'), null)
  assert.equal(leerFacturaDelPedido(undefined), null)
  // Cédula: sin DV; pasaporte en mayúsculas.
  assert.deepEqual(leerFacturaDelPedido({ tipo: 'CC', numero: '1.020.304.050', dv: '9', razonSocial: 'Ana', correo: 'a@ejemplo.test' }),
    { tipo: 'CC', numero: '1020304050', dv: null, razon_social: 'Ana', correo: 'a@ejemplo.test' })
  assert.equal(leerFacturaDelPedido({ tipo: 'PA', numero: 'ab12345', razonSocial: 'Ana', correo: 'a@ejemplo.test' }).numero, 'AB12345')
})

// ── 6. Prellenado desde la cuenta ───────────────────────────────────────────
prueba('prellenado: la empresa primero, solo lo vacío, sin marcar la casilla', () => {
  const persona = { identification_type: 'cc', identification_number: '1020304050', full_name: 'Ana Pérez', email: 'ana@ejemplo.test', billing_email: null }
  const empresa = { identification_type: 'nit', identification_number: '900123456', dv: 8, company_name: 'Empresa de Prueba S.A.S.', email: null, billing_email: 'factura@ejemplo.test' }
  assert.deepEqual(facturaDePerfil(persona, empresa), { tipo: 'NIT', numero: '900123456', dv: '8', razonSocial: 'Empresa de Prueba S.A.S.', correo: 'factura@ejemplo.test' })
  assert.deepEqual(facturaDePerfil(persona, null), { tipo: 'CC', numero: '1020304050', dv: '', razonSocial: 'Ana Pérez', correo: 'ana@ejemplo.test' })
  assert.equal(facturaDePerfil({ email: 'x@ejemplo.test' }, null), null)
  const perfil = leerPerfilFactura(facturaDePerfil(persona, empresa))
  // Vacío: se llena todo y la casilla sigue sin marcar.
  const llena = mezclarFacturaPerfil(FACTURA_VACIA, perfil)
  assert.equal(llena.activa, false)
  assert.deepEqual({ ...llena, activa: true }, { activa: true, tipo: 'NIT', numero: '900123456', dv: '8', razonSocial: 'Empresa de Prueba S.A.S.', correo: 'factura@ejemplo.test' })
  // Lo escrito no se pisa (documento, razón social ni correo).
  const escrita = { activa: true, tipo: 'CC', numero: '55', dv: '', razonSocial: 'Mi nombre', correo: 'mio@ejemplo.test' }
  assert.deepEqual(mezclarFacturaPerfil(escrita, perfil), escrita)
  // Solo el correo vacío: se llena el correo, el documento escrito queda.
  const sinCorreo = { ...escrita, correo: '' }
  assert.deepEqual(mezclarFacturaPerfil(sinCorreo, perfil), { ...escrita, correo: 'factura@ejemplo.test' })
  assert.equal(leerPerfilFactura({ tipo: 'TI', numero: '1' }), null)
  assert.equal(mezclarFacturaPerfil(escrita, null), escrita)
})

// ── 7. Rutas del dinero: conectadas y con su `else` de hoy ──────────────────
prueba('/api/orders: la RPC después de crear el pedido y reservar, con su else', () => {
  const src = leer('app/api/orders/route.ts')
  const i = src.indexOf('leerFacturaDelPedido(facturaBody)')
  assert.ok(i > 0, 'lee body.factura')
  assert.ok(i > src.indexOf("rpc('reserve_stock_for_web_order'"), 'después de la reserva de stock')
  assert.ok(i > src.indexOf('Pasos críticos: líneas del pedido'), 'después de las líneas')
  assert.match(src.slice(i, i + 600), /guardarDocumentoPedido\([^)]*webOrder\.id, facturaPedido\)[\s\S]*?\} else \{\s*\/\/ Sin factura pedida/)
  // Las notas siguen siendo las del cliente (con la línea de la factura): no se tocan aquí.
  assert.match(src, /customer_notes: customer\.notes \|\| null,/)
  const rpc = leer('lib/orders/documentoCliente.ts')
  assert.match(rpc, /rpc\('fn_web_order_documento_cliente'/)
  assert.doesNotMatch(rpc, /console\.[a-z]+\([^)]*factura[,)]/, 'el documento no va al log')
})

prueba('/api/checkout/init: campos oficiales, else de hoy, sin documento en logs ni en la URL de la tienda', () => {
  const src = leer('app/api/checkout/init/route.ts')
  assert.match(src, /customer-data:legal-id=\$\{encodeURIComponent\(documento\.numero\)\}/)
  assert.match(src, /customer-data:legal-id-type=\$\{encodeURIComponent\(documento\.tipo\)\}/)
  assert.match(src, /payer\.identification = \{ type: documento\.tipo, number: documento\.numero \}/)
  assert.match(src, /params\.append\('payerDocument', documento\.numero\)/)
  assert.equal((src.match(/\} else \{\s*\/\/ Sin documento/g) || []).length >= 3, true, 'cada pasarela con su else')
  assert.doesNotMatch(src, /full URL/, 'el log de Wompi ya no imprime la URL completa')
  assert.doesNotMatch(src, /documentNumber/, 'Bold: el documento no se arma en la URL de /checkout/bold')
  for (const linea of src.split('\n').filter((l) => /console\.(log|warn|error|info)/.test(l))) {
    assert.doesNotMatch(linea, /documento\.numero|pagador|finalUrl|checkoutUrl/, `log con datos del pagador: ${linea.trim()}`)
  }
  // Solo pedido web y anticipo; el token o la sesión deciden (documentoPagadorServidor.ts).
  assert.match(src, /if \(esPedidoWeb \|\| isAnticipo\) \{\s*pagador = await documentoPagadorDelPedido\(supabase, order, tokenPedido\)\s*\} else \{/)
  const srv = leer('lib/payments/documentoPagadorServidor.ts')
  assert.match(srv, /tokenSeguimientoValido\(organizationId, id,/)
  assert.match(srv, /\.eq\('organization_id', organizationId\)/)
})

prueba('checkout y consulta del pedido: factura estructurada, token y Bold', () => {
  const w = leer('components/site/CheckoutWizard.tsx')
  assert.match(w, /\.\.\.\(facturaParaPedido\(factura\) \? \{ factura: facturaParaPedido\(factura\) \} : \{\}\)/)
  assert.equal((w.match(/\{ t: (orderData|reintento)\.trackingToken \}/g) || []).length, 3, 'token en las 3 llamadas a /api/checkout/init')
  assert.equal((w.match(/abrirBoldDesdeUrl\([^)]*boldCustomerData\)/g) || []).length, 3)
  assert.match(w, /setFactura\(\(f\) => mezclarFacturaPerfil\(f, perfilFactura\)\)/)
  const t = leer('app/pedido/[id]/OrderTracker.tsx')
  assert.match(t, /abrirBoldDesdeUrl\(j\.checkoutUrl, j\.boldCustomerData\)/)
  assert.equal((t.match(/\.\.\.\(token \? \{ t: token \} : \{\}\)/g) || []).length, 2)
  const b = leer('lib/payments/boldCheckoutCliente.ts')
  assert.match(b, /config\.customerData = customerDataConDocumento/)
})

// ── 8. ERP: la rama «distinto» no escribe la ficha (si el repo está al lado) ─
const erp = process.env.ERP_DIR || join(ROOT, '..', 'CascadeProjects', 'go-admin-erp')
prueba('Navegador: el documento queda guardado para la próxima compra (sin sesión)', () => {
  assert.equal(facturaParaGuardar(FACTURA_VACIA), null, 'sin número no se guarda')
  assert.equal(facturaParaGuardar({ ...FACTURA_VACIA, tipo: 'CC', numero: '   ' }), null)
  const cc = { activa: true, tipo: 'CC', numero: ' 1020304050 ', dv: '7', razonSocial: 'Ana Gómez', correo: 'ana@ejemplo.test' }
  const g = facturaParaGuardar(cc)
  assert.deepEqual(g, { tipo: 'CC', numero: '1020304050', dv: '', razonSocial: 'Ana Gómez', correo: 'ana@ejemplo.test' })
  assert.ok(!('activa' in g), 'la casilla no se guarda')
  // Ida y vuelta: lo guardado se lee igual y solo llena lo vacío; la casilla no se marca sola.
  const leido = leerPerfilFactura(JSON.parse(JSON.stringify(g)))
  assert.deepEqual(leido, g)
  const lleno = mezclarFacturaPerfil(FACTURA_VACIA, leido)
  assert.equal(lleno.activa, false)
  assert.equal(lleno.numero, '1020304050')
  assert.equal(lleno.tipo, 'CC')
  const nit = facturaParaGuardar({ activa: false, tipo: 'NIT', numero: '900123456', dv: '8', razonSocial: 'Empresa S.A.S.', correo: '' })
  assert.equal(nit.dv, '8')
  const w = readFileSync(join(ROOT, 'components/site/CheckoutWizard.tsx'), 'utf8')
  assert.match(w, /checkout_factura_\$\{organizationSubdomain\}/)
  assert.match(w, /setFactura\(\(f\) => mezclarFacturaPerfil\(f, guardada\)\)/)
  assert.match(w, /const aGuardar = facturaParaGuardar\(factura\)/)
})

const carpeta = join(erp, 'supabase', 'migrations')
const archivo = existsSync(carpeta) ? readdirSync(carpeta).find((f) => /_factura_pedido_web_documento_cliente\.sql$/.test(f)) : null
if (archivo) {
  prueba('ERP: no sobrescribe una identificación distinta', () => {
    const sql = readFileSync(join(carpeta, archivo), 'utf8').replace(/\r\n/g, '\n')
    // La única escritura de identification_number de la persona está bajo «la ficha no tiene documento».
    const escrituras = sql.split('identification_number = v_numero').length - 1
    assert.equal(escrituras, 1)
    const iEscritura = sql.indexOf('identification_number = v_numero')
    const iGuardia = sql.lastIndexOf("IF nullif(btrim(coalesce(v_cliente.identification_number, '')), '') IS NULL THEN", iEscritura)
    assert.ok(iGuardia > 0 && iEscritura - iGuardia < 1200, 'solo si la ficha no tenía documento')
    assert.match(sql, /ELSE\s*\n\s*v_estado := 'distinto';\s*\n\s*END IF;/, 'distinto: sin UPDATE')
    assert.match(sql, /WHEN 'distinto' THEN format\('\[Factura electrónica\] Revisar:/)
    assert.match(sql, /REVOKE ALL ON FUNCTION public\.fn_web_order_documento_cliente\(integer, uuid, jsonb\) FROM PUBLIC, anon, authenticated;/)
  })
} else {
  console.log('! verify-documento-pagador: sin el repo del ERP al lado; la regla «distinto» se prueba en seco en la base')
}

console.log(`✓ verify-documento-pagador: ${pruebas} grupos de pruebas pasan`)
