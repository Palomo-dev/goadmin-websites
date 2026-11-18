/**
 * Verifica el remitente de los correos de pedido del sitio y que los dos envíos lleven la clave.
 *
 * 1. `resolverRemitente` (lib/email/marcaCorreoPedido.ts): con dominio verificado y predeterminado
 *    sale desde pedidos@<dominio> con el Reply-To de la tienda; sin él, el respaldo de la plataforma.
 * 2. «Pago confirmado» (lib/orders/correoPedidoPagado.ts) lee `claveResend` y la pasa a
 *    `sendOrderConfirmationEmail(..., { apiKey })`; sin clave registra el error y no envía. Antes
 *    no la pasaba y, sin RESEND_API_KEY en el despliegue, fallaba siempre.
 * 3. «Recibimos tu pedido» (app/api/orders/route.ts) pasa la marca y la clave.
 *
 * Sin base ni red: importa la función pura y lee el fuente de los otros dos.
 * Uso: npm run verify:correo-pedido
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const { resolverRemitente } = await import(pathToFileURL(join(ROOT, 'lib/email/marcaCorreoPedido.ts')).href)

let n = 0
function caso(nombre, fn) {
  try {
    fn()
    n++
  } catch (e) {
    console.error(`✗ ${nombre}\n  ${e.message}`)
    process.exit(1)
  }
}

const dominio = { domain: 'tienda-prueba.co', fromEmail: 'pedidos@tienda-prueba.co', isDefault: true }

// ─── 1. resolverRemitente ─────────────────────────────────────────────────────────────────────
caso('dominio verificado y predeterminado: From pedidos@<dominio> y Reply-To de la tienda', () => {
  const r = resolverRemitente({ nombre: 'Casa de Prueba', correoTienda: 'Ventas@Tienda-Prueba.co', dominios: [dominio] })
  assert.deepEqual(r, { from: '"Casa de Prueba" <pedidos@tienda-prueba.co>', replyTo: 'ventas@tienda-prueba.co', propio: true })
})
caso('sin dominio: respaldo de la plataforma con el Reply-To de la tienda', () => {
  const r = resolverRemitente({ nombre: 'Casa de Prueba', correoTienda: 'ventas@tienda-prueba.co', dominios: [], respaldo: 'pedidos@goadmin.io' })
  assert.deepEqual(r, { from: '"Casa de Prueba" <pedidos@goadmin.io>', replyTo: 'ventas@tienda-prueba.co', propio: false })
})
caso('dominio no predeterminado: no se usa', () => {
  const r = resolverRemitente({ nombre: 'Casa de Prueba', correoTienda: null, dominios: [{ ...dominio, isDefault: false }], respaldo: 'pedidos@goadmin.io' })
  assert.equal(r.propio, false)
  assert.equal(r.from, '"Casa de Prueba" <pedidos@goadmin.io>')
})
caso('from_email de otro dominio: no se usa', () => {
  const r = resolverRemitente({ nombre: 'Casa', correoTienda: null, dominios: [{ ...dominio, fromEmail: 'pedidos@otro.co' }], respaldo: 'pedidos@goadmin.io' })
  assert.equal(r.propio, false)
})
caso('el Reply-To igual al From no se repite', () => {
  const r = resolverRemitente({ nombre: 'Casa', correoTienda: 'pedidos@tienda-prueba.co', dominios: [dominio] })
  assert.equal(r.replyTo, null)
})
caso('el nombre no rompe la cabecera (comillas, <> y saltos de línea)', () => {
  const r = resolverRemitente({ nombre: 'Casa "X" <y>\r\nBcc: z@z.co', correoTienda: null, dominios: [dominio] })
  assert.equal(r.from, '"Casa X yBcc: z@z.co" <pedidos@tienda-prueba.co>')
})
caso('sin nombre: «Tienda»', () => {
  assert.equal(resolverRemitente({ nombre: '  ', correoTienda: null, dominios: [dominio] }).from, '"Tienda" <pedidos@tienda-prueba.co>')
})

// ─── 2. «Pago confirmado» pasa la clave ───────────────────────────────────────────────────────
const pagado = await readFile(join(ROOT, 'lib/orders/correoPedidoPagado.ts'), 'utf8')
caso('pago confirmado: importa claveResend', () => {
  assert.match(pagado, /import \{ claveResend \} from '@\/lib\/orders\/claveResend'/)
})
caso('pago confirmado: lee la clave antes de enviar y sin ella no envía', () => {
  const lee = pagado.indexOf('await claveResend(sb)')
  const envia = pagado.indexOf('sendOrderConfirmationEmail(')
  assert.ok(lee > 0 && envia > lee, 'claveResend debe leerse antes de sendOrderConfirmationEmail')
  const bloque = pagado.slice(lee, envia)
  assert.match(bloque, /if \(!apiKey\) \{[\s\S]*?registrarCorreoPedido\([\s\S]*?estado: 'error'[\s\S]*?return\s*\n\s*\}/, 'sin clave: registra el error y sale')
})
caso('pago confirmado: pasa { apiKey } a sendOrderConfirmationEmail', () => {
  const envia = pagado.slice(pagado.indexOf('sendOrderConfirmationEmail('))
  const cierre = envia.indexOf('\n    }, { apiKey })')
  assert.ok(cierre > 0, 'falta el segundo argumento { apiKey }')
})

// ─── 3. «Recibimos tu pedido» pasa marca y clave ──────────────────────────────────────────────
const ruta = await readFile(join(ROOT, 'app/api/orders/route.ts'), 'utf8')
caso('recibimos tu pedido: carga la marca y la clave de la organización del contexto', () => {
  assert.match(ruta, /cargarMarcaPedido\(sbCorreo, contextOrgId, resolvedBranchId \?\? null\)\.catch\(\(\) => null\)/)
  assert.match(ruta, /claveResend\(sbCorreo\)\.catch\(\(\) => null\)/)
})
caso('recibimos tu pedido: pasa marca y { apiKey }', () => {
  const envio = ruta.slice(ruta.indexOf('sendOrderConfirmationEmail({'))
  const fin = envio.indexOf("}, { apiKey }).catch(err => console.error('[Orders] Email error:', err))")
  assert.ok(fin > 0, 'falta { apiKey } en el envío')
  assert.match(envio.slice(0, fin), /\.\.\.\(marca \? \{ marca \} : \{\}\)/)
})

console.log(`✓ verify-correo-pedido: ${n} comprobaciones (remitente, clave del pago confirmado y de «Recibimos tu pedido»)`)
