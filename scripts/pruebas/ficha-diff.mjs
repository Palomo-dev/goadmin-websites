/**
 * ficha-diff.mjs — la ficha de producto pinta lo mismo al píxel antes y después de la fase 1.
 *
 *   npx next build && npm run verify:ficha-diff          (arranca `next start` con PRUEBAS_INTERNAS=1)
 *   FICHA_DEV=1 npm run verify:ficha-diff                 (con `next dev`, sin build)
 *   FICHA_URL=http://localhost:3000 npm run verify:ficha-diff   (servidor ya levantado con PRUEBAS_INTERNAS=1)
 *
 * Qué compara, para cada fixture de scripts/pruebas/fixtures/ficha-<org>.json, cada caso de
 * ficha-ajustes.json y cada ancho (390 y 1280 px), en app/pruebas-internas/ficha:
 *   1. `referencia` (ProductDetailRenderer de antes, copia congelada) vs `fallback` (el actual sin
 *      secciones)       → captura de página completa píxel a píxel + DOM normalizado. Debe dar 0.
 *   2. `fallback` vs `plantilla` (el actual con los bloques por defecto como secciones de un
 *      documento V2)     → ídem. Debe dar 0.
 *   3. Informativo, sin fallar: `pagina` (lo que hoy pinta app/productos/[id]/page.tsx sin
 *      plantilla) vs `referencia`, solo con el caso `base`.
 *
 * Sin red: Supabase y las imágenes están bloqueados en este contenedor. Las imágenes de Storage y
 * de /_next/image se responden con un SVG local determinista, /rest/v1 con [] y todo lo que no sea
 * el servidor local se aborta. El reloj y Math.random quedan fijos (reseñas generadas, contador).
 * pixelmatch no está instalado: el PNG se decodifica aquí (zlib de Node) y se compara byte a byte.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FIXTURES = join(ROOT, 'scripts', 'pruebas', 'fixtures')
const SALIDA = process.env.FICHA_SALIDA || join(tmpdir(), 'ficha-diff')
const PUERTO = Number(process.env.FICHA_PUERTO || 3105)
const ANCHOS = [390, 1280]
const FECHA_FIJA = new Date('2026-11-04T15:00:00.000Z')
const MONEDA_COP = { baseCurrency: 'COP', targetCurrency: 'COP', conversionRate: 1, locale: 'es-CO', countryCode: 'CO', detectedCountry: null, symbol: '$', decimals: 0, availableCurrencies: [] }

// ─── PNG mínimo (8 bits, RGB/RGBA, sin entrelazado: lo que produce Chromium) ───────────────
function decodificarPng(buffer) {
  const firma = '89504e470d0a1a0a'
  if (buffer.subarray(0, 8).toString('hex') !== firma) throw new Error('no es PNG')
  let pos = 8
  let ancho = 0, alto = 0, tipoColor = 0, profundidad = 0, entrelazado = 0
  const idat = []
  while (pos < buffer.length) {
    const largo = buffer.readUInt32BE(pos)
    const tipo = buffer.toString('ascii', pos + 4, pos + 8)
    const datos = buffer.subarray(pos + 8, pos + 8 + largo)
    if (tipo === 'IHDR') {
      ancho = datos.readUInt32BE(0)
      alto = datos.readUInt32BE(4)
      profundidad = datos[8]
      tipoColor = datos[9]
      entrelazado = datos[12]
    } else if (tipo === 'IDAT') idat.push(datos)
    else if (tipo === 'IEND') break
    pos += 12 + largo
  }
  if (profundidad !== 8 || entrelazado !== 0 || (tipoColor !== 2 && tipoColor !== 6)) {
    throw new Error(`PNG no soportado (profundidad ${profundidad}, color ${tipoColor}, entrelazado ${entrelazado})`)
  }
  const bpp = tipoColor === 6 ? 4 : 3
  const bruto = inflateSync(Buffer.concat(idat))
  const fila = ancho * bpp
  const px = Buffer.alloc(ancho * alto * 4)
  let anterior = Buffer.alloc(fila)
  for (let y = 0; y < alto; y++) {
    const filtro = bruto[y * (fila + 1)]
    const actual = Buffer.from(bruto.subarray(y * (fila + 1) + 1, (y + 1) * (fila + 1)))
    for (let x = 0; x < fila; x++) {
      const a = x >= bpp ? actual[x - bpp] : 0
      const b = anterior[x]
      const c = x >= bpp ? anterior[x - bpp] : 0
      let v = actual[x]
      if (filtro === 1) v += a
      else if (filtro === 2) v += b
      else if (filtro === 3) v += (a + b) >> 1
      else if (filtro === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      actual[x] = v & 0xff
    }
    for (let x = 0; x < ancho; x++) {
      const o = (y * ancho + x) * 4
      px[o] = actual[x * bpp]
      px[o + 1] = actual[x * bpp + 1]
      px[o + 2] = actual[x * bpp + 2]
      px[o + 3] = bpp === 4 ? actual[x * bpp + 3] : 255
    }
    anterior = actual
  }
  return { ancho, alto, px }
}

/** Píxeles distintos entre dos PNG. Tamaños distintos: cuenta el área que no coincide. */
function compararPng(a, b) {
  if (Buffer.compare(a, b) === 0) return { distintos: 0, total: 0, tamanos: null }
  const A = decodificarPng(a)
  const B = decodificarPng(b)
  const tamanos = A.ancho !== B.ancho || A.alto !== B.alto ? `${A.ancho}x${A.alto} vs ${B.ancho}x${B.alto}` : null
  const ancho = Math.min(A.ancho, B.ancho)
  const alto = Math.min(A.alto, B.alto)
  let distintos = Math.max(A.ancho * A.alto, B.ancho * B.alto) - ancho * alto
  const caja = { x0: Infinity, y0: Infinity, x1: -1, y1: -1 }
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const oa = (y * A.ancho + x) * 4
      const ob = (y * B.ancho + x) * 4
      if (A.px.readUInt32BE(oa) !== B.px.readUInt32BE(ob)) {
        distintos++
        caja.x0 = Math.min(caja.x0, x); caja.y0 = Math.min(caja.y0, y)
        caja.x1 = Math.max(caja.x1, x); caja.y1 = Math.max(caja.y1, y)
      }
    }
  }
  const zona = caja.x1 >= 0 ? `x ${caja.x0}-${caja.x1}, y ${caja.y0}-${caja.y1}` : null
  return { distintos, total: Math.max(A.ancho * A.alto, B.ancho * B.alto), tamanos, zona }
}

/** DOM de la ficha sin lo que depende de la carga (ids de useId de React). */
function normalizarDom(html) {
  return html
    .replace(/:r[0-9a-z]+:/g, ':rID:')
    .replace(/«r[0-9a-z]+»/g, '«rID»')
}

function primeraDiferencia(a, b) {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return { pos: i, a: a.slice(Math.max(0, i - 120), i + 160), b: b.slice(Math.max(0, i - 120), i + 160) }
}

// ─── Imagen de reemplazo: color estable por URL ────────────────────────────────────────────
function svgPara(url) {
  let h = 0
  for (const ch of url) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const tono = h % 360
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><rect width="800" height="800" fill="hsl(${tono},55%,70%)"/><circle cx="400" cy="400" r="${150 + (h % 150)}" fill="hsl(${(tono + 140) % 360},50%,45%)"/></svg>`
}

// ─── Servidor ──────────────────────────────────────────────────────────────────────────────
async function esperarServidor(base, ms) {
  const fin = Date.now() + ms
  let ultimo = ''
  while (Date.now() < fin) {
    try {
      const r = await fetch(`${base}/pruebas-internas/ficha?org=339&modo=fallback&ajustes=base`)
      if (r.status === 200) return
      ultimo = `HTTP ${r.status}`
    } catch (e) {
      ultimo = e.message
    }
    await new Promise((res) => setTimeout(res, 1000))
  }
  throw new Error(`el servidor no respondió 200 en ${ms / 1000} s (${ultimo}). ¿Corre con PRUEBAS_INTERNAS=1?`)
}

function levantarServidor() {
  const dev = process.env.FICHA_DEV === '1'
  if (!dev && !existsSync(join(ROOT, '.next', 'BUILD_ID'))) {
    throw new Error('no hay build: corre `npx next build` antes (o usa FICHA_DEV=1)')
  }
  const env = {
    ...process.env,
    PRUEBAS_INTERNAS: '1',
    PORT: String(PUERTO),
    // Sin red hacia Supabase: el middleware necesita una URL; la sesión vacía no la llama.
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://taqjemqjtumhwptchcxk.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'clave-de-prueba',
  }
  const hijo = spawn(join(ROOT, 'node_modules', '.bin', 'next'), [dev ? 'dev' : 'start', '-p', String(PUERTO)], {
    cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  hijo.stdout.on('data', (d) => { log += d })
  hijo.stderr.on('data', (d) => { log += d })
  return { hijo, log: () => log }
}

// ─── Captura ───────────────────────────────────────────────────────────────────────────────
async function capturar(navegador, base, { org, modo, ajuste, ancho }) {
  const contexto = await navegador.newContext({
    viewport: { width: ancho, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
  })
  const pagina = await contexto.newPage()
  await pagina.clock.setFixedTime(FECHA_FIJA)
  await pagina.addInitScript(() => {
    let semilla = 20261104
    Math.random = () => {
      semilla = (semilla * 1103515245 + 12345) & 0x7fffffff
      return semilla / 0x80000000
    }
  })
  const bloqueadas = new Set()
  await pagina.route('**/*', async (ruta) => {
    const url = ruta.request().url()
    if (url.includes('/storage/v1/object/') || url.includes('/_next/image')) {
      return ruta.fulfill({ status: 200, contentType: 'image/svg+xml', body: svgPara(decodeURIComponent(url)) })
    }
    if (url.includes('/rest/v1/')) return ruta.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    if (url.startsWith(base)) {
      const { pathname } = new URL(url)
      // Moneda de la tienda: la respuesta de /api/currency para una organización en COP.
      if (pathname === '/api/currency') return ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MONEDA_COP) })
      // Otras rutas de API del propio sitio (reseñas, stock…): sin Supabase no responden; vacío estable.
      if (pathname.startsWith('/api/')) return ruta.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      // Vercel Analytics (layout raíz): en local es un 404 en HTML que rompe como script.
      if (pathname.startsWith('/_vercel/')) return ruta.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
      return ruta.continue()
    }
    bloqueadas.add(new URL(url).host)
    return ruta.abort()
  })
  const errores = []
  pagina.on('pageerror', (e) => errores.push(e.message))
  const url = `${base}/pruebas-internas/ficha?org=${org}&modo=${modo}&ajustes=${ajuste}`
  const r = await pagina.goto(url, { waitUntil: 'networkidle' })
  if (!r || r.status() !== 200) throw new Error(`${url} → HTTP ${r?.status()}`)
  await pagina.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(Array.from(document.images).map((img) => (img.complete ? null : new Promise((res) => { img.onload = img.onerror = res }))))
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)))
  })
  // Estable: dos capturas seguidas iguales (los efectos del cliente —reseñas generadas, contador,
  // paginación del carrusel— terminan de asentarse después de networkidle).
  const tomar = () => pagina.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' })
  let png = await tomar()
  for (let intento = 0; intento < 8; intento++) {
    await pagina.waitForTimeout(300)
    const otra = await tomar()
    if (Buffer.compare(png, otra) === 0) break
    png = otra
  }
  const dom = normalizarDom(await pagina.$eval('#ficha-raiz', (el) => el.innerHTML))
  await contexto.close()
  return { png, dom, errores, bloqueadas: [...bloqueadas] }
}

// ─── Principal ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const orgs = readdirSync(FIXTURES)
    .map((f) => /^ficha-(\d+)\.json$/.exec(f)?.[1])
    .filter(Boolean)
    .sort((a, b) => Number(a) - Number(b))
  const ajustes = Object.keys(JSON.parse(readFileSync(join(FIXTURES, 'ficha-ajustes.json'), 'utf8'))).filter((k) => !k.startsWith('_'))
  if (orgs.length < 3) throw new Error(`se esperaban al menos 3 fixtures de ficha, hay ${orgs.length}`)
  // FICHA_SOLO=120:galeria_scroll (org:caso) para repetir un caso al depurar.
  const [soloOrg, soloAjuste] = (process.env.FICHA_SOLO || '').split(':')
  mkdirSync(SALIDA, { recursive: true })

  let servidor = null
  const base = process.env.FICHA_URL || `http://localhost:${PUERTO}`
  if (!process.env.FICHA_URL) servidor = levantarServidor()
  const navegador = await chromium.launch()
  const fallos = []
  const informativos = []
  let comparaciones = 0
  try {
    await esperarServidor(base, process.env.FICHA_DEV === '1' ? 180_000 : 60_000)
    for (const org of orgs.filter((o) => !soloOrg || o === soloOrg)) {
      for (const ajuste of ajustes.filter((a) => !soloAjuste || a === soloAjuste)) {
        for (const ancho of ANCHOS) {
          const caso = { org, ajuste, ancho }
          const ref = await capturar(navegador, base, { ...caso, modo: 'referencia' })
          const fb = await capturar(navegador, base, { ...caso, modo: 'fallback' })
          const tpl = await capturar(navegador, base, { ...caso, modo: 'plantilla' })
          for (const [nombre, a, b] of [['referencia→fallback', ref, fb], ['fallback→plantilla', fb, tpl]]) {
            comparaciones++
            const px = compararPng(a.png, b.png)
            const domIgual = a.dom === b.dom
            const etiqueta = `org ${org} · ${ajuste} · ${ancho}px · ${nombre}`
            if (px.distintos !== 0 || !domIgual) {
              const archivo = join(SALIDA, `${org}-${ajuste}-${ancho}-${nombre.replace('→', '-')}`)
              writeFileSync(`${archivo}-a.png`, a.png)
              writeFileSync(`${archivo}-b.png`, b.png)
              const d = domIgual ? null : primeraDiferencia(a.dom, b.dom)
              fallos.push(`${etiqueta}: ${px.distintos} px distintos${px.tamanos ? ` (${px.tamanos})` : ''}${px.zona ? ` en ${px.zona}` : ''}; DOM ${domIgual ? 'igual' : `distinto en ${d.pos}\n      a: …${d.a}…\n      b: …${d.b}…`}\n      capturas: ${archivo}-a.png / -b.png`)
            }
          }
          for (const c of [ref, fb, tpl]) {
            if (c.errores.length) fallos.push(`org ${org} · ${ajuste} · ${ancho}px: error en la página: ${c.errores.join(' | ')}`)
          }
          if (ajuste === 'base') {
            const actual = await capturar(navegador, base, { ...caso, modo: 'pagina' })
            const px = compararPng(actual.png, ref.png)
            informativos.push(`org ${org} · ${ancho}px · página actual vs renderer: ${px.distintos} px distintos${px.total ? ` de ${px.total}` : ''}${px.tamanos ? ` (${px.tamanos})` : ''}${px.zona ? ` en ${px.zona}` : ''}; DOM ${actual.dom === ref.dom ? 'igual' : 'distinto'}`)
          }
          process.stdout.write('.')
        }
      }
    }
  } finally {
    await navegador.close()
    if (servidor) servidor.hijo.kill('SIGTERM')
  }
  process.stdout.write('\n')

  console.log(`Informativo (no falla): lo que pinta hoy app/productos/[id]/page.tsx sin plantilla vs ProductDetailRenderer`)
  for (const l of informativos) console.log(`  · ${l}`)
  if (fallos.length) {
    console.error(`✗ verify:ficha-diff: ${fallos.length} problema(s) en ${comparaciones} comparaciones`)
    for (const f of fallos) console.error(`  - ${f}`)
    process.exit(1)
  }
  console.log(`✓ verify:ficha-diff: ${comparaciones} comparaciones${soloOrg ? ` (solo ${process.env.FICHA_SOLO})` : ` (${orgs.length} orgs × ${ajustes.length} casos × ${ANCHOS.length} anchos × 2)`}, 0 píxeles y 0 diferencias de DOM`)
}

main().catch((e) => {
  console.error(`✗ verify:ficha-diff: ${e.message}`)
  process.exit(1)
})
