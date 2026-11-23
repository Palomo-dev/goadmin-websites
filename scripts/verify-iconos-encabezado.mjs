/**
 * verify-iconos-encabezado.mjs — íconos de moneda, carrito y cuenta (pedido de Juan, 28-oct).
 * Sin configuración la tienda pinta lo de hoy (Globe en la moneda del menú móvil); con
 * `currency_icon` o `header_icons.currency` el bloque móvil usa el mismo ícono que el escritorio.
 *
 *   npm run verify:iconos-encabezado
 */
import { readFileSync } from 'node:fs'
import * as lucide from 'lucide-react'
import { resolverIconoEncabezado } from '../lib/website/v2/iconosEncabezado.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

const NUEVOS = {
  'shopping-basket': 'ShoppingBasket',
  store: 'Store',
  'circle-user-round': 'CircleUserRound',
  'log-in': 'LogIn',
  'circle-dollar-sign': 'CircleDollarSign',
  languages: 'Languages',
}
const fuente = readFileSync(new URL('../components/site/header/HeaderShared.tsx', import.meta.url), 'utf8')
const mapa = fuente.slice(fuente.indexOf('const ICON_MAP'), fuente.indexOf('export function getLucideIcon'))
for (const [nombre, comp] of Object.entries(NUEVOS)) {
  check(Boolean(lucide[comp]), `lucide-react instalado exporta ${comp}`)
  check(mapa.includes(`'${nombre}': ${comp},`), `ICON_MAP tiene '${nombre}'`)
}

// Sin configuración: Globe, como hoy.
check(resolverIconoEncabezado('currency', null).nombre === 'globe', 'sin ajustes la moneda es globe')
check(resolverIconoEncabezado('currency', {}).nombre === 'globe', 'ajustes vacíos: globe')
// Con configuración.
check(resolverIconoEncabezado('currency', { currency_icon: 'languages' }).nombre === 'languages', 'currency_icon manda')
check(
  resolverIconoEncabezado('currency', { currency_icon: 'coins', header_icons: { currency: { icono: 'circle-dollar-sign' } } }).nombre === 'circle-dollar-sign',
  'header_icons manda sobre la columna',
)
check(resolverIconoEncabezado('cart', { cart_icon: 'store' }).nombre === 'store', 'carrito store')
check(resolverIconoEncabezado('account', { auth_icon: 'log-in' }).nombre === 'log-in', 'cuenta log-in')

// El bloque de moneda del menú móvil ya no pinta un Globe fijo.
// (El modal viejo MobileCurrencyChips se borró: la fila «hoja» recibe el ícono del rótulo.)
const bloque = fuente.slice(fuente.indexOf('export function BloqueMonedaMovil'), fuente.indexOf('// Sección de auth para drawers móviles'))
check(!/<Globe\b/.test(bloque), 'el menú móvil no tiene Globe fijo')
check((bloque.match(/getLucideIcon\(resolverIconoEncabezado\('currency', settings\)\.nombre, Globe\)/g) ?? []).length === 1, 'el rótulo resuelve el ícono con Globe de respaldo')
check(bloque.includes('<FilaMonedaHoja lista={visibles} estilo={op.estilo} Icono={IconoMoneda} />'), 'la fila «hoja» usa el mismo ícono que el rótulo')
for (const archivo of ['HeaderMinimal.tsx', 'mobile/MobileDrawer.tsx', 'mobile/MobileBottomSheet.tsx', 'mobile/MobileFullscreen.tsx', 'mobile/MobileTabs.tsx', 'mobile/HeaderMovilConfigurable.tsx']) {
  const f = readFileSync(new URL(`../components/site/header/${archivo}`, import.meta.url), 'utf8')
  check(!/<BloqueMonedaMovil(?![^>]*settings=\{settings\})/.test(f), `${archivo} pasa settings a BloqueMonedaMovil`)
}

// Dibujo de Buscar (queja del dueño 2026-11-23: «cambié el ícono del buscador y no cambió»).
// Todas las opciones del editor (ICONOS_BUSCAR, contrato compartido) existen en lucide y en el mapa
// de la tienda, y TODOS los buscadores leen el mismo resolver: nadie pinta una lupa fija.
const { ICONOS_BUSCAR } = await import('../lib/website/v2/iconosEncabezado.ts')
const modBuscar = readFileSync(new URL('../components/site/header/iconoBuscar.ts', import.meta.url), 'utf8')
const PASCAL = (n) => n.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('')
check(ICONOS_BUSCAR.length >= 6, 'Buscar ofrece al menos 6 dibujos')
for (const nombre of ICONOS_BUSCAR) {
  check(Boolean(lucide[PASCAL(nombre)]), `lucide-react instalado exporta ${PASCAL(nombre)}`)
  check(new RegExp(`['"]?${nombre}['"]?: ${PASCAL(nombre)},`).test(modBuscar), `iconoBuscar.ts tiene '${nombre}'`)
}
check(modBuscar.includes("resolverIconoEncabezado('search'"), 'iconoBuscar usa resolverIconoEncabezado')
check(mapa.includes('...ICONOS_BUSCAR_LUCIDE'), 'ICON_MAP incluye los dibujos de Buscar (MobileTabs y la lupa suelta)')
check(resolverIconoEncabezado('search', { search_icon: 'binoculars' }).nombre === 'binoculars', 'search_icon binoculars')
const leer = (ruta) => readFileSync(new URL(`../components/site/${ruta}`, import.meta.url), 'utf8')
const cromo = leer('header/BuscadorCromo.tsx')
check(!/<Search className/.test(cromo), 'BuscadorCromo: ni el botón de la barra ni el del compacto pintan la lupa fija')
check(!/const Icono = Search/.test(cromo), 'BuscadorCromo: la lupa del campo es la elegida')
check(cromo.includes('icono={iconoBuscar(settings)}'), 'barraSiCromo pasa el dibujo (barra visible, compacta, grande, píldora)')
check(cromo.includes('icono={props.icon ?? iconoBuscar(props.settings)}'), 'el buscador del celular como computador lleva el dibujo')
check(!/<Search className/.test(leer('ProductSearch.tsx')), 'ProductSearch: la lupa del panel abierto es la elegida')
check(leer('header/HeaderShared.tsx').includes('colores={coloresCaja} icono={SearchIconComp} />'), 'el ícono que abre encima (icon_overlay) lleva el dibujo')
for (const archivo of ['HeaderCentered', 'HeaderClassic', 'HeaderMega', 'HeaderMinimal', 'HeaderPill', 'HeaderSplit', 'mobile/HeaderMovilConfigurable', 'mobile/MobileBottomSheet', 'mobile/MobileDrawer', 'mobile/MobileFullscreen']) {
  const f = leer(`header/${archivo}.tsx`)
  check(!f.includes('settings?.search_icon'), `${archivo}: no lee solo search_icon (se saltaba header_icons)`)
  check(f.includes('iconoBuscar(settings)'), `${archivo}: usa iconoBuscar(settings)`)
}
check(leer('header/HeaderPorZonas.tsx').match(/iconoBuscar\(settings\)/g)?.length === 2, 'HeaderPorZonas: barra con estilo y barra simple con el dibujo')
check(leer('header/mobile/MobileBottomNav.tsx').includes("item.icon === 'search' && iconoBuscar"), 'barra inferior (v1): la pestaña Buscar con el dibujo')

if (problemas.length) {
  console.error(`✗ ${problemas.length}/${casos} fallaron:\n- ${problemas.join('\n- ')}`)
  process.exit(1)
}
console.log(`✓ ${casos} casos`)
