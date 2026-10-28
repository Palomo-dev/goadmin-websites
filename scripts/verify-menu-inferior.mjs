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

if (problemas.length) { console.error(`verify-menu-inferior: ${problemas.length} de ${casos} fallan`); for (const p of problemas) console.error(' -', p); process.exit(1) }
console.log(`verify-menu-inferior: ${casos} casos OK`)
