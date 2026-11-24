/**
 * verify-volver.mjs — un solo «Volver» en las tiendas (Figma EAvjINVRnlzFM70GVoWXgl, regla
 * 2992:74856, aprobada el 2026-11-24).
 *
 *   npm run verify:volver
 *
 * Sin base de datos ni servidor. Prueba:
 *  1. La regla pura de a dónde vuelve el ← (lib/navegacion/volver.ts): historial de la pestaña si
 *     el paso anterior es de la tienda; si el cliente entró directo, la página «madre».
 *  2. Que no quede ningún «Volver» suelto con el estilo viejo (`← Volver a …` o un enlace con
 *     `<ArrowLeft>` + «Volver») en app/ y components/.
 *  3. Que las páginas cubiertas pinten el patrón nuevo (barra del celular y ← de escritorio).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  INICIO,
  avanzarRastro,
  caminoCategoria,
  etiquetaDeRuta,
  etiquetaDeTitulo,
  navegacionCategoria,
  navegacionCuenta,
  navegacionFicha,
  resolverVolver,
  rutaReferente,
  rutaSinRetorno,
  textoVolver,
} from '../lib/navegacion/volver.ts'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const igual = (obtenido, esperado, msg) => {
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado)
  check(ok, `${msg}: esperado ${JSON.stringify(esperado)}, obtenido ${JSON.stringify(obtenido)}`)
}

// ─── 1. Regla pura ─────────────────────────────────────────────────────────────────────────

// Textos: nunca «Volver» a secas.
igual(textoVolver('Neveras'), 'Volver a Neveras', 'texto con el destino real')
igual(textoVolver('Inicio'), 'Volver al inicio', 'inicio')
igual(textoVolver('la carta'), 'Volver a la carta', 'la carta')
check(textoVolver('') !== 'Volver' && textoVolver('').startsWith('Volver a '), 'sin nombre no queda «Volver» a secas')

// Referente: solo el de la misma tienda.
igual(rutaReferente('https://tienda.test/categorias/neveras?orden=precio', 'https://tienda.test'), '/categorias/neveras?orden=precio', 'referente propio')
igual(rutaReferente('https://www.google.com/search?q=x', 'https://tienda.test'), null, 'Google no es la tienda')
igual(rutaReferente('', 'https://tienda.test'), null, 'sin referente')
igual(rutaReferente('no es url', 'https://tienda.test'), null, 'referente inválido')

// Nombres de rutas conocidas.
igual(etiquetaDeRuta('/'), 'Inicio', 'inicio')
igual(etiquetaDeRuta('/search?q=nevera'), 'Resultados de "nevera"', 'búsqueda')
igual(etiquetaDeRuta('/mi-cuenta/pedidos/'), 'Mis pedidos', 'mis pedidos con barra final')
igual(etiquetaDeRuta('/categorias/neveras'), null, 'la categoría registra su propio nombre')
igual(etiquetaDeTitulo('Neveras | Tienda Ejemplo'), 'Neveras', 'título sin la marca')
igual(etiquetaDeTitulo(''), null, 'título vacío')

// Pasos sin retorno por historial.
check(rutaSinRetorno('/checkout') && rutaSinRetorno('/checkout/bold?x=1') && rutaSinRetorno('/auth'), 'el pago y el acceso no se reabren con ←')
check(!rutaSinRetorno('/carrito') && !rutaSinRetorno('/categorias/x'), 'carrito y categoría sí')

const sin = (p) => p
const nombres = (mapa) => (e) => mapa[e.path] ?? etiquetaDeRuta(e.url) ?? null
const NEVERAS = { href: '/categorias/neveras', etiqueta: 'Neveras' }

// Categoría → ficha por navegación interna: ← = historial a la categoría, con su nombre.
let pila = avanzarRastro([], { path: '/', url: '/', pop: false, primera: true, referente: null })
pila = avanzarRastro(pila, { path: '/categorias/neveras', url: '/categorias/neveras', pop: false, primera: false, referente: null })
pila = avanzarRastro(pila, { path: '/categorias/neveras', url: '/categorias/neveras?orden=precio', pop: false, primera: false, referente: null })
pila = avanzarRastro(pila, { path: '/productos/abc', url: '/productos/abc', pop: false, primera: false, referente: null })
let d = resolverVolver({ pila, actual: '/productos/abc', padre: NEVERAS, nombre: nombres({ '/categorias/neveras': 'Neveras' }), sinPrefijo: sin, largoHistorial: 5 })
igual(d, { modo: 'historial', href: '/categorias/neveras?orden=precio', etiqueta: 'Neveras', hrefReal: true }, 'ficha desde la categoría vuelve por historial con los filtros')

// La categoría con filtros empujados (2 pasos): enlace al paso anterior, no history.back().
pila = avanzarRastro([], { path: '/', url: '/', pop: false, primera: true, referente: null })
pila = avanzarRastro(pila, { path: '/categorias/neveras', url: '/categorias/neveras', pop: false, primera: false, referente: null })
pila = avanzarRastro(pila, { path: '/categorias/neveras', url: '/categorias/neveras?page=2', pop: false, primera: false, referente: null })
d = resolverVolver({ pila, actual: '/categorias/neveras', padre: INICIO, nombre: nombres({}), sinPrefijo: sin, largoHistorial: 4 })
igual(d, { modo: 'enlace', href: '/', etiqueta: 'Inicio', hrefReal: true }, 'categoría con filtros: enlace a la página anterior')

// Búsqueda → ficha.
pila = avanzarRastro([], { path: '/search', url: '/search?q=nevera', pop: false, primera: true, referente: null })
pila = avanzarRastro(pila, { path: '/productos/abc', url: '/productos/abc', pop: false, primera: false, referente: null })
d = resolverVolver({ pila, actual: '/productos/abc', padre: NEVERAS, nombre: nombres({}), sinPrefijo: sin, largoHistorial: 3 })
igual([d.modo, d.etiqueta], ['historial', 'Resultados de "nevera"'], 'ficha desde la búsqueda')

// Entró directo (WhatsApp, Google): la página «madre» de la ficha = su categoría.
pila = avanzarRastro([], { path: '/productos/abc', url: '/productos/abc', pop: false, primera: true, referente: null })
d = resolverVolver({ pila, actual: '/productos/abc', padre: NEVERAS, nombre: nombres({}), sinPrefijo: sin, largoHistorial: 1 })
igual(d, { modo: 'enlace', href: '/categorias/neveras', etiqueta: 'Neveras', hrefReal: false }, 'entrada directa: padre lógico')

// Entró directo después de haber navegado la tienda en la misma pestaña: también el padre.
pila = avanzarRastro([], { path: '/', url: '/', pop: false, primera: true, referente: null })
pila = avanzarRastro(pila, { path: '/productos/abc', url: '/productos/abc', pop: false, primera: true, referente: null })
d = resolverVolver({ pila, actual: '/productos/abc', padre: NEVERAS, nombre: nombres({}), sinPrefijo: sin, largoHistorial: 3 })
igual(d.href, '/categorias/neveras', 'enlace externo con pestaña usada: corte, al padre')

// Pestaña nueva desde la tienda (referente propio, historial de 1): enlace a la página anterior.
pila = avanzarRastro([], { path: '/productos/abc', url: '/productos/abc', pop: false, primera: true, referente: '/categorias/neveras' })
d = resolverVolver({ pila, actual: '/productos/abc', padre: NEVERAS, nombre: nombres({ '/categorias/neveras': 'Neveras' }), sinPrefijo: sin, largoHistorial: 1 })
igual([d.modo, d.href], ['enlace', '/categorias/neveras'], 'pestaña nueva: enlace, no history.back()')

// Recarga: no duplica la página.
pila = avanzarRastro([], { path: '/', url: '/', pop: false, primera: true, referente: null })
pila = avanzarRastro(pila, { path: '/carrito', url: '/carrito', pop: false, primera: false, referente: null })
const recargada = avanzarRastro(pila, { path: '/carrito', url: '/carrito', pop: false, primera: true, referente: '/carrito' })
igual(recargada.map((e) => e.path), ['/', '/carrito'], 'recargar no agrega otra entrada')

// Atrás del navegador: recorta la pila.
pila = avanzarRastro([], { path: '/', url: '/', pop: false, primera: true, referente: null })
pila = avanzarRastro(pila, { path: '/categorias/neveras', url: '/categorias/neveras', pop: false, primera: false, referente: null })
pila = avanzarRastro(pila, { path: '/productos/abc', url: '/productos/abc', pop: false, primera: false, referente: null })
pila = avanzarRastro(pila, { path: '/categorias/neveras', url: '/categorias/neveras', pop: true, primera: false, referente: null })
igual(pila.map((e) => e.path), ['/', '/categorias/neveras'], 'atrás recorta hasta la categoría')

// Pedido recién pagado: el ← no reabre el checkout.
pila = avanzarRastro([], { path: '/checkout', url: '/checkout', pop: false, primera: true, referente: null })
pila = avanzarRastro(pila, { path: '/pedido/WO-1', url: '/pedido/WO-1', pop: false, primera: false, referente: null })
d = resolverVolver({ pila, actual: '/pedido/WO-1', padre: INICIO, nombre: nombres({}), sinPrefijo: sin, largoHistorial: 4 })
igual([d.modo, d.href], ['enlace', '/'], 'pedido tras el pago: al padre, no al checkout')

// Carrito sin paso anterior: la última categoría vista; sin ella, el inicio.
pila = avanzarRastro([], { path: '/categorias/neveras', url: '/categorias/neveras', pop: false, primera: true, referente: null })
pila = avanzarRastro(pila, { path: '/carrito', url: '/carrito', pop: false, primera: true, referente: null })
d = resolverVolver({ pila, actual: '/carrito', padre: INICIO, nombre: nombres({ '/categorias/neveras': 'Neveras' }), sinPrefijo: sin, largoHistorial: 1, preferirUltimaCategoria: true })
igual([d.href, d.etiqueta], ['/categorias/neveras', 'Neveras'], 'carrito directo: última categoría vista')
d = resolverVolver({ pila: [], actual: '/carrito', padre: INICIO, nombre: nombres({}), sinPrefijo: sin, largoHistorial: 1, preferirUltimaCategoria: true })
igual([d.href, d.etiqueta], ['/', 'Inicio'], 'carrito sin rastro: inicio')

// Sede por prefijo: las rutas se comparan sin el prefijo.
pila = avanzarRastro([], { path: '/sede-norte/checkout', url: '/sede-norte/checkout', pop: false, primera: true, referente: null })
pila = avanzarRastro(pila, { path: '/sede-norte/pedido/1', url: '/sede-norte/pedido/1', pop: false, primera: false, referente: null })
d = resolverVolver({ pila, actual: '/sede-norte/pedido/1', padre: INICIO, nombre: nombres({}), sinPrefijo: (p) => p.replace(/^\/sede-norte(?=\/|$)/, '') || '/', largoHistorial: 3 })
igual(d.href, '/', 'checkout de una sede tampoco se reabre')

// Rastro acotado.
pila = []
for (let i = 0; i < 50; i += 1) pila = avanzarRastro(pila, { path: `/p${i}`, url: `/p${i}`, pop: false, primera: i === 0, referente: null })
check(pila.length === 30 && pila[29].path === '/p49', 'el rastro guarda las últimas 30 páginas')

// Páginas «madre».
const arbol = [
  { id: 1, name: 'Cocina', slug: 'cocina', children: [{ id: 2, name: 'Neveras', slug: 'neveras', children: [] }] },
  { id: 3, name: 'Hogar', slug: 'hogar', children: [] },
]
igual(caminoCategoria(arbol, 2).map((c) => c.name), ['Cocina', 'Neveras'], 'camino en el árbol ya cargado')
igual(caminoCategoria(arbol, 99), [], 'categoría fuera del árbol')
let nav = navegacionFicha({ camino: caminoCategoria(arbol, 2), esRestaurante: false, producto: 'Nevera 251 L' })
igual(nav.padre, { href: '/categorias/neveras', etiqueta: 'Neveras' }, 'ficha → su categoría')
igual(nav.migas.map((m) => m.etiqueta), ['Inicio', 'Cocina', 'Neveras', 'Nevera 251 L'], 'migas de la ficha')
nav = navegacionFicha({ camino: [], esRestaurante: false, producto: 'X' })
igual(nav.padre, { href: '/productos', etiqueta: 'Productos' }, 'ficha sin categoría → Productos (el destino de antes)')
nav = navegacionFicha({ camino: [], esRestaurante: true, producto: 'Bandeja' })
igual(nav.padre, { href: '/menu', etiqueta: 'la carta' }, 'plato → la carta (el destino de antes)')
igual(navegacionCategoria({ categoria: 'Neveras', padre: { name: 'Cocina', slug: 'cocina' } }).padre, { href: '/categorias/cocina', etiqueta: 'Cocina' }, 'categoría → su padre')
igual(navegacionCategoria({ categoria: 'Cocina', padre: null }).padre, INICIO, 'categoría raíz → inicio')
const secciones = [
  { href: '/mi-cuenta', texto: 'Inicio' },
  { href: '/mi-cuenta/pedidos', texto: 'Mis pedidos' },
  { href: '/mi-cuenta/facturas', texto: 'Facturas' },
]
igual(navegacionCuenta('/mi-cuenta', secciones), null, 'inicio de la cuenta: sin ←')
igual(navegacionCuenta('/mi-cuenta/facturas', secciones)?.padre, { href: '/mi-cuenta', etiqueta: 'Mi cuenta' }, 'sección → Mi cuenta')
igual(navegacionCuenta('/mi-cuenta/pedidos/abc', secciones)?.padre, { href: '/mi-cuenta/pedidos', etiqueta: 'Mis pedidos' }, 'pedido → Mis pedidos')
igual(navegacionCuenta('/mi-cuenta/vehiculos', secciones)?.actual, 'Vehiculos', 'página fuera del menú: nombre de la ruta')

// ─── 2. Ningún «Volver» suelto con el estilo viejo ─────────────────────────────────────────

/**
 * Fuera de la regla:
 * - app/pruebas-internas/ficha/_referencia/: copias congeladas de la ficha de antes para la
 *   comparación al píxel (verify:ficha-diff); no se publican.
 * - components/site/BarraVistaPrevia.tsx: barra del borrador que ve el dueño desde el editor del
 *   ERP; «← Volver al editor» es un botón con borde que sale de la tienda, no navegación de ella.
 */
const EXCLUIDOS = ['app/api/', 'app/pruebas-internas/ficha/_referencia/', 'components/site/BarraVistaPrevia.tsx']

function archivos(dir) {
  const salida = []
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`
    if (EXCLUIDOS.some((x) => `${rel}/`.startsWith(x) || rel.startsWith(x))) continue
    if (e.isDirectory()) salida.push(...archivos(rel))
    else if (/\.(tsx|ts)$/.test(e.name)) salida.push(rel)
  }
  return salida
}

const viejos = []
for (const rel of [...archivos('app'), ...archivos('components')]) {
  const lineas = fs.readFileSync(path.join(ROOT, rel), 'utf8').split(/\r?\n/)
  lineas.forEach((l, i) => {
    const codigo = l.replace(/\/\/.*$/, '')
    if (/^\s*(\*|\/\*|\{\/\*)/.test(l)) return
    // `← Volver a …` en el texto de un enlace.
    if (/(?:>|^)\s*←\s*Volver/.test(codigo)) viejos.push(`${rel}:${i + 1} «← Volver» suelto`)
    // <ArrowLeft> o <ChevronLeft> seguido de «Volver …» dentro del mismo enlace.
    if (/<(ArrowLeft|ChevronLeft)\b/.test(codigo)) {
      const siguiente = lineas.slice(i, i + 3).join(' ')
      if (/(ArrowLeft|ChevronLeft)[^]*?\/>\s*(\{[^}]*\?\s*)?['"]?\s*Volver/.test(siguiente)) viejos.push(`${rel}:${i + 1} flecha + «Volver» suelto`)
    }
  })
}
check(viejos.length === 0, `«Volver» con el estilo viejo:\n    ${viejos.join('\n    ')}`)

// ─── 3. Páginas cubiertas ──────────────────────────────────────────────────────────────────

const leer = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const CON_BARRA = [
  'app/productos/[id]/page.tsx',
  'app/categorias/[slug]/page.tsx',
  'app/carrito/page.tsx',
  'app/pedido/[id]/page.tsx',
  'components/site/cuenta/MenuMiCuenta.tsx',
  'app/servicios/[id]/page.tsx',
  'app/agendar/page.tsx',
  'app/cotizar/page.tsx',
  'app/espacios/[id]/page.tsx',
  'app/pases/[id]/page.tsx',
  'app/viajes/[id]/page.tsx',
  'app/reservas/page.tsx',
  'app/auth/page.tsx',
  'app/reserva/[id]/page.tsx',
]
for (const rel of CON_BARRA) check(leer(rel).includes('<BarraVolverMovil'), `${rel}: falta el «‹ Volver» del celular`)
// El pago no lleva «‹ Volver» en el celular: su cabecera ya tiene «Seguir comprando» (dueño, 2026-11-24).
check(!leer('app/checkout/page.tsx').includes('<BarraVolverMovil'), 'app/checkout/page.tsx: el pago no repite «Volver» en el celular')
// Un solo «volver» en el celular: la ruta completa (EncabezadoPagina enCelular) solo en la ficha del
// producto, que no pinta la barra; las demás páginas usan BarraVolverMovil (dueño, 2026-11-24: salían dos).
for (const rel of CON_BARRA.filter((r) => r !== 'app/productos/[id]/page.tsx')) {
  check(!/<EncabezadoPagina[^>]*\benCelular\b/.test(leer(rel)), `${rel}: con BarraVolverMovil no puede llevar EncabezadoPagina enCelular (salen dos «volver»)`)
}
check(/<BarraVolverMovil\s+soloRegistrar/.test(leer('app/productos/[id]/page.tsx')) && /enCelular/.test(leer('app/productos/[id]/page.tsx')), 'la ficha del producto: ruta completa en el celular y la barra solo registra')
// Celular como el computador pero pequeño (dueño, 2026-11-24): ← cuadrado de 32 px + destino, sin quedarse pegado.
{
  const barra = leer('components/site/volver/BarraVolverMovil.tsx')
  check(!/sticky/.test(barra), 'el «‹ Volver» del celular no se queda pegado al bajar')
  check(/h-8 w-8/.test(barra) && /estiloBotonVolver\(primaryColor\)/.test(barra), 'el «Volver» del celular es el ← cuadrado del computador en pequeño (32 px)')
}
const CON_BOTON = [
  'components/sections/product-detail/ProductDetailRenderer.tsx',
  'app/productos/[id]/page.tsx',
  'components/sections/category-detail/CategoryHeader.tsx',
  'components/sections/category-detail/CategoryDetailRenderer.tsx',
  'app/carrito/CartPageClient.tsx',
  'app/checkout/page.tsx',
  'components/site/cuenta/MenuMiCuenta.tsx',
  'app/checkout/bold/page.tsx',
]
for (const rel of CON_BOTON) check(/<(EncabezadoPagina|BotonVolver)\b/.test(leer(rel)), `${rel}: falta el ← de escritorio`)

// El pago: el encabezado va fuera del CheckoutWizard (archivo prohibido para este trabajo).
check(!leer('components/site/CheckoutWizard.tsx').includes('EncabezadoPagina'), 'el CheckoutWizard no se toca')
// El rastro va una sola vez, en el layout raíz.
check(leer('app/layout.tsx').includes('<RastroNavegacion'), 'el layout raíz lleva el rastro de la pestaña')
// Las migas salen de datos ya cargados: la ficha usa el árbol del contexto, sin consultas nuevas.
check(/caminoCategoria\(ctx\.categoriasTienda/.test(leer('app/productos/[id]/page.tsx')), 'las migas de la ficha salen de ctx.categoriasTienda')
check(!/from\(['"]categories['"]\)/.test(leer('lib/navegacion/volver.ts')), 'la regla no consulta la base')

if (problemas.length) {
  console.error(`verify-volver: ${problemas.length} de ${casos} comprobaciones fallaron`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`verify-volver: ${casos} comprobaciones OK`)
