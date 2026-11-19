/**
 * verify-encabezado-movil.mjs — fila del encabezado en el celular (< 768 px) sin desbordar.
 *
 *   npm run verify:encabezado-movil
 *
 * Sin navegador ni base: lee el CSS y los componentes. (La medición real —360, 390 y 430 px, sin
 * scroll horizontal, logo completo, botón y menú visibles— se hizo con estas mismas reglas sobre
 * las tiendas publicadas de las orgs 389 y 388.)
 *
 * Casos:
 *  1. Las reglas viven solo dentro de @media (max-width: 767px) / (max-width: 374px): computador igual.
 *  2. Solo tamaños y espacios: nada se oculta (display/visibility/opacity) ni cambia de color,
 *     fondo, borde o forma.
 *  3. Contenedor a 12 px con overflow-x: clip; logo que se encoge con contain y alineado a la
 *     izquierda (máx. 40 vw); íconos de 34 px; botón compacto en una línea; menú de 36 px.
 *  4. El último recurso (≤ 374 px) solo aplica a filas con botón principal o píldora «Menú», y no le
 *     devuelve el relleno a los íconos con círculo o caja.
 *  5. Las marcas están en todas las filas de celular y en las piezas compartidas.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (ruta) => readFileSync(join(ROOT, ruta), 'utf8')
const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

// ─── 1. Solo en el celular ─────────────────────────────────────────────────
const css = leer('app/globals.css').replace(/\r\n/g, '\n')
const inicio = css.lastIndexOf('/*', css.indexOf(' * Fila del encabezado en el celular'))
const bloque = inicio > 0 ? css.slice(inicio) : ''
check(bloque.length > 0, '1a: no se encontró el bloque de la fila del celular en app/globals.css')
const sinComentarios = bloque.replace(/\/\*[\s\S]*?\*\//g, '')
// Cada regla con data-fila-movil debe estar dentro de una media query de celular.
let profundidad = 0
let dentroDeMedia = false
let fueraDeMedia = 0
for (const linea of sinComentarios.split('\n')) {
  if (/^@media \(max-width: (767|374)px\)/.test(linea)) dentroDeMedia = true
  if (profundidad === 0 && /data-fila-movil/.test(linea) && !dentroDeMedia) fueraDeMedia++
  profundidad += (linea.match(/\{/g) ?? []).length - (linea.match(/\}/g) ?? []).length
  if (profundidad === 0) dentroDeMedia = false
}
check(fueraDeMedia === 0, '1b: hay reglas de la fila fuera de las media queries del celular')
check((sinComentarios.match(/@media \(max-width: 767px\)/g) ?? []).length === 1, '1c: falta la media query de < 768 px')

// ─── 2. Solo tamaños y espacios ────────────────────────────────────────────
check(!/\b(display|visibility|opacity)\s*:/.test(sinComentarios), '2a: la fila oculta algo (display/visibility/opacity)')
check(!/(^|[\s;{])(color|background|background-color|border(-color|-radius|-width)?|box-shadow|fill|stroke)\s*:/m.test(sinComentarios), '2b: la fila cambia colores, fondos, bordes o formas')

// ─── 3. Medidas ────────────────────────────────────────────────────────────
check(/\.px-4:has\(> \[data-fila-movil\]\)[\s\S]*?padding-left: 12px;[\s\S]*?overflow-x: clip;/.test(sinComentarios), '3a: el contenedor no queda a 12 px con overflow-x: clip')
check(/\[data-logo-encabezado\] img \{[^}]*max-width: min\(100%, 40vw\);[^}]*object-fit: contain;[^}]*object-position: left center;/.test(sinComentarios), '3b: el logo no se encoge con contain a la izquierda (máx. 40 vw)')
check(/\[data-logo-encabezado\] \{[^}]*flex-shrink: 1;[^}]*min-width: 0;/.test(sinComentarios), '3c: el logo no puede encogerse (flex-shrink/min-width)')
check(/\[data-icono-circulo='md'\] \{\s*width: 34px;\s*height: 34px;/.test(sinComentarios), '3d: los círculos no quedan en 34 px')
check(/\[data-contenedor-icono\]:not\(\[data-contenedor-icono='none'\]\) \{\s*max-width: 34px !important;/.test(sinComentarios), '3e: las cajas de ícono no quedan en 34 px')
check(/\[data-cta-movil\] \{[^}]*flex-shrink: 0;[^}]*height: 32px !important;[^}]*font-size: 12px !important;[^}]*white-space: nowrap;/.test(sinComentarios), '3f: el botón principal no queda compacto y en una línea')
check(/\[data-acciones-encabezado\] \{\s*gap: 6px;/.test(sinComentarios), '3g: el espacio entre íconos no es de 6 px')

// ─── 4. Último recurso ─────────────────────────────────────────────────────
const angosto = sinComentarios.slice(sinComentarios.indexOf('@media (max-width: 374px)'))
const reglasAngosto = angosto.match(/[^{}]+\{/g) ?? []
check(reglasAngosto.length > 1, '4a: falta el último recurso de ≤ 374 px')
check(reglasAngosto.slice(1).every((r) => r.split(/,\s*\n/).every((s) => s.includes(':has([data-cta-movil], [data-pildora-menu])'))), '4b: el último recurso aplica también a filas sin botón principal')
check(/:is\(a, button\)\.p-2:not\(:has\(\[data-icono-circulo\]/.test(angosto), '4c: el último recurso le devuelve relleno a los íconos con círculo o caja')

// ─── 5. Marcas ─────────────────────────────────────────────────────────────
const fila = leer('components/site/header/mobile/FilaLogoMovil.tsx')
check((fila.match(/data-fila-movil=""/g) ?? []).length === 5, '5a: alguna fila de FilaLogoMovil no lleva data-fila-movil')
check(/data-fila-movil=""/.test(leer('components/site/header/mobile/HeaderMovilConfigurable.tsx')), '5b: el encabezado configurable no lleva data-fila-movil')
check(/data-fila-movil=""/.test(leer('components/site/header/HeaderMinimal.tsx')), '5c: el encabezado minimal no lleva data-fila-movil')
check(/data-fila-movil=""/.test(leer('components/site/header/HeaderPorZonas.tsx')), '5d: el encabezado por zonas no lleva data-fila-movil')
const compartido = leer('components/site/header/HeaderShared.tsx')
check((compartido.match(/data-logo-encabezado=""/g) ?? []).length === 3, '5e: algún logo (imagen, tema o iniciales) no lleva data-logo-encabezado')
check(/data-acciones-encabezado=""/.test(compartido), '5f: las acciones no llevan data-acciones-encabezado')
check(/data-cta-movil=""/.test(compartido) && /data-cta-movil=\{movil \? '' : undefined\}/.test(compartido), '5g: algún botón principal del celular no lleva data-cta-movil')
check(/data-icono-circulo=\{tamano\}/.test(leer('components/site/header/IconoEncabezado.tsx')), '5h: el círculo de los íconos no lleva data-icono-circulo')

if (problemas.length) {
  console.error(`✗ ${problemas.length} de ${casos} comprobaciones fallaron:`)
  for (const p of problemas) console.error('  -', p)
  process.exit(1)
}
console.log(`✓ encabezado del celular: ${casos} comprobaciones`)
