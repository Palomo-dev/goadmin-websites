/**
 * verify-paginacion-categoria.mjs — el total de una categoría no cambia al paginar.
 *
 *   npm run verify:paginacion-categoria
 *
 * Sin base de datos. La página 1 y la página 2 salen de la misma lista de ids:
 * un catálogo de 42 sigue en 4 páginas de 12, y uno de 16 deja 4 fichas en la
 * página 2. Esas dos listas no se mezclan.
 */
import fs from 'node:fs'
import {
  TAMANO_PAGINA_CATEGORIA,
  ordenarPorVentasEstable,
  paginarIds,
  ventasConHijos,
} from '../lib/products/paginacionCategoria.ts'

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

check(TAMANO_PAGINA_CATEGORIA === 12, 'la página de categoría sigue en 12')

const de42 = Array.from({ length: 42 }, (_, i) => i + 1)
const p1 = paginarIds(de42, 1)
const p2 = paginarIds(de42, 2)
const p4 = paginarIds(de42, 4)
check(p1.total === 42 && p2.total === 42 && p4.total === 42, 'el total no cambia entre páginas')
check(p1.totalPaginas === 4 && p2.totalPaginas === 4 && p4.totalPaginas === 4, '42 productos son 4 páginas')
check(p1.pagina.length === 12 && p2.pagina.length === 12, 'las páginas intermedias van llenas')
check(p4.pagina.length === 6 && p4.pagina[0] === 37 && p4.pagina[5] === 42, 'la última página es el resto')
igual(p2.pagina, de42.slice(12, 24), 'la página 2 es el segundo corte de la misma lista')

const de16 = Array.from({ length: 16 }, (_, i) => i + 1)
const vieja = paginarIds(de16, 2)
check(vieja.total === 16 && vieja.totalPaginas === 2 && vieja.pagina.length === 4, '16 productos: la página 2 tiene 4')
check(p2.total !== vieja.total, 'el corte de 16 no anuncia el total de 42')

check(paginarIds([], 1).total === 0 && paginarIds([], 1).totalPaginas === 0, 'sin productos no hay páginas')
check(paginarIds(de42, 0).pagina.length === 12, 'una página inválida cae en la primera')
check(paginarIds(de42, 2, 0).pagina.length === 12, 'un límite inválido usa 12')

const filas = [
  { id: 1, name: 'A' },
  { id: 2, name: 'B' },
  { id: 3, name: 'C' },
  { id: 4, name: 'D' },
]
igual(
  ordenarPorVentasEstable(filas, { 2: 5, 4: 5, 1: 0 }).map((f) => f.id),
  [2, 4, 1, 3],
  'más vendidos primero y el empate conserva el orden de nombre',
)
igual(
  ordenarPorVentasEstable(filas, {}).map((f) => f.id),
  [1, 2, 3, 4],
  'sin ventas se queda el orden en que llegaron',
)

const ventas = ventasConHijos([10, 20], { 10: 1, 99: 4, 50: 7 }, { 99: 10, 50: 20 })
check(ventas[10] === 5 && ventas[20] === 7, 'las ventas de la variante se suman al padre')
const ajenas = ventasConHijos([10], { 77: 3 }, { 77: 88 })
check(ajenas[10] === 0 && ajenas[88] === undefined, 'un hijo de otro listado no entra en el total')

const queries = fs.readFileSync(new URL('../lib/supabase/queries.ts', import.meta.url), 'utf8')
const pagina = fs.readFileSync(new URL('../app/categorias/[slug]/page.tsx', import.meta.url), 'utf8')
const firma = queries.match(/function getOrdenListadoCategoriaUncached\(([^)]*)\)/)
check(Boolean(firma) && !firma[1].includes('page'), 'la lista cacheada no recibe la página')
check(queries.includes("'getOrdenListadoCategoria'"), 'el orden de la categoría se cachea una vez')
check(
  /export const getProductsByCategoryPaginated = cache\(getProductsByCategoryPaginatedUncached\)/.test(queries),
  'el resultado por página no entra en la caché del catálogo',
)
check(!queries.includes("cacheCatalog(\n  'getProductsByCategoryPaginated'"), 'no queda la caché por página')
check(queries.includes('paginarIds('), 'el corte sale de la lista compartida')
check(queries.includes("'getFichasListadoCategoria'"), 'las fichas se cachean por ids, no por número de página')
check(!queries.includes('total: count'), 'el total no es el count de PostgREST')
check(pagina.includes('TAMANO_PAGINA_CATEGORIA'), 'la página usa el mismo tamaño para el corte y el número de páginas')
check(!pagina.includes('total / 12'), 'el número de páginas no tiene un 12 suelto')

if (problemas.length > 0) {
  console.error(problemas.join('\n'))
  process.exit(1)
}
console.log(`ok ${casos} comprobaciones`)
