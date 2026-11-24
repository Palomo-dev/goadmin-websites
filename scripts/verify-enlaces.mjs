#!/usr/bin/env node
/**
 * Los enlaces internos de la tienda usan `@/components/site/Enlace` (sin precarga automática),
 * no `next/link` directo. Con `next/link` cada enlace visible precarga su destino: 17 peticiones
 * de más por ficha y 44 por portada, medidas el 2026-11-24.
 *
 * Falla si un archivo de `app/`, `components/` o `lib/` importa `next/link` y no está en la lista
 * de permitidos. Sin dependencias: lee el propio código fuente.
 *
 *   node scripts/verify-enlaces.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(fileURLToPath(import.meta.url), '..', '..')

/** Quién puede importar `next/link` directo, y por qué. */
const PERMITIDOS = new Map([
  ['components/site/Enlace.tsx', 'es el envoltorio'],
  // Archivo delicado (checkout de todos los sitios): su único enlace («Seguir comprando»,
  // /productos) se deja con `next/link` para no tocar el archivo por esto.
  ['components/site/CheckoutWizard.tsx', 'checkout: no se toca por una optimización'],
  // Arnés de la prueba: lleva un `next/link` directo como testigo de que la precarga se detecta.
  ['app/pruebas-internas/enlaces/page.tsx', 'testigo de scripts/pruebas/enlaces-precarga.mjs'],
])

function archivos(dir) {
  const salida = []
  for (const nombre of readdirSync(dir)) {
    if (nombre === 'node_modules' || nombre.startsWith('.')) continue
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta))
    else if (/\.(tsx?|jsx?|mjs)$/.test(nombre)) salida.push(ruta)
  }
  return salida
}

const fallos = []
let revisados = 0
let conEnlace = 0
for (const carpeta of ['app', 'components', 'lib']) {
  for (const ruta of archivos(join(RAIZ, carpeta))) {
    revisados += 1
    const rel = relative(RAIZ, ruta).split('\\').join('/')
    const fuente = readFileSync(ruta, 'utf8')
    if (/from\s+['"]@\/components\/site\/Enlace['"]/.test(fuente)) conEnlace += 1
    if (/from\s+['"]next\/link['"]|require\(\s*['"]next\/link['"]\s*\)/.test(fuente) && !PERMITIDOS.has(rel)) {
      fallos.push(rel)
    }
  }
}

// El envoltorio: sin precarga por defecto, con la del checkout y respetando `prefetch` explícito.
const envoltorio = readFileSync(join(RAIZ, 'components/site/Enlace.tsx'), 'utf8')
const reglas = [
  [/prefetch !== undefined \? prefetch/, 'respeta `prefetch` cuando se pasa a mano'],
  [/esRutaConPrecarga\(href\) \? undefined : false/, 'sin precarga salvo en las rutas con `loading.tsx`'],
  [/\\\/checkout\\\/\?\$/, 'el checkout conserva su precarga'],
]
for (const [patron, que] of reglas) {
  if (!patron.test(envoltorio)) fallos.push(`components/site/Enlace.tsx: falta «${que}»`)
}

if (fallos.length > 0) {
  console.error('✗ verify-enlaces: importan `next/link` directo (usa `@/components/site/Enlace`):')
  for (const f of fallos) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✓ verify-enlaces: ${revisados} archivos revisados, ${conEnlace} usan Enlace, ${PERMITIDOS.size} permitidos con next/link.`)
