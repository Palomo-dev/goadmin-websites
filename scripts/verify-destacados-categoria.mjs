/**
 * verify-destacados-categoria.mjs — destacados por categoría, con hijas.
 *
 *   npm run verify:destacados-categoria
 *
 * Sin base de datos. Importa el filtro real. Las raíces 2115 y 2117 (org 341)
 * no tienen productos propios: están en las hijas. Con la clave ausente, destacados
 * incluye esas hijas y las dos selecciones devuelven productos distintos y no vacíos.
 * En grilla, carrusel, lista y ofertas la clave ausente no expande (el id exacto de hoy).
 */
import {
  expandirCategorias,
  filtrarProductosPorCategorias,
  idsParaCargarProductos,
  incluirSubcategorias,
  unirProductosDeCategoria,
} from '../lib/products/filtrosProductos.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

/** Árbol real de las dos raíces de la org 341: cada hija tiene productos, la raíz no. */
const HIJAS_2115 = [2119, 2120, 2121, 2122, 2123, 2124, 2125, 2126, 2127, 2128, 2129, 2130, 2131, 2132, 2133]
const HIJAS_2117 = [2136, 2137, 2138, 2139, 2140, 2141, 2142, 2143, 2144, 2145, 2146, 2147, 2148, 2149]
const categorias = [
  { id: 2115, parent_id: null },
  { id: 2117, parent_id: null },
  ...HIJAS_2115.map((id) => ({ id, parent_id: 2115 })),
  ...HIJAS_2117.map((id) => ({ id, parent_id: 2117 })),
]
const productos = [
  ...HIJAS_2115.map((category_id, i) => ({ id: 1000 + i, category_id })),
  ...HIJAS_2117.map((category_id, i) => ({ id: 2000 + i, category_id })),
]

const de2115 = filtrarProductosPorCategorias(productos, [2115], categorias, incluirSubcategorias(undefined, 'featured_products'))
const de2117 = filtrarProductosPorCategorias(productos, [2117], categorias, incluirSubcategorias(undefined, 'featured_products'))
const ids2115 = new Set(de2115.map((p) => p.id))
const ids2117 = new Set(de2117.map((p) => p.id))

check(de2115.length > 0, '[2115] no devolvió productos')
check(de2117.length > 0, '[2117] no devolvió productos')
check([...ids2115].every((id) => !ids2117.has(id)), '[2115] y [2117] comparten productos')
check(de2115.length === HIJAS_2115.length, `[2115] devolvió ${de2115.length}, se esperaban ${HIJAS_2115.length}`)
check(de2117.length === HIJAS_2117.length, `[2117] devolvió ${de2117.length}, se esperaban ${HIJAS_2117.length}`)

check(expandirCategorias([2115], categorias)[0] === 2115, 'la raíz queda en la expansión')
check(incluirSubcategorias(undefined, 'featured_products') === true, 'destacados ausente debe incluir hijas')
check(incluirSubcategorias(undefined, 'products_grid') === false, 'grilla ausente no expande')
check(incluirSubcategorias(undefined, 'products_carousel') === false, 'carrusel ausente no expande')
check(incluirSubcategorias(undefined, 'products_list') === false, 'lista ausente no expande')
check(incluirSubcategorias(undefined, 'offers') === false, 'ofertas ausente no expande')
check(incluirSubcategorias(false, 'featured_products') === false, 'destacados puede apagar las hijas')

const exactos = filtrarProductosPorCategorias(productos, [2115], categorias, false)
check(exactos.length === 0, 'sin hijas, la raíz 2115 no tiene productos propios')

const todos = filtrarProductosPorCategorias(productos, [], categorias, true)
check(todos.length === productos.length, 'sin selección el listado no cambia')

const generales = productos.slice(0, 2)
const extra = [{ id: 9, category_id: 2119 }]
check(unirProductosDeCategoria(generales, extra, []).length === 2, 'sin selección no se unen los de categoría')
check(unirProductosDeCategoria(generales, extra, [2115]).some((p) => p.id === 9), 'con selección sí se unen')

const ids = idsParaCargarProductos(
  [
    { section_type: 'featured_products', content: { selected_category_ids: [2115] } },
    { section_type: 'products_grid', content: { selected_category_ids: [2117] } },
    { section_type: 'offers', content: { selected_category_ids: [9999] } },
  ],
  categorias,
)
check(ids.includes(2115) && ids.includes(2119), 'destacados carga la raíz y sus hijas')
check(ids.includes(2117), 'la grilla carga el id elegido')
check(!ids.includes(2136), 'la grilla, sin la clave, no carga las hijas')
check(!ids.includes(9999), 'ofertas no usa esta carga: lee offerProducts')

if (problemas.length) {
  console.error(`verify-destacados-categoria: ${problemas.length} fallo(s) de ${casos}`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`verify-destacados-categoria: ${casos} casos, [2115]=${de2115.length} [2117]=${de2117.length}, distintos`)
