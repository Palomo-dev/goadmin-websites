/**
 * Cargador de módulos de Node para `verify-membresias.mjs` (no lo uses suelto).
 *
 * - Transpila `.ts` / `.tsx` del repo con `sucrase` (ya está en node_modules como dependencia de
 *   tailwindcss; no se agrega ninguna dependencia).
 * - Resuelve el alias `@/` y las rutas sin extensión, como el build de Next.
 * - Dobles fijos para lo que necesita Next o el navegador: enlace, router y el modo «vista previa
 *   del editor» (`globalThis.__VISTA_PREVIA__`).
 */
import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { createRequire } from 'node:module'

let ROOT = ''
let transformar = null

const DOBLES = {
  'next/link': `import { createElement } from 'react'
export default function Link({ href, children, prefetch, scroll, replace, ...resto }) {
  return createElement('a', { href: typeof href === 'string' ? href : String(href?.pathname ?? ''), ...resto }, children)
}`,
  'next/navigation': `export function useRouter() { return { push() {}, replace() {}, prefetch() {}, back() {}, refresh() {} } }
export function usePathname() { return '/' }
export function useSearchParams() { return new URLSearchParams() }`,
  '@/components/sections/PreviewBridge': `export function useIsPreviewMode() { return globalThis.__VISTA_PREVIA__ === true }`,
}

export async function initialize(data) {
  ROOT = data.root
  transformar = createRequire(join(ROOT, 'package.json'))('sucrase').transform
}

const EXTENSIONES = ['', '.tsx', '.ts', '.js', '.mjs', '/index.tsx', '/index.ts', '/index.js']

async function esArchivo(ruta) {
  try {
    return (await stat(ruta)).isFile()
  } catch {
    return false
  }
}

export async function resolve(especificador, contexto, siguiente) {
  if (DOBLES[especificador]) return { url: `doble:${especificador}`, shortCircuit: true }
  let base = null
  if (especificador.startsWith('@/')) base = join(ROOT, especificador.slice(2))
  else if (especificador.startsWith('.') && contexto.parentURL?.startsWith('file:')) {
    base = join(fileURLToPath(new URL('.', contexto.parentURL)), especificador)
  }
  if (base) {
    for (const ext of EXTENSIONES) {
      if (await esArchivo(base + ext)) return { url: pathToFileURL(base + ext).href, shortCircuit: true }
    }
  }
  if (especificador.startsWith('node:') || especificador.startsWith('file:')) return siguiente(especificador, contexto)
  return siguiente(especificador, { ...contexto, parentURL: pathToFileURL(join(ROOT, 'package.json')).href })
}

export async function load(url, contexto, siguiente) {
  if (url.startsWith('doble:')) return { format: 'module', source: DOBLES[url.slice('doble:'.length)], shortCircuit: true }
  if (url.startsWith('file:') && /\.tsx?$/.test(url) && !url.includes('/node_modules/')) {
    const ruta = fileURLToPath(url)
    const { code } = transformar(await readFile(ruta, 'utf8'), {
      transforms: ['typescript', 'jsx'],
      jsxRuntime: 'automatic',
      production: true,
      filePath: ruta,
    })
    return { format: 'module', source: code, shortCircuit: true }
  }
  return siguiente(url, contexto)
}
