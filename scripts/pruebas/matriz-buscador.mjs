/**
 * matriz-buscador.mjs — matriz automatizada del buscador del encabezado (Playwright).
 *
 *   npm run pruebas:matriz-buscador
 *   npm run pruebas:matriz-buscador -- --sin-build            (reusa el .next existente)
 *   npm run pruebas:matriz-buscador -- --dev                  (next dev en vez de build + start)
 *   npm run pruebas:matriz-buscador -- --orgs 342 --anchos 1024 --search bar
 *
 * Arranca el sitio con PRUEBAS_INTERNAS=1 (arnés app/pruebas-internas/encabezado, sin Supabase) en
 * un puerto libre y recorre:
 * - cada tienda del fixture (scripts/pruebas/fixtures/encabezados.json) con su encabezado REAL ×
 *   todos los search_style × anchos;
 * - la tienda base (org 342) con TODOS los encabezados forzados × search_style × anchos.
 * Por defecto el celular usa el mismo estilo (`msearch` = `search`); `--movil-real` deja el
 * mobile_search_style de la tienda.
 *
 * Reglas por caso:
 *   a  sin scroll horizontal del documento (en reposo y con el buscador abierto);
 *   b  hay buscador y, si es campo visible, mide ≥ 240 px (en reposo o al enfocarlo); una lupa que
 *      abre un panel también vale. En el celular con «Buscador grande» (selector + campo + botón)
 *      se mide el control entero (≥ 240) y el campo debe ser al menos la mitad;
 *   c  al abrir y escribir 3 letras aparece el desplegable/panel con los resultados simulados,
 *      mide ≥ 320 px, queda dentro del viewport y los resultados no quedan tapados;
 *   d  Escape cierra y clic afuera cierra (clic afuera no aplica a un panel de pantalla completa);
 *   e  ningún enlace del menú del encabezado tiene el texto cortado ni queda fuera del área
 *      visible sin forma de llegar (un menú que se desliza sí es una forma de llegar);
 *   f  search_style hidden: no hay buscador en el encabezado.
 *
 * Salida: scripts/pruebas/salida/matriz-buscador.json (todos los casos con sus medidas),
 * scripts/pruebas/salida/capturas/*.png (solo fallos) y un resumen por consola. Sale con 1 si hay
 * algún fallo. La red externa se bloquea: /api/products/search responde con 5 productos de
 * nombres largos y el resto de /api/* con respuestas vacías.
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SALIDA = join(RAIZ, 'scripts', 'pruebas', 'salida')
const CAPTURAS = join(SALIDA, 'capturas')
const requerir = createRequire(join(RAIZ, 'package.json'))

// ─── Opciones ──────────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const tiene = (n) => args.includes(n)
const valor = (n) => {
  const i = args.indexOf(n)
  return i >= 0 ? args[i + 1] : undefined
}
const lista = (n, porDefecto) => (valor(n) ? valor(n).split(',').map((s) => s.trim()).filter(Boolean) : porDefecto)

const HEADERS = ['default', 'minimal', 'mega', 'centered', 'split', 'transparent']
const BUSCADORES = ['icon', 'bar', 'mini', 'icon_overlay', 'mega', 'pill_floating', 'hidden']
const ANCHOS = [390, 768, 1024, 1280, 1440]
const ALTO = 900

const fixture = JSON.parse(readFileSync(join(RAIZ, 'scripts', 'pruebas', 'fixtures', 'encabezados.json'), 'utf8'))
const ORGS = lista('--orgs', fixture.tiendas.map((t) => String(t.id))).map(Number)
const BASE = Number(valor('--base') ?? 342)
const headers = lista('--headers', HEADERS)
const buscadores = lista('--search', BUSCADORES)
const anchos = lista('--anchos', ANCHOS.map(String)).map(Number)
const CONCURRENCIA = Math.max(1, Number(valor('--concurrencia') ?? 4))
const MOVIL_REAL = tiene('--movil-real')
const MODO_DEV = tiene('--dev')
const SIN_BUILD = tiene('--sin-build')

const ANCHO_MIN_INPUT = 240
const ANCHO_MIN_PANEL = 320

const PRODUCTOS = [
  'Silla ergonómica ejecutiva con soporte lumbar ajustable, apoyabrazos 4D y base cromada',
  'Silla gamer reclinable 180° con cojín cervical y reposapiés retráctil edición especial',
  'Sillón reclinable de cuero sintético con masajeador y puerto USB para sala de estar',
  'Silla plegable de madera maciza para comedor, jardín y eventos (paquete por 4 unidades)',
  'Silla infantil de escritorio con altura regulable y ruedas con freno de seguridad',
].map((name, i) => ({
  id: 9000 + i,
  uuid: `00000000-0000-4000-8000-00000000900${i}`,
  name,
  price: 189900 + i * 10000,
  comparePrice: i % 2 ? 249900 : null,
  imageUrl: null,
  category: 'Sillas',
  tag: null,
}))

// ─── Servidor ──────────────────────────────────────────────────────────────────────────────────

function puertoLibre() {
  return new Promise((ok, mal) => {
    const s = createServer()
    s.unref()
    s.on('error', mal)
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => ok(port))
    })
  })
}

const ENTORNO = {
  ...process.env,
  PRUEBAS_INTERNAS: '1',
  // Falsas a propósito: el arnés no consulta Supabase y Playwright bloquea cualquier petición a
  // estas direcciones. 127.0.0.1:9 (discard) falla al instante si algo del servidor lo intenta.
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'clave-falsa-de-pruebas',
  SUPABASE_SERVICE_ROLE_KEY: 'clave-falsa-de-pruebas',
  NEXT_TELEMETRY_DISABLED: '1',
}

function ejecutarNext(argumentos, { esperar = true } = {}) {
  const bin = requerir.resolve('next/dist/bin/next')
  const hijo = spawn(process.execPath, [bin, ...argumentos], { cwd: RAIZ, env: ENTORNO, stdio: ['ignore', 'pipe', 'pipe'] })
  let log = ''
  hijo.stdout.on('data', (d) => { log += d })
  hijo.stderr.on('data', (d) => { log += d })
  if (!esperar) return { hijo, log: () => log }
  return new Promise((ok, mal) => {
    hijo.on('exit', (code) => (code === 0 ? ok(log) : mal(new Error(`next ${argumentos.join(' ')} salió con ${code}\n${log.slice(-4000)}`))))
  })
}

async function esperarServidor(url, hijo, log, msMax = 180000) {
  const inicio = Date.now()
  while (Date.now() - inicio < msMax) {
    if (hijo.exitCode !== null) throw new Error(`el servidor terminó (${hijo.exitCode})\n${log().slice(-4000)}`)
    try {
      const r = await fetch(url)
      if (r.status === 200) return
      if (r.status === 404 && Date.now() - inicio > 20000) {
        throw new Error('el arnés responde 404: ¿PRUEBAS_INTERNAS=1 llegó al servidor? ¿el build incluye app/pruebas-internas?')
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('el arnés')) throw e
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`el servidor no respondió en ${msMax / 1000}s\n${log().slice(-4000)}`)
}

// ─── Medidas dentro de la página ───────────────────────────────────────────────────────────────

/**
 * Corre en el navegador. Detecta el buscador (campo o disparador), mide el menú del encabezado y
 * el desborde del documento. Marca el elemento elegido con `data-mb-objetivo`.
 */
function medirReposo({ anchoMinInput }) {
  const RE_BUSCAR = /busc|search/i
  const enRelleno = (el) => !!el.closest('[data-relleno], footer')
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return false
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false
    return true
  }
  const rect = (el) => {
    const r = el.getBoundingClientRect()
    return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) }
  }
  // Por posición primero: la barra de pestañas del celular (MobileTabs) vive dentro de <header>
  // pero está fija abajo; es otro menú, no el buscador del encabezado.
  const zona = (el) => {
    const r = el.getBoundingClientRect()
    if (r.top >= innerHeight * 0.5) return 'barra-inferior'
    return el.closest('header') ? 'encabezado' : 'arriba'
  }
  document.querySelectorAll('[data-mb-objetivo]').forEach((e) => e.removeAttribute('data-mb-objetivo'))

  // a) desborde horizontal del documento
  const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)

  // b/f) buscador
  const campos = Array.from(document.querySelectorAll('input'))
    .filter((i) => !enRelleno(i) && ['text', 'search', ''].includes(i.type) && (i.type === 'search' || RE_BUSCAR.test(`${i.placeholder} ${i.getAttribute('aria-label') ?? ''} ${i.name}`)))
    .filter(visible)
  const disparadores = Array.from(document.querySelectorAll('button, a, [role="button"]'))
    .filter((b) => !enRelleno(b) && RE_BUSCAR.test(`${b.getAttribute('aria-label') ?? ''} ${b.getAttribute('title') ?? ''} ${(b.textContent ?? '').trim().slice(0, 30)}`))
    // «Buscar» de una barra (BuscadorCromo) no es un disparador de panel.
    .filter((b) => !b.closest('[data-buscador]') && !(b.tagName === 'A' && /\/search/.test(b.getAttribute('href') ?? '')))
    .filter(visible)
  const camposArriba = campos.filter((c) => zona(c) !== 'barra-inferior')
  const dispArriba = disparadores.filter((d) => zona(d) !== 'barra-inferior')
  let modo = 'ninguno'
  let objetivo = null
  if (camposArriba.length) {
    modo = 'barra'
    objetivo = camposArriba.reduce((a, b) => (b.getBoundingClientRect().width > a.getBoundingClientRect().width ? b : a))
  } else if (dispArriba.length) {
    modo = 'panel'
    objetivo = dispArriba[0]
  } else if (campos.length) {
    modo = 'barra'
    objetivo = campos[0]
  } else if (disparadores.length) {
    modo = 'panel'
    objetivo = disparadores[0]
  }
  if (objetivo) objetivo.setAttribute('data-mb-objetivo', '1')

  // e) enlaces del menú del encabezado
  const navs = Array.from(document.querySelectorAll('header nav, header [role="navigation"]')).filter(visible)
  const enlaces = Array.from(new Set(navs.flatMap((n) => Array.from(n.querySelectorAll('a, button')))))
    .filter((a) => (a.textContent ?? '').trim() && visible(a))
  const problemasNav = []
  let deslizables = 0
  let envueltos = 0
  for (const a of enlaces) {
    const texto = (a.textContent ?? '').trim().replace(/\s+/g, ' ')
    const r = a.getBoundingClientRect()
    // Texto cortado: el enlace o algo de adentro desborda con overflow oculto o con elipsis.
    for (const d of [a, ...a.querySelectorAll('*')]) {
      const cs = getComputedStyle(d)
      const oculta = cs.overflowX !== 'visible' || cs.textOverflow === 'ellipsis'
      if (oculta && d.clientWidth > 0 && d.scrollWidth > d.clientWidth + 1) {
        problemasNav.push({ texto, tipo: cs.textOverflow === 'ellipsis' ? 'elipsis' : 'recortado', scrollWidth: d.scrollWidth, clientWidth: d.clientWidth })
        break
      }
    }
    // Fuera del área visible: ancestro que recorta (overflow ≠ visible) o el viewport.
    let clipIzq = 0
    let clipDer = innerWidth
    let recortaDeslizable = false
    for (let p = a.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p)
      if (cs.overflowX === 'visible') continue
      const pr = p.getBoundingClientRect()
      if (r.left < pr.left - 1 || r.right > pr.right + 1) {
        const desliza = (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && p.scrollWidth > p.clientWidth + 1
        if (desliza) recortaDeslizable = true
      }
      clipIzq = Math.max(clipIzq, pr.left)
      clipDer = Math.min(clipDer, pr.right)
    }
    if (r.left < clipIzq - 1 || r.right > clipDer + 1) {
      if (recortaDeslizable) deslizables++
      else problemasNav.push({ texto, tipo: 'fuera-de-vista', left: Math.round(r.left), right: Math.round(r.right), clipIzq: Math.round(clipIzq), clipDer: Math.round(clipDer) })
    }
    const lh = parseFloat(getComputedStyle(a).lineHeight) || 20
    if (r.height > lh * 1.8 && !a.querySelector('svg, img')) envueltos++
  }

  return {
    innerWidth,
    scrollWidth,
    modo,
    zona: objetivo ? zona(objetivo) : null,
    objetivo: objetivo ? { tag: objetivo.tagName.toLowerCase(), etiqueta: (objetivo.getAttribute('aria-label') || objetivo.getAttribute('placeholder') || '').slice(0, 40), ...rect(objetivo) } : null,
    campos: campos.map((c) => ({ ...rect(c), zona: zona(c) })),
    disparadores: disparadores.map((d) => ({ ...rect(d), zona: zona(d), etiqueta: (d.getAttribute('aria-label') || '').slice(0, 40) })),
    anchoMinInput,
    nav: { enlaces: enlaces.length, problemas: problemasNav, deslizables, envueltos, textos: enlaces.map((a) => (a.textContent ?? '').trim()).slice(0, 20) },
  }
}

/** Corre en el navegador: dónde están los resultados simulados que se ven. */
function medirResultados({ nombres }) {
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false
    return true
  }
  const encontrados = []
  const ocultos = []
  const todos = document.querySelectorAll('body *')
  for (const el of todos) {
    if (el.children.length > 0) continue
    const t = (el.textContent ?? '').trim()
    if (nombres.includes(t)) (visible(el) ? encontrados : ocultos).push(el)
  }
  const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
  if (!encontrados.length) {
    const texto = document.body.innerText
    // Resultados en el DOM pero sin área visible: se informa el ancho de su superficie.
    let superficie = null
    for (const el of ocultos) {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const pos = getComputedStyle(p).position
        if (pos === 'absolute' || pos === 'fixed') {
          const r = p.getBoundingClientRect()
          if (r.width >= 1 && r.height >= 1) superficie = { width: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right) }
          break
        }
      }
      if (superficie) break
    }
    return {
      visibles: 0,
      enDom: new Set(ocultos.map((e) => e.textContent.trim())).size,
      superficie,
      scrollWidth,
      estado: ocultos.length
        ? `en el DOM pero sin verse${superficie ? `: superficie de ${superficie.width}px` : ''}`
        : /No se encontraron/i.test(texto) ? 'sin-resultados' : /Buscando/i.test(texto) ? 'buscando' : 'nada',
    }
  }
  const primero = encontrados[0]
  // Superficie: primer ancestro posicionado (absolute/fixed) que contiene el resultado.
  let panel = null
  for (let p = primero.parentElement; p && p !== document.body; p = p.parentElement) {
    const pos = getComputedStyle(p).position
    if (pos === 'absolute' || pos === 'fixed') { panel = p; break }
  }
  const pr = (panel ?? primero).getBoundingClientRect()
  // ¿Se ve de verdad? El punto central del primer resultado debe ser el resultado (o su enlace).
  const fr = primero.getBoundingClientRect()
  const cx = Math.min(Math.max(fr.left + Math.min(fr.width, 40) / 2, 0), innerWidth - 1)
  const cy = Math.min(Math.max(fr.top + fr.height / 2, 0), innerHeight - 1)
  const arriba = document.elementFromPoint(cx, cy)
  const fila = primero.closest('a, button, li') ?? primero.parentElement
  const tapado = !arriba || !(fila.contains(arriba) || arriba.contains(primero))
  return {
    visibles: new Set(encontrados.map((e) => e.textContent.trim())).size,
    scrollWidth,
    estado: 'resultados',
    panel: {
      left: Math.round(pr.left), right: Math.round(pr.right), top: Math.round(pr.top), bottom: Math.round(pr.bottom),
      width: Math.round(pr.width), height: Math.round(pr.height),
      posicion: panel ? getComputedStyle(panel).position : null,
      pantallaCompleta: pr.width >= innerWidth - 1 && pr.height >= innerHeight - 1,
    },
    tapado,
    tapadoPor: tapado && arriba ? `${arriba.tagName.toLowerCase()}.${String(arriba.className).slice(0, 60)}` : null,
  }
}

/** Corre en el navegador: un punto fuera del panel, del encabezado y del buscador para hacer clic. */
function puntoAfuera({ panel }) {
  const candidatos = [
    [innerWidth / 2, innerHeight - 30],
    [12, innerHeight * 0.75],
    [innerWidth - 12, innerHeight * 0.75],
    [innerWidth / 2, Math.min(innerHeight - 5, (panel?.bottom ?? 0) + 30)],
    [12, innerHeight / 2],
  ]
  for (const [x, y] of candidatos) {
    if (panel && x >= panel.left && x <= panel.right && y >= panel.top && y <= panel.bottom) continue
    const el = document.elementFromPoint(x, y)
    if (!el) continue
    if (el.closest('header, [data-mb-objetivo], [data-superficie-propia], nav, a, button, input')) continue
    return { x: Math.round(x), y: Math.round(y), sobre: el.tagName.toLowerCase() }
  }
  return null
}

// ─── Un caso ───────────────────────────────────────────────────────────────────────────────────

const NOMBRES = PRODUCTOS.map((p) => p.name)

async function esperarResultados(page, ms) {
  const fin = Date.now() + ms
  let ultimo = null
  while (Date.now() < fin) {
    ultimo = await page.evaluate(medirResultados, { nombres: NOMBRES })
    if (ultimo.visibles > 0) return ultimo
    await page.waitForTimeout(120)
  }
  return ultimo
}

async function esperarCierre(page, ms) {
  const fin = Date.now() + ms
  let ultimo = null
  while (Date.now() < fin) {
    ultimo = await page.evaluate(medirResultados, { nombres: NOMBRES })
    if (ultimo.visibles === 0) return true
    await page.waitForTimeout(100)
  }
  return false
}

async function escribir(page, texto) {
  await page.keyboard.press('ControlOrMeta+a').catch(() => {})
  await page.keyboard.type(texto, { delay: 25 })
}

/** Campo de búsqueda visible que apareció al abrir el panel (no el disparador). */
async function enfocarCampoDelPanel(page) {
  const fin = Date.now() + 2500
  while (Date.now() < fin) {
    const ok = await page.evaluate(() => {
      const RE = /busc|search/i
      const visibles = Array.from(document.querySelectorAll('input')).filter((i) => {
        const r = i.getBoundingClientRect()
        return r.width > 1 && r.height > 1 && (!i.checkVisibility || i.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
          && (i.type === 'search' || RE.test(`${i.placeholder} ${i.getAttribute('aria-label') ?? ''}`)) && !i.closest('[data-relleno]')
      })
      if (!visibles.length) return null
      const activo = document.activeElement
      const campo = visibles.includes(activo) ? activo : visibles[visibles.length - 1]
      document.querySelectorAll('[data-mb-campo]').forEach((e) => e.removeAttribute('data-mb-campo'))
      campo.setAttribute('data-mb-campo', '1')
      const r = campo.getBoundingClientRect()
      return { width: Math.round(r.width) }
    })
    if (ok) {
      await page.click('[data-mb-campo]', { timeout: 2000 }).catch(() => {})
      return ok
    }
    await page.waitForTimeout(100)
  }
  return null
}

/**
 * Clic en el buscador elegido. Si algo lo tapa (Playwright no puede hacer clic), se anota qué lo
 * tapa como fallo de `regla` y se sigue con un clic forzado para poder medir el resto.
 */
async function clicObjetivo(page, falla, regla) {
  try {
    await page.click('[data-mb-objetivo]', { timeout: 1500 })
    return
  } catch {
    const encima = await page.evaluate(() => {
      const el = document.querySelector('[data-mb-objetivo]')
      if (!el) return 'el buscador desapareció'
      const r = el.getBoundingClientRect()
      const arriba = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      if (!arriba) return 'fuera de la pantalla'
      const etiqueta = arriba.getAttribute('aria-label') || (arriba.textContent ?? '').trim().slice(0, 20)
      return `${arriba.tagName.toLowerCase()}${etiqueta ? ` «${etiqueta}»` : ''}`
    })
    falla(regla, `no recibe el clic: lo tapa ${encima}`)
    await page.click('[data-mb-objetivo]', { timeout: 1500, force: true }).catch(() => {})
    await page.focus('[data-mb-objetivo]').catch(() => {})
  }
}

function urlCaso(base, c) {
  const p = new URLSearchParams({ org: String(c.org) })
  if (c.header) p.set('header', c.header)
  p.set('search', c.search)
  if (!MOVIL_REAL) p.set('msearch', c.search)
  return `${base}/pruebas-internas/encabezado?${p}`
}

async function correrCaso(page, base, c) {
  const fallos = []
  const falla = (regla, detalle) => fallos.push({ regla, detalle })
  const r = { ...c, url: urlCaso(base, c), fallos, medidas: {} }
  let capturado = false
  const capturar = async (sufijo) => {
    if (capturado && sufijo === 'reposo') return
    capturado = true
    const archivo = `${c.id}-${sufijo}.png`
    await page.screenshot({ path: join(CAPTURAS, archivo) }).catch(() => {})
    r.capturas = [...(r.capturas ?? []), `capturas/${archivo}`]
  }

  await page.goto(r.url, { waitUntil: 'load', timeout: 30000 })
  await page.waitForSelector('html[data-pruebas-listo]', { timeout: 20000, state: 'attached' })
  await page.waitForTimeout(150)
  const datos = await page.evaluate(() => JSON.parse(document.getElementById('datos-prueba-encabezado')?.textContent || '{}'))
  r.datos = datos
  const esMovil = c.ancho < (datos.mobile_breakpoint ?? 768)
  const esperado = esMovil ? datos.buscadorMovil : datos.search_style
  r.esMovil = esMovil
  r.esperado = esperado
  r.headerEfectivo = datos.headerEfectivo

  const reposo = await page.evaluate(medirReposo, { anchoMinInput: ANCHO_MIN_INPUT })
  r.medidas.reposo = reposo

  // a) documento sin scroll horizontal
  if (reposo.scrollWidth > reposo.innerWidth) falla('a', `scrollWidth ${reposo.scrollWidth} > ${reposo.innerWidth} en reposo`)

  // e) menú del encabezado
  for (const p of reposo.nav.problemas) {
    falla('e', p.tipo === 'fuera-de-vista'
      ? `«${p.texto}» fuera de vista (${p.left}–${p.right}, área ${p.clipIzq}–${p.clipDer})`
      : `«${p.texto}» ${p.tipo} (${p.scrollWidth} > ${p.clientWidth})`)
  }

  // f) hidden: sin buscador arriba
  if (esperado === 'hidden') {
    if (reposo.modo !== 'ninguno' && reposo.zona !== 'barra-inferior') {
      falla('f', `hay buscador (${reposo.modo}, ${reposo.objetivo?.tag} ${reposo.objetivo?.width}px en ${reposo.zona})`)
    }
    if (fallos.length) await capturar('reposo')
    return r
  }

  // b) existe y mide
  if (reposo.modo === 'ninguno') {
    falla('b', `sin buscador visible (esperado ${esperado})`)
    await capturar('reposo')
    return r
  }

  // c) abrir, escribir 3 letras
  if (reposo.modo === 'barra') {
    await clicObjetivo(page, falla, 'b')
    await page.waitForTimeout(250)
    const { enfocado, compuesto } = await page.evaluate(() => {
      const el = document.querySelector('[data-mb-objetivo]')
      // Celular con «Buscador grande»: selector angosto + campo + botón en una fila de 360px
      // (BuscadorCromoCompacto). Ahí la regla mide el control entero y exige que el campo sea al
      // menos la mitad; el selector y el botón tienen ancho fijo a propósito.
      const caja = el?.closest('[data-buscador="movil-categorias"]')
      return {
        enfocado: el ? Math.round(el.getBoundingClientRect().width) : null,
        compuesto: caja ? Math.round(caja.getBoundingClientRect().width) : null,
      }
    })
    r.medidas.anchoInputEnfocado = enfocado
    r.medidas.anchoControlCompuesto = compuesto
    const ancho = Math.max(reposo.objetivo.width, enfocado ?? 0)
    if (compuesto !== null) {
      if (compuesto < ANCHO_MIN_INPUT || ancho < compuesto / 2) falla('b', `control ${compuesto}px (campo ${ancho}px): se espera ≥ ${ANCHO_MIN_INPUT} y el campo ≥ la mitad`)
    } else if (ancho < ANCHO_MIN_INPUT) falla('b', `input ${reposo.objetivo.width}px${enfocado && enfocado !== reposo.objetivo.width ? ` (${enfocado}px enfocado)` : ''} < ${ANCHO_MIN_INPUT}`)
  } else {
    await clicObjetivo(page, falla, 'b')
    const campo = await enfocarCampoDelPanel(page)
    r.medidas.campoPanel = campo
    if (!campo) {
      falla('c', 'la lupa no abre ningún campo de búsqueda')
      await capturar('abierto')
      return r
    }
  }
  if (fallos.length) await capturar('reposo')

  await escribir(page, 'sil')
  const abierto = await esperarResultados(page, 4000)
  r.medidas.abierto = abierto
  let fallaC = false
  if (!abierto || abierto.visibles === 0) {
    falla('c', `sin resultados visibles tras escribir (${abierto?.estado ?? '¿?'})`)
    fallaC = true
  } else {
    const p = abierto.panel
    if (p.width < ANCHO_MIN_PANEL) { falla('c', `panel ${p.width}px < ${ANCHO_MIN_PANEL}`); fallaC = true }
    if (p.left < -0.5 || p.right > c.ancho + 0.5) { falla('c', `panel fuera del viewport (${p.left}–${p.right} de ${c.ancho})`); fallaC = true }
    if (abierto.tapado) { falla('c', `resultados tapados o recortados (encima: ${abierto.tapadoPor ?? '¿?'})`); fallaC = true }
    if (abierto.visibles < PRODUCTOS.length && p.height < 200) { falla('c', `solo ${abierto.visibles} de ${PRODUCTOS.length} resultados a la vista (panel ${p.height}px de alto)`); fallaC = true }
    if (abierto.scrollWidth > c.ancho) falla('a', `scrollWidth ${abierto.scrollWidth} > ${c.ancho} con el buscador abierto`)
  }
  if (fallaC || fallos.some((f) => f.regla === 'a')) await capturar('abierto')
  if (!abierto || abierto.visibles === 0) return r

  // d) Escape cierra
  await page.keyboard.press('Escape')
  const cerroEscape = await esperarCierre(page, 1200)
  r.medidas.cierraEscape = cerroEscape
  if (!cerroEscape) {
    falla('d', 'Escape no cierra')
    await capturar('escape')
    // Se intenta igual el clic afuera desde este estado.
  } else {
    // Reabrir: el mismo campo (la barra conserva el texto) o la lupa.
    await page.click('[data-mb-objetivo]', { timeout: 3000 }).catch(() => {})
    if (reposo.modo === 'panel') await enfocarCampoDelPanel(page)
    let re = await esperarResultados(page, 1500)
    if (!re || re.visibles === 0) {
      await escribir(page, 'sil')
      re = await esperarResultados(page, 3000)
    }
    if (!re || re.visibles === 0) {
      falla('d', 'no se pudo reabrir para probar el clic afuera')
      return r
    }
  }
  const actual = await page.evaluate(medirResultados, { nombres: NOMBRES })
  if (actual.panel?.pantallaCompleta) {
    r.medidas.clicAfuera = 'no aplica: pantalla completa'
    return r
  }
  const punto = await page.evaluate(puntoAfuera, { panel: actual.panel ?? null })
  if (!punto) {
    r.medidas.clicAfuera = 'sin punto libre'
    falla('d', 'no hay dónde hacer clic afuera (el panel tapa todo sin ser pantalla completa)')
    return r
  }
  await page.mouse.click(punto.x, punto.y)
  const cerroClic = await esperarCierre(page, 1200)
  r.medidas.clicAfuera = cerroClic ? `cierra (${punto.x},${punto.y})` : `no cierra (${punto.x},${punto.y})`
  if (!cerroClic) {
    falla('d', `clic afuera (${punto.x},${punto.y}) no cierra`)
    await capturar('clic-afuera')
  }
  return r
}

// ─── Casos ─────────────────────────────────────────────────────────────────────────────────────

function armarCasos() {
  const casos = []
  const agregar = (org, header) => {
    for (const search of buscadores) {
      for (const ancho of anchos) {
        const id = `org${org}-${header ?? 'real'}-${search}-${ancho}`
        casos.push({ id, org, header, search, ancho })
      }
    }
  }
  for (const org of ORGS) agregar(org, null)
  if (!tiene('--sin-base') && fixture.tiendas.some((t) => t.id === BASE)) {
    for (const h of headers) agregar(BASE, h)
  }
  return casos
}

// ─── Resumen ───────────────────────────────────────────────────────────────────────────────────

function resumir(resultados, segundos) {
  const conFallo = resultados.filter((r) => r.fallos.length)
  const lineas = []
  lineas.push('')
  lineas.push(`Matriz del buscador: ${resultados.length} casos · ${resultados.length - conFallo.length} ok · ${conFallo.length} con fallos · ${segundos.toFixed(0)} s`)
  const etiqueta = (r) => `${r.header ? r.header : `real:${r.headerEfectivo ?? '?'}`}`
  const porRegla = new Map()
  for (const r of conFallo) for (const f of r.fallos) {
    const m = porRegla.get(f.regla) ?? new Map()
    const clave = `${etiqueta(r)} · ${r.search} · ${r.ancho}`
    const g = m.get(clave) ?? { orgs: new Set(), ejemplos: [] }
    g.orgs.add(r.org)
    if (g.ejemplos.length < 2) g.ejemplos.push(`org ${r.org}: ${f.detalle}`)
    m.set(clave, g)
    porRegla.set(f.regla, m)
  }
  const NOMBRE = {
    a: 'a · scroll horizontal del documento',
    b: 'b · buscador ausente o input < 240 px',
    c: 'c · desplegable/panel de resultados',
    d: 'd · Escape / clic afuera no cierran',
    e: 'e · enlaces del menú cortados o fuera de vista',
    f: 'f · hidden con buscador',
    error: 'error · el caso no se pudo correr',
  }
  for (const regla of ['a', 'b', 'c', 'd', 'e', 'f', 'error']) {
    const m = porRegla.get(regla)
    if (!m) continue
    const total = [...m.values()].reduce((n, g) => n + g.orgs.size, 0)
    lineas.push('')
    lineas.push(`${NOMBRE[regla]} — ${total} caso(s)`)
    const claves = [...m.keys()].sort()
    for (const k of claves) {
      const g = m.get(k)
      lineas.push(`  ${k}  [orgs ${[...g.orgs].sort((x, y) => x - y).join(',')}]`)
      for (const e of g.ejemplos) lineas.push(`      ${e}`)
    }
  }
  // Vista compacta: fallos por (regla × search_style × ancho), todas las tiendas y encabezados.
  lineas.push('')
  lineas.push('Fallos por regla × search_style × ancho (casos):')
  const tabla = new Map()
  for (const r of conFallo) for (const regla of new Set(r.fallos.map((f) => f.regla))) {
    const k = `${regla}|${r.search}|${r.ancho}`
    tabla.set(k, (tabla.get(k) ?? 0) + 1)
  }
  const reglas = [...new Set([...tabla.keys()].map((k) => k.split('|')[0]))].sort()
  for (const regla of reglas) {
    const celdas = []
    for (const s of buscadores) for (const a of anchos) {
      const n = tabla.get(`${regla}|${s}|${a}`)
      if (n) celdas.push(`${s}@${a}=${n}`)
    }
    lineas.push(`  ${regla}: ${celdas.join('  ')}`)
  }
  return lineas.join('\n')
}

// ─── Principal ─────────────────────────────────────────────────────────────────────────────────

async function principal() {
  const inicio = Date.now()
  let playwright
  try {
    playwright = requerir('playwright')
  } catch {
    playwright = createRequire(import.meta.url)('playwright')
  }
  const casos = armarCasos()
  if (!casos.length) throw new Error('sin casos: revisa --orgs/--anchos/--search')
  rmSync(CAPTURAS, { recursive: true, force: true })
  mkdirSync(CAPTURAS, { recursive: true })

  const puerto = Number(valor('--puerto')) || (await puertoLibre())
  // «localhost» y no 127.0.0.1: el middleware solo simula el host en localhost; con una IP la toma
  // por dominio propio y el layout raíz buscaría la organización en Supabase.
  const base = `http://localhost:${puerto}`
  if (!MODO_DEV && !SIN_BUILD) {
    console.log('next build (con PRUEBAS_INTERNAS=1 y Supabase falso)…')
    await ejecutarNext(['build'])
  } else if (!MODO_DEV && !existsSync(join(RAIZ, '.next', 'BUILD_ID'))) {
    throw new Error('--sin-build sin un .next construido: corre sin --sin-build o con --dev')
  }
  console.log(`${MODO_DEV ? 'next dev' : 'next start'} en ${base}…`)
  const servidor = ejecutarNext([MODO_DEV ? 'dev' : 'start', '-p', String(puerto)], { esperar: false })
  const terminar = () => { try { servidor.hijo.kill('SIGTERM') } catch {} }
  process.on('exit', terminar)
  process.on('SIGINT', () => { terminar(); process.exit(130) })

  let navegador
  const resultados = []
  try {
    await esperarServidor(`${base}/pruebas-internas/encabezado?org=${casos[0].org}`, servidor.hijo, servidor.log, MODO_DEV ? 300000 : 180000)
    navegador = await playwright.chromium.launch()
    const local = new URL(base)
    const rutas = async (route) => {
      const u = new URL(route.request().url())
      const esLocal = (u.hostname === local.hostname || u.hostname === 'localhost') && u.port === local.port
      if (!esLocal) return route.abort()
      if (u.pathname.startsWith('/api/products/search')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ products: PRODUCTOS }) })
      }
      if (u.pathname.startsWith('/api/currency')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ baseCurrency: 'COP', targetCurrency: 'COP', conversionRate: 1, locale: 'es-CO', decimals: 0, availableCurrencies: [{ code: 'COP', country: 'Colombia' }] }) })
      }
      if (u.pathname.startsWith('/api/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      return route.continue()
    }

    // Un contexto por ancho; CONCURRENCIA páginas reutilizadas en total, repartidas por ancho.
    const porAncho = new Map()
    for (const c of casos) porAncho.set(c.ancho, [...(porAncho.get(c.ancho) ?? []), c])
    const trabajadores = []
    let hechos = 0
    const paginasPorAncho = Math.max(1, Math.floor(CONCURRENCIA / porAncho.size) || 1)
    for (const [ancho, cola] of porAncho) {
      const contexto = await navegador.newContext({ viewport: { width: ancho, height: ALTO }, deviceScaleFactor: 1, locale: 'es-CO' })
      await contexto.route('**/*', rutas)
      for (let i = 0; i < paginasPorAncho; i++) {
        trabajadores.push((async () => {
          const page = await contexto.newPage()
          page.setDefaultTimeout(8000)
          while (cola.length) {
            const c = cola.shift()
            let r
            try {
              r = await correrCaso(page, base, c)
            } catch (e) {
              r = { ...c, fallos: [{ regla: 'error', detalle: e instanceof Error ? e.message.split('\n')[0] : String(e) }] }
              await page.screenshot({ path: join(CAPTURAS, `${c.id}-error.png`) }).catch(() => {})
            }
            resultados.push(r)
            hechos++
            if (hechos % 25 === 0 || hechos === casos.length) {
              process.stdout.write(`  ${hechos}/${casos.length} casos (${((Date.now() - inicio) / 1000).toFixed(0)} s)\n`)
            }
          }
          await page.close()
        })())
      }
    }
    await Promise.all(trabajadores)
  } finally {
    if (navegador) await navegador.close()
    terminar()
  }

  resultados.sort((a, b) => a.id.localeCompare(b.id, 'es', { numeric: true }))
  const segundos = (Date.now() - inicio) / 1000
  const conFallo = resultados.filter((r) => r.fallos.length)
  mkdirSync(SALIDA, { recursive: true })
  writeFileSync(join(SALIDA, 'matriz-buscador.json'), `${JSON.stringify({
    fecha: new Date().toISOString(),
    segundos: Math.round(segundos),
    opciones: { orgs: ORGS, base: BASE, headers, buscadores, anchos, movilReal: MOVIL_REAL, dev: MODO_DEV },
    totales: { casos: resultados.length, ok: resultados.length - conFallo.length, conFallos: conFallo.length },
    casos: resultados,
  }, null, 2)}\n`)
  console.log(resumir(resultados, segundos))
  console.log(`\nDetalle: scripts/pruebas/salida/matriz-buscador.json · capturas de fallos: scripts/pruebas/salida/capturas/`)
  process.exitCode = conFallo.length ? 1 : 0
}

principal().catch((e) => {
  console.error(e instanceof Error ? e.stack : e)
  process.exit(1)
})
