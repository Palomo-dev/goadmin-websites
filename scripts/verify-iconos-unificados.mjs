/**
 * verify-iconos-unificados.mjs — íconos de la cabecera en un solo lugar (Figma «16 Sitio web»
 * 2830:73206, aprobado 2026-11-22).
 *
 *   npm run verify:iconos-unificados
 *
 * Qué comprueba:
 * 1. Contrato (lib/website/v2/cabeceraTienda.ts): `header_iconos.movil` y `.por_icono`; sin ellos
 *    todo vale lo de hoy; el trazo unificado (relleno gana sobre `trazo`).
 * 2. En el celular, Píldora y Relleno (generales o propios) pasan a la forma de «En el celular»;
 *    con «Automático», a lo de hoy (solo ícono o círculo según la caja).
 * 3. En el fuente: la cabecera pinta cada ícono con su forma propia (presentacionIcono con la
 *    clave del ícono y formaSimpleIcono para la caja/círculo), el glifo carrito/bolsa guardado se
 *    sigue leyendo y el menú lateral del celular trae la fila «Favoritos».
 */
import { readFileSync } from 'node:fs'
import {
  estiloDeIcono,
  estiloEnPantalla,
  estiloIconosHeredado,
  opcionesIconos,
  trazoUnificado,
} from '../lib/website/v2/cabeceraTienda.ts'
import { resolverIconoEncabezado } from '../lib/website/v2/iconosEncabezado.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// 1. Lo guardado hoy se lee igual.
for (const a of [null, {}, { header_icons_circle: true }, { header_icons_box: { shape: 'square', icon: 28 } }, { header_icons_weight: 'relleno' }]) {
  const op = opcionesIconos(a)
  check(op.configurado === false, `sin header_iconos nuevo no hay camino nuevo (${JSON.stringify(a)})`)
  check(op.movil === 'auto' && igual(op.porIcono, {}), 'sin movil ni por_icono: automático y sin formas propias')
}
const op = opcionesIconos({ header_iconos: { movil: 'circulo', por_icono: { carrito: { estilo: 'relleno' }, cuenta: { estilo: 'nada' } } } })
check(op.configurado && op.movil === 'circulo', 'lee header_iconos.movil')
check(igual(op.porIcono, { carrito: 'relleno' }), 'lee las formas propias válidas y descarta las demás')
check(estiloDeIcono(op, 'carrito') === 'relleno' && estiloDeIcono(op, 'cuenta') === 'icono', 'forma propia o «como los demás»')
check(trazoUnificado({ header_icons_weight: 'relleno', header_iconos: { trazo: 'fino' } }) === 'relleno', 'relleno gana al leer')
check(opcionesIconos({ header_icons_weight: 'relleno', header_iconos: { trazo: 'fino' } }).trazo === null, 'con relleno no se aplica el grosor')
check(trazoUnificado({ header_iconos: { trazo: 'normal' } }) === 'normal' && trazoUnificado({}) === null, 'sin relleno, el grosor guardado (o nada)')

// 2. Celular.
check(estiloEnPantalla('pildora', true, 'auto', estiloIconosHeredado({ header_icons_circle: true })) === 'circulo', 'píldora + automático + círculo del sitio → círculo')
check(estiloEnPantalla('relleno', true, 'auto', estiloIconosHeredado({})) === 'icono', 'relleno + automático sin caja → solo ícono')
check(estiloEnPantalla('relleno', true, 'texto', 'icono') === 'texto', 'relleno + «Con texto debajo» → con texto')
check(estiloEnPantalla('pildora', false, 'texto', 'icono') === 'pildora', 'en el computador no cambia')
check(estiloEnPantalla('icono', true, 'texto', 'icono') === 'icono', 'solo ícono no cambia en el celular')

// El glifo carrito/bolsa guardado se sigue respetando (y un dibujo elegido lo pisa).
check(resolverIconoEncabezado('cart', { header_cart_glyph: 'carrito' }).nombre === 'shopping-cart', 'header_cart_glyph = carrito se respeta')
check(resolverIconoEncabezado('cart', { header_cart_glyph: 'bolsa', cart_icon: 'gift' }).nombre === 'gift', 'un dibujo elegido pisa el glifo')

// 3. Fuente.
const leer = (r) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8')
const accion = leer('components/site/header/AccionCabecera.tsx')
check(/export function presentacionIcono\([^)]*icono\?: IconoCabecera\)/.test(accion), 'presentacionIcono recibe el ícono (forma propia)')
check(accion.includes('estiloEnPantalla(elegido, movil, op.movil, heredado)'), 'presentacionIcono aplica «En el celular»')
check(accion.includes('export function formaSimpleIcono'), 'formaSimpleIcono: caja y círculo de la forma propia')
const cabecera = leer('components/site/header/HeaderShared.tsx')
check(cabecera.includes('estiloIconosHeredado(ajustesCabecera), clave)'), 'la cabecera presenta cada ícono con su clave')
for (const caja of ['cajaCarrito', 'cajaMoneda', 'cajaCuenta', 'cajaFavoritos', 'cajaBuscar']) {
  check(cabecera.includes(`const ${caja} =`), `la cabecera calcula ${caja}`)
}
check(cabecera.includes('circulo={cajaCarrito.circulo}') && cabecera.includes('contenedor={cajaCarrito.contenedor}'), 'el carrito usa su forma propia')
check(cabecera.includes('circulo={cajaMoneda.circulo}'), 'la moneda usa su forma propia')
for (const menu of ['components/site/header/mobile/MobileDrawer.tsx', 'components/site/header/mobile/MobileFullscreen.tsx']) {
  check(leer(menu).includes('<FilaFavoritosMenu settings={settings} visible={showCart}'), `${menu}: fila «Favoritos» en el menú lateral`)
}
const fila = leer('components/site/favoritos/FilaFavoritosMenu.tsx')
check(fila.includes('if (!visible || !op.favoritos) return null'), 'la fila «Favoritos» solo sale con el corazón prendido')
check(fila.includes("favoritos.alTocar === 'pagina'") && fila.includes('abrirPanelFavoritos'), 'la fila hace lo mismo que el corazón (panel o página)')

if (problemas.length) {
  console.error(`✗ verify-iconos-unificados: ${problemas.length} de ${casos} fallaron`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-iconos-unificados: ${casos} comprobaciones`)
