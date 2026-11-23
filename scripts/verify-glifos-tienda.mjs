/**
 * verify-glifos-tienda.mjs — «Íconos con más estilos» (Figma «16 Sitio web» 2852:70951, propuesta 8,
 * aprobada 2026-11-23).
 *
 *   npm run verify:glifos-tienda
 *
 * 1. Contrato (lib/website/v2/glifosTienda.ts y catalogoIconos.ts, copias del ERP): lectores,
 *    peso efectivo, qué dibujo se pinta, y que TODOS los nombres del contrato (sugeridos,
 *    equivalentes de Lucide, nombres en español) existen en @phosphor-icons/core.
 * 2. Ruta del dibujo: cada nombre del contrato en los 6 pesos sale como `<symbol id="g">` limpio;
 *    pedidos raros (rutas, pesos inventados) no leen nada.
 * 3. Pintado: SIN opciones nuevas `conGlifo` e `iconoCabecera` devuelven el MISMO componente de
 *    Lucide (mismo HTML de hoy); con opciones, Phosphor con `<use>`, trazo, tamaño, sombra y fondo,
 *    y el menú inferior con su estilo.
 *
 * Cargador TS/TSX: el mismo de verify-menu-inferior-pintado.
 */
import { readFile } from 'node:fs/promises'
import { register } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
process.env.NODE_ENV = 'production'
let fallos = 0
let total = 0
function check(cond, msg) {
  total++
  if (!cond) {
    fallos++
    console.error('✗', msg)
  }
}

// ─── Cargador TS/TSX: `@/` → raíz; paquetes desde node_modules de este repo ──────────────────
const CARGADOR = `
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
let ts, raizPaquetes
export async function initialize(d) {
  raizPaquetes = d.raizPaquetes
  ts = createRequire(join(raizPaquetes, 'package.json'))('typescript')
}
const EXT = ['.tsx', '.ts', '.mjs', '.js', '/index.tsx', '/index.ts', '/index.js']
function archivo(base) {
  if (existsSync(base) && statSync(base).isFile()) return base
  for (const e of EXT) if (existsSync(base + e)) return base + e
  return null
}
function raizDe(url) {
  // La raíz del árbol que importa: la carpeta con package.json o con app/ y components/.
  let d = dirname(fileURLToPath(url))
  while (d !== dirname(d)) {
    if (existsSync(join(d, 'components')) && existsSync(join(d, 'lib'))) return d
    d = dirname(d)
  }
  return raizPaquetes
}
export async function resolve(esp, ctx, next) {
  const padre = ctx.parentURL && ctx.parentURL.startsWith('file:') ? ctx.parentURL : null
  if (esp.endsWith('.css')) return { url: 'data:text/javascript,export default new Proxy({}, { get: (_, k) => String(k) })', shortCircuit: true }
  if (esp.startsWith('@/') && padre) {
    const f = archivo(join(raizDe(padre), esp.slice(2)))
    if (f) return { url: pathToFileURL(f).href, shortCircuit: true }
  }
  if ((esp.startsWith('./') || esp.startsWith('../')) && padre) {
    const f = archivo(join(dirname(fileURLToPath(padre)), esp))
    if (f) return { url: pathToFileURL(f).href, shortCircuit: true }
  }
  if (!esp.startsWith('.') && !esp.startsWith('/') && !esp.startsWith('node:') && !esp.startsWith('data:') && !esp.startsWith('file:')) {
    const padreRaiz = pathToFileURL(join(raizPaquetes, 'package.json')).href
    try {
      return await next(esp, { ...ctx, parentURL: padreRaiz })
    } catch (e) {
      // Subrutas sin «exports» (next/link): la resolución de CommonJS.
      return { url: pathToFileURL(createRequire(padreRaiz).resolve(esp)).href, shortCircuit: true }
    }
  }
  return next(esp, ctx)
}
export async function load(url, ctx, next) {
  if (url.startsWith('file:') && /\\.(tsx?|mts)$/.test(url)) {
    const fuente = readFileSync(fileURLToPath(url), 'utf8')
    const { outputText } = ts.transpileModule(fuente, {
      fileName: fileURLToPath(url),
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, verbatimModuleSyntax: false, isolatedModules: true },
    })
    return { format: 'module', source: outputText, shortCircuit: true }
  }
  return next(url, ctx)
}
`
register(`data:text/javascript,${encodeURIComponent(CARGADOR)}`, { parentURL: import.meta.url, data: { raizPaquetes: ROOT } })
const importar = (rel) => import(pathToFileURL(join(ROOT, rel)).href)
const React = (await import(pathToFileURL(join(ROOT, 'node_modules/react/index.js')).href)).default
const { renderToStaticMarkup } = (await import(pathToFileURL(join(ROOT, 'node_modules/react-dom/server.node.js')).href)).default
const h = React.createElement

const G = await importar('lib/website/v2/glifosTienda.ts')
const C = await importar('lib/website/v2/catalogoIconos.ts')
const S = await importar('lib/website/iconos/simboloPhosphor.ts')
const { icons } = await import(pathToFileURL(join(ROOT, 'node_modules/@phosphor-icons/core/dist/index.mjs')).href)
const PHOSPHOR = new Set(icons.map((i) => i.pascal_name))

// ─── 1. Contrato ─────────────────────────────────────────────────────────────────────────────
check(icons.every((i) => G.kebabPhosphor(i.pascal_name) === i.name), 'kebabPhosphor da el nombre de archivo de los 1.512 íconos')
const usados = new Set([
  ...Object.values(G.EQUIVALENTE_PHOSPHOR),
  ...Object.keys(C.NOMBRES_ES),
  ...Object.values(C.SUGERIDOS_POR_ACCION).flat().map((s) => C.leerSugerido(s).name),
])
for (const n of usados) check(PHOSPHOR.has(n), `${n} existe en @phosphor-icons/core`)
for (const s of Object.values(C.SUGERIDOS_POR_ACCION).flat()) {
  const w = C.leerSugerido(s).weight
  check(!w || G.PESOS_GLIFO.includes(w), `sugerido ${s}: peso válido`)
}
check(G.leerRefGlifo('cart') === null && G.leerRefGlifo({ set: 'lucide', name: 'Cart' }) === null, 'un texto o otro set no es Phosphor')
check(G.leerRefGlifo({ set: 'phosphor', name: '../etc' }) === null && G.leerRefGlifo({ set: 'phosphor', name: 'shopping-cart' }) === null, 'nombre que no es PascalCase: nada')
check(JSON.stringify(G.leerRefGlifo({ set: 'phosphor', name: 'Heart', weight: 'x' })) === '{"set":"phosphor","name":"Heart"}', 'peso inventado: sin peso')
check(G.leerEstiloGlifos(null) === null && G.leerEstiloGlifos({}) === null, 'sin estilo: null (lo de hoy)')
check(G.leerEstiloGlifos({ weight: 'neon', size: 50, shadow: 'none', bg: { shape: 'none', color: '#fff' }, scope: 'all' }) === null, 'solo valores «como hoy» o inválidos: null')
check(JSON.stringify(G.leerEstiloGlifos({ weight: 'bold', size: 20, shadow: 'strong', bg: { shape: 'square', color: 'rojo' } })) === '{"weight":"bold","size":20,"shadow":"strong","bg":{"shape":"square"}}', 'color de fondo inválido: el fondo queda sin color')
check(G.pesoEfectivo({ set: 'phosphor', name: 'Heart', weight: 'fill' }, { weight: 'duotone' }) === 'duotone', 'Igual para todos: manda el estilo general')
check(G.pesoEfectivo({ set: 'phosphor', name: 'Heart', weight: 'fill' }, { weight: 'duotone', scope: 'item' }) === 'fill', 'Propio por botón: manda el del ícono')
check(G.pesoEfectivo({ set: 'phosphor', name: 'Heart', weight: 'fill' }, null) === 'fill' && G.pesoEfectivo(null, null) === 'regular', 'sin estilo: el del ícono o Línea')
check(JSON.stringify(G.dibujoGlifo(null, 'cart', null)) === '{"tipo":"lucide","trazo":null}', 'Lucide sin estilo: nada cambia')
check(JSON.stringify(G.dibujoGlifo(null, 'cart', { weight: 'fill' })) === '{"tipo":"phosphor","name":"ShoppingCart","weight":"fill"}', 'Lucide con Relleno y equivalente: Phosphor relleno')
check(G.dibujoGlifo(null, 'scan-search', { weight: 'fill' }).tipo === 'lucide', 'Lucide sin equivalente: el de hoy (relleno emulado)')
check(JSON.stringify(G.dibujoGlifo(null, 'cart', { weight: 'light' })) === '{"tipo":"lucide","trazo":{"strokeWidth":1.5}}', 'Línea fina sobre Lucide: solo el trazo')
check(G.estiloDePeso('bold') === 'gruesa' && G.grosorDePeso('light') === 'fino' && G.grosorDePeso('fill') === null, 'tarjeta y grosor desde el peso')
check(G.pesoDeEstilo('linea', 'light') === 'light' && G.pesoDeEstilo('relleno') === 'fill' && G.pesoDeGrosor('grueso') === 'bold', 'peso desde tarjeta y grosor')
check(JSON.stringify(G.glifosCabecera({ header_iconos: { glifos: { carrito: { set: 'phosphor', name: 'Basket' }, cuenta: 'user', nada: { set: 'phosphor', name: 'Heart' } } } })) === '{"carrito":{"set":"phosphor","name":"Basket"}}', 'glifos de la cabecera: solo los válidos')
check(G.estiloGlifosCabecera({ header_iconos: { estilo: 'texto' } }) === null, 'cabecera sin iconStyle: null')
check(C.coincideBusqueda('carrito compras mercado', 'carr') && C.coincideBusqueda('bolsa compras', 'Bolsa Compras') && !C.coincideBusqueda('bolsa', 'carrito'), 'búsqueda por inicio de palabra, sin tildes ni mayúsculas')
check(C.normalizarBusqueda('Corazón  ÁRBOL') === 'corazon arbol', 'normalizar quita tildes')

// ─── 2. Ruta del dibujo ──────────────────────────────────────────────────────────────────────
check(S.archivoPhosphor('duotone', 'ShoppingCart.svg')?.archivo === 'shopping-cart-duotone.svg', 'archivo duotone')
check(S.archivoPhosphor('regular', 'ShoppingCart.svg')?.archivo === 'shopping-cart.svg', 'archivo regular sin sufijo')
for (const [p, n] of [['negrita', 'Heart.svg'], ['bold', '..%2F..%2Fetc.svg'], ['bold', 'heart.svg'], ['bold', '../x.svg']]) check(S.archivoPhosphor(p, n) === null, `pedido raro ${p}/${n}: nada`)
check(S.simboloDesdeSvg('<svg viewBox="0 0 256 256"><script>alert(1)</script></svg>') === null, 'un SVG con script no sale')
check(S.simboloDesdeSvg('<svg><path d="M0 0" onload="x()"/></svg>') === null, 'un SVG con eventos no sale')
let rutas = 0
for (const n of usados) {
  for (const p of G.PESOS_GLIFO) {
    const a = S.archivoPhosphor(p, `${n}.svg`)
    const svg = await readFile(join(ROOT, 'node_modules/@phosphor-icons/core/assets', a.peso, a.archivo), 'utf8')
    const simbolo = S.simboloDesdeSvg(svg)
    rutas++
    check(simbolo && simbolo.startsWith('<svg xmlns="http://www.w3.org/2000/svg"><symbol id="g" viewBox="0 0 256 256"><'), `${p}/${n}: símbolo limpio`)
  }
}
const ruta = await readFile(join(ROOT, 'app/api/iconos/[peso]/[nombre]/route.ts'), 'utf8')
check(ruta.includes("'Cache-Control': CACHE") && ruta.includes('immutable'), 'la ruta se cachea un año')
const config = await readFile(join(ROOT, 'next.config.js'), 'utf8')
check(config.includes("'/api/iconos/[peso]/[nombre]': ['./node_modules/@phosphor-icons/core/assets/**/*.svg']"), 'next.config lleva los SVG a la función')
const mw = await readFile(join(ROOT, 'middleware.ts'), 'utf8')
check(mw.includes('(?:svg|png|jpg|jpeg|gif|webp)$'), 'el middleware no corre en los .svg (la ruta termina en .svg)')
const vivos = await readFile(join(ROOT, 'components/site/useAjustesVivosPreview.ts'), 'utf8')
check(vivos.includes('if (profundidad > 4) return false'), 'la vista previa en vivo acepta items[].icon.name e iconStyle.bg.color')

// ─── 3. Pintado ──────────────────────────────────────────────────────────────────────────────
const lucide = await import('lucide-react')
const { ShoppingBag, Heart, Search } = lucide
const { conGlifo } = await importar('components/site/iconos/GlifoTienda.tsx')
const { iconoCabecera } = await importar('components/site/iconos/iconoCabecera.ts')
const { iconoBuscar } = await importar('components/site/header/iconoBuscar.ts')
const pintar = (Comp, p = {}) => renderToStaticMarkup(h(Comp, { className: 'h-6 w-6', strokeWidth: 2, ...p }))

check(conGlifo(ShoppingBag, {}) === ShoppingBag && conGlifo(ShoppingBag, { nombre: 'shopping-bag', estilo: null }) === ShoppingBag, 'sin nada nuevo: el mismo componente de Lucide')
for (const a of [null, {}, { header_iconos: { estilo: 'texto', tamano: 'm' } }, { cart_icon: 'store', header_icons_weight: 'relleno' }]) {
  check(iconoCabecera(ShoppingBag, 'carrito', 'shopping-bag', a) === ShoppingBag, `cabecera sin opciones nuevas (${JSON.stringify(a)}): el mismo componente`)
}
check(iconoBuscar({}) === Search && iconoBuscar(null) === Search, 'la lupa de hoy sin ajustes')
const html = pintar(iconoCabecera(ShoppingBag, 'carrito', 'shopping-bag', { header_iconos: { glifos: { carrito: { set: 'phosphor', name: 'Basket', weight: 'duotone' } } } }))
check(html.includes('<use href="/api/iconos/duotone/Basket.svg#g"></use>') && html.includes('viewBox="0 0 256 256"') && html.includes('class="h-6 w-6"'), 'dibujo del catálogo: <use> con las clases de siempre')
check(conGlifo(ShoppingBag, { glifo: { set: 'phosphor', name: 'Basket' } }) === conGlifo(ShoppingBag, { glifo: { set: 'phosphor', name: 'Basket' } }), 'mismo pedido, mismo componente (no se remonta)')
const relleno = pintar(conGlifo(Heart, { nombre: 'heart', estilo: { weight: 'fill' } }), { style: { fill: 'none', strokeWidth: 2 } })
check(relleno.includes('/api/iconos/fill/Heart.svg#g') && !relleno.includes('fill:none'), 'Relleno sobre Lucide con equivalente: Phosphor relleno, sin el fill:none de la caja')
const fino = pintar(conGlifo(ShoppingBag, { nombre: 'scan-search', estilo: { weight: 'light', size: 20, shadow: 'soft' } }))
check(fino.includes('stroke-width="1.5"') && fino.includes('width:20px') && fino.includes('filter:drop-shadow'), 'Lucide sin equivalente: trazo fino, tamaño y sombra')
const conFondo = pintar(conGlifo(Heart, { glifo: { set: 'phosphor', name: 'Heart' }, estilo: { bg: { shape: 'circle', color: '#1D4ED8' }, shadow: 'strong' } }))
check(conFondo.startsWith('<span data-glifo-fondo="circle"') && conFondo.includes('border-radius:9999px') && conFondo.includes('background-color:#1D4ED8') && conFondo.includes('box-shadow'), 'fondo círculo con color y sombra marcada')
const tinte = pintar(conGlifo(Heart, { nombre: 'heart', estilo: { bg: { shape: 'square' } } }))
check(tinte.includes('border-radius:28%') && tinte.includes('color-mix(in srgb, currentColor 12%, transparent)'), 'fondo sin color: un tinte del color del ícono')

// El menú inferior con estilo: Phosphor en sus botones y fondo de marca en el activo.
const { MenuInferior } = await importar('components/site/MenuInferior.tsx')
const { TemaColoresProvider } = await importar('components/site/TemaColoresContext.tsx')
const ORG = { id: 9001, name: 'Tienda de muestra', subdomain: 'muestra', logo_url: null, primary_color: '#2563EB', website_settings: {} }
const ITEMS = [
  { id: 'a', action: 'home', label: 'Inicio', icon: 'home', visible: true },
  { id: 'd', action: 'cart', label: 'Carrito', icon: 'bag', visible: true, glyph: { set: 'phosphor', name: 'Basket' } },
]
const menuHtml = renderToStaticMarkup(h(TemaColoresProvider, { value: true }, h(MenuInferior, {
  menu: { v: 2, enabled: true, variant: 'tabs', items: ITEMS, style: { labels: 'always', iconStyle: { weight: 'duotone', bg: { shape: 'circle' }, shadow: 'soft' } } },
  destinos: { llamar: null, whatsapp: null, comoLlegar: null, reservar: null, pedir: null },
  organization: ORG, primaryColor: '#2563EB', navTree: [], settings: {}, menuCategories: [], rutaAdmiteAcciones: true,
})))
check(menuHtml.includes('/api/iconos/duotone/House.svg#g') && menuHtml.includes('/api/iconos/duotone/Basket.svg#g'), 'menú: Duotono para todos (Inicio por su equivalente, Carrito del catálogo)')
check((menuHtml.match(/data-glifo-fondo="circle"/g) ?? []).length === 2, 'menú: cada ícono en su círculo')

console.log(`verify-glifos-tienda: ${total - fallos}/${total} comprobaciones OK (${rutas} dibujos leídos)`)
if (fallos) process.exit(1)
