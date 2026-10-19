/**
 * verify-marca-correo.mjs — remitente y marca del correo de un pedido pagado.
 *
 *   node --disable-warning=ExperimentalWarning scripts/verify-marca-correo.mjs
 *
 * Sin base de datos. Carga lib/email/marcaCorreoPedido.ts (puro, sin imports)
 * con module.stripTypeScriptTypes y comprueba:
 * - un Gmail no puede ser el From (el proveedor lo rechazaría);
 * - el correo de la tienda sí es el From cuando su dominio ya está autenticado;
 * - si hay otro dominio autenticado, el From es ese y Reply-To el correo de la tienda;
 * - el logo solo entra si es https; un logo vaciado en la sede no revive el legacy;
 * - un color claro lleva texto oscuro.
 */

import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { stripTypeScriptTypes } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = await mkdtemp(join(tmpdir(), 'verify-marca-correo-'))
let marca
try {
  const js = stripTypeScriptTypes(await readFile(join(ROOT, 'lib/email/marcaCorreoPedido.ts'), 'utf8'), { mode: 'strip' })
  const archivo = join(dir, 'marcaCorreoPedido.mjs')
  await writeFile(archivo, js)
  marca = await import(pathToFileURL(archivo).href)
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

const base = {
  nombre: 'Tienda Norte',
  correoTienda: 'caja@gmail.com',
  logoUrl: 'https://cdn.ejemplo.com/logo.png',
  color: '#112233',
  dominios: [],
  respaldo: 'pedidos@goadmin.io',
}

const sinDominio = marca.sobreCorreoPedido(base)
igual(sinDominio.from, '"Tienda Norte" <pedidos@goadmin.io>', 'sin dominio autenticado el From es la plataforma')
igual(sinDominio.replyTo, 'caja@gmail.com', 'sin dominio autenticado Reply-To es el correo de la tienda')
igual(sinDominio.propio, false, 'el sobre de la plataforma no se anuncia como propio')
igual(sinDominio.logoUrl, 'https://cdn.ejemplo.com/logo.png', 'el logo https se conserva')
igual(sinDominio.color, '#112233', 'el color de la tienda se conserva')
check(!sinDominio.from.includes('gmail.com'), 'el From no usa el Gmail de la tienda')

const propio = marca.sobreCorreoPedido({
  ...base,
  correoTienda: 'pedidos@tienda.ejemplo',
  dominios: [{ domain: 'tienda.ejemplo', fromEmail: 'hola@tienda.ejemplo', isDefault: true }],
})
igual(propio.from, '"Tienda Norte" <pedidos@tienda.ejemplo>', 'el From es el correo de la tienda si su dominio está autenticado')
igual(propio.replyTo, null, 'no hace falta Reply-To cuando el From ya es el de la tienda')
igual(propio.propio, true, 'el sobre propio se marca')

const otro = marca.sobreCorreoPedido({
  ...base,
  dominios: [{ domain: 'tienda.ejemplo', fromEmail: 'hola@tienda.ejemplo', isDefault: false }],
})
igual(otro.from, '"Tienda Norte" <hola@tienda.ejemplo>', 'con dominio autenticado y correo en Gmail, el From es el dominio de la tienda')
igual(otro.replyTo, 'caja@gmail.com', 'las respuestas van al correo de contacto')
igual(otro.propio, true, 'ese sobre también es de la tienda')

const inyeccion = marca.sobreCorreoPedido({
  ...base,
  nombre: 'Tienda\r\nBcc: otro@ejemplo.com <script>',
  correoTienda: 'caja@gmail.com\n',
})
const nombreSobre = inyeccion.from.slice(0, inyeccion.from.lastIndexOf('<'))
check(!inyeccion.from.includes('\n') && !inyeccion.from.includes('\r') && !nombreSobre.includes('<'), 'el nombre no puede inyectar cabeceras')
igual(inyeccion.replyTo, 'caja@gmail.com', 'un salto de línea no invalida el correo')

igual(marca.logoCorreo('/logo.png'), null, 'una ruta del sitio no sirve en el correo')
igual(marca.logoCorreo('http://cdn.ejemplo.com/logo.png'), null, 'http no entra')
igual(marca.logoCorreo('https://cdn.ejemplo.com/logo.png'), 'https://cdn.ejemplo.com/logo.png', 'https sí entra')
igual(marca.colorMarca('#ABC'), '#aabbcc', 'el color corto se expande')
igual(marca.colorMarca('rojo'), null, 'un color que no es hex se descarta')
igual(marca.textoSobreColor('#ffffff'), '#111827', 'fondo claro, texto oscuro')
igual(marca.textoSobreColor('#112233'), '#ffffff', 'fondo oscuro, texto blanco')

const ensamble = marca.ensamblarMarca({
  nombre: 'Tienda Norte',
  correoOrganizacion: 'caja@gmail.com',
  correoSede: 'sede@gmail.com',
  logoOrganizacion: 'https://cdn.ejemplo.com/org.png',
  logoSede: '/logo-sede.png',
  colorOrganizacion: '#111111',
  colorAjustes: '#222222',
  colorAjustesSede: null,
  logoV2Principal: { mode: 'value', value: 'https://cdn.ejemplo.com/v2.png' },
  colorV2Principal: { mode: 'value', value: '#abc' },
  logoV2Sede: { mode: 'inherit' },
  colorV2Sede: { mode: 'value', value: '#ffcc00' },
  v2Principal: true,
  v2Sede: true,
  dominios: [{ domain: 'Gmail.com', fromEmail: 'no-es-de-gmail@otro.ejemplo', isDefault: true }],
})
igual(ensamble.correo, 'sede@gmail.com', 'el correo de la sede gana al de la organización')
igual(ensamble.logoUrl, 'https://cdn.ejemplo.com/v2.png', 'la sede hereda el logo publicado')
igual(ensamble.color, '#ffcc00', 'el color de la sede gana')
igual(ensamble.dominios, [], 'un from_email de otro dominio no cuenta como autenticado')

const vaciado = marca.ensamblarMarca({
  nombre: 'Tienda Norte',
  correoOrganizacion: 'no-es-correo',
  correoSede: null,
  logoOrganizacion: 'https://cdn.ejemplo.com/org.png',
  logoSede: null,
  colorOrganizacion: null,
  colorAjustes: null,
  colorAjustesSede: null,
  logoV2Principal: { mode: 'value', value: 'https://cdn.ejemplo.com/v2.png' },
  colorV2Principal: null,
  logoV2Sede: { mode: 'clear' },
  colorV2Sede: null,
  v2Principal: true,
  v2Sede: true,
  dominios: [],
})
igual(vaciado.logoUrl, null, 'un logo vaciado no revive el de la organización')
igual(vaciado.correo, null, 'un texto que no es correo no se usa')
igual(vaciado.color, null, 'sin color publicado la marca no inventa uno')

const legacy = marca.ensamblarMarca({
  nombre: 'Tienda Norte',
  correoOrganizacion: 'Caja@Gmail.com',
  correoSede: null,
  logoOrganizacion: 'https://cdn.ejemplo.com/org.png',
  logoSede: null,
  colorOrganizacion: '#336699',
  colorAjustes: null,
  colorAjustesSede: null,
  logoV2Principal: null,
  colorV2Principal: null,
  logoV2Sede: null,
  colorV2Sede: null,
  v2Principal: false,
  v2Sede: false,
  dominios: [],
})
igual(legacy.logoUrl, 'https://cdn.ejemplo.com/org.png', 'sin V2 se usa el logo de la organización')
igual(legacy.correo, 'caja@gmail.com', 'el correo se normaliza')
igual(legacy.color, '#336699', 'sin V2 se usa el color de la organización')

if (problemas.length) {
  console.error(problemas.join('\n'))
  process.exit(1)
}
console.log(`verify:marca-correo ${casos} OK`)
