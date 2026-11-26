/**
 * Cargador de módulos de Node para `verify-uso-pasarela.mjs` (no lo uses suelto).
 *
 * Igual que `verify-pasarelas-bold-mp.cargador.mjs` (sucrase, alias `@/`, rutas sin extensión),
 * pero cambia `@/lib/supabase/server` por una base en memoria: la prueba no sale a la red.
 */
import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join, relative } from 'node:path'
import { createRequire } from 'node:module'

let ROOT = ''
let STUB = ''
let transformar = null

const FALSOS = new Set(['@/lib/supabase/server'])

export async function initialize(data) {
  ROOT = data.root
  STUB = data.stub
  transformar = createRequire(join(ROOT, 'package.json'))('sucrase').transform
}

const EXTENSIONES = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx']

async function existe(ruta) {
  try {
    return (await stat(ruta)).isFile()
  } catch {
    return false
  }
}

function enRepo(ruta) {
  const rel = relative(ROOT, ruta)
  return !rel.startsWith('..') && !rel.split(/[\/]/).includes('node_modules')
}

export async function resolve(specifier, context, next) {
  if (FALSOS.has(specifier)) return { url: STUB, shortCircuit: true }
  const padre = context.parentURL || ''
  let candidato = null
  if (specifier.startsWith('@/')) candidato = join(ROOT, specifier.slice(2))
  else if ((specifier.startsWith('./') || specifier.startsWith('../')) && padre.startsWith('file:')) {
    candidato = join(fileURLToPath(new URL('.', padre)), specifier)
  }
  if (candidato && enRepo(candidato)) {
    for (const ext of EXTENSIONES) {
      if (await existe(candidato + ext)) return { url: pathToFileURL(candidato + ext).href, shortCircuit: true }
    }
  }
  return next(specifier, context)
}

export async function load(url, context, next) {
  if (url.startsWith('file:') && /\.tsx?$/.test(url) && enRepo(fileURLToPath(url))) {
    const fuente = await readFile(fileURLToPath(url), 'utf8')
    const { code } = transformar(fuente, { transforms: ['typescript'], filePath: fileURLToPath(url) })
    return { format: 'module', source: code, shortCircuit: true }
  }
  return next(url, context)
}
