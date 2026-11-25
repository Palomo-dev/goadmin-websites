/**
 * verify-consulta-guia.mjs — «Consultar pedido» › «Número de guía» (Figma «16 Sitio web» › Consulta
 * por número de guía, sección 3240:97997; aprobado por el dueño el 2026-11-25).
 *
 *   npm run verify:consulta-guia
 *   node --experimental-strip-types --import ./scripts/resolver-ts.mjs scripts/verify-consulta-guia.mjs
 *
 * Sin base de datos (el contrato de columnas con la base real lo comprueba verify-tracking.mjs).
 * Importa las reglas puras REALES (`lib/orders/consultaGuia.ts`) y lee el fuente para comprobar:
 * - se busca por el número impreso en la guía (DEL-…), la guía de la transportadora y el TRK viejo,
 *   siempre en la organización del host, con `.limit(1).maybeSingle()`;
 * - el TRK nunca se muestra, ni la dirección, el nombre o teléfono del comprador, el teléfono o la
 *   placa del domiciliario, el código de entrega, quién recibió ni montos; del domiciliario, solo
 *   el nombre de pila;
 * - el historial sale de la lista fija por estado canónico (nunca de `description`), con horas en
 *   la zona de la tienda;
 * - «no existe» y «es de otra tienda» dan el MISMO aviso; límite de 20 búsquedas por 10 minutos por
 *   IP y tienda ANTES de consultar la base;
 * - un número de pedido (WO-… sin DEL-) en la pestaña de guía sugiere la otra pestaña.
 * Las expresiones toleran CRLF.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CHIP_GUIA, cuandoEnZona, enlaceSeguro, enlaceTransportadora, esTrkInterno, estadoGuia, nombreDePila,
  normalizarGuia, pareceNumeroPedido, textoEvento, vistaGuiaPublica,
} from '../lib/orders/consultaGuia.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (ruta) => readFileSync(join(ROOT, ruta), 'utf8')
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

let fallos = 0
let casos = 0
function check(ok, texto) {
  casos++
  if (ok) console.log(`  ok  ${texto}`)
  else {
    fallos++
    console.error(`  FALLA  ${texto}`)
  }
}

// ─── 1. Lo que escribe la persona ────────────────────────────────────────────────────────────
check(normalizarGuia(' del-wo-452-mx4k2p7f-a3qz ')?.compacta === 'DEL-WO-452-MX4K2P7F-A3QZ', 'guía: mayúsculas y sin espacios alrededor')
check(normalizarGuia('#DEL-WO-1')?.compacta === 'DEL-WO-1', 'guía: sin «#» al comienzo')
const conEspacios = normalizarGuia('7012  4455 9981')
check(conEspacios?.compacta === '701244559981' && conEspacios?.conEspacios === '7012 4455 9981', 'guía de transportadora: compacta y con los espacios reducidos a uno')
check(normalizarGuia('a,b)') === null && normalizarGuia("DEL'1") === null && normalizarGuia('x.or(1)') === null, 'guía: comas, paréntesis, comillas y puntos no llegan a la consulta')
check(normalizarGuia('') === null && normalizarGuia('AB') === null && normalizarGuia('A'.repeat(81)) === null && normalizarGuia(12) === null, 'guía: vacía, muy corta, muy larga o no texto → nada')
check(pareceNumeroPedido('wo-358-mwwenhob-5vov') === 'WO-358-MWWENHOB-5VOV' && pareceNumeroPedido('EG-120-X1') === 'EG-120-X1', 'WO-…/EG-… sin DEL- parece un número de pedido')
check(pareceNumeroPedido('DEL-WO-358-MWWENHOB-5VOV') === null && pareceNumeroPedido('701244559981') === null && pareceNumeroPedido('TRKMWWER9G3XFCM') === null, 'DEL-…, guías numéricas y TRK no parecen número de pedido')
check(esTrkInterno('TRKMWWER9G3XFCM') && !esTrkInterno('DEL-WO-1'), 'TRK interno reconocido')

// ─── 2. Reglas puras ─────────────────────────────────────────────────────────────────────────
check(nombreDePila('  carlos andrés PÉREZ gómez') === 'Carlos' && nombreDePila('') === null && nombreDePila(null) === null, 'domiciliario: solo el nombre de pila')
check(enlaceSeguro('javascript:alert(1)') === null && enlaceSeguro('data:text/html,x') === null && enlaceSeguro('https://x.co/a') === 'https://x.co/a', 'enlaces: solo http(s)')
check(enlaceTransportadora(null, 'https://t.co/r?g={tracking_number}', '7012 4455') === 'https://t.co/r?g=7012%204455', 'transportadora: plantilla con la guía codificada')
check(enlaceTransportadora('javascript:x', 'https://t.co/{guia}', 'A1') === 'https://t.co/A1' && enlaceTransportadora(null, 'https://t.co/sin-marcador', 'A1') === null, 'transportadora: URL insegura descartada; plantilla sin marcador, sin enlace')
const ESTADOS = ['created', 'ready_for_pickup', 'assigned', 'picked', 'in_transit', 'out_for_delivery', 'failed_attempt', 'delivered', 'exception', 'returned', 'cancelled']
check(ESTADOS.every((e) => textoEvento(e, true, 'Carlos') !== 'Tu envío se actualizó' && textoEvento(e, false, 'Rápido') !== 'Tu envío se actualizó'), 'historial: un texto de comprador para cada estado canónico (propio y transportadora)')
check(estadoGuia('out_for_delivery') === 'en_camino' && estadoGuia('pending') === 'preparando' && estadoGuia('failed_attempt') === 'novedad' && estadoGuia('delivered') === 'entregado' && estadoGuia('returned') === 'devuelto' && estadoGuia('cancelled') === 'cancelado', 'estado del envío → estado del comprador')
check(Object.values(CHIP_GUIA).every((t) => t && t !== 'Pendiente'), 'chips en palabras (adiós a «Pendiente»)')
// 2026-11-25 03:38 UTC = 24 nov 10:38 p. m. en Bogotá; «ahora» = 24 nov 11:00 p. m. en Bogotá.
const AHORA = new Date('2026-11-25T04:00:00Z')
check(cuandoEnZona('2026-11-25T03:38:00Z', 'America/Bogota', AHORA) === 'Hoy 10:38 p. m.', `horas en la zona de la tienda (Bogotá): ${cuandoEnZona('2026-11-25T03:38:00Z', 'America/Bogota', AHORA)}`)
check(cuandoEnZona('2026-11-25T03:38:00Z', 'Europe/Madrid', AHORA) === 'Hoy 4:38 a. m.', `horas en otra zona (Madrid): ${cuandoEnZona('2026-11-25T03:38:00Z', 'Europe/Madrid', AHORA)}`)
check(cuandoEnZona('2026-11-25T03:38:00Z', 'Zona/Invalida', AHORA) === 'Hoy 10:38 p. m.', 'zona inválida → America/Bogota de respaldo')

// ─── 3. La vista: privacidad y textos ────────────────────────────────────────────────────────
const base = {
  envio: {
    shipment_number: 'DEL-WO-452-MX4K2P7F-A3QZ', tracking_number: 'TRKMWWER9G3XFCM', status: 'out_for_delivery', fulfillment_mode: 'own',
    delivery_city: 'Bogotá D.C.', delivery_department: 'Bogotá D.C.', package_count: 2, weight_kg: 1.8, cod_status: 'pending',
    external_tracking_url: null, expected_delivery_date: null, picked_at: null, dispatched_at: null, delivered_at: null,
    assigned_at: '2026-11-25T03:31:00Z', created_at: '2026-11-25T02:48:00Z', source_type: 'web_order',
    // Lo que NUNCA debe salir aunque llegue en la fila:
    delivery_address: 'Calle 99 # 1-23 apto 501', delivery_contact_name: 'Ana Compradora', delivery_contact_phone: '3001234567', cod_amount: 87500, delivery_code: '4821',
  },
  eventos: [
    { canonical_status: 'created', event_type: 'created', event_time: '2026-11-25T02:55:00Z', location_text: null, reason_code: null, description: 'Envío creado desde pedido web WO-452' },
    { canonical_status: 'ready_for_pickup', event_type: 'ready_for_pickup', event_time: '2026-11-25T03:20:00Z', location_text: null, reason_code: null },
    { canonical_status: 'assigned', event_type: 'assigned', event_time: '2026-11-25T03:31:00Z', location_text: null, reason_code: null },
    { canonical_status: 'out_for_delivery', event_type: 'out_for_delivery', event_time: '2026-11-25T03:38:00Z', location_text: 'Calle 99 # 1-23 apto 501', reason_code: null },
  ],
  pedido: { created_at: '2026-11-25T02:48:00Z', confirmed_at: '2026-11-25T02:51:00Z', estimated_delivery_at: '2026-11-25T03:50:00Z', payment_status: 'partial' },
  domiciliarioNombreCompleto: 'carlos andrés pérez',
  transportadora: null,
  zona: 'America/Bogota',
  encontradoPor: 'guia',
}
const v = vistaGuiaPublica(base, new Date('2026-11-25T03:45:00Z'))
const json = JSON.stringify(v)
check(!/TRK/i.test(json), 'privacidad: el TRK nunca aparece (aunque se buscó con él)')
check(v.subtitulo === 'Buscaste la guía DEL-WO-452-MX4K2P7F-A3QZ.', 'buscado con el TRK → se muestra el número de la tienda')
check(!/Calle 99|apto|Ana|Compradora|3001234567|87500|87\.500|4821/.test(json), 'privacidad: sin dirección, nombre ni teléfono del comprador, monto ni código de entrega')
check(!/andrés|pérez/i.test(json) && v.quien.tipo === 'domiciliario' && v.quien.nombre === 'Carlos', 'privacidad: del domiciliario solo «Carlos»')
check(!/Envío creado desde pedido web/.test(json), 'historial: nunca la `description` interna')
check(v.chip === 'En camino' && v.titulo === 'Tu envío va en camino', 'en camino con domiciliario: chip y título')
check(v.pasos.map((p) => p.estado).join(',') === 'hecho,hecho,actual,pendiente' && v.pasos.map((p) => p.titulo).join(',') === 'Recibido,Preparando,En camino,Entregado', 'pasos: Recibido, Preparando, En camino (actual), Entregado')
check(v.pasos[0].detalle === 'Hoy 9:48 p. m.' && v.pasos[2].detalle === 'Con Carlos · Hoy 10:38 p. m.', `pasos con horas reales en Bogotá (${v.pasos[0].detalle} / ${v.pasos[2].detalle})`)
check(v.historial[0].texto === 'Carlos va en camino a tu dirección' && v.historial[0].detalle === 'Hoy 10:38 p. m.', 'historial: el más reciente arriba, con texto de comprador y sin la ubicación (domicilio propio)')
check(v.historial.map((h) => h.texto).join('|') === 'Carlos va en camino a tu dirección|Tu pedido ya tiene domiciliario: Carlos|Tu pedido está listo y empacado|Estamos preparando tu pedido|Pedido confirmado|Recibimos tu pedido', 'historial: los seis textos del diseño (G2)')
check(v.historial[2].detalle.endsWith('· 2 paquetes'), 'historial: «listo y empacado» con los paquetes')
check(v.pago === 'al_recibir', 'contraentrega pendiente → «Pagas al recibir» (sin monto)')
check(v.destino === 'Bogotá D.C.' && v.resumen === 'Destino: Bogotá D.C. · 2 paquetes · Domicilio de la tienda', 'destino: solo ciudad (sin repetir el departamento igual)')
check(v.estimado?.titulo === 'Llega hoy hacia las 10:50 p. m.' && v.aviso?.titulo === 'Llega hoy hacia las 10:50 p. m.', `hora estimada del pedido en la zona (${v.estimado?.titulo})`)
check(v.numeroPedido === 'WO-452-MX4K2P7F-A3QZ', '«Ver mi pedido completo» con el número del pedido ya escrito')
check(v.paquetes === '2 paquetes', 'domicilio propio: paquetes sin peso')

// Entregado (M3): fecha y hora, sin quién lo recibió; ya no se paga al recibir.
const entregado = vistaGuiaPublica({
  ...base,
  envio: { ...base.envio, status: 'delivered', delivered_at: '2026-11-25T04:02:00Z' },
  eventos: [...base.eventos, { canonical_status: 'delivered', event_type: 'delivered', event_time: '2026-11-25T04:02:00Z', location_text: 'Portería', reason_code: null }],
  encontradoPor: 'numero',
}, new Date('2026-11-25T04:30:00Z'))
check(entregado.chip === 'Entregado' && entregado.titulo === 'Tu pedido fue entregado' && entregado.pasos.every((p) => p.estado === 'hecho'), 'entregado: chip, título y los cuatro pasos')
check(entregado.aviso?.tono === 'exito' && entregado.aviso.titulo === 'Entregado hoy a las 11:02 p. m.' && /Quién lo recibió se ve con el enlace de tu correo/.test(entregado.aviso.detalle), `entregado: fecha y hora, y quién recibió solo con el correo (${entregado.aviso?.titulo})`)
check(entregado.historial[0].texto === 'Entregado' && entregado.historial[0].detalle === 'Hoy 11:02 p. m. · Bogotá D.C.' && !/Portería/.test(JSON.stringify(entregado)), 'entregado: en el historial con la ciudad, nunca la ubicación del domiciliario')
check(entregado.pago === null && entregado.estimado === null, 'entregado: sin «Pagas al recibir» ni estimado')

// Novedad: texto de comprador con el motivo.
const novedad = vistaGuiaPublica({
  ...base,
  envio: { ...base.envio, status: 'failed_attempt' },
  eventos: [...base.eventos, { canonical_status: 'failed_attempt', event_type: 'failed_attempt', event_time: '2026-11-25T03:58:00Z', location_text: null, reason_code: 'not_home' }],
}, new Date('2026-11-25T04:30:00Z'))
check(novedad.chip === 'No se pudo entregar' && novedad.aviso?.tono === 'alerta' && /No había nadie para recibirlo/.test(novedad.aviso.detalle), 'novedad: «No se pudo entregar» con el motivo para el comprador')
check(novedad.historial[0].texto === 'No pudimos entregar tu pedido: no había nadie para recibirlo', 'novedad: en el historial')
// Devuelto y cancelado: sin pasos.
const devuelto = vistaGuiaPublica({ ...base, envio: { ...base.envio, status: 'returned' } }, AHORA)
check(devuelto.chip === 'Devuelto' && devuelto.pasos.length === 0 && devuelto.pago === null, 'devuelto: texto de comprador, sin pasos ni pago')

// Transportadora (G3): su guía y su enlace; la del TRK nunca.
const carrier = vistaGuiaPublica({
  ...base,
  envio: { ...base.envio, fulfillment_mode: 'national_carrier', tracking_number: '7012 4455 9981', status: 'in_transit', cod_status: null, expected_delivery_date: '2026-11-26', external_tracking_url: null },
  eventos: [
    { canonical_status: 'in_transit', event_type: 'in_transit', event_time: '2026-11-25T15:14:00Z', location_text: 'Centro de distribución Medellín', reason_code: null },
  ],
  pedido: { ...base.pedido, payment_status: 'paid', estimated_delivery_at: null },
  domiciliarioNombreCompleto: 'Carlos Pérez',
  transportadora: { nombre: 'Rápido Andino', plantillaUrl: 'https://rastreo.example/{tracking_number}' },
}, new Date('2026-11-25T16:00:00Z'))
check(carrier.quien.tipo === 'transportadora' && carrier.quien.nombre === 'Rápido Andino' && carrier.quien.guia === '7012 4455 9981' && carrier.quien.enlace === 'https://rastreo.example/7012%204455%209981', 'transportadora: nombre, guía y enlace de la plantilla')
check(carrier.titulo === 'Tu envío va con Rápido Andino' && carrier.subtitulo === 'Buscaste la guía de la transportadora 7012 4455 9981.', 'transportadora: título y subtítulo (G3)')
check(carrier.estimado?.titulo === 'Llega mañana, jueves 26 de noviembre', `transportadora: día estimado como fecha calendario (${carrier.estimado?.titulo})`)
check(carrier.pago === 'pagado' && carrier.historial[0].detalle.endsWith('· Centro de distribución Medellín'), 'transportadora: «Pagado» y la ubicación de la transportadora')
check(!/Carlos/.test(JSON.stringify(carrier)), 'transportadora: el domiciliario no aparece')
const carrierTrk = vistaGuiaPublica({ ...base, envio: { ...base.envio, fulfillment_mode: 'national_carrier' }, transportadora: { nombre: 'Rápido Andino', plantillaUrl: 'https://r.example/{guia}' } }, AHORA)
check(carrierTrk.quien.tipo === 'transportadora' && carrierTrk.quien.guia === null && carrierTrk.quien.enlace === null && !/TRK/.test(JSON.stringify(carrierTrk)), 'transportadora con TRK viejo: ni guía ni enlace con el TRK')

// ─── 4. Servidor: búsqueda, organización del host, límite ────────────────────────────────────
const queries = leer('lib/supabase/queries.ts')
const inicio = queries.indexOf('export async function getShipmentByTracking')
const resto = queries.slice(inicio + 1)
const finRel = resto.search(/\r?\nexport /)
const fn = sinComentarios(finRel < 0 ? queries.slice(inicio) : queries.slice(inicio, inicio + 1 + finRel))
check(/buscar\('shipment_number', \[guia\.compacta\]\)/.test(fn) && /buscar\('tracking_number', valores\)/.test(fn), 'búsqueda: primero el número impreso (DEL-…), después la guía de la transportadora o el TRK')
check((fn.match(/\.eq\('organization_id', organizationId\)/g) || []).length === 6, 'búsqueda: las 6 consultas filtran por la organización del host')
check(/\.limit\(1\)\s*\.maybeSingle\(\)/.test(fn) && !/\.single\(\)/.test(fn), 'búsqueda: .limit(1).maybeSingle(), nunca .single()')
check(!/delivery_address|delivery_contact|cod_amount|description|recipient_|phone|license|\bplate\b|delivery_code|proof_of_delivery/.test(fn), 'búsqueda: no lee dirección, contacto, monto, descripción, teléfonos, placa, código ni prueba de entrega')
check(/select\('full_name'\)/.test(fn), 'domiciliario: solo full_name (se recorta al nombre de pila)')

const pagina = sinComentarios(leer('app/consultar-pedido/page.tsx'))
check(/checkRateLimit\(`consultar-guia:\$\{organization\.id\}:\$\{ip\}`, GUIAS_POR_VENTANA, VENTANA_GUIAS_MS\)/.test(pagina) && /const GUIAS_POR_VENTANA = 20\r?\n/.test(pagina) && /const VENTANA_GUIAS_MS = 10 \* 60 \* 1000\r?\n/.test(pagina), 'límite: 20 búsquedas por 10 minutos por IP y tienda')
check(pagina.indexOf('checkRateLimit(') > 0 && pagina.indexOf('checkRateLimit(') < pagina.indexOf('getShipmentByTracking('), 'límite: se revisa ANTES de consultar la base')
check(/ipDeCabeceras\(await headers\(\)\)/.test(pagina), 'límite: IP desde headers() del server component')
check(/getShipmentByTracking\(guia, organization\.id, zonaOrg\)/.test(pagina), 'búsqueda: con la organización del host (nunca de la URL)')
check(/vista: vistaGuiaPublica\(datos\)/.test(pagina) && /consultaGuia=\{consulta\}/.test(pagina) && !/datos=\{/.test(pagina), 'a la pantalla solo llega la vista recortada, nunca las filas')
check(/consulta = numero \? \{ tipo: 'parece_pedido', numero \} : \{ tipo: 'no_encontrada' \}/.test(pagina), 'no encontrada: «parece un número de pedido» o el aviso único')
check((pagina.match(/tipo: 'no_encontrada'/g) || []).length === 2 && !/otra tienda|otra organizaci/i.test(pagina), 'no encontrada: el mismo aviso si no existe o es de otra tienda')

// ─── 5. Pantalla ─────────────────────────────────────────────────────────────────────────────
const pantallaCruda = leer('app/consultar-pedido/SeguirPedido.tsx')
const pantalla = sinComentarios(pantallaCruda)
const resultadoCrudo = leer('components/site/rastreo/ResultadoGuia.tsx')
const resultado = sinComentarios(resultadoCrudo)
check(/\['guia', 'Número de guía'\]/.test(pantalla) && !/Guía de transportadora/.test(pantalla), 'pestaña «Número de guía» (antes «Guía de transportadora»)')
check(/placeholder=\{`Ej\.: \$\{EJEMPLO_GUIA\}`\}/.test(pantalla) && /const EJEMPLO_GUIA = 'DEL-WO-/.test(pantalla) && /Así se ve en tu guía/.test(pantalla), 'campo: ejemplo DEL-WO-… y «Así se ve en tu guía»')
check((pantalla.match(/No encontramos esa guía/g) || []).length === 1 && /data-error-guia="no_encontrada"/.test(pantalla), 'no encontrada (M4): un solo aviso')
check(/Eso parece un número de pedido/.test(pantalla) && /pareceNumeroPedido\(guia\)/.test(pantalla) && /onClick=\{\(\) => pasarANumeroPedido\(avisoGuia\.numero\)\}/.test(pantalla), 'WO-… en la guía: sugerencia y cambio de pestaña con el número ya escrito')
check(/if \(valor\) setNumero\(valor\)/.test(pantalla), 'cambio de pestaña: el número queda escrito')
check(/Tu dirección no se muestra aquí/.test(pantalla), 'primer ingreso (G1/M1): «Tu dirección no se muestra aquí»')
check(/<ResultadoGuia\s+vista=\{consultaGuia\.vista\}/.test(pantalla), 'resultado de la guía con la vista recortada')
check(/¿Es tu pedido\?/.test(resultado) && /Abre el enlace del correo de confirmación/.test(resultado) && /Ver mi pedido completo/.test(resultado) && /onVerPedido\(vista\.numeroPedido\)/.test(resultado), 'resultado: tarjeta «¿Es tu pedido?» con el botón a «Número de pedido»')
check(/Contactar por WhatsApp/.test(resultado) && /\{whatsapp && \(/.test(resultado), 'resultado: bloque de WhatsApp si la tienda lo tiene')
check(/te lo lleva/.test(resultado) && /Pagas al recibir/.test(resultado) && /La dirección completa no se muestra aquí/.test(resultado), 'resultado: «Carlos te lo lleva», «Pagas al recibir» y destino sin dirección')
check(/Buscar otra guía/.test(resultado) && /Seguimiento del envío/.test(resultado) && /Historial/.test(resultado), 'resultado: «Seguimiento del envío», historial y «Buscar otra guía»')
for (const [nombre, f] of [['SeguirPedido', pantallaCruda], ['ResultadoGuia', resultadoCrudo], ['consultaGuia', leer('lib/orders/consultaGuia.ts')]]) {
  check(!/@\/lib\/supabase|next\/headers|server-only|@\/lib\/rateLimit/.test(f), `${nombre}: sin módulos de servidor`)
}
check(/^'use client'/.test(resultadoCrudo) && /^'use client'/.test(pantallaCruda), 'componentes cliente marcados')
check(!/tracking_number|delivery_address|cod_amount|recipient_|description|dangerouslySetInnerHTML/.test(resultado + pantalla), 'pantalla: no conoce el TRK, la dirección, montos, quién recibió ni descripciones; sin HTML crudo')
check(!/from 'next\/link'/.test(resultadoCrudo + pantallaCruda) && !/go\s*admin/i.test(resultadoCrudo + pantallaCruda), 'sin next/link directo ni marca GO Admin ante compradores')
check(/rel="noopener noreferrer"/.test(resultado) && /href=\{quien\.enlace\}/.test(resultado), 'enlace de la transportadora en pestaña nueva con noopener')

console.log(`\n${casos - fallos}/${casos} casos OK`)
if (fallos) process.exit(1)
