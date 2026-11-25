/**
 * verify-galeria-scroll.mjs — galería de la ficha en modo «Desplazamiento» (gallery_layout: scroll).
 *
 *   npm run verify:galeria-scroll
 *
 * Sin navegador ni base: importa la regla pura de la columna fija y lee el fuente de la galería.
 * (La comprobación visual con fotos de 1 y 8 imágenes, a 1280 y 390 px, se hace en el arnés
 * /pruebas-internas/ficha con PRUEBAS_INTERNAS=1.)
 *
 * Casos:
 *  1. Columna de información: debajo del header si cabe; si es más alta que la pantalla, sube
 *     hasta mostrar su final (top negativo) y no más.
 *  2. Modo scroll: sin caja con barra propia, sin alto fijo, sin object-cover, sin marco grueso
 *     del primario; fotos con object-contain sobre fondo neutro y lazy loading; carrusel con puntos
 *     en el celular; miniaturas solo si thumbnails_position no es «none».
 *  3. Los demás modos siguen como estaban (carrusel con su marco y flechas; grilla; mosaico).
 *  4. La ficha usa la columna fija solo con la galería en scroll.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MARGEN_COLUMNA_FIJA, topColumnaFija } from '../components/sections/product-detail/columnaFija.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

// ─── 1. Columna fija ───────────────────────────────────────────────────────
check(MARGEN_COLUMNA_FIJA === 16, '1a: el margen cambió')
check(topColumnaFija(500, 800, 72) === 88, '1b: una columna que cabe no queda justo debajo del header')
check(topColumnaFija(933, 800, 72) === -149, '1c: una columna alta no sube hasta mostrar su final')
check(topColumnaFija(800 - 72 - 32, 800, 72) === 88, '1d: en el límite exacto no queda debajo del header')
check(topColumnaFija(600, 800, 0) === 16, '1e: sin header no queda a 16 px')

// ─── 2. Modo scroll ────────────────────────────────────────────────────────
const fuente = readFileSync(join(ROOT, 'components/site/ProductImageGallery.tsx'), 'utf8')
const inicio = fuente.indexOf("if (layout === 'scroll')")
const fin = fuente.indexOf('// ---- Modo carousel (default) ----')
const scroll = inicio > 0 && fin > inicio ? fuente.slice(inicio, fin) : ''
check(scroll.length > 0, '2a: no se encontró el bloque del modo scroll')
check(!/overflow-y-auto|maxHeight|scrollHeight\b/.test(scroll), '2b: el modo scroll vuelve a tener una caja con barra o alto fijo')
check(!/object-cover/.test(scroll), '2c: el modo scroll recorta fotos (object-cover)')
check(!/border-2|borderColor/.test(scroll), '2d: el modo scroll vuelve al marco grueso del color primario')
check(!/primaryColor/.test(scroll), '2e: el modo scroll usa el color primario (marco oscuro en tiendas de primario oscuro)')
check((scroll.match(/object-contain/g) ?? []).length >= 3, '2f: las fotos del modo scroll no van con object-contain')
check(/bg-neutral-50/.test(scroll) && /rounded-lg/.test(scroll), '2g: falta el fondo neutro o el redondeo suave')
check(/gap-3/.test(scroll) && /lg:gap-4/.test(scroll), '2h: el espacio entre fotos no es de 12–16 px')
check(/loading=\{i === 0 \? undefined : 'lazy'\}/.test(scroll), '2i: se perdió el lazy loading (la primera foto sin lazy)')
check(/md:hidden/.test(scroll) && /snap-x/.test(scroll) && /aria-label=\{`Ver imagen/.test(scroll), '2j: falta el carrusel con puntos del celular')
check(/thumbsPos !== 'none'/.test(scroll) && /ring-1/.test(scroll), '2k: las miniaturas no respetan «none» o el anillo no es fino')
check(/scrollIntoView\(\{ behavior: 'smooth'/.test(scroll), '2l: la miniatura no hace scroll suave a su foto')
check(!/settings\.gallery_scroll_height/.test(fuente), '2m: gallery_scroll_height se vuelve a usar como alto de una caja')

// ─── 3. Los demás modos, como estaban ──────────────────────────────────────
const carrusel = fuente.slice(fin)
// Bloque 3 de la ficha (2026-11-25): la proporción sale de «Proporción de la foto»; sin la clave,
// cuadrada (`square: 'aspect-square'`) y recortada (object-cover), como siempre.
check(
  /\$\{claseProporcion\} rounded-2xl overflow-hidden relative/.test(carrusel) && /object-cover/.test(carrusel) &&
    /square: 'aspect-square'/.test(fuente) && /CLASE_PROPORCION\[opciones\?\.proporcion \?\? 'square'\]/.test(fuente),
  '3a: cambió la foto del carrusel (sin opciones debe seguir cuadrada y recortada)',
)
check(/aria-label="Imagen anterior"/.test(carrusel) && /border-2/.test(carrusel), '3b: cambiaron las flechas o las miniaturas del carrusel')
check(/if \(layout === 'grid'\)/.test(fuente) && /if \(layout === 'mosaic'\)/.test(fuente) && /if \(layout === 'show_all'\)/.test(fuente), '3c: falta algún modo')

// ─── 4. Ficha ──────────────────────────────────────────────────────────────
const ficha = readFileSync(join(ROOT, 'components/sections/product-detail/ProductDetailRenderer.tsx'), 'utf8')
check(/gallery_layout === 'scroll'/.test(ficha) && /stickyColumn && galeriaScroll \? \(\s*<ColumnaInfoFija/.test(ficha), '4a: la columna fija no depende de la galería en scroll')
check(/lg:sticky lg:top-4 lg:self-start/.test(ficha), '4b: los demás modos perdieron su columna fija de siempre')

if (problemas.length) {
  console.error(`✗ ${problemas.length} de ${casos} comprobaciones fallaron:`)
  for (const p of problemas) console.error('  -', p)
  process.exit(1)
}
console.log(`✓ galería en scroll: ${casos} comprobaciones`)
