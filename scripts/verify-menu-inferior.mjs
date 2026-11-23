/**
 * verify-menu-inferior.mjs — el menú inferior v2: sin `v: 2` la tienda no cambia y cada plantilla
 * se lee como sus botones de hoy.
 *
 *   node --disable-warning=ExperimentalWarning scripts/verify-menu-inferior.mjs
 */
import { leerMenuInferior, menuInicial, aGuardar, destinoBoton, botonesVisibles, telDe, whatsappDe, barraGuardada } from '../lib/website/menuInferior.ts'
import { normalizarOpcionShell } from '../lib/website/v2/mapeoAjustes.ts'

const problemas = []
let casos = 0
const check = (c, m) => { casos++; if (!c) problemas.push(m) }
const D = { llamar: 'tel:+5760000000', whatsapp: 'https://wa.me/570000000000?text=Hola', comoLlegar: 'https://maps/x', reservar: '/reservas', pedir: '/productos' }

// Sin v2 nada cambia.
for (const s of [null, {}, { mobile_menu_style: 'tabs' }, { mobile_bottom_bar: ['whatsapp', 'llamar'] }, { mobile_header: { bottom_nav: { enabled: true, items: [] } } }, { mobile_header: { icons: { style: 'circle' } } }]) {
  check(leerMenuInferior(s) === null, `sin v2 no hay menú nuevo: ${JSON.stringify(s)}`)
}
// Pestañas (333, 339, 345, 346, 347): las 5 de MobileTabs, aunque haya lista oculta.
const tabs = menuInicial({ mobile_menu_style: 'tabs', mobile_bottom_bar: ['whatsapp', 'llamar', 'como_llegar'] })
check(tabs.fuente === 'tabs' && tabs.menu.variant === 'tabs' && tabs.menu.enabled, 'tabs se lee como pestañas encendidas')
check(tabs.menu.items.map((b) => b.action).join() === 'home,categories_modal,search,cart,account', 'las 5 pestañas en orden')
check(destinoBoton(tabs.menu.items[4], D)?.href === '/auth', 'Cuenta lleva a /auth como MobileTabs')
// Acciones (335, 349, 125).
const acc = menuInicial({ mobile_menu_style: 'fullscreen', mobile_bottom_bar: ['whatsapp', 'llamar', 'como_llegar'] })
check(acc.fuente === 'acciones' && acc.menu.variant === 'actions', 'la lista se lee como botones de acción')
check(acc.menu.items.map((b) => b.action).join() === 'whatsapp,call,location', 'mismo orden que la barra')
check(botonesVisibles(acc.menu, { ...D, comoLlegar: null }).length === 2, 'sin dirección no sale Cómo llegar (como hoy)')
// Restaurante auto.
check(menuInicial({}, { restaurante: true }).fuente === 'restaurante', 'restaurante auto')
check(menuInicial({ mobile_bottom_bar: 'ninguna' }, { restaurante: true }).fuente === 'ninguna', 'restaurante sin barra')
// v1 (borrador 134).
const v1 = menuInicial({ mobile_header: { bottom_nav: { enabled: false, items: [{ id: 'home', kind: 'home', label: 'Inicio', icon: 'home', show_label: true, action: 'link', href: '/' }, { kind: 'search', action: 'search' }, { kind: 'cart', action: 'cart' }, { kind: 'custom', label: 'Blog', href: '/blog' }] } } })
check(v1.fuente === 'v1' && !v1.menu.enabled && v1.menu.items.length === 4, 'v1 apagado se lee')
check(v1.menu.items[3].action === 'page' && v1.menu.items[3].target === '/blog', 'v1 custom → página')
// Ida y vuelta.
const guardado = aGuardar({ ...acc.menu, items: [...acc.menu.items, { id: 'x', action: 'page', label: 'Nosotros', icon: 'link', visible: false, target: '/nosotros' }] })
const leido = leerMenuInferior({ mobile_header: { bottom_nav: guardado } })
check(leido && leido.items.length === 4 && leido.items[3].visible === false, 'ida y vuelta con oculto')
check(leerMenuInferior({ mobile_header: { bottom_nav: { ...guardado, enabled: false } } })?.items.length === 4, 'apagar no borra botones')
check(aGuardar({ v: 2, enabled: true, variant: 'actions', items: Array.from({ length: 6 }, (_, i) => ({ id: `b${i}`, action: 'home', label: 'x', icon: 'home', visible: true })), style: { labels: 'always' } }).items.length === 4, 'máximo 4 en acciones')
// Destinos.
check(telDe('300 000 0000') === 'tel:+573000000000', 'teléfono de 10 dígitos con +57')
check(whatsappDe('300 000 0000', 'Hola') === 'https://wa.me/573000000000?text=Hola', 'WhatsApp escrito con mensaje')
check(destinoBoton({ id: 'w', action: 'whatsapp', label: 'W', icon: 'whatsapp', visible: true, message: 'Quiero info' }, D)?.href === 'https://wa.me/570000000000?text=Quiero%20info', 'mensaje propio reemplaza el saludo')
check(destinoBoton({ id: 'c', action: 'call', label: 'L', icon: 'phone', visible: true }, { ...D, llamar: null }) === null, 'sin teléfono no hay Llamar')
check(destinoBoton({ id: 'p', action: 'page', label: 'P', icon: 'link', visible: true, target: 'nosotros' }, D) === null, 'página sin / no sale')
check(destinoBoton({ id: 'u', action: 'url', label: 'U', icon: 'link', visible: true, target: 'https://x.co' }, D)?.tipo === 'externo', 'enlace externo')
check(destinoBoton({ id: 's', action: 'search', label: 'B', icon: 'search', visible: true }, D)?.evento === 'search', 'buscar abre el panel')

// Columna legacy en texto: el primer guardado de v2 da la barra de hoy (normalizarOpcionShell).
const txt1 = menuInicial({ mobile_bottom_bar: 'reservar' })
check(txt1.fuente === 'acciones' && txt1.menu.items.map((b) => b.action).join() === 'booking', '«reservar» (texto) → un botón Reservar')
const txt2 = menuInicial({ mobile_bottom_bar: 'whatsapp,llamar' })
check(txt2.fuente === 'acciones' && txt2.menu.items.map((b) => b.action).join() === 'whatsapp,call', '«whatsapp,llamar» (texto) → WhatsApp y Llamar')
check(menuInicial({ mobile_bottom_bar: 'whatsapp,llamar' }, { restaurante: true }).fuente === 'acciones', 'texto en restaurante: la lista manda')
check(menuInicial({ mobile_bottom_bar: 'xx,llamar' }, { restaurante: true }).fuente === 'restaurante', 'lista inválida = auto, como la tienda')
for (const v of [undefined, null, 'auto', 'ninguna', 'reservar', 'whatsapp,llamar', ' llamar , como_llegar ', 'xx', 'llamar,llamar', 'a,b,c,d,e', '', [], ['pedir'], ['pedir', 'x'], ['pedir', 'reservar', 'llamar', 'whatsapp', 'agendar'], 42]) {
  check(JSON.stringify(barraGuardada(v)) === JSON.stringify(normalizarOpcionShell('mobile_bottom_bar', v)), `barraGuardada = normalizarOpcionShell para ${JSON.stringify(v)}`)
}
check(telDe('573000000000') === 'tel:+573000000000', '12 dígitos con 57 → tel:+57…')
check(telDe('+57 300 000 0000') === 'tel:+573000000000', 'con + se respeta')

// Píldora flotante (2026-11-07): variante y estilo nuevos del contrato; las de siempre no cambian.
const BOTONES6 = Array.from({ length: 6 }, (_, i) => ({ id: `f${i}`, action: 'home', label: `B${i}`, icon: 'home', visible: true }))
const flotante = leerMenuInferior({ mobile_header: { bottom_nav: { v: 2, enabled: true, variant: 'floating', items: BOTONES6, style: { labels: 'always', glass: false, offset: 24, width: 'full', indicator: 'dot', centerId: 'f2' } } } })
check(flotante?.variant === 'floating', 'floating se lee como variante')
check(flotante?.style.glass === false && flotante.style.offset === 24 && flotante.style.width === 'full' && flotante.style.indicator === 'dot', 'floating: vidrio, separación, ancho e indicador')
check(flotante?.style.centerId === 'f2', 'floating: botón destacado')
check(botonesVisibles(flotante, D).length === 5, 'floating: máximo 5 botones')
const flotanteBasura = leerMenuInferior({ mobile_header: { bottom_nav: { v: 2, enabled: true, variant: 'floating', items: BOTONES6.slice(0, 2), style: { labels: 'never', glass: 'si', offset: 40, width: 'ancho', indicator: 'raya' } } } })
check(flotanteBasura && !('glass' in flotanteBasura.style) && !('offset' in flotanteBasura.style) && !('width' in flotanteBasura.style) && !('indicator' in flotanteBasura.style), 'floating: valores fuera del contrato = ausentes (vidrio, 16, contenido, relleno)')
const idaFlotante = leerMenuInferior({ mobile_header: { bottom_nav: aGuardar(flotante) } })
check(JSON.stringify(idaFlotante) === JSON.stringify(flotante), 'floating: ida y vuelta')
const tabsSinEstilo = leerMenuInferior({ mobile_header: { bottom_nav: { v: 2, enabled: true, variant: 'tabs', items: BOTONES6.slice(0, 3), style: { labels: 'always' } } } })
check(tabsSinEstilo && Object.keys(tabsSinEstilo.style).join() === 'labels', 'tabs sin claves nuevas: el estilo de siempre')
check(!('glass' in aGuardar(tabsSinEstilo).style), 'tabs: aGuardar no escribe claves de la píldora')
const { readFileSync } = await import('node:fs')
const fuenteMenu = readFileSync(new URL('../components/site/MenuInferior.tsx', import.meta.url), 'utf8')
check(fuenteMenu.includes("menu.variant === 'floating'") && fuenteMenu.includes("aparte ? 'isla' : 'flotante'"), 'MenuInferior pinta la píldora flotante')
check(/env\(safe-area-inset-bottom\)/.test(fuenteMenu.slice(fuenteMenu.indexOf("menu.variant === 'floating' || menu.variant === 'split') {"))), 'floating respeta el área segura de abajo')

// Favoritos (2026-11-23): acción nueva con el corazón; abre el panel o /favoritos como la cabecera.
const { ACCIONES_MENU, DEFECTO_ACCION } = await import('../lib/website/menuInferior.ts')
check(ACCIONES_MENU.includes('favorites') && ACCIONES_MENU.length === 18, 'favorites es una de las 18 acciones')
check(DEFECTO_ACCION.favorites.label === 'Favoritos' && DEFECTO_ACCION.favorites.icon === 'heart', 'Favoritos con el corazón')
const fav = { id: 'fav', action: 'favorites', label: 'Favoritos', icon: 'heart', visible: true }
check(destinoBoton(fav, D)?.tipo === 'evento' && destinoBoton(fav, D)?.evento === 'favorites', 'sin header_favoritos: abre el panel')
check(destinoBoton(fav, { ...D, favoritos: 'panel' })?.evento === 'favorites', 'alTocar panel: abre el panel')
check(destinoBoton(fav, { ...D, favoritos: 'pagina' })?.href === '/favoritos', 'alTocar pagina: va a /favoritos')
const conFav = leerMenuInferior({ mobile_header: { bottom_nav: { v: 2, enabled: true, variant: 'tabs', items: [fav], style: { labels: 'always' } } } })
check(conFav?.items[0]?.action === 'favorites' && JSON.stringify(leerMenuInferior({ mobile_header: { bottom_nav: aGuardar(conFav) } })) === JSON.stringify(conFav), 'favorites: se lee y hace ida y vuelta')
check(fuenteMenu.includes("d.evento === 'favorites') abrirPanelFavoritos()"), 'MenuInferior abre el panel de favoritos')
// 2026-11-23: el contador es el de la cabecera con número, punto u oculto (InsigniaContador).
check(fuenteMenu.includes('favoritos: favoritos.alTocar') && fuenteMenu.includes('<InsigniaContador'), 'MenuInferior usa header_favoritos.alTocar y el contador de la cabecera')
check(/function ConFavoritos[\s\S]*?useFavoritos\(\)/.test(fuenteMenu) && !fuenteMenu.slice(fuenteMenu.indexOf('export function MenuInferior(')).includes('useFavoritos()'), 'el almacén de favoritos solo se lee con el botón Favoritos')
const fuenteCabecera = readFileSync(new URL('../components/site/favoritos/AccesoFavoritosCabecera.tsx', import.meta.url), 'utf8')
check(fuenteCabecera.includes('export function ContadorFavoritos') && fuenteCabecera.includes('<ContadorFavoritos primaryColor={primaryColor} />'), 'el corazón de la cabecera y el menú comparten el contador')

// ─── Propuestas de mejora (2026-11-23, Figma 2836:69391) ─────────────────────────────────────
const M = await import('../lib/website/menuInferior.ts')
const base5 = [
  { id: 'a', action: 'home', label: 'Inicio', icon: 'home', visible: true },
  { id: 'b', action: 'categories_modal', label: 'Categorías', icon: 'grid', visible: true },
  { id: 'c', action: 'search', label: 'Buscar', icon: 'search', visible: true },
  { id: 'd', action: 'cart', label: 'Carrito', icon: 'bag', visible: true },
  { id: 'e', action: 'account', label: 'Cuenta', icon: 'user', visible: true },
]
const leer = (variant, style, items = base5) => M.leerMenuInferior({ mobile_header: { bottom_nav: { v: 2, enabled: true, variant, items, style } } })
// Sin claves: lo de hoy.
const hoyTabs = leer('tabs', { labels: 'always' })
check(Object.keys(hoyTabs.style).join() === 'labels', 'sin claves nuevas: el estilo de siempre')
check(M.indicadorMenu(hoyTabs) === 'none' && M.efectoActivoMenu(hoyTabs) === null, 'Pestañas sin marca del activo (hoy)')
check(M.efectoActivoMenu(leer('floating', { labels: 'always' })) === 'pill', 'Píldora flotante: relleno (hoy)')
check(M.efectoActivoMenu(leer('floating', { labels: 'always', indicator: 'dot' })) === 'dot' && M.efectoActivoMenu(leer('floating', { labels: 'always', indicator: 'line' })) === 'underline', 'punto y línea de hoy')
check(M.efectoActivoMenu(leer('actions', { labels: 'always' })) === null, 'Acciones: sin marca del activo')
check(M.temaMenu(hoyTabs) === 'header' && M.temaMenu(leer('floating', { labels: 'always' })) === 'light' && M.temaMenu(leer('actions', { labels: 'always' })) === 'light', 'colores de cada estilo (hoy)')
check(M.contadorMenu(hoyTabs, 'cart') === 'number' && M.contadorMenu(leer('actions', { labels: 'always' }), 'cart') === 'hidden', 'carrito con número; en Acciones sin contador (hoy)')
check(M.contadorMenu(hoyTabs, 'favorites') === 'dot', 'Favoritos con punto por defecto')
check(M.fichaMenu(hoyTabs) === 'hide', 'ficha: se oculta por defecto (F1)')
check(M.repetidosArriba(hoyTabs, '/').size === 0, '«No repetir arriba» apagado por defecto')
check(JSON.stringify(M.aGuardar(hoyTabs).style) === '{"labels":"always"}', 'aGuardar sin claves nuevas no escribe nada más')
// Variantes nuevas.
check(M.VARIANTES_MENU.join() === 'tabs,actions,floating,icons,split', 'variantes: suman icons y split')
check(leer('icons', { labels: 'always' }).variant === 'icons' && M.efectoActivoMenu(leer('icons', { labels: 'always' })) === 'label', 'Solo íconos: etiqueta del activo')
check(leer('icons', { labels: 'always' }, BOTONES6).items.length === 5 && leer('split', { labels: 'always' }, BOTONES6).items.length === 5, 'máximo 5 en icons y split')
const isla = leer('split', { labels: 'always' })
check(M.idBotonAparte(isla, base5.map((b) => b.id)) === 'd', 'Isla: el Carrito sale aparte por defecto')
check(M.idBotonAparte(leer('split', { labels: 'always', splitId: 'c' }), base5.map((b) => b.id)) === 'c', 'Isla: botón aparte elegido')
check(M.idBotonAparte(isla, ['a', 'b', 'c']) === 'c', 'Isla sin carrito: el último')
check(M.idBotonAparte(hoyTabs, ['a', 'd']) === null, 'solo la Isla tiene botón aparte')
check(!('splitId' in leer('split', { labels: 'always', splitId: 'zz' }).style), 'splitId que no existe = ausente')
// Cada clave: se lee, vuelve igual y la basura no pasa.
const TODO = { labels: 'always', indicator: 'slide', centerId: 'd', centerShape: 'notch', theme: 'custom', background: '#111827', badges: { cart: 'dot', favorites: 'number' }, scroll: 'hide', pages: { product: 'stack' }, dedupeHeader: true, activeEffect: 'glow', pressEffect: 'ripple', fxSpeed: 'slow' }
const todo = leer('tabs', TODO)
const ordenado = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).sort(([x], [y]) => x.localeCompare(y))))
check(ordenado(todo.style) === ordenado(TODO), 'todas las claves nuevas se leen')
check(JSON.stringify(M.leerMenuInferior({ mobile_header: { bottom_nav: M.aGuardar(todo) } })) === JSON.stringify(todo), 'todas las claves: ida y vuelta')
const BASURA = { labels: 'always', indicator: 'raya', centerShape: 'estrella', theme: 'neon', badges: { cart: 'grande', favorites: 3 }, scroll: 'nunca', pages: { product: 'flotar' }, dedupeHeader: 'si', activeEffect: 'fuego', pressEffect: 'saltar', fxSpeed: 'turbo', splitId: 7 }
check(JSON.stringify(leer('tabs', BASURA).style) === '{"labels":"always"}', 'valores fuera del contrato = ausentes (lo de hoy)')
check(!('dedupeHeader' in leer('tabs', { labels: 'always', dedupeHeader: false }).style), 'dedupeHeader false = sin la clave')
check(M.ICONOS_MENU.includes('store') && M.ICONOS_MENU.includes('gift') && M.ICONOS_MENU.length === 25, 'dibujos nuevos: tienda, lista, canasta, en círculo, regalo')
// Contadores.
check(JSON.stringify(M.pintaContador(0, 'number')) === 'null' && JSON.stringify(M.pintaContador(3, 'hidden')) === 'null', 'sin unidades u oculto: nada')
check(M.pintaContador(3, 'dot').tipo === 'punto' && M.pintaContador(150, 'number').texto === '99+', 'punto y «99+»')
// Páginas especiales (todas las tiendas).
for (const r of ['/checkout', '/checkout/confirmacion/12', '/checkout/resultado?x=1', '/carrito', '/pedido/abc']) check(M.paginaMenu(r) === 'sin-menu', `${r}: sin menú`)
for (const r of ['/productos/12', '/productos/12?v=3']) check(M.paginaMenu(r) === 'ficha', `${r}: ficha`)
for (const r of ['/', '/productos', '/categorias/x', '/checkouts', '/carritos', '/mi-cuenta']) check(M.paginaMenu(r) === 'normal', `${r}: normal`)
check(M.fichaMenu(leer('tabs', { labels: 'always', pages: { product: 'stack' } })) === 'stack' && M.fichaMenu(null) === 'hide', 'Apilar se elige; sin menú v2, ocultar')
// «No repetir arriba».
const dedupe = leer('tabs', { labels: 'always', dedupeHeader: true })
check([...M.repetidosArriba(dedupe, '/')].sort().join() === 'account,cart,search', 'No repetir: carrito, cuenta y buscar')
check(M.repetidosArriba(dedupe, '/carrito').size === 0 && M.repetidosArriba(dedupe, '/productos/3').size === 0, 'No repetir: no en checkout, carrito ni ficha (ahí el menú no siempre está)')
check(M.repetidosArriba({ ...dedupe, enabled: false }, '/').size === 0, 'No repetir: con el menú apagado, nada')
check(M.repetidosArriba(leer('tabs', { labels: 'always', dedupeHeader: true }, base5.map((b) => (b.id === 'd' ? { ...b, visible: false } : b))), '/').has('cart') === false, 'No repetir: un botón oculto sigue arriba')
check(M.repetidosArriba(leer('actions', { labels: 'always', dedupeHeader: true }, [base5[3]]), '/mi-cuenta').size === 0, 'No repetir: Acciones no sale en la cuenta, la cabecera conserva el carrito')

if (problemas.length) { console.error(`verify-menu-inferior: ${problemas.length} de ${casos} fallan`); for (const p of problemas) console.error(' -', p); process.exit(1) }
console.log(`verify-menu-inferior: ${casos} casos OK`)
