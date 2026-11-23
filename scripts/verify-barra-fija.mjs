/**
 * verify-barra-fija.mjs — barra fija de compra de la ficha («sticky cart») en el celular y en el
 * computador (Figma «16 Sitio web», propuesta 9 de 2836:69391; nota 2859:71821; aprobada el
 * 2026-11-23).
 *
 *   npm run verify:barra-fija
 *
 * 1. Contrato (lib/website/v2/barraFija.ts, copia idéntica del ERP): sin claves = lo de hoy
 *    (plana, 400 px, check, corazón; sin barra en el computador).
 * 2. IGUAL A HOY: pinta con react-dom/server la StickyAddToCart de HEAD (git show) y la nueva sin
 *    opciones, con los mismos productos, y exige el mismo HTML (las clases se comparan sin espacios
 *    de más). Así una tienda que no toca nada ve en el celular exactamente la barra de hoy.
 * 3. Cada opción se pinta: estilo flotante y vidrio, miniatura, cantidad, «Comprar ahora», texto
 *    propio, corazón apagado, la del computador en sus 3 posiciones y apagada por defecto.
 * 4. En el fuente: una sola lógica de compra (useCompraBarraFija, sin localStorage en las barras),
 *    la cabecera que se esconde («en lugar de la cabecera»), el chat que sube, el destino del
 *    vuelo al carrito, «Comprar ahora» con el mismo useIrAlCheckout de la ficha y la clave
 *    `sticky` declarada en el bloque.
 *
 * Sin base de datos ni dependencias nuevas: transpila los componentes REALES con `typescript`
 * (como verify-interruptores) y cambia next/link, next/image y next/navigation por mínimos.
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'
import {
  CELULAR_POR_DEFECTO,
  ESCRITORIO_POR_DEFECTO,
  UMBRAL_BARRA_FIJA_PX,
  barraDebeVerse,
  celularComoHoy,
  contenidoConBarraFija,
  leerBarraFija,
} from '../lib/website/v2/barraFija.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TMP = join(ROOT, '.verify-barra-fija-tmp')

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const leer = (ruta) => readFileSync(join(ROOT, ruta), 'utf8').replace(/\r\n/g, '\n')

// ── 1. Contrato ──
const hoy = leerBarraFija({})
check(celularComoHoy(hoy.celular) && hoy.celular.encendida, 'sin claves: el celular como hoy y encendido')
check(!hoy.escritorio.encendida, 'sin claves: sin barra en el computador')
check(UMBRAL_BARRA_FIJA_PX === 400 && !barraDebeVerse('scroll', { scrollY: 400, botonPasado: null }) && barraDebeVerse('scroll', { scrollY: 401, botonPasado: null }), 'aparece a los 400 px (hoy)')
check(barraDebeVerse('pass', { scrollY: 0, botonPasado: true }) && !barraDebeVerse('pass', { scrollY: 5000, botonPasado: false }), '«al pasar el botón» lo decide el botón')
check(leerBarraFija({ sticky_mobile: false }).celular.encendida === false, 'respeta sticky_mobile')
check(JSON.stringify(contenidoConBarraFija({ a: 1 }, { celular: { estilo: 'flat' } })) === '{"a":1}', 'lo de hoy no escribe claves')
check(CELULAR_POR_DEFECTO.estilo === 'flat' && ESCRITORIO_POR_DEFECTO.posicion === 'top', 'por defecto: plana; el computador arranca arriba')

// ── 2 y 3. Pintar ──
const STUBS = {
  'next/link': `import { createElement } from 'react'
export default function Link({ href, children, prefetch, scroll, replace, ...resto }) {
  return createElement('a', { href: typeof href === 'string' ? href : String(href?.pathname ?? ''), ...resto }, children)
}`,
  'next/image': `import { createElement } from 'react'
export default function Image({ src, alt, fill, sizes, priority, quality, placeholder, ...resto }) {
  return createElement('img', { src: typeof src === 'string' ? src : '', alt, ...resto })
}`,
  'next/navigation': `export function useSearchParams() { return new URLSearchParams() }
export function usePathname() { return '/' }
export function useRouter() { return { push() {}, replace() {}, refresh() {}, back() {}, prefetch() {} } }`,
}

function resolverLocal(especificador, desde) {
  const base = especificador.startsWith('@/') ? join(ROOT, especificador.slice(2)) : resolve(dirname(desde), especificador)
  for (const ext of ['', '.tsx', '.ts', '/index.tsx', '/index.ts']) {
    const p = base + ext
    if (existsSync(p) && (p.endsWith('.ts') || p.endsWith('.tsx'))) return p
  }
  throw new Error(`no encuentro ${especificador} (desde ${relative(ROOT, desde)})`)
}

const compilados = new Map()
async function compilar(ruta, salidaPropia = null) {
  if (compilados.has(ruta)) return compilados.get(ruta)
  const salida = salidaPropia ?? join(TMP, relative(ROOT, ruta)).replace(/\.tsx?$/, '.mjs')
  compilados.set(ruta, salida)
  const { outputText } = ts.transpileModule(await readFile(ruta, 'utf8'), {
    fileName: ruta,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  })
  const especificadores = new Set()
  for (const m of outputText.matchAll(/(?:from\s*|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)) especificadores.add(m[1])
  let codigo = outputText
  for (const esp of especificadores) {
    let destino = null
    if (STUBS[esp]) destino = join(TMP, '__stubs', `${esp.replace(/\//g, '_')}.mjs`)
    else if (esp.startsWith('.') || esp.startsWith('@/')) destino = await compilar(resolverLocal(esp, ruta))
    if (!destino) continue
    let rel = relative(dirname(salida), destino).replace(/\\/g, '/')
    if (!rel.startsWith('.')) rel = `./${rel}`
    codigo = codigo.split(`'${esp}'`).join(`'${rel}'`).split(`"${esp}"`).join(`"${rel}"`)
  }
  await mkdir(dirname(salida), { recursive: true })
  await writeFile(salida, codigo)
  return salida
}

/** Clases sin espacios de más y en el mismo orden: el navegador las lee igual. */
// `data-barra-fija-celular` (2026-11-23): marca invisible para que el menú inferior se oculte o se
// apile mientras la barra se ve (Figma 2844:70510 F1/F2); no cambia lo que se ve.
const normalizar = (html) => html
  .replace(/ data-barra-fija-celular=""/g, '')
  .replace(/class="([^"]*)"/g, (_, c) => `class="${c.trim().split(/\s+/).join(' ')}"`)

await rm(TMP, { recursive: true, force: true })
await mkdir(join(TMP, '__stubs'), { recursive: true })
for (const [nombre, codigo] of Object.entries(STUBS)) await writeFile(join(TMP, '__stubs', `${nombre.replace(/\//g, '_')}.mjs`), codigo)

try {
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const pintar = (Comp, props, nombre) => {
    try {
      return normalizar(renderToStaticMarkup(createElement(Comp, props)))
    } catch (e) {
      problemas.push(`${nombre}: revienta al pintar — ${e instanceof Error ? e.message : String(e)}`)
      return ''
    }
  }

  // La de HEAD (lo que hoy está en producción) junto a la nueva.
  let antes = null
  try {
    const fuente = execFileSync('git', ['show', 'HEAD:components/site/StickyAddToCart.tsx'], { cwd: ROOT, encoding: 'utf8' })
    // Se escribe solo en TMP (compilar() resuelve los `@/` desde ROOT): el árbol no se toca.
    const fuenteTmp = join(TMP, '__antes', 'StickyAntes.tsx')
    await mkdir(dirname(fuenteTmp), { recursive: true })
    await writeFile(fuenteTmp, fuente)
    antes = (await import(pathToFileURL(await compilar(fuenteTmp, join(TMP, '__antes', 'StickyAntes.mjs'))).href)).StickyAddToCart
  } catch (e) {
    problemas.push(`no pude pintar la barra de HEAD: ${e instanceof Error ? e.message : String(e)}`)
  }
  const { StickyAddToCart } = await import(pathToFileURL(await compilar(join(ROOT, 'components/site/StickyAddToCart.tsx'))).href)

  const simple = {
    productId: 10,
    productName: 'Audífonos ANC Pro',
    price: 289900,
    comparePrice: 329900,
    imageUrl: 'https://ejemplo.test/a.jpg',
    primaryColor: '#2563EB',
    organizationSubdomain: 'tienda',
    trackStock: true,
    stockLevels: [{ qty_on_hand: 5, qty_reserved: 0 }],
    branchId: null,
    conFavorito: true,
  }
  const variantes = [
    { id: 11, name: 'Negro M', variant_data: { color: 'Negro', talla: 'M' }, track_stock: true, stock_levels: [{ qty_on_hand: 3, qty_reserved: 0 }], product_prices: [{ price: 289900, compare_price: null }], product_images: [] },
    { id: 12, name: 'Blanco L', variant_data: { color: 'Blanco', talla: 'L' }, track_stock: true, stock_levels: [{ qty_on_hand: 0, qty_reserved: 0 }], product_prices: [{ price: 299900, compare_price: null }], product_images: [] },
  ]
  const escenarios = {
    'producto sencillo': simple,
    'padre con variantes': { ...simple, isParent: true, variants: variantes },
    'restaurante (sin corazón)': { ...simple, conFavorito: false },
    'precio dentro del botón': { ...simple, precioEnBoton: true },
    'sin stock': { ...simple, stockLevels: [{ qty_on_hand: 0, qty_reserved: 0 }] },
  }

  // 2. Igual a hoy: sin opciones y con las opciones leídas de un contenido vacío.
  if (antes) {
    for (const [nombre, props] of Object.entries(escenarios)) {
      const html = pintar(antes, props, `HEAD · ${nombre}`)
      const sinOpciones = pintar(StickyAddToCart, props, `nueva · ${nombre}`)
      const leidas = leerBarraFija({ sticky_mobile: true })
      const conLeidas = pintar(StickyAddToCart, { ...props, celular: leidas.celular, escritorio: leidas.escritorio }, `nueva leída · ${nombre}`)
      check(html.length > 0 && html === sinOpciones, `igual a hoy (${nombre}): la barra sin opciones cambió\n    HEAD:  ${html.slice(0, 400)}\n    nueva: ${sinOpciones.slice(0, 400)}`)
      check(html === conLeidas, `igual a hoy (${nombre}): con el contenido vacío leído, la barra cambió`)
    }
  }

  // 3. Opciones.
  const con = (sticky, extra = {}) => {
    const leidas = leerBarraFija({ sticky, ...extra })
    return pintar(StickyAddToCart, { ...simple, celular: leidas.celular, escritorio: leidas.escritorio }, JSON.stringify(sticky))
  }
  const base = pintar(StickyAddToCart, simple, 'base')
  check(!base.includes('data-barra-fija-escritorio'), 'por defecto no hay barra en el computador')
  check(base.includes('lg:hidden') && base.includes('bg-white border-t'), 'por defecto: la plana de hoy, solo hasta 1024 px')
  check(con({ style: 'floating' }).includes('rounded-2xl') && con({ style: 'floating' }).includes('data-barra-fija="floating"'), 'estilo flotante')
  check(con({ style: 'glass' }).includes('backdrop-blur-md'), 'estilo vidrio')
  check(con({ thumb: true }).includes('src="https://ejemplo.test/a.jpg"') && con({ thumb: true }).includes('Audífonos ANC Pro'), 'miniatura y precio')
  check(con({ thumb: true }).includes('>Agregar<'), 'con miniatura en la fila: «Agregar» corto (B1)')
  check(con({ qty: true }).includes('aria-label="Cantidad"'), 'cantidad compacta')
  check(con({ buyNow: true }).includes('Comprar ahora'), '«Comprar ahora»')
  check(!base.includes('Comprar ahora') && !base.includes('aria-label="Cantidad"'), 'por defecto sin cantidad ni «Comprar ahora»')
  check(con({ label: '¡Lo quiero!' }).includes('¡Lo quiero!'), 'texto propio del botón')
  check(base.includes('Guardar en favoritos') && !con({ fav: false }).includes('Guardar en favoritos'), 'corazón: sí por defecto, se apaga')
  check(!con({}, { sticky_mobile: false }).includes('lg:hidden'), 'sticky_mobile: false quita la barra del celular')
  for (const pos of ['top', 'replace', 'bottom']) {
    const html = con({ desktop: { enabled: true, position: pos } })
    check(html.includes(`data-barra-fija-escritorio="${pos}"`) && html.includes('lg:block'), `computador: posición ${pos}`)
  }
  const escritorio = con({ desktop: { enabled: true } })
  check(escritorio.includes('Comprar ahora') && escritorio.includes('aria-label="Cantidad"'), 'computador encendido: arranca con todo a la vista (K-E2)')
  const padreEsc = pintar(StickyAddToCart, { ...escenarios['padre con variantes'], escritorio: leerBarraFija({ sticky: { desktop: { enabled: true } } }).escritorio }, 'padre computador')
  check(padreEsc.includes('<select') && padreEsc.includes('color: Negro'), 'computador: variante compacta')
  const soloEsc = pintar(StickyAddToCart, { ...simple, ...(() => { const l = leerBarraFija({ sticky_mobile: false, sticky: { desktop: { enabled: true } } }); return { celular: l.celular, escritorio: l.escritorio } })() }, 'solo computador')
  check(!soloEsc.includes('lg:hidden') && soloEsc.includes('data-barra-fija-escritorio'), 'celular apagado y computador encendido: solo la del computador')
} finally {
  await rm(TMP, { recursive: true, force: true })
}

// ── 4. En el fuente ──
const pagina = leer('app/productos/[id]/page.tsx')
check(pagina.includes('const opcionesBarra = leerBarraFija(contenidoAcciones)'), 'la ficha lee la barra con el contrato')
check(pagina.includes('(barraFija || barraEscritorio)'), 'la barra se pinta con el celular o el computador encendido')
const barra = leer('components/site/StickyAddToCart.tsx')
const escritorioFuente = leer('components/site/barraFija/BarraFijaEscritorio.tsx')
check((barra.match(/useCompraBarraFija\(/g) || []).length === 1, 'una sola lógica de compra para las dos barras')
check(!barra.includes('localStorage') && !escritorioFuente.includes('localStorage'), 'las barras no escriben el carrito por su cuenta')
check(leer('components/site/barraFija/useCompraBarraFija.ts').includes('useIrAlCheckout()'), '«Comprar ahora» con el mismo useIrAlCheckout de la ficha')
check(leer('app/productos/[id]/ProductDetailActions.tsx').includes('useIrAlCheckout()'), 'la ficha usa useIrAlCheckout')
const css = leer('app/globals.css')
check(css.includes('html[data-barra-fija-cabecera="oculta"] [data-raiz-sitio] > header'), '«en lugar de la cabecera»: la cabecera se esconde')
check(css.includes('.latido-carrito'), 'el carrito late al llegar la miniatura')
const efectos = leer('components/site/barraFija/efectosBarraFija.ts')
check(efectos.includes('[data-gochat-widget]') && efectos.includes('--empuje-chat-barra-fija'), 'el chat sube sobre la barra')
check(efectos.includes("'(prefers-reduced-motion: reduce)'"), 'con «menos movimiento» no vuela')
check(leer('components/site/CartIndicator.tsx').includes('data-icono-carrito'), 'el ícono del carrito es el destino del vuelo')
check(leer('components/sections/product-detail/ProductActions.tsx').includes("'preset', 'sticky']"), 'CONTENT_KEYS declara `sticky`')

if (problemas.length > 0) {
  console.error(`✗ verify-barra-fija: ${problemas.length} de ${casos} fallaron`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-barra-fija: ${casos} comprobaciones`)
