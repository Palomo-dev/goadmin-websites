/**
 * Pinta los casos de `casos.mjs` con `react-dom/server` y escribe `{ id: html }` en stdout.
 * `TARJETA_REF` (lo pone `verify-tarjeta-producto.mjs`) hace que el cargador lea el código de esa
 * rama; sin él, el del árbol de trabajo. `TARJETA_NUEVOS=1` pinta también los casos nuevos.
 *
 *   node --import ./scripts/tarjeta-producto/registrar.mjs scripts/tarjeta-producto/pintar.mjs
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProductCard } from '@/components/sections/products/ProductCard'
import { ProductsGrid } from '@/components/sections/products/ProductsGrid'
import { TarjetaProductoProvider } from '@/components/site/TarjetaProductoContext'
import { CASOS_SIN_CLAVES, CASOS_NUEVOS, CASOS_REJILLA_SIN_CLAVES, CASOS_REJILLA_NUEVOS, CATEGORIAS, PRODUCTOS } from './casos.mjs'

const salida = {}
const casos = process.env.TARJETA_NUEVOS === '1' ? [...CASOS_SIN_CLAVES, ...CASOS_NUEVOS] : CASOS_SIN_CLAVES
for (const caso of casos) {
  try {
    salida[caso.id] = renderToStaticMarkup(
      createElement(TarjetaProductoProvider, { valor: caso.sitio }, createElement(ProductCard, { primaryColor: '#1F3FD8', organizationSubdomain: 'demo', ...caso.props })),
    )
  } catch (e) {
    salida[caso.id] = `ERROR: ${e?.message ?? e}`
  }
}
const productos = Object.values(PRODUCTOS)
const rejillas = process.env.TARJETA_NUEVOS === '1' ? [...CASOS_REJILLA_SIN_CLAVES, ...CASOS_REJILLA_NUEVOS] : CASOS_REJILLA_SIN_CLAVES
for (const caso of rejillas) {
  try {
    salida[caso.id] = renderToStaticMarkup(
      createElement(TarjetaProductoProvider, { valor: caso.sitio }, createElement(ProductsGrid, {
        content: caso.content,
        primaryColor: '#1F3FD8',
        data: { products: productos, productsTotal: productos.length, categories: CATEGORIAS },
        organization: { subdomain: 'demo' },
      })),
    )
  } catch (e) {
    salida[caso.id] = `ERROR: ${e?.message ?? e}`
  }
}
// Integrador (W7): con mayúsculas o hover del tema (BotonesTemaProvider en true) los botones de la
// tarjeta llevan `data-boton-tema` y nada más cambia. Solo en la rama: el archivo no existe en main.
if (process.env.TARJETA_NUEVOS === '1') {
  const { BotonesTemaProvider } = await import('@/components/site/BotonesTemaContext')
  for (const caso of CASOS_SIN_CLAVES) {
    try {
      salida[`marca:${caso.id}`] = renderToStaticMarkup(
        createElement(BotonesTemaProvider, { value: true }, createElement(TarjetaProductoProvider, { valor: caso.sitio }, createElement(ProductCard, { primaryColor: '#1F3FD8', organizationSubdomain: 'demo', ...caso.props }))),
      )
    } catch (e) {
      salida[`marca:${caso.id}`] = `ERROR: ${e?.message ?? e}`
    }
  }
}
process.stdout.write(JSON.stringify(salida))
