/**
 * Cargador de módulos de Node para `verify-pasarelas-bold-mp.mjs` (no lo uses suelto).
 *
 * - Transpila los `.ts` del repo con `sucrase` (ya está en node_modules; sin dependencias nuevas).
 * - Resuelve el alias `@/` y las rutas sin extensión, como el build de Next.
 * - Cambia por un módulo de registro los efectos que salen de la tienda (ERP, correo, Google Ads,
 *   Meta): la prueba cuenta cuántas veces se llamarían, sin red.
 */
import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join, relative } from 'node:path'
import { createRequire } from 'node:module'

let ROOT = ''
let STUB = ''
let transformar = null

const EFECTOS = new Set([
  '@/lib/google-ads/upload-conversion',
  '@/lib/meta/send-capi-event',
  '@/lib/erp-auto-confirm',
  '@/lib/erp-release-stock',
  '@/lib/erp-refund',
  '@/lib/orders/correoPedidoPagado',
])

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
  return !rel.startsWith('..') && !rel.split(/[\\/]/).includes('node_modules')
}

export async function resolve(specifier, context, next) {
  if (EFECTOS.has(specifier)) return { url: STUB, shortCircuit: true }
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
