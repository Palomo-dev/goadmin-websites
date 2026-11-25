/**
 * verify-boton-categorias.mjs — botón «Todas las categorías» del encabezado (Figma 2689:57377).
 *
 *   npm run verify:boton-categorias
 *
 * 1. Opción del editor: sin clave = encendido con «Todas las categorías»; `false` apaga; el texto se
 *    recorta y, vacío o de más de 40 caracteres, vuelve al de siempre.
 * 2. Qué lista: el mega menú del editor si tiene ítems; si no, las categorías cuando
 *    `show_categories_in_header` está encendido; apagado o sin nada, no hay botón.
 * 3. Celular y encabezado mínimo: encendido = las categorías de primeras y con el texto del botón;
 *    apagado = al final como «Categorías» (lo de antes).
 * 4. Texto del botón legible sobre el primario (blanco u oscuro según el contraste).
 * 5. Contrato: las claves nuevas están en la copia de la tienda (y la del ERP es idéntica, si existe).
 * 6. Los encabezados con barra lo usan; el «Categorías ⌄» de Mega solo queda con el botón apagado.
 * 7. Celular, encabezado mínimo y hoja de categorías: la misma función (sin copias del armado).
 * 9. Mega menú con categorías (reporte 2026-11-25: salían planas y sin ícono): `completarMenuMega`
 *    pone ícono, color e imagen reales; sin hijos a mano, las subcategorías por parent_id en el
 *    orden de la tienda; con hijos a mano, esos; inactivas o de otra sede, fuera; sin mega menú, el
 *    árbol de hoy. Todo desde el árbol que getOrgContext ya carga (ninguna consulta nueva).
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
register(pathToFileURL(join(ROOT, 'scripts/verify-pasarelas-bold-mp.cargador.mjs')).href, import.meta.url, {
  data: { root: ROOT, stub: pathToFileURL(join(ROOT, 'scripts/verify-pasarelas-bold-mp.efectos.mjs')).href },
})
const b = await import('../lib/website/botonCategorias.ts')

const problemas = []
let casos = 0
const check = (cond, msg) => { casos++; if (!cond) problemas.push(msg) }
const igual = (a, e, msg) => check(JSON.stringify(a) === JSON.stringify(e), `${msg}: esperado ${JSON.stringify(e)}, obtenido ${JSON.stringify(a)}`)

// 1. Opción
igual(b.opcionBotonCategorias(null), { activo: true, texto: 'Todas las categorías' }, 'sin ajustes: encendido')
igual(b.opcionBotonCategorias({}), { activo: true, texto: 'Todas las categorías' }, 'sin clave: encendido')
igual(b.opcionBotonCategorias({ header_categories_button: false }).activo, false, 'false apaga')
igual(b.opcionBotonCategorias({ header_categories_button: 'no' }).activo, true, 'basura = default (encendido)')
igual(b.opcionBotonCategorias({ header_categories_button_text: '  Departamentos  ' }).texto, 'Departamentos', 'texto recortado')
igual(b.opcionBotonCategorias({ header_categories_button_text: '   ' }).texto, 'Todas las categorías', 'texto vacío = el de siempre')
igual(b.opcionBotonCategorias({ header_categories_button_text: 'x'.repeat(41) }).texto, 'Todas las categorías', 'más de 40 = el de siempre')

// 2. Qué lista
const CATS = [
  { id: 1, name: 'Celulares', slug: 'celulares', icon: 'smartphone', color: '#2563EB', image_url: null, children: [{ id: 11, name: 'Gama alta', slug: 'gama-alta', icon: null, color: null, image_url: null, children: [] }] },
  { id: 2, name: 'Portátiles', slug: 'portatiles', icon: null, color: null, image_url: 'https://x/y.png', children: [] },
]
const ITEMS = [{ name: 'Ofertas', href: '/ofertas', icon: 'tag', children: [{ name: 'Hoy', href: '/ofertas/hoy' }] }]
const ruta = (p) => `/sede-norte${p}`
check(b.botonCategoriasBarra({}, CATS, null) === null, 'categorías sin show_categories_in_header: sin botón (como antes)')
const conCats = b.botonCategoriasBarra({ show_categories_in_header: true }, CATS, null, ruta)
igual(conCats?.entradas.map((e) => e.href), ['/sede-norte/categorias/celulares', '/sede-norte/categorias/portatiles'], 'categorías con la ruta de la sede, en su orden')
igual(conCats?.entradas[0].hijos, [{ clave: 'c11', nombre: 'Gama alta', href: '/sede-norte/categorias/gama-alta', icono: null }], 'subcategorías')
igual([conCats?.entradas[0].icono, conCats?.entradas[0].color, conCats?.entradas[1].imagen], ['smartphone', '#2563EB', 'https://x/y.png'], 'ícono, color e imagen de cada categoría')
const MEGA = { header_style: 'mega' }
const conMega = b.botonCategoriasBarra({ ...MEGA, show_categories_in_header: true }, CATS, ITEMS)
igual(conMega?.entradas.map((e) => [e.nombre, e.href, e.hijos.length]), [['Ofertas', '/ofertas', 1]], 'el mega menú del editor manda (como el «Categorías ⌄» de antes)')
igual(b.botonCategoriasBarra({ header_layout: 'mega', show_categories_in_header: true }, CATS, ITEMS)?.entradas[0].nombre, 'Ofertas', 'composición mega por header_layout: igual que SiteHeader')
igual(b.botonCategoriasBarra({ header_style: 'default', show_categories_in_header: true }, CATS, ITEMS)?.entradas.map((e) => e.nombre), ['Celulares', 'Portátiles'], 'otra composición con mega menú guardado: el árbol, como hoy (el mega menú es de la composición mega)')
check(b.botonCategoriasBarra({ ...MEGA, header_categories_button: false, show_categories_in_header: true }, CATS, ITEMS) === null, 'apagado: sin botón')
check(b.botonCategoriasBarra({ show_categories_in_header: true }, [], []) === null, 'sin nada que listar: sin botón')
igual(b.botonCategoriasBarra({ show_categories_in_header: true, header_categories_button_text: 'Departamentos' }, CATS, null)?.texto, 'Departamentos', 'texto propio')

// 3. Menú del celular
const NAV = [{ name: 'Inicio' }, { name: 'Contacto' }]
const CAT = { name: 'Categorías', href: '/categorias' }
igual(b.menuConCategorias(NAV, CAT, {}).map((i) => i.name), ['Todas las categorías', 'Inicio', 'Contacto'], 'encendido: de primeras con el texto')
igual(b.menuConCategorias(NAV, CAT, { header_categories_button_text: 'Departamentos' })[0].name, 'Departamentos', 'con el texto propio')
igual(b.menuConCategorias(NAV, CAT, { header_categories_button: false }).map((i) => i.name), ['Inicio', 'Contacto', 'Categorías'], 'apagado: al final como antes')
igual(b.menuConCategorias(NAV, null, {}).map((i) => i.name), ['Inicio', 'Contacto'], 'sin categorías: el menú tal cual')
check(b.menuConCategorias(NAV, CAT, {})[0].href === '/categorias', 'conserva el enlace y los hijos del ítem')

// 4. Contraste
igual(b.colorTextoSobre('#2254F8'), '#FFFFFF', 'azul: texto blanco')
igual(b.colorTextoSobre('#111827'), '#FFFFFF', 'oscuro: texto blanco')
igual(b.colorTextoSobre('#FACC15'), '#111827', 'amarillo: texto oscuro')
igual(b.colorTextoSobre('#fff'), '#111827', 'blanco corto: texto oscuro')
igual(b.colorTextoSobre('rgb(1,2,3)'), '#FFFFFF', 'otro formato: blanco')

// 5. Contrato
const tienda = readFileSync(join(ROOT, 'lib/website/v2/mapeoAjustes.ts'), 'utf8').replace(/\r\n/g, '\n')
check(tienda.includes("header_categories_button: { zona: 'header', porDefecto: true, regla: BOOL, nueva: true },"), 'interruptor en el contrato de la tienda')
check(tienda.includes("header_categories_button_text: { zona: 'header', porDefecto: null, regla: { tipo: 'texto', max: 40 }, nueva: true },"), 'texto en el contrato de la tienda')
const erp = join(ROOT, '..', 'CascadeProjects', 'go-admin-erp', 'src', 'lib', 'website', 'v2', 'mapeoAjustes.ts')
if (existsSync(erp)) check(readFileSync(erp, 'utf8').replace(/\r\n/g, '\n') === tienda, 'la copia del ERP es idéntica')

// 9. Mega menú con categorías: completarMenuMega + la misma fuente en todas partes
{
  // Árbol de la tienda como lo arma getMenuCategories: activas, con la regla de sede y los hijos ya
  // en orden (display_order, rank). La 4 (inactiva) y la 9 (de otra sede) no están.
  const ARBOL = [
    { id: 1, name: 'Celulares', slug: 'celulares', icon: 'smartphone', color: '#2563EB', image_url: 'https://x/cel.png', children: [
      { id: 12, name: 'Gama media', slug: 'gama-media', icon: 'cpu', color: null, image_url: null, children: [] },
      { id: 11, name: 'Gama alta', slug: 'gama-alta', icon: null, color: null, image_url: null, children: [] },
    ] },
    { id: 2, name: 'Portátiles', slug: 'portatiles', icon: null, color: '#D97706', image_url: null, children: [] },
    { id: 3, name: 'Hogar', slug: 'hogar', icon: 'home', color: null, image_url: null, children: [
      { id: 31, name: 'Cocina', slug: 'cocina', icon: null, color: null, image_url: null, children: [] },
    ] },
  ]
  // Mega menú como sale de menuItemToNavItem: categorías con categoriaId y sin ícono (V2 lo dejaba en null).
  const MENU = [
    { name: 'Celulares', href: '/categorias/celulares', categoriaId: 1 },
    { name: 'Mi hogar', href: '/categorias/hogar', categoriaId: 3, icon: 'sofa', children: [
      { name: 'Cocina', href: '/categorias/cocina', categoriaId: 31 },
      { name: 'Ofertas', href: '/ofertas' },
      { name: 'Baño', href: '/categorias/bano', categoriaId: 4 },
    ] },
    { name: 'Ofertas', href: '/ofertas' },
    { name: 'Descontinuados', href: '/categorias/viejos', categoriaId: 4 },
    { name: 'Otra sede', href: '/categorias/sede-sur', categoriaId: 9 },
    { name: 'Portátiles', href: '/categorias/portatiles', categoriaId: 2 },
  ]
  const r = b.completarMenuMega(MENU, ARBOL)
  igual(r.map((i) => i.name), ['Celulares', 'Mi hogar', 'Ofertas', 'Portátiles'], 'orden y nombres del editor; inactiva y de otra sede fuera')
  igual([r[0].icon, r[0].color, r[0].imagen], ['smartphone', '#2563EB', 'https://x/cel.png'], 'ícono, color e imagen reales de la categoría')
  igual(r[0].children?.map((h) => [h.name, h.href, h.icon ?? null]), [['Gama media', '/categorias/gama-media', 'cpu'], ['Gama alta', '/categorias/gama-alta', null]], 'sin hijos a mano: subcategorías por parent_id en el orden de la tienda')
  igual(r[1].children?.map((h) => h.name), ['Cocina', 'Ofertas'], 'con hijos a mano: esos, tal cual (sin la inactiva)')
  check(r[1].icon === 'sofa', 'un ícono propio del ítem (menú legacy) manda sobre el de la categoría')
  check(r[2].icon === undefined && r[2].children === undefined && r[2].color === undefined, 'un enlace que no es categoría queda igual')
  igual([r[3].icon ?? null, r[3].color, r[3].children], [null, '#D97706', undefined], 'categoría sin hijas ni ícono: su color, sin subcategorías')
  igual(b.completarMenuMega(MENU, []).map((i) => i.name), MENU.map((i) => i.name), 'árbol vacío (lectura fallida): el menú tal cual, como antes')
  check(MENU[0].icon === undefined && MENU[0].children === undefined, 'no muta el menú de entrada')

  // La misma fuente: botón, celular y hoja de categorías
  const ajustes = { header_style: 'mega', show_categories_in_header: false }
  const boton = b.botonCategoriasBarra(ajustes, ARBOL, r)
  igual(boton?.entradas.map((e) => [e.nombre, e.icono, e.color, e.imagen, e.hijos.length]), [
    ['Celulares', 'smartphone', '#2563EB', 'https://x/cel.png', 2], ['Mi hogar', 'sofa', null, null, 2], ['Ofertas', null, null, null, 0], ['Portátiles', null, '#D97706', null, 0],
  ], 'botón: filas con ícono, color, imagen y subcategorías')
  const movil = b.itemCategoriasMenu(ajustes, ARBOL, r)
  igual(movil?.children?.map((c) => [c.name, c.href, c.icon, (c.children ?? []).map((h) => h.name)]), boton?.entradas.map((e) => [e.nombre, e.href, e.icono, e.hijos.map((h) => h.nombre)]), 'celular: mismas filas, íconos y subcategorías que el botón')
  igual(b.entradasCategoriasCabecera(ajustes, ARBOL, r, undefined, { sinAjuste: true }), boton?.entradas, 'hoja de categorías: mismas filas que el botón')
  // Sin mega menú: el árbol de hoy, en todas partes
  const sinMega = { header_style: 'mega', show_categories_in_header: true }
  igual(b.botonCategoriasBarra(sinMega, ARBOL, null)?.entradas.map((e) => [e.nombre, e.hijos.map((h) => h.nombre)]), [['Celulares', ['Gama media', 'Gama alta']], ['Portátiles', []], ['Hogar', ['Cocina']]], 'sin menuMegaId: el árbol de categorías de hoy')
  igual(b.itemCategoriasMenu(sinMega, ARBOL, null)?.children?.[0], { name: 'Celulares', href: '/categorias/celulares', icon: 'smartphone', children: [{ name: 'Gama media', href: '/categorias/gama-media', icon: 'cpu' }, { name: 'Gama alta', href: '/categorias/gama-alta', icon: null }] }, 'celular sin mega menú: el ítem de siempre')
  check(b.itemCategoriasMenu({ show_categories_in_header: false }, ARBOL, null) === null, 'celular: con show_categories_in_header apagado y sin mega menú, sin ítem (como antes)')
  igual(b.entradasCategoriasCabecera({ show_categories_in_header: false }, ARBOL, null, undefined, { sinAjuste: true }).length, 3, 'hoja de categorías: el árbol aunque el ajuste esté apagado (como antes)')
}

// 10. El servidor completa el mega menú con el árbol que ya cargó (ninguna consulta nueva)
{
  const ctx = readFileSync(join(ROOT, 'lib/get-org-context.ts'), 'utf8')
  check(/completarMenuMega\(namedMegaMenu\.items\.map\(item => menuItemToNavItem\(item\)\), categoriasTienda\)/.test(ctx), 'getOrgContext completa el mega menú con categoriasTienda')
  check(/categoriaId: Number\(categoriaId\)/.test(ctx) && /item\.category_id \?\? item\.category\?\.id/.test(ctx), 'menuItemToNavItem marca los ítems de categoría con su id')
  check(/const categoriasTienda = await getMenuCategories\(organization\.id, branchId\)/.test(ctx), 'el árbol sale de getMenuCategories (cacheado, con la regla de sede)')
}

// 6. Encabezados
const fuente = (r) => readFileSync(join(ROOT, r), 'utf8')
for (const h of ['HeaderMega', 'HeaderClassic', 'HeaderCentered', 'HeaderSplit']) {
  const s = fuente(`components/site/header/${h}.tsx`)
  check(/botonCategoriasBarra\(/.test(s) && /<BotonTodasCategorias\b/.test(s), `${h} pinta el botón`)
  check(/botonCategoriasBarra\(settings as Record<string, unknown>, menuCategories, megaMenuItems, ruta\)/.test(s), `${h}: misma llamada (la composición decide si usa el mega menú)`)
}
check(/showCategories && !boton &&/.test(fuente('components/site/header/HeaderMega.tsx')), 'Mega: «Categorías ⌄» solo con el botón apagado')
for (const m of ['components/site/header/mobile/MobileDrawer.tsx', 'components/site/header/mobile/MobileFullscreen.tsx', 'components/site/header/HeaderMinimal.tsx']) {
  check(/menuConCategorias\(navItems, categoriesItem/.test(fuente(m)), `${m}: categorías de primeras con el botón`)
  check(/itemCategoriasMenu\(settings as Record<string, unknown>, menuCategories, megaMenuItems\)/.test(fuente(m)), `${m}: el ítem de categorías sale de itemCategoriasMenu`)
}
const comp = fuente('components/site/header/BotonTodasCategorias.tsx')
check(/role="menu"/.test(comp) && /aria-expanded=\{abierto\}/.test(comp) && /e\.key === 'Escape'/.test(comp), 'accesible: menú, aria-expanded y Escape')
check(/bg-white/.test(comp) && !/dark:/.test(comp), 'panel con colores propios, sin dark:')
check(/Ver todas las categorías/.test(comp), '«Ver todas las categorías» al final')
check(!/animate-in|fade-in/.test(comp), 'panel opaco desde el primer cuadro (sin desvanecerse)')

// 7. Subcategorías en el celular (parent_id): la padre se despliega dentro del menú
const sub = fuente('components/site/header/mobile/SubmenuCategoria.tsx')
check(/<details/.test(sub) && /Ver todo/.test(sub), 'SubmenuCategoria: acordeón con «Ver todo» y sus hijas')
for (const m of ['components/site/header/mobile/MobileDrawer.tsx', 'components/site/header/mobile/MobileFullscreen.tsx', 'components/site/header/HeaderMinimal.tsx']) {
  const s = fuente(m)
  check(!/menuCategories!?\.map\(/.test(s), `${m}: sin una copia propia del armado de categorías`)
  check(/child\.children && child\.children\.length > 0 \? \(\s*<SubmenuCategoria/.test(s), `${m}: la padre se despliega con SubmenuCategoria`)
}
const tabs = fuente('components/site/header/mobile/MobileTabs.tsx')
check(/entradas\.map\(\(cat\) => cat\.hijos\.length > 0 \? \(/.test(tabs), 'barra de pestañas: la hoja de categorías despliega las padres')
check(/entradasCategoriasCabecera\(settings as Record<string, unknown>, menuCategories, megaMenuItems, ruta, \{ sinAjuste: true \}\)/.test(tabs), 'hoja de categorías: la misma fuente que el botón')
check((tabs.match(/megaMenuItems=\{megaMenuItems\}/g) ?? []).length >= 3, 'pestañas y píldora pasan el mega menú a la hoja')
check(/megaMenuItems=\{megaMenuItems\}/.test(fuente('components/site/MenuInferior.tsx')), 'menú inferior «Categorías (hoja)»: la misma fuente')
check((fuente('components/site/OrganizationLayoutCliente.tsx').match(/megaMenuItems=\{megaMenu\}/g) ?? []).length >= 3, 'el layout pasa el mega menú (con el prefijo de la sede) al encabezado y al menú inferior')
const conf = fuente('components/site/header/mobile/HeaderMovilConfigurable.tsx')
check(/itemCategoriasMenu\(settings as Record<string, unknown>, menuCategories, megaMenuItems\)/.test(conf), 'encabezado configurable: la misma fuente')
check(/<ItemNav key=\{h\.href\} item=\{h\} onCerrar=\{onCerrar\} anidado \/>/.test(conf), 'encabezado configurable: las subcategorías se despliegan (ItemNav anidado)')

// 8. Buscador en una sola barra (Figma 2689:57377) con las opciones del editor
const cromo = fuente('components/site/header/BuscadorCromo.tsx')
check(/data-barra-unificada=""/.test(cromo), 'BuscadorCromo: barra unificada')
check(/backgroundColor: presentacion\.background \|\| '#FFFFFF'/.test(cromo) && /borderColor: presentacion\.borderColor/.test(cromo) && /RADIO\[presentacion\.radius\]/.test(cromo) && /maxWidth: presentacion\.width/.test(cromo), 'la barra respeta fondo, borde, esquinas y ancho del editor')
check(/const campo = compacta \? campoSuelto : unificada/.test(cromo), 'la «barra compacta» sigue como antes')
check(/enBarra: true/.test(cromo) && /cromo\?\.enBarra/.test(fuente('components/site/SearchBarInput.tsx')), 'el campo va sin borde propio dentro de la barra')

if (problemas.length) {
  console.error(`✗ ${problemas.length} de ${casos} comprobaciones fallaron:`)
  for (const p of problemas) console.error('  -', p)
  process.exit(1)
}
console.log(`✓ botón «Todas las categorías»: ${casos} comprobaciones`)
