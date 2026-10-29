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
const bloque = fuente.slice(fuente.indexOf('export function MobileCurrencyChips'), fuente.indexOf('// Sección de auth para drawers móviles'))
check(!/<Globe\b/.test(bloque), 'el menú móvil no tiene Globe fijo')
check((bloque.match(/getLucideIcon\(resolverIconoEncabezado\('currency', settings\)\.nombre, Globe\)/g) ?? []).length === 2, 'chips y rótulo resuelven el ícono con Globe de respaldo')
for (const archivo of ['HeaderMinimal.tsx', 'mobile/MobileDrawer.tsx', 'mobile/MobileBottomSheet.tsx', 'mobile/MobileFullscreen.tsx', 'mobile/MobileTabs.tsx', 'mobile/HeaderMovilConfigurable.tsx']) {
  const f = readFileSync(new URL(`../components/site/header/${archivo}`, import.meta.url), 'utf8')
  check(!/<BloqueMonedaMovil(?![^>]*settings=\{settings\})/.test(f), `${archivo} pasa settings a BloqueMonedaMovil`)
}

if (problemas.length) {
  console.error(`✗ ${problemas.length}/${casos} fallaron:\n- ${problemas.join('\n- ')}`)
  process.exit(1)
}
console.log(`✓ ${casos} casos`)
