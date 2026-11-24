/**
 * enlaces-precarga.mjs — los enlaces de la tienda no precargan su destino (Playwright).
 *
 *   PRUEBAS_INTERNAS=1 npx next start -p 3459   (con un build hecho; en `next dev` Next no precarga)
 *   BASE=http://localhost:3459 node scripts/pruebas/enlaces-precarga.mjs
 *
 * Sobre el arnés app/pruebas-internas/enlaces, en celular y en computador, con los cuatro
 * enlaces a la vista:
 * - `Enlace` a /productos: ninguna petición de precarga.
 * - `Enlace` a /checkout: precarga (es la ruta con `loading.tsx`).
 * - `Enlace` con `prefetch` a mano (/contacto): trae la página por adelantado.
 * - `next/link` directo (/ofertas), el testigo: precarga. Si este no precarga, la prueba no está
 *   midiendo nada y falla.
 * - Pasar el mouse por el enlace sin precarga tampoco la dispara.
 * - El clic en el enlace sin precarga navega sin recargar la página.
 *
 * `X_SUBDOMAIN` (opcional): cabecera `x-subdomain` para probar en local contra una organización.
 */
import { createRequire } from 'node:module'
const requerir = createRequire(import.meta.url)
const { chromium, devices } = requerir('playwright')

const BASE = process.env.BASE ?? 'http://localhost:3459'
const cabeceras = process.env.X_SUBDOMAIN ? { 'x-subdomain': process.env.X_SUBDOMAIN } : undefined
const problemas = []
let casos = 0
const check = (cond, msg) => { casos++; if (!cond) problemas.push(msg) }

const navegador = await chromium.launch()
for (const [nombre, opciones] of [
  ['celular', { ...devices['iPhone 13'] }],
  ['computador', { viewport: { width: 1280, height: 800 } }],
]) {
  const ctx = await navegador.newContext({ ...opciones, extraHTTPHeaders: cabeceras })
  const page = await ctx.newPage()
  /** Rutas pedidas como precarga (`Next-Router-Prefetch: 1`) y como navegación. */
  const precargas = new Set()
  const navegaciones = new Set()
  page.on('request', (r) => {
    const u = new URL(r.url())
    if (!u.searchParams.has('_rsc')) return
    if (r.headers()['next-router-prefetch']) precargas.add(u.pathname)
    else navegaciones.add(u.pathname)
  })
  const respuesta = await page.goto(`${BASE}/pruebas-internas/enlaces`, { waitUntil: 'load' })
  check(respuesta?.status() === 200, `${nombre}: el arnés responde 200 (${respuesta?.status()}; ¿falta PRUEBAS_INTERNAS=1?)`)
  await page.waitForTimeout(3000)

  check(precargas.has('/ofertas'), `${nombre}: el testigo (next/link directo) precarga /ofertas — sin esto la prueba no mide nada`)
  check(!precargas.has('/productos'), `${nombre}: Enlace a /productos NO precarga`)
  check(precargas.has('/checkout'), `${nombre}: Enlace a /checkout conserva su precarga`)
  // `prefetch` a mano pide la página ENTERA por adelantado: Next la manda sin la cabecera de
  // precarga, así que se ve como una navegación a /contacto sin que nadie haya hecho clic.
  check(navegaciones.has('/contacto'), `${nombre}: Enlace con prefetch a mano trae /contacto por adelantado`)
  check(!navegaciones.has('/productos'), `${nombre}: /productos no se pide antes del clic`)

  if (nombre === 'computador') {
    await page.hover('[data-enlace="normal"]')
    await page.waitForTimeout(1500)
    check(!precargas.has('/productos'), `${nombre}: pasar el mouse por el Enlace tampoco precarga`)
  }

  // El clic sigue siendo una navegación del cliente (sin recargar la página).
  await page.evaluate(() => { window.__sigue = true })
  await page.click('[data-enlace="normal"]')
  await page.waitForURL('**/productos', { timeout: 20000 }).catch(() => {})
  check(new URL(page.url()).pathname === '/productos', `${nombre}: el clic lleva a /productos (${page.url()})`)
  check(navegaciones.has('/productos'), `${nombre}: el clic pide la página al navegar`)
  check((await page.evaluate(() => window.__sigue)) === true, `${nombre}: el clic navega sin recargar la página`)
  await ctx.close()
}
await navegador.close()

if (problemas.length > 0) {
  console.error(`✗ enlaces-precarga: ${problemas.length} de ${casos} comprobaciones fallaron`)
  for (const p of problemas) console.error('  - ' + p)
  process.exit(1)
}
console.log(`✓ enlaces-precarga: ${casos} comprobaciones (celular y computador).`)
