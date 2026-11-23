/**
 * verify-zonas-envio.mjs — domicilio por zona y rastreo público (logística Fase 1).
 *
 *   npm run verify:zonas-envio
 *
 * 1. Sin zonas configuradas (o sin cotización) la tienda cobra como antes.
 * 2. En zona: el precio de la zona (gratis si aplica); fuera de zona con tarifa general: esa
 *    tarifa; fuera de cobertura o bajo el mínimo: bloqueado.
 * 3. Tarjeta «Domicilio», «Llega hoy · 45–60 min» / «Sale hoy · llega en 3–15 días» y la barra «Te faltan $X para envío gratis».
 * 4. Municipio DANE por nombre (sin tildes, «Bogotá, D.C.»), y la RPC con canal web.
 * 5. Rastreo: primer nombre, código solo con token y contraentrega, dirección incompleta.
 * 6. /api/orders cobra SIEMPRE el envío del servidor (ya no acepta `shipping: 0`).
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
register(pathToFileURL(join(ROOT, 'scripts/verify-pasarelas-bold-mp.cargador.mjs')).href, import.meta.url, {
  data: { root: ROOT, stub: pathToFileURL(join(ROOT, 'scripts/verify-pasarelas-bold-mp.efectos.mjs')).href },
})
const dz = await import('../lib/shipping/domicilioZonas.ts')
const cz = await import('../lib/shipping/cotizarZonas.ts')
const rp = await import('../lib/orders/rastreoPublico.ts')

const problemas = []
let casos = 0
const igual = (a, b, msg) => {
  casos++
  if (JSON.stringify(a) !== JSON.stringify(b)) problemas.push(`${msg}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`)
}
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

const base = {
  en_zona: true, zona: { id: 'z2', nombre: 'Zona 2 · Chapinero', es_tarifa_general: false, coincidencia: 'neighborhood' },
  precio: 7000, tarifa: 7000, moneda: 'COP', envio_gratis: false, envio_gratis_desde: 120000, falta_para_envio_gratis: 65000,
  pedido_minimo: 30000, cumple_minimo: true, falta_para_minimo: 0,
  tiempo: { min_minutos: 45, max_minutos: 60, texto: null },
  despacho: { fecha: '2026-11-23', hoy: true, corte: '19:00:00', dias_reparto: [1, 2, 3, 4, 5, 6, 7], zona_horaria: 'America/Bogota' },
  modo: 'own', regla_id: null, motivo: null, alternativa: null, canal: 'web', subtotal: 55000,
}

// 1. Sin zonas
check(!dz.usaZonas(null), 'sin cotización: sin zonas')
check(!dz.usaZonas({ ...base, motivo: 'sin_zonas_configuradas', en_zona: false, precio: null }), 'sin_zonas_configuradas: como antes')
check(dz.usaZonas(base), 'con zona: usa zonas')

// 2. Lo que se cobra
igual(dz.envioDeZona(base), { ok: true, costo: 7000, zonaId: 'z2', zonaNombre: 'Zona 2 · Chapinero', fueraDeZona: false }, 'en zona: precio de la zona')
igual(dz.envioDeZona({ ...base, precio: 0, envio_gratis: true }).costo, 0, 'envío gratis: 0')
const general = { ...base, en_zona: false, zona: { id: 'g', nombre: 'General', es_tarifa_general: true, coincidencia: null }, precio: 15000, motivo: 'fuera_de_zona', alternativa: 'tarifa_general' }
igual(dz.envioDeZona(general), { ok: true, costo: 15000, zonaId: 'g', zonaNombre: null, fueraDeZona: true }, 'fuera de zona: tarifa general')
igual(dz.envioDeZona({ ...base, en_zona: false, zona: null, precio: null, motivo: 'fuera_de_zona', alternativa: 'transportadora' }), { ok: false, codigo: 'FUERA_DE_COBERTURA' }, 'solo transportadora: sin domicilio')
igual(dz.envioDeZona({ ...base, cumple_minimo: false, falta_para_minimo: 5000 }), { ok: false, codigo: 'PEDIDO_MINIMO_DOMICILIO' }, 'bajo el mínimo: bloqueado')

// 3. Tarjeta y barra
igual(dz.tiempoZona(base), '45–60 min', 'tiempo en minutos')
igual(dz.tiempoZona({ ...base, tiempo: { min_minutos: null, max_minutos: null, texto: 'Mismo día' } }), 'Mismo día', 'texto de la zona')
igual(dz.llegadaZona(base, (f) => f), 'Llega hoy · 45–60 min', 'llega hoy')
igual(dz.llegadaZona({ ...base, despacho: { ...base.despacho, hoy: false, fecha: '2026-11-24' } }, (f) => `lun ${f}`), 'Sale el lun 2026-11-24 · 45–60 min', 'sale otro día (fecha plana)')
// Envío nacional en días y domicilio en horas: nunca «Llega hoy» si no cabe en el día (2026-11-23).
const dias = (min, max) => ({ ...base, tiempo: { min_minutos: min, max_minutos: max, texto: null } })
igual(dz.tiempoZona(dias(3 * 1440, 15 * 1440)), '3–15 días', 'nacional en días')
igual(dz.tiempoZona(dias(null, 15 * 1440)), 'hasta 15 días', 'solo máximo en días')
igual(dz.tiempoZona(dias(1440, 1440)), '1 día', 'un día')
igual(dz.tiempoZona(dias(120, 240)), '2–4 horas', 'horas')
igual(dz.llegadaZona(dias(3 * 1440, 15 * 1440), (f) => f), 'Sale hoy · llega en 3–15 días', 'días: sale hoy, no llega hoy')
igual(dz.llegadaZona(dias(null, 15 * 1440), (f) => f), 'Sale hoy · llega en máximo 15 días', 'días: solo máximo')
igual(dz.llegadaZona({ ...dias(3 * 1440, 7 * 1440), despacho: { ...base.despacho, hoy: false, fecha: '2026-11-24' } }, (f) => `lun ${f}`), 'Sale el lun 2026-11-24 · llega en 3–7 días', 'días: sale otro día')
igual(dz.llegadaZona(dias(120, 240), (f) => f), 'Llega hoy · 2–4 horas', 'horas: llega hoy')
igual(dz.llegadaZona({ ...base, tiempo: { min_minutos: null, max_minutos: null, texto: '2 a 5 días hábiles' } }, (f) => f), 'Sale hoy · 2 a 5 días hábiles', 'texto propio: no promete llega hoy')
igual(dz.barraEnvioGratis(base), { falta: 65000, desde: 120000, porcentaje: 46 }, 'te faltan $65.000 (46 %)')
igual(dz.barraEnvioGratis({ ...base, envio_gratis: true }), null, 'ya es gratis: sin barra')
igual(dz.detalleZona(base), 'Lo lleva la tienda · Zona 2 · Chapinero', 'detalle en zona')
igual(dz.detalleZona(general), 'Fuera de zona · tarifa general', 'detalle fuera de zona')

// 4. DANE y RPC
igual(cz.normalizarMunicipio('Bogotá, D.C.'), 'bogota', 'Bogotá, D.C.')
const MUNIS = [{ code: '11001', name: 'Bogotá, D.C.' }, { code: '25754', name: 'Soacha' }, { code: '05001', name: 'Medellín' }]
igual(cz.codigoDeMunicipio('bogota', MUNIS), '11001', 'bogota sin tilde')
igual(cz.codigoDeMunicipio('Medellin', MUNIS), '05001', 'Medellín')
igual(cz.codigoDeMunicipio('La Unión', [{ code: '05400', name: 'La Unión' }, { code: '52399', name: 'La Unión' }]), null, 'homónimos: no se adivina')
let llamada = null
const sb = {
  from: () => ({ select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: MUNIS, error: null }) }) }) }),
  rpc: (fn, args) => { llamada = { fn, args }; return Promise.resolve({ data: base, error: null }) },
}
const cot = await cz.cotizarDomicilioWeb(sb, { organizationId: 9, branchId: 3, subtotal: 55000, direccion: { ciudad: 'Bogotá', pais: 'COL', departamento: '11', barrio: 'Chapinero' } })
igual(llamada?.fn, 'logistica_cotizar_envio', 'llama la RPC de la base')
igual(llamada?.args?.p_canal, 'web', 'canal web')
igual(llamada?.args?.p_direccion, { municipio_dane: '11001', barrio: 'Chapinero' }, 'dirección con DANE y barrio')
igual(cot?.precio, 7000, 'devuelve la cotización leída')
const caida = await cz.cotizarDomicilioWeb({ ...sb, rpc: () => Promise.resolve({ data: null, error: { message: 'x' } }) }, { organizationId: 9, branchId: 3, subtotal: 1, direccion: {} })
igual(caida, null, 'RPC caída: null (se cobra como antes)')

// 5. Rastreo
const RAW = {
  estado: 'out_for_delivery', modo: 'own', domiciliario: 'Andrés Felipe', fecha_estimada: '2026-11-24', motivo_novedad: null,
  contraentrega: { monto: 128900, moneda: 'COP', estado: 'pending', codigo_entrega: '4821' },
  eventos: [{ estado: 'created', fecha: '2026-11-23T16:52:00Z', motivo: null }, { estado: 'picked', fecha: '2026-11-23T17:41:00Z', motivo: null }],
}
const conToken = rp.leerRastreoLogistica(RAW, true)
igual(conToken.domiciliario, 'Andrés', 'solo el primer nombre')
igual(conToken.codigoEntrega, '4821', 'código con token y contraentrega')
igual(rp.leerRastreoLogistica(RAW, false).codigoEntrega, null, 'sin token: sin código')
igual(rp.leerRastreoLogistica({ ...RAW, contraentrega: null }, true).codigoEntrega, null, 'sin contraentrega: sin código')
igual(conToken.contraentrega, { monto: 128900, moneda: 'COP', pendiente: true }, 'pagas al recibir')
igual(conToken.eventos.map((e) => e.etiqueta), ['Pedido confirmado', 'Recogido'], 'historial canónico')
igual(rp.leerRastreoLogistica({ ...RAW, estado: 'failed_attempt', motivo_novedad: 'not_home' }, true).novedad, 'No había nadie para recibirlo', 'novedad en palabras del cliente')
igual(rp.direccionIncompleta({ address: 'Cra 45 #12-34 apto 502', neighborhood: 'Chapinero', city: 'Bogotá' }), 'Cra 45 #12-… · Chapinero, Bogotá', 'dirección incompleta')
igual(rp.direccionIncompleta({ address: 'Km 5 vía La Calera', city: 'La Calera' }), 'Km 5… · La Calera', 'sin placa: dos palabras')
igual(rp.enlaceWhatsApp('+57 300 123 4567', 'WO-1'), 'https://wa.me/573001234567?text=' + encodeURIComponent('Hola, tengo una pregunta sobre mi pedido WO-1.'), 'WhatsApp con el pedido')
igual(rp.enlaceWhatsApp('12', 'WO-1'), null, 'número inválido: sin enlace')

// 6. Uso
const fuente = (r) => readFileSync(join(ROOT, r), 'utf8')
const ruta = fuente('app/api/orders/route.ts')
check(!/ENVIO_SERVIDOR_OBLIGATORIO|ORDERS_ENFORCE_SERVER_SHIPPING ===/.test(ruta), '/api/orders: ya no depende del interruptor de observación')
check(/resolvedShipping = envioDecidido/.test(ruta), '/api/orders: cobra el envío del servidor')
check(/cotizarDomicilioWeb\(supabase/.test(ruta) && /envioDeZona\(cotizacion\)/.test(ruta), '/api/orders: domicilio propio por zona')
check(/status: 422/.test(ruta) && /TARIFA_ENVIO_INVALIDA/.test(ruta), '/api/orders: fuera de cobertura 422 y tarifa inválida 409')
const quote = fuente('app/api/shipping/quote/route.ts')
check(/getOrgIdDelHost\(\)/.test(quote) && !/body\??\.organizationId/.test(quote), 'quote: la organización sale del host')
const wiz = fuente('components/site/CheckoutWizard.tsx')
check(/\/api\/shipping\/quote/.test(wiz) && /Te faltan \{fmtPrice\(barraGratis\.falta\)\} para envío gratis/.test(wiz), 'checkout: zona y «Te faltan $X para envío gratis»')
check(/neighborhood: customerData\.barrio\.trim\(\)/.test(wiz), 'checkout: manda el barrio')
const tracking = fuente('app/api/orders/[id]/tracking/route.ts')
check(/logistica_rastreo_publico/.test(tracking) && /leerRastreoLogistica\(rastreo, verificado\)/.test(tracking), 'tracking: rastreo de logística con el token')
// 7. Seguridad (2026-11-23): lo que sale al navegador.
const pub = dz.cotizacionPublica(base)
igual(Object.keys(pub).sort(), ['alternativa', 'cumple_minimo', 'despacho', 'en_zona', 'envio_gratis', 'envio_gratis_desde', 'falta_para_envio_gratis', 'falta_para_minimo', 'moneda', 'motivo', 'pedido_minimo', 'precio', 'tiempo', 'zona'], 'quote: solo los campos públicos')
igual(pub.zona, { nombre: 'Zona 2 · Chapinero', es_tarifa_general: false }, 'quote: la zona sin id ni coincidencia')
igual(pub.despacho, { fecha: '2026-11-23', hoy: true }, 'quote: despacho sin corte, días ni zona horaria')
igual(dz.envioDeZona(pub), { ok: true, costo: 7000, zonaId: null, zonaNombre: 'Zona 2 · Chapinero', fueraDeZona: false }, 'checkout: la versión pública alcanza para la tarjeta')
check(/cotizacionPublica\(cotizacion\)/.test(quote) && !/cotizacion: usaZonas\(cotizacion\) \? cotizacion :/.test(quote), 'quote: responde solo la cotización pública')
check(/checkRateLimit\(/.test(quote), 'quote: con límite por IP')
// Columnas leídas o devueltas (no comentarios): dentro de un select con comillas o como `.columna`.
const leeColumna = (src, cols) =>
  new RegExp(String.raw`'[^'\n]*\b(${cols})\b[^'\n]*'|\.(${cols})\b|profiles\s*\([^)]*\b(${cols})\b`).test(src)
check(!leeColumna(tracking, 'photo_urls|signature_url|avatar_url'), 'tracking: no lee fotos, firmas ni foto de perfil')
check(/verificado \? leerRastreoLogistica/.test(tracking) && /shipment && verificado \?/.test(tracking), 'tracking: sin token válido, sin datos del envío')
const entrega = fuente('app/api/orders/[id]/delivery/route.ts')
check(!leeColumna(entrega, 'photo_urls|signature_url|avatar_url|phone'), 'delivery: sin fotos, firmas, foto de perfil ni teléfono del domiciliario')
const infoEntrega = fuente('components/site/DeliveryInfo.tsx')
check(!/<img|tel:/.test(infoEntrega), 'DeliveryInfo: no pinta fotos ni enlaza el teléfono del domiciliario')
check(!leeColumna(fuente('lib/supabase/queries.ts'), 'photo_urls|signature_url'), '/tracking por guía: no lee fotos ni firmas de la prueba de entrega')

const copias = fuente('scripts/verify-copias-erp.mjs')
check(/lib\/shipping\/cotizacionLogistica\.ts', 'src\/lib\/logistica\/cotizacion\.ts'/.test(copias), 'cotizacionLogistica.ts es copia registrada del ERP')

if (problemas.length) {
  console.error(`✗ ${problemas.length} de ${casos} comprobaciones fallaron:`)
  for (const p of problemas) console.error('  -', p)
  process.exit(1)
}
console.log(`✓ zonas de envío y rastreo: ${casos} comprobaciones`)
