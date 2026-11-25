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
 * 11. «Categorías en el menú» del celular (Figma 3290:101848, aprobado 2026-11-25): por defecto
 *    (`icono`) el ítem es idéntico al de hoy (sin `avatar` ni `estiloCategorias`); `redonda` y
 *    `tarjetas` suman el círculo; imagen → ícono → inicial (y si la imagen falla, el siguiente);
 *    el morado por defecto de la base (#6366F1) = sin color, también en el botón de computador;
 *    glifo blanco o casi negro; cada menú del celular usa la misma pieza (CategoriasMovil.tsx).
 * 12. «Contenido del botón» (Figma 3298:97349, opción B): `auto` (por defecto) = la regla de hoy en
 *    todas las composiciones; `menu` = el menú armado en todas; `inventory` = el árbol; aviso del
 *    editor cuando hay un menú guardado que no se ve.
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
const cc = await import('../lib/website/v2/categoriasCabecera.ts')
const { estiloDeHeaderLayout } = await import('../lib/website/v2/mapeoAjustes.ts')

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

// 11. «Categorías en el menú» del celular
{
  const ARBOL = [
    { id: 1, name: 'Jeans', slug: 'jeans', icon: 'shirt', color: '#1E3A8A', image_url: 'https://x/jeans.png', children: [
      { id: 11, name: 'Slim', slug: 'slim', icon: null, color: '#6366f1', image_url: null, children: [] },
    ] },
    { id: 2, name: 'Tenis', slug: 'tenis', icon: 'footprints', color: '#FACC15', image_url: null, children: [] },
    { id: 3, name: 'Chaquetas', slug: 'chaquetas', icon: null, color: '#7C3AED', image_url: null, children: [] },
    { id: 4, name: 'Novedades', slug: 'novedades', icon: 'sparkles', color: '#6366f1', image_url: null, children: [] },
    { id: 5, name: 'básicos', slug: 'basicos', icon: '  ', color: '#6366F1', image_url: '', children: [] },
  ]
  const base = { show_categories_in_header: true }
  igual(cc.estiloCategoriasMovil({}), 'icono', 'sin clave: «Lista con ícono» (hoy)')
  igual(cc.estiloCategoriasMovil(null), 'icono', 'sin ajustes: «Lista con ícono»')
  igual(cc.estiloCategoriasMovil({ mobile_categories_look: 'redonda' }), 'redonda', 'redonda')
  igual(cc.estiloCategoriasMovil({ mobile_categories_look: 'tarjetas' }), 'tarjetas', 'tarjetas')
  igual(cc.estiloCategoriasMovil({ mobile_categories_look: 'circulos' }), 'icono', 'basura = «Lista con ícono»')

  // Por defecto, el ítem es EXACTAMENTE el de hoy (mismo JSON que armaba itemCategoriasMenu antes).
  const deHoy = (cats) => ({ name: 'Categorías', href: '/categorias', children: cats.map((c) => ({ name: c.name, href: `/categorias/${c.slug}`, icon: c.icon ?? null, ...((c.children ?? []).length > 0 ? { children: c.children.map((h) => ({ name: h.name, href: `/categorias/${h.slug}`, icon: h.icon ?? null })) } : {}) })) })
  igual(b.itemCategoriasMenu(base, ARBOL, null), deHoy(ARBOL), 'por defecto: el ítem de hoy, idéntico')
  igual(b.itemCategoriasMenu({ ...base, mobile_categories_look: 'icono' }, ARBOL, null), deHoy(ARBOL), '«Lista con ícono» elegida: idéntico a hoy')
  check(!JSON.stringify(b.itemCategoriasMenu(base, ARBOL, null)).includes('avatar'), 'por defecto: ninguna fila trae círculo')

  const red = b.itemCategoriasMenu({ ...base, mobile_categories_look: 'redonda' }, ARBOL, null)
  igual(red?.estiloCategorias, 'redonda', 'redonda: el ítem lo dice')
  check(red?.children?.every((c) => c.avatar), 'redonda: cada categoría con su círculo')
  check(red?.children?.[0].children?.every((h) => !h.avatar), 'las hijas no llevan círculo (llevan el punto del padre)')
  igual(b.itemCategoriasMenu({ ...base, mobile_categories_look: 'tarjetas' }, ARBOL, null)?.estiloCategorias, 'tarjetas', 'tarjetas: el ítem lo dice')
  const sinAvatar = (it) => { const { avatar, estiloCategorias, ...resto } = it; return { ...resto, ...(resto.children ? { children: resto.children.map(sinAvatar) } : {}) } }
  igual(sinAvatar(red), deHoy(ARBOL), 'redonda: mismas filas, enlaces, íconos y subcategorías que hoy (solo se suma el círculo)')

  // Círculo: imagen → ícono sobre su color → inicial
  const [jeans, tenis, chaquetas, novedades, basicos] = red.children.map((c) => c.avatar)
  igual([jeans.imagen, jeans.icono, jeans.fondo, jeans.glifo], ['https://x/jeans.png', 'shirt', '#1E3A8A', '#FFFFFF'], 'con imagen: la imagen (ícono y color quedan de respaldo)')
  igual([tenis.imagen, tenis.icono, tenis.fondo, tenis.glifo], [null, 'footprints', '#FACC15', '#111827'], 'amarillo sin imagen: ícono casi negro')
  igual([chaquetas.icono, chaquetas.fondo, chaquetas.glifo, chaquetas.inicial], [null, '#7C3AED', '#FFFFFF', 'C'], 'sin imagen ni ícono: la inicial en blanco sobre su color')
  igual([novedades.fondo, novedades.glifo, novedades.icono], [null, null, 'sparkles'], 'morado por defecto: círculo neutro con el ícono en el color del menú')
  igual([basicos.imagen, basicos.icono, basicos.fondo, basicos.inicial], [null, null, null, 'B'], 'ícono e imagen vacíos + color por defecto: inicial sobre neutro')
  igual(cc.avatarCategoria({ nombre: '' }).inicial, '·', 'sin nombre: un punto')
  igual(cc.avatarCategoria({ nombre: 'élite' }).inicial, 'É', 'inicial con tilde en mayúscula')
  const cm = fuente('components/site/header/mobile/CategoriasMovil.tsx')
  check(/avatar\.imagen && avatar\.imagen !== rota \? 'imagen' : avatar\.icono \? 'icono' : 'inicial'/.test(cm), 'si la imagen no carga: el ícono y luego la inicial')
  check(/onError=\{marcarRota\}/.test(cm) && /alt=""/.test(cm) && /aria-hidden="true"/.test(cm), 'imagen decorativa (alt vacío) que cae al siguiente si falla')

  // Color por defecto de la base = sin color (UNA función: colorCategoriaPropio)
  igual(cc.COLOR_CATEGORIA_POR_DEFECTO, '#6366F1', 'el default de categories.color (verificado con SELECT)')
  for (const v of ['#6366F1', '#6366f1', ' #6366F1 ', null, undefined, '', 'rgb(99,102,241)', 'morado', 42]) {
    igual(cc.colorCategoriaPropio(v), null, `sin color propio: ${JSON.stringify(v)}`)
  }
  igual(cc.colorCategoriaPropio('#DC2626'), '#DC2626', 'un color elegido se respeta')
  igual(cc.colorCategoriaPropio('#66f'), '#66f', '#66f (#6666FF) no es el morado por defecto')
  check(b.colorCategoriaPropio === cc.colorCategoriaPropio && b.colorTextoSobre === cc.colorTextoSobre, 'la tienda reexporta las funciones compartidas (sin copias)')
  check(/const color = colorCategoriaPropio\(e\.color\) \|\| primaryColor;/.test(fuente('components/site/header/BotonTodasCategorias.tsx')), 'botón de computador: el morado por defecto va con el color de la tienda, como las categorías sin color')

  // Contraste
  igual(cc.colorTextoSobre('#0F172A'), '#FFFFFF', 'fondo oscuro: glifo blanco')
  igual(cc.colorTextoSobre('#FFFFFF'), '#111827', 'fondo blanco: glifo casi negro')
  check(cm.includes('const ARO = `0 0 0 1px color-mix(in srgb, ${TEXTO} 16%, transparent)`;') && /boxShadow: ARO/.test(cm), 'aro del color del texto del menú: el círculo no se pierde en el fondo')
  check(/color: avatar\.glifo \?\? TEXTO/.test(cm) && /backgroundColor: avatar\.fondo \?\? NEUTRO/.test(cm), 'sin color: círculo neutro y glifo del color del menú')

  // Accesibilidad de la pieza
  check(/aria-expanded=\{abierta\}/.test(cm) && /aria-controls=\{id\}/.test(cm) && /hidden=\{!abierta\}/.test(cm), 'desplegable: botón con aria-expanded y aria-controls')
  check((cm.match(/min-h-11/g) ?? []).length >= 5, 'objetivos táctiles de 44 px')
  check(/focus-visible:ring-2/.test(cm), 'foco visible')
  check(/Ver todo/.test(cm) && /<Punto color=\{avatar\.fondo\} \/>/.test(cm), 'subcategorías con «Ver todo» y el punto del color del padre')
  check(/Volver a las categorías/.test(cm) && /data-tarjeta-categoria/.test(cm) && /\.focus\(\)/.test(cm), 'tarjetas: segundo nivel con volver y el foco de regreso a la tarjeta')

  // Cada menú del celular usa la misma pieza solo con el estilo elegido
  for (const m of ['components/site/header/mobile/MobileDrawer.tsx', 'components/site/header/mobile/MobileFullscreen.tsx', 'components/site/header/HeaderMinimal.tsx']) {
    const s2 = fuente(m)
    check(/child\.avatar \? \(\s*(\/\/[^\n]*\s*)?<FilaCategoriaMovil key=\{j\} item=\{child\} onNavigate=\{onNavigate\} \/>/.test(s2), `${m}: círculo solo si la fila lo trae; si no, la fila de siempre`)
  }
  const fs2 = fuente('components/site/header/mobile/MobileFullscreen.tsx')
  check(/item\.estiloCategorias === 'tarjetas' \?/.test(fs2) && /<CuadriculaCategorias items=\{item\.children\}/.test(fs2), 'pantalla completa: cuadrícula con «Tarjetas»')
  check(/if \(item\.avatar\) return <FilaCategoriaMovil item=\{item\} onNavigate=\{onCerrar\} \/>/.test(fuente('components/site/header/mobile/HeaderMovilConfigurable.tsx')), 'panel configurable: lista redonda (también con «Tarjetas»)')
  const tabs2 = fuente('components/site/header/mobile/MobileTabs.tsx')
  check(/const estilo = estiloCategoriasMovil\(settings as Record<string, unknown>\)/.test(tabs2) && /estilo !== 'icono' && entradas\.length > 0 \? itemsCategoriaMovil\(entradas, true\) : null/.test(tabs2), 'hoja de categorías: con «Lista con ícono», la hoja de siempre')
  check(/<CuadriculaCategorias items=\{conAvatar\}[^>]*abierta=\{nivel\} onAbrir=\{setNivel\} conVolver=\{false\} \/>/.test(tabs2), 'hoja con «Tarjetas»: segundo nivel dentro de la hoja («‹ Nombre» arriba)')
  check(/<ListaCategoriasMovil items=\{conAvatar\}/.test(tabs2), 'hoja con «Lista con imagen redonda»')
}

// 12. «Contenido del botón»
{
  const CATS2 = [{ id: 1, name: 'Jeans', slug: 'jeans', icon: null, color: null, image_url: null, children: [] }]
  const MENU = [{ name: 'Hombre', href: '/hombre', children: [{ name: 'Jeans', href: '/categorias/jeans' }] }, { name: 'Guía de tallas', href: '/guia' }]
  const reglaDeHoy = (a) => (estiloDeHeaderLayout(a?.header_layout) || a?.header_style || 'default') === 'mega'
  igual(cc.fuenteBotonCategorias({}), 'auto', 'sin clave: Automático')
  igual(cc.fuenteBotonCategorias({ header_categories_source: 'todo' }), 'auto', 'basura: Automático')
  const composiciones = [{}, ...['default', 'centered', 'split', 'minimal', 'mega', 'pill', 'commerce', 'transparent'].map((c) => ({ header_style: c })), { header_layout: 'clasico' }, { header_layout: 'logo_centro', header_style: 'mega' }, { header_layout: 'mega' }]
  for (const comp of composiciones) {
    const a = { ...comp, show_categories_in_header: true }
    const n = JSON.stringify(comp)
    igual(b.usaMenuMega(a), reglaDeHoy(a), `Automático = regla de hoy (${n})`)
    igual(b.usaMenuMega({ ...a, header_categories_source: 'auto' }), reglaDeHoy(a), `«auto» explícito = regla de hoy (${n})`)
    const hoy = reglaDeHoy(a) ? ['Hombre', 'Guía de tallas'] : ['Jeans']
    igual(b.botonCategoriasBarra(a, CATS2, MENU)?.entradas.map((e) => e.nombre), hoy, `botón por defecto idéntico a hoy (${n})`)
    igual(b.itemCategoriasMenu(a, CATS2, MENU)?.children?.map((c) => c.name), hoy, `celular por defecto idéntico a hoy (${n})`)
    igual(b.entradasCategoriasCabecera(a, CATS2, MENU, undefined, { sinAjuste: true }).map((e) => e.nombre), hoy, `hoja por defecto idéntica a hoy (${n})`)
    igual(b.botonCategoriasBarra({ ...a, header_categories_source: 'menu' }, CATS2, MENU)?.entradas.map((e) => e.nombre), ['Hombre', 'Guía de tallas'], `«Menú armado»: el menú en todas (${n})`)
    igual(b.itemCategoriasMenu({ ...a, header_categories_source: 'menu' }, CATS2, MENU)?.children?.map((c) => c.name), ['Hombre', 'Guía de tallas'], `«Menú armado»: también el celular (${n})`)
    igual(b.botonCategoriasBarra({ ...a, header_categories_source: 'inventory' }, CATS2, MENU)?.entradas.map((e) => e.nombre), ['Jeans'], `«Categorías del inventario»: el árbol (${n})`)
    igual(b.botonCategoriasBarra({ ...a, header_categories_source: 'menu' }, CATS2, null)?.entradas.map((e) => e.nombre), ['Jeans'], `«Menú armado» sin menú: el árbol, como hoy (${n})`)
  }
  // Aviso del editor: menú guardado que no se ve
  check(cc.menuArmadoSinUsar({ header_style: 'default' }, true), 'Classic + Automático + menú guardado: aviso')
  check(!cc.menuArmadoSinUsar({ header_style: 'mega' }, true), 'Mega: sin aviso (se ve)')
  check(!cc.menuArmadoSinUsar({ header_style: 'default', header_categories_source: 'menu' }, true), '«Menú armado» elegido: sin aviso')
  check(!cc.menuArmadoSinUsar({ header_style: 'default', header_categories_source: 'inventory' }, true), '«Inventario» elegido a propósito: sin aviso')
  check(!cc.menuArmadoSinUsar({ header_style: 'default' }, false), 'sin menú guardado: sin aviso')

  // Contrato: claves nuevas con el valor de hoy por defecto; la copia del ERP idéntica
  const contrato = readFileSync(join(ROOT, 'lib/website/v2/mapeoAjustes.ts'), 'utf8').replace(/\r\n/g, '\n')
  check(contrato.includes("header_categories_source: { zona: 'header', porDefecto: 'auto', regla: { tipo: 'opcion', valores: FUENTES_BOTON_CATEGORIAS }, nueva: true },"), 'contrato: header_categories_source (auto)')
  check(contrato.includes("mobile_categories_look: { zona: 'header', porDefecto: 'icono', regla: { tipo: 'opcion', valores: ESTILOS_CATEGORIAS_MOVIL }, nueva: true },"), 'contrato: mobile_categories_look (icono)')
  const erpCc = join(ROOT, '..', 'CascadeProjects', 'go-admin-erp', 'src', 'lib', 'website', 'v2', 'categoriasCabecera.ts')
  if (existsSync(erpCc)) check(readFileSync(erpCc, 'utf8').replace(/\r\n/g, '\n') === readFileSync(join(ROOT, 'lib/website/v2/categoriasCabecera.ts'), 'utf8').replace(/\r\n/g, '\n'), 'categoriasCabecera.ts: la copia del ERP es idéntica')
  check(/'lib\/website\/v2\/categoriasCabecera\.ts', 'src\/lib\/website\/v2\/categoriasCabecera\.ts'/.test(fuente('scripts/verify-copias-erp.mjs')), 'categoriasCabecera.ts en verify-copias')
}

if (problemas.length) {
  console.error(`✗ ${problemas.length} de ${casos} comprobaciones fallaron:`)
  for (const p of problemas) console.error('  -', p)
  process.exit(1)
}
console.log(`✓ botón «Todas las categorías»: ${casos} comprobaciones`)
