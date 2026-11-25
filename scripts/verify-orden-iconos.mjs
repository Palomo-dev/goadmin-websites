/**
 * verify-orden-iconos.mjs — orden de los íconos de la cabecera (Figma «16 Sitio web» 3261:99475,
 * aprobado 2026-11-25).
 *
 *   npm run verify:orden-iconos
 *
 * Qué comprueba:
 * 1. Lector puro (`lib/website/v2/cabeceraTienda.ts`, copia idéntica del ERP): sin orden guardado,
 *    el de hoy; las 46 filas de la base (45 con el de siempre y 1 con la moneda primero) se pintan
 *    igual que antes; sin repetidos ni valores raros; los que faltan en su lugar de siempre
 *    (Favoritos justo antes del carrito, la regla que ya tenía HeaderActions).
 * 2. Celular: `header_iconos.ordenCelular` manda en el celular; sin él, el del computador. El
 *    computador nunca lo lee. El orden propio no activa la presentación nueva de los íconos.
 * 3. En el fuente: HeaderActions pinta con `ordenAccionesPantalla(…, isMobile)`, «No repetir
 *    arriba» sigue quitando lo del menú inferior sin mover el resto y el lienzo avisa al editor
 *    cuando el clic cae en la fila de íconos (`iconos: true`).
 */
import { readFileSync } from 'node:fs'
import {
  ACCIONES_ORDEN,
  ORDEN_ACCIONES_HOY,
  opcionesIconos,
  ordenAcciones,
  ordenAccionesPantalla,
  ordenCelularPropio,
  ordenGuardado,
} from '../lib/website/v2/cabeceraTienda.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

// Lo que hacía HeaderActions antes de este cambio, para comparar con las filas reales.
function ordenViejo(raw, conFavoritos) {
  let lista = ['search', 'currency', 'cart', 'auth']
  if (typeof raw === 'string') {
    try { lista = JSON.parse(raw) } catch { /* el de hoy */ }
  } else if (Array.isArray(raw)) lista = raw
  if (!conFavoritos || lista.includes('favorites')) return lista
  const i = lista.indexOf('cart')
  return i < 0 ? [...lista, 'favorites'] : [...lista.slice(0, i), 'favorites', ...lista.slice(i)]
}
const pintado = (orden, visibles) => orden.filter((x) => visibles.includes(x))

// 1. Lector puro
check(igual(ORDEN_ACCIONES_HOY, ['search', 'currency', 'cart', 'auth']), 'el orden de hoy')
check(igual(ACCIONES_ORDEN, ['search', 'currency', 'favorites', 'cart', 'auth']), 'cinco íconos en su lugar de siempre')
for (const v of [undefined, null, [], '', 'no-json', 7, {}, '[]', ['x']]) {
  check(igual(ordenAcciones(v), ['search', 'currency', 'favorites', 'cart', 'auth']), `sin orden válido (${JSON.stringify(v)}): el de hoy`)
}
const FILAS_BASE = [['search', 'currency', 'cart', 'auth'], ['currency', 'search', 'cart', 'auth'], '["currency","search","cart","auth"]', null]
for (const fila of FILAS_BASE) {
  for (const conFav of [false, true]) {
    const visibles = conFav ? ['search', 'currency', 'favorites', 'cart', 'auth'] : ['search', 'currency', 'cart', 'auth']
    check(
      igual(pintado(ordenAcciones(fila), visibles), pintado(ordenViejo(fila, conFav), visibles)),
      `fila ${JSON.stringify(fila)}${conFav ? ' con favoritos' : ''}: se pinta igual que antes`,
    )
  }
}
check(igual(ordenGuardado(['cart', 'cart', 'wishlist', 3, 'auth']), ['cart', 'auth']), 'sin repetidos ni desconocidos')
check(ordenGuardado(['nada']) === null, 'nada válido = sin orden')
check(igual(ordenAcciones(['cart']), ['search', 'currency', 'favorites', 'cart', 'auth']), 'los que faltan, en su lugar de siempre')
check(igual(ordenAcciones(['auth', 'cart']), ['auth', 'search', 'currency', 'favorites', 'cart']), 'faltantes antes del siguiente que sí está')
check(ordenAcciones(['cart', 'favorites', 'search']).indexOf('favorites') > ordenAcciones(['cart', 'favorites', 'search']).indexOf('cart'), 'favoritos guardado después del carrito se respeta')
for (const v of [['auth'], ['cart', 'search'], '["auth","search"]']) {
  const r = ordenAcciones(v)
  check(r.length === 5 && new Set(r).size === 5, `${JSON.stringify(v)}: los cinco, una vez`)
}

// 2. Celular
const base = { actions_order: ['currency', 'search', 'cart', 'auth'] }
check(ordenCelularPropio(base) === null, 'sin ordenCelular: igual que en el computador')
check(igual(ordenAccionesPantalla(base, true), ordenAccionesPantalla(base, false)), 'celular = computador sin orden propio')
check(ordenCelularPropio({ header_iconos: { ordenCelular: 'cart' } }) === null, 'ordenCelular que no es lista: se ignora')
const propio = { ...base, header_iconos: { ordenCelular: ['cart', 'search', 'currency', 'favorites', 'auth'] } }
check(igual(ordenAccionesPantalla(propio, true), ['cart', 'search', 'currency', 'favorites', 'auth']), 'celular con su orden propio')
check(igual(ordenAccionesPantalla(propio, false), ['currency', 'search', 'favorites', 'cart', 'auth']), 'el computador no lee el orden del celular')
check(opcionesIconos(propio).configurado === false, 'el orden propio no activa la presentación nueva de los íconos')

// 3. Fuente
const compartido = leer('components/site/header/HeaderShared.tsx')
check(compartido.includes('const ordenFinal = ordenAccionesPantalla(ajustesCabecera, isMobile);'), 'HeaderActions ordena con ordenAccionesPantalla(…, isMobile)')
check(!compartido.includes('settings?.actions_order'), 'HeaderActions ya no lee actions_order a mano')
check(/ordenFinal\.map\(\(action\) => actionElements\[action\]\)\.filter\(Boolean\)/.test(compartido), 'los ocultos se saltan sin mover el resto')
check(/if \(repetidos\.has\('cart'\)\) actionElements\.cart = null;/.test(compartido), '«No repetir arriba» sigue quitando lo del menú inferior')
check(compartido.includes('data-acciones-encabezado=""'), 'la fila de íconos sigue marcada para el lienzo')
const puente = leer('components/sections/PreviewBridge.tsx')
check(puente.includes("const iconos = sectionId === 'header' && !!(e.target as HTMLElement).closest('[data-acciones-encabezado]');"), 'el clic en la fila de íconos se detecta solo en el encabezado')
check(puente.includes('...(iconos ? { iconos: true } : {}),'), 'el lienzo avisa iconos: true al editor')
const zona = leer('components/site/ZonaGlobalPreview.tsx')
check(zona.includes('[data-goadmin-zona="header"] [data-acciones-encabezado]:hover') && zona.includes('Íconos de la cabecera · clic para ordenar'), 'contorno y etiqueta al pasar el mouse (solo en el lienzo)')
check(zona.includes('if (!isPreview) return <>{children}</>'), 'fuera del lienzo nada cambia')

if (problemas.length) {
  console.error(`✗ verify-orden-iconos: ${problemas.length} de ${casos} fallaron`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-orden-iconos: ${casos} comprobaciones`)
