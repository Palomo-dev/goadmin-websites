/**
 * verify-contacto.mjs — «Contacto v2 editable» (Figma 3104:84056). Sin base de datos.
 *
 *   npm run verify:contacto
 *
 * Comprueba:
 * 1. El contrato (copia del ERP): canales, redes, campos con «Mostrar»/«Obligatorio», casilla de
 *    datos, mensaje de enviado y secciones por defecto. Lo guardado antes se lee igual.
 * 2. El sitio pinta los tipos y variantes nuevos (SECTION_MAP) y declara sus claves.
 * 3. /api/contact valida los obligatorios con la sección leída en el servidor (nunca del body) y el
 *    formulario de respaldo manda la copia al correo de contacto del sitio.
 * 4. /contacto sin página por secciones ya no pinta la versión escrita a mano (salvo el interruptor).
 * 5. WhatsApp: sin número en Configuración, el teléfono de contacto hace de WhatsApp si es un
 *    celular (canal, sede y «WhatsApp al terminar» con la misma función) y Teléfono no se repite.
 * 6. Espaciado: Contacto v2 con relleno `md` por defecto («Horario y sedes» solo en Contacto); una
 *    sección sin datos no deja su relleno.
 * 7. Tipografía: la hoja de Google Fonts del tema incluye el par de las perillas y los títulos de
 *    las secciones nuevas usan la fuente de títulos del tema.
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  CAMPOS_CONTACTO_POR_DEFECTO,
  ID_FORMULARIO_RESPALDO,
  VARIANTE_FORMULARIO_TARJETA,
  camposDeSeccion,
  camposFaltantes,
  camposVisibles,
  canalesConDato,
  datosContactoDe,
  esCelularColombia,
  enlaceCanalPropio,
  leerCamposContacto,
  leerCanales,
  redesDeSeccion,
  redesDelSitio,
  seccionesContactoPorDefecto,
  textoConDatos,
  valorDeCanal,
  whatsappDeTienda,
} from '../lib/website/v2/contrato/paginaContacto.ts'

// espacioSeccion importa './espacioHeader' sin extensión: el gancho de resolver-ts lo resuelve
// (se registra antes de importarlo; los import estáticos se resuelven antes de ejecutar nada).
await import('./resolver-ts.mjs')
const { rellenoPorDefecto, espacioSeccion } = await import('../lib/website/espacioSeccion.ts')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (r) => readFile(join(ROOT, r), 'utf8')

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

// ── 1. Contrato ──
const canales = leerCanales(undefined)
check(canales.map((c) => c.type).join() === 'whatsapp,phone,email,address', 'sin channels salen los cuatro canales por defecto')
const datos = datosContactoDe({ phone: '601 1', email: 'org@x.co', address: 'Cra. 1', city: 'Cali' }, { whatsapp_number: '3001234567', contact_email: 'web@x.co' })
check(datos.correo === 'web@x.co' && datos.telefono === '601 1' && datos.direccion === 'Cra. 1, Cali', 'lo del sitio gana; la ciudad se suma a la dirección')
check(valorDeCanal(canales[0], {}) === null, 'un canal sin dato no sale')
check(valorDeCanal(leerCanales([{ type: 'phone', source: 'own', value: 'ext. 2' }])[0], { telefono: '1' }) === 'ext. 2', 'el texto propio gana')
check(enlaceCanalPropio('javascript:alert(1)') === null && enlaceCanalPropio('//x.com') === null, 'un canal propio no acepta enlaces inseguros')

const redes = redesDelSitio({ instagram: '@tienda', twitter: 'https://twitter.com/t', tiktok: 'con espacios no' })
check(redes.map((r) => r.id).join() === 'instagram,x', 'redes: usuario y URL; twitter es X; lo inválido se descarta')
check(redes[0].href === 'https://instagram.com/tienda', 'el usuario arma la URL de la red')
check(redesDeSeccion({ instagram: '@a' }, ['youtube']).length === 0, 'networks solo muestra redes que el sitio tiene')

const viejos = leerCamposContacto([{ name: 'phone', label: 'Teléfono', type: 'tel' }])
check(viejos?.every((c) => c.visible) && viejos?.[0].name === 'name', 'form_fields de antes: todos visibles y nombre primero')
check(camposDeSeccion({}, 'split') === null, 'las variantes viejas sin form_fields siguen con sus campos de siempre')
const tarjeta = camposDeSeccion({}, VARIANTE_FORMULARIO_TARJETA)
check(tarjeta?.length === CAMPOS_CONTACTO_POR_DEFECTO.length, 'la tarjeta con horario nace con los campos de la página Contacto')
check(camposFaltantes(tarjeta, { name: 'a', email: 'b@c.co' }).join() === 'message,consent', 'mensaje y casilla de datos obligatorios por defecto')
check(camposFaltantes(tarjeta, { name: 'a', email: 'b@c.co', message: 'Hola', consent: true }).length === 0, 'completo pasa')
const ocultos = leerCamposContacto([{ name: 'email', visible: false }, { name: 'consent', type: 'consent', visible: false }])
check(camposVisibles(ocultos).map((c) => c.name).join() === 'name,email', 'el correo no se oculta; la casilla sí')
check(textoConDatos('Gracias, {nombre}: {correo}', { nombre: 'Laura Pérez', correo: 'l@x.co' }) === 'Gracias, Laura: l@x.co', '{nombre} y {correo}')
check(seccionesContactoPorDefecto().every((s) => s.section_type !== 'faq'), 'la tienda no publica preguntas que el dueño no escribió')
check(seccionesContactoPorDefecto().map((s) => s.section_type).join() === 'hero,contact_channels,contact_form,hours_location,social_networks', 'orden del diseño')

// ── 2. Registro de secciones ──
const renderer = await leer('components/sections/SectionRenderer.tsx')
check(/page_header: EncabezadoPaginaSeccion/.test(renderer), 'hero · page_header registrado')
check(/card_hours: ContactFormTarjeta/.test(renderer), 'contact_form · card_hours registrado')
check(/contact_channels: \{\s*cards: CanalesContacto/.test(renderer), 'contact_channels · cards registrado')
check(/social_networks: \{\s*row: RedesSociales/.test(renderer), 'social_networks · row registrado')
for (const [archivo, claves] of [
  ['components/sections/contact/CanalesContacto.tsx', 'CLAVES_CANALES'],
  ['components/sections/contact/RedesSociales.tsx', 'CLAVES_REDES'],
  ['components/sections/hero/EncabezadoPaginaSeccion.tsx', 'CLAVES_ENCABEZADO_PAGINA'],
]) {
  check((await leer(archivo)).includes(`.CONTENT_KEYS = ${claves}`), `${archivo} declara sus claves (${claves})`)
}
const sedes = await leer('components/sections/restaurant/HoursLocation.tsx')
check(sedes.includes("'featured_branch_id'") && sedes.includes("'show_whatsapp'"), 'hours_location declara sede destacada y WhatsApp')
check(/bool\(content\.show_whatsapp, false\)/.test(sedes), 'WhatsApp por sede apagado por defecto (secciones guardadas no cambian)')

// Ningún componente de cliente importa módulos de servidor.
for (const archivo of [
  'components/sections/contact/ContactFormTarjeta.tsx',
  'components/sections/contact/CanalesContacto.tsx',
  'components/sections/contact/RedesSociales.tsx',
  'components/sections/contact/CamposPropios.tsx',
  'components/sections/hero/EncabezadoPaginaSeccion.tsx',
]) {
  const fuente = await leer(archivo)
  check(!/from ['"](twilio|fs|node:fs|@\/lib\/supabase\/server|next\/headers|@\/lib\/website\/correoDestinoContacto)['"]/.test(fuente), `${archivo} no importa módulos de servidor`)
}

// ── 3. /api/contact ──
const ruta = await leer('app/api/contact/route.ts')
check(/seccionContacto\(supabase, Number\(organization\.id\), \(body as any\)\.sectionId, branchId\)/.test(ruta), 'la sección se lee en el servidor con la organización del host')
check(/camposFaltantes\(campos,/.test(ruta) && /status: 400/.test(ruta), 'obligatorios validados en el servidor')
check(ruta.indexOf('camposFaltantes(') < ruta.indexOf("rpc('web_capture_lead'"), 'se valida antes de guardar')
check(/destinoDeSeccion\(seccion,/.test(ruta), 'la copia sale de la sección ya leída')
const destino = await leer('lib/website/correoDestinoContacto.ts')
check(destino.includes('ID_FORMULARIO_RESPALDO') && /seccion\.respaldo/.test(destino), 'el formulario de respaldo manda la copia al correo de contacto del sitio')
check(!/^[0-9a-f-]{1,64}$/i.test(ID_FORMULARIO_RESPALDO), 'el id de respaldo no puede confundirse con un uuid')

// ── 4. /contacto sin página ──
const pagina = await leer('app/[[...slug]]/page.tsx')
const caso = pagina.slice(pagina.indexOf("case 'contacto':"), pagina.indexOf("case 'nosotros':"))
check(caso.includes('seccionesContactoRespaldo(') && caso.includes('!contactoEscritoAMano()'), '/contacto sin página se arma con las secciones por defecto')
check(caso.indexOf('seccionesContactoRespaldo(') < caso.indexOf('<ContactSection'), 'la versión escrita a mano queda solo de respaldo')

// ── 5. WhatsApp con el respaldo del celular ──
check(esCelularColombia('+57 3103957409') && esCelularColombia('310 395 7409') && esCelularColombia('573103957409') && esCelularColombia('0057 310 395 7409'), 'celular de Colombia con o sin 57')
check(!esCelularColombia('(601) 745 0000') && !esCelularColombia('+1 310 395 7409') && !esCelularColombia('31039574') && !esCelularColombia(''), 'fijo, otro país o incompleto no es celular')
check(whatsappDeTienda({ telefono: '+57 3103957409' })?.numero === '+57 3103957409' && whatsappDeTienda({ telefono: '+57 3103957409' })?.delTelefono === true, 'sin WhatsApp, el celular de contacto hace de WhatsApp')
check(whatsappDeTienda({ whatsapp: '300 111 2233', telefono: '+57 3103957409' })?.numero === '300 111 2233', 'el whatsapp_number configurado gana')
check(whatsappDeTienda({ telefono: '(601) 745 0000' }) === null, 'un fijo no hace de WhatsApp')
const porDefecto = leerCanales(undefined)
const conCelular = canalesConDato(porDefecto, { telefono: '+57 3103957409', correo: 'a@b.co' })
check(conCelular.map((x) => x.canal.type).join() === 'whatsapp,email', 'con el celular de respaldo: WhatsApp sale y Teléfono no se repite')
check(conCelular[0].valor === '+57 3103957409' && conCelular[0].canal.button_text === 'Escribir por WhatsApp', 'el canal WhatsApp lleva el número y «Escribir por WhatsApp»')
const sinWhatsapp = canalesConDato(porDefecto.map((c) => (c.type === 'whatsapp' ? { ...c, visible: false } : c)), { telefono: '+57 3103957409' })
check(sinWhatsapp.map((x) => x.canal.type).join() === 'phone', 'con WhatsApp apagado en el editor vuelve la tarjeta Teléfono')
check(canalesConDato(porDefecto, { telefono: '(601) 745 0000' }).map((x) => x.canal.type).join() === 'phone', 'teléfono fijo: tarjeta Teléfono con «Llamar», sin WhatsApp')
check(canalesConDato(porDefecto, { whatsapp: '300 111 2233', telefono: '+57 3103957409' }).map((x) => x.canal.type).join() === 'whatsapp,phone', 'con whatsapp_number propio, Teléfono sigue saliendo')
const tarjetaForm = await leer('components/sections/contact/ContactFormTarjeta.tsx')
check(tarjetaForm.includes('whatsappDeTienda(datos)') && !/datos\.whatsapp \?/.test(tarjetaForm), '«WhatsApp al terminar» usa la misma regla')
check(sedes.includes('whatsappDeTienda(datosContactoDe(organization, organization.website_settings))') && !sedes.includes('website_settings?.whatsapp_number'), 'el WhatsApp por sede usa la misma regla')
const canalesFuente = await leer('components/sections/contact/CanalesContacto.tsx')
check(canalesFuente.includes('canalesDeSeccion(content, organization)'), 'Canales de contacto usa canalesConDato (vía datosSeccionesContacto)')

// ── 6. Espaciado ──
for (const [tipo, variante] of [['hero', 'page_header'], ['contact_channels', 'cards'], ['contact_form', 'card_hours'], ['social_networks', 'row']]) {
  check(rellenoPorDefecto(tipo, variante) === 'md', `${tipo} · ${variante} con relleno md por defecto`)
}
check(rellenoPorDefecto('hours_location', 'hours_map', 'contacto') === 'md', 'Horario y sedes en Contacto: relleno md')
check(rellenoPorDefecto('hours_location', 'hours_map', 'home') === 'lg' && rellenoPorDefecto('hours_location', 'cards') === 'lg', 'Horario y sedes fuera de Contacto: el de siempre (lg)')
check(rellenoPorDefecto('hero', 'minimal') === 'lg' && rellenoPorDefecto('contact_form', 'split') === 'lg', 'las variantes viejas no cambian')
check(rellenoPorDefecto('table_service') === 'none', 'la Carta QR sigue sin relleno')
const esp = espacioSeccion({}, { tipo: 'contact_channels', variante: 'cards' })
check(esp.rellenoArriba.computador === 48 && esp.rellenoAbajo.celular === 32 && !esp.rellenoArriba.propio, 'el editor muestra el relleno de Contacto v2 (48/32 px)')
check(espacioSeccion({ padding_top: 'xl' }, { tipo: 'contact_channels', variante: 'cards' }).rellenoArriba.computador === 96, 'un relleno fijado en el editor se respeta')
check(espacioSeccion({}, { tipo: 'contact_channels', variante: 'cards', espaciado: 'amplio' }).rellenoAbajo.computador === 96, 'el espaciado del estilo se respeta')
check(espacioSeccion({ section_background: { padding_top: 10 } }, { tipo: 'social_networks', variante: 'row' }).rellenoArriba.computador === 10, 'el relleno en px de Fondo y espaciado se respeta')
const envoltura = await leer('components/sections/SectionWrapperBase.tsx')
check(/rellenoPorDefecto\(sectionType, sectionVariant, pagina\)/.test(envoltura), 'SectionWrapperBase usa la misma regla que el editor')
check(/pagina=\{typeof data\?\.pageSlug === 'string'/.test(renderer), 'SectionRenderer pasa la página al wrapper')
check(/seccionContactoVacia\(section\.section_type, content, organization\)/.test(renderer), 'canales o redes sin datos no dejan relleno')

// ── 7. Tipografía ──
const tema = await leer('lib/website/v2/temaPublico.ts')
check(/export function familiasTema\(/.test(tema) && /familiasDePar\(par\.value\)/.test(tema), 'familiasTema incluye el par de las perillas')
const capa = await leer('components/site/OrganizationLayoutCliente.tsx')
check(/urlGoogleFonts\(familiasTema\(temaEfectivo\)/.test(capa), 'la hoja de fuentes del tema se carga en todas las páginas (con el par)')
for (const archivo of [
  'components/sections/contact/CanalesContacto.tsx',
  'components/sections/contact/RedesSociales.tsx',
  'components/sections/contact/ContactFormTarjeta.tsx',
  'components/sections/hero/EncabezadoPaginaSeccion.tsx',
]) {
  const fuente = await leer(archivo)
  const titulos = fuente.match(/<h[1-3][^>]*>/g) ?? []
  check(titulos.length > 0 && titulos.every((t) => t.includes('FUENTE_TITULOS')), `${archivo}: todos los títulos con la fuente de títulos del tema`)
  check(fuente.includes('fontFamily: FUENTE_CUERPO') && !/fontFamily: '[A-Z]/.test(fuente), `${archivo}: cuerpo con la fuente del tema, sin fuentes fijas`)
}

if (problemas.length > 0) {
  console.error(`verify-contacto: ${problemas.length} de ${casos} comprobaciones fallaron`)
  for (const p of problemas) console.error(`  ✗ ${p}`)
  process.exit(1)
}
console.log(`verify-contacto: ${casos} comprobaciones OK`)
