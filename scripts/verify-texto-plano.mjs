/**
 * verify-texto-plano.mjs — las descripciones con HTML se pintan como texto limpio.
 *
 *   npm run verify:texto
 *
 * Sin base de datos ni dependencias nuevas:
 * 1. Casos de `textoPlano` (lib/texto/textoPlano.ts), incluido el HTML real pegado desde un
 *    editor que se vio en la carta de una organización de prueba (`<p data-start="2111" …>`).
 * 2. Cada componente que pinta la descripción de un producto o categoría pasa por
 *    `textoPlano`/`textoPlanoONulo` y ninguno inyecta esa descripción con dangerouslySetInnerHTML.
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { stripTypeScriptTypes } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (ruta) => readFile(join(ROOT, ruta), 'utf8')

const dir = join(ROOT, '.verify-texto-tmp')
await rm(dir, { recursive: true, force: true })
await mkdir(dir)
let m
try {
  await writeFile(join(dir, 'textoPlano.mjs'), stripTypeScriptTypes(await leer('lib/texto/textoPlano.ts'), { mode: 'strip' }))
  m = await import(pathToFileURL(join(dir, 'textoPlano.mjs')).href)
} finally {
  await rm(dir, { recursive: true, force: true })
}
const { textoPlano, textoPlanoONulo } = m

const problemas = []
let casos = 0
const igual = (a, b, msg) => {
  casos++
  if (a !== b) problemas.push(`${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`)
}

// ─── 1. Casos ────────────────────────────────────────────────────────────────────────────────
igual(textoPlano(null), '', 'null')
igual(textoPlano(undefined), '', 'undefined')
igual(textoPlanoONulo('   '), null, 'vacío → null')
igual(textoPlanoONulo('<p> </p>'), null, 'solo etiquetas → null')
const plano = 'Perro con salsa de la casa, sin cebolla.\nTamaño grande.'
igual(textoPlano(plano), plano, 'texto sin HTML sale idéntico')
igual(
  textoPlano('<p data-start="2111" data-end="2446" class="PDq2pG_selectionAnchorContainer">Dos hamburguesas de gran tamaño con <strong data-start="15" data-end="40">carne artesanal</strong>&nbsp;y pollo.</p>'),
  'Dos hamburguesas de gran tamaño con carne artesanal y pollo.',
  'HTML pegado desde un editor',
)
igual(textoPlano('Combo abundante. <strong data-start="15'), 'Combo abundante.', 'etiqueta cortada al final')
igual(textoPlano('<p>Uno</p><p>Dos</p>'), 'Uno\nDos', 'párrafos → líneas')
igual(textoPlano('Línea 1<br>Línea 2<br/>Línea 3'), 'Línea 1\nLínea 2\nLínea 3', 'br → líneas')
igual(textoPlano('<ul><li>Papas</li><li>Gaseosa</li></ul>'), '• Papas\n• Gaseosa', 'li → viñetas')
igual(textoPlano('Pan &amp; queso &quot;casero&quot; &lt;3 &#233;xito &#x1F32D; ma&ntilde;ana'), 'Pan & queso "casero" <3 éxito 🌭 mañana', 'entidades')
igual(textoPlano('&amp;lt;b&amp;gt;'), '&lt;b&gt;', 'una sola pasada de entidades (no reinterpreta)')
igual(textoPlano('Precio < 10 y > 5'), 'Precio < 10 y > 5', 'un < que no abre etiqueta se respeta')
igual(textoPlano('Hola<script>alert(1)</script> mundo<style>p{}</style>'), 'Hola mundo', 'script y style con su contenido')
igual(textoPlano('a<!-- nota -->b'), 'ab', 'comentarios')
igual(textoPlano('&entidadrara; y &#0;'), '&entidadrara; y &#0;', 'entidad desconocida o inválida queda igual')

// ─── 2. Componentes ──────────────────────────────────────────────────────────────────────────
const COMPONENTES = [
  'components/sections/restaurant/MenuItemRow.tsx',
  'components/sections/restaurant/PlatoSheet.tsx',
  'components/sections/restaurant/MenuPreviewTabs.tsx',
  'components/sections/restaurant/MenuFullView.tsx',
  'components/sections/restaurant/SignatureDishesView.tsx',
  'components/sections/products/ProductCard.tsx',
  'components/sections/products/FeaturedProductsHero.tsx',
  'components/sections/hotel/SpacesFilterableGrid.tsx',
  'components/site/MenuView.tsx',
  'components/site/ProductQuickView.tsx',
  'components/site/ExpandableDescription.tsx',
  'app/productos/[id]/page.tsx',
  'app/mi-cuenta/favoritos/page.tsx',
]
for (const ruta of COMPONENTES) {
  const fuente = await leer(ruta)
  casos++
  if (!/from '@\/lib\/texto\/textoPlano'/.test(fuente)) problemas.push(`${ruta}: no usa textoPlano`)
  // Una descripción pintada en JSX sin pasar por la regla: {x.description} suelto.
  const crudas = fuente.match(/(?<!=)\{\s*(?:item|product|selectedProduct|hero|dish|current|group\.category)\.description\s*\}/g) ?? []
  casos++
  if (crudas.length) problemas.push(`${ruta}: pinta la descripción cruda (${crudas.join(', ')})`)
  casos++
  if (/dangerouslySetInnerHTML=\{\{\s*__html:\s*[^}]*description/.test(fuente)) problemas.push(`${ruta}: inyecta la descripción como HTML`)
}

if (problemas.length) {
  console.error(`verify-texto-plano: ${problemas.length} problema(s) en ${casos} comprobaciones`)
  for (const p of problemas) console.error(' ✗', p)
  process.exit(1)
}
console.log(`verify-texto-plano: OK (${casos} comprobaciones)`)
