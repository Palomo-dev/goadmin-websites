/**
 * Cargador de módulos de Node para `verify-categoria-plantilla.mjs` (no lo uses suelto).
 *
 * - Transpila `.ts` / `.tsx` del repo con `sucrase` (ya está en node_modules como dependencia
 *   de tailwindcss; no se agrega ninguna dependencia).
 * - Resuelve el alias `@/` y las rutas sin extensión, como el build de Next.
 * - Grafo «base»: una URL con `?base` lee los archivos de `BASE_FILES` tal como están en la
 *   referencia base (`git show <ref>:<ruta>`, contenido pasado por `initialize`) y propaga
 *   `?base` a sus importaciones del repo. node_modules se comparte (un solo React).
 */
import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join, relative } from 'node:path'
import { createRequire } from 'node:module'

let ROOT = ''
let BASE = new Map()
let transformar = null

export async function initialize(data) {
  ROOT = data.root
  BASE = new Map(Object.entries(data.base))
  const require = createRequire(join(ROOT, 'package.json'))
  transformar = require('sucrase').transform
}

const EXTENSIONES = ['', '.tsx', '.ts', '.js', '.mjs', '/index.tsx', '/index.ts', '/index.js']

async function existe(ruta) {
  try {
    return (await stat(ruta)).isFile()
  } catch {
    return false
  }
}

function enRepo(ruta) {
  const rel = relative(ROOT, ruta)
  return !rel.startsWith('..') && !rel.split(/[\\/]/).includes('node_modules')
}

export async function resolve(specifier, context, next) {
  const padre = context.parentURL || ''
  const deBase = padre.includes('?base')
  let candidato = null
  if (specifier.startsWith('@/')) candidato = join(ROOT, specifier.slice(2))
  else if ((specifier.startsWith('./') || specifier.startsWith('../')) && padre.startsWith('file:')) {
    candidato = join(fileURLToPath(new URL('.', padre.split('?')[0])), specifier)
  }
  if (candidato && enRepo(candidato)) {
    for (const ext of EXTENSIONES) {
      if (await existe(candidato + ext)) {
        const url = pathToFileURL(candidato + ext).href
        return { url: deBase ? `${url}?base` : url, shortCircuit: true }
      }
    }
  }
  try {
    return await next(specifier, context)
  } catch (error) {
    // Paquetes sin mapa de `exports` (next/link, next/navigation): en ESM hace falta la extensión.
    if (error?.code === 'ERR_MODULE_NOT_FOUND' && !specifier.startsWith('.') && !/\.[cm]?js$/.test(specifier)) {
      return next(`${specifier}.js`, context)
    }
    throw error
  }
}

export async function load(url, context, next) {
  if (!url.startsWith('file:')) return next(url, context)
  const [limpia] = url.split('?')
  const ruta = fileURLToPath(limpia)
  if (!enRepo(ruta) || !/\.(tsx?|mjs|js)$/.test(ruta)) return next(url, context)
  if (/\.(mjs|js)$/.test(ruta)) return next(url, context)
  const rel = relative(ROOT, ruta).split('\\').join('/')
  const fuente = url.includes('?base') && BASE.has(rel) ? BASE.get(rel) : await readFile(ruta, 'utf8')
  const { code } = transformar(fuente, {
    transforms: ['typescript', 'jsx'],
    jsxRuntime: 'automatic',
    production: true,
    filePath: ruta,
  })
  return { format: 'module', source: code, shortCircuit: true }
}
