/**
 * Cargador de módulos para pintar la tarjeta de producto en Node, sin Next ni dependencias nuevas.
 *
 * - Resuelve el alias `@/` y las rutas sin extensión del repo, y transpila `.ts`/`.tsx` con
 *   `sucrase` (ya está en node_modules: lo trae tailwindcss).
 * - Reemplaza por dobles fijos lo que necesita el navegador o la red (enlace e imagen de Next,
 *   router, favoritos, sesión, carrito, diálogos). Los mismos dobles en las dos pasadas: la
 *   comparación con `main` es justa.
 * - Con `ref` (p. ej. `main`), todo archivo del repo que difiera de esa rama se lee con
 *   `git show <ref>:<ruta>`: la pasada «referencia» pinta exactamente el código de `main`.
 *
 * Lo registra `registrar.mjs`; lo usa `scripts/verify-tarjeta-producto.mjs`.
 */
import { readFile } from 'node:fs/promises'
import { statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, relative, sep } from 'node:path'
import { createRequire } from 'node:module'

let ROOT = ''
let REF = null
let cambiados = new Set()
let transformar = null

const DOBLES = {
  'next/link': `import { createElement } from 'react'
export default function Link({ href, children, className, prefetch, scroll, replace, ...resto }) {
  return createElement('a', { href: typeof href === 'string' ? href : String(href?.pathname ?? ''), className, ...resto }, children)
}`,
  'next/image': `import { createElement } from 'react'
export default function Image({ src, alt, fill, sizes, className, style, priority, quality, placeholder, loading, unoptimized, ...resto }) {
  return createElement('img', { src, alt, className, sizes, style, 'data-fill': fill ? '' : undefined, ...resto })
}`,
  'next/navigation': `export function useRouter() { return { push() {}, replace() {}, prefetch() {}, back() {}, refresh() {} } }
export function usePathname() { return '/' }
export function useSearchParams() { return new URLSearchParams() }`,
  '@/components/site/CurrencyProvider': `import { createElement } from 'react'
export function Price({ value, className, style }) {
  return createElement('span', { className, style, 'data-precio': '' }, '$ ' + Number(value).toLocaleString('es-CO'))
}
export function useCurrency() { return { format: (v) => '$ ' + Number(v).toLocaleString('es-CO') } }`,
  '@/lib/hooks/useFavorites': `export function useFavorites() { return { isFavorite: () => false, toggleFavorite() {} } }`,
  '@/lib/hooks/useAuthCustomer': `export function useAuthCustomer() { return { customer: null } }`,
  '@/components/site/ProductQuickView': `export function ProductQuickView() { return null }`,
  '@/components/site/DialogoVariantes': `export function useDialogoVariantes() { return { abrir() {}, dialogo: null } }`,
  '@/components/site/ShareDialog': `export function ShareDialog() { return null }`,
  '@/lib/cart': `export function addProductToCart() {}
export function useCartLineQty() { return 0 }`,
  './CardQuantityStepper': `import { createElement } from 'react'
export function CardQuantityStepper() { return createElement('span', { 'data-doble': 'contador' }) }`,
}

export async function initialize(datos) {
  ROOT = datos.root
  REF = datos.ref || null
  const requerir = createRequire(join(ROOT, 'package.json'))
  transformar = requerir('sucrase').transform
  if (REF) {
    const salida = execFileSync('git', ['-C', ROOT, 'diff', '--name-only', REF, '--'], { encoding: 'utf8' })
    cambiados = new Set(salida.split('\n').map((s) => s.trim()).filter(Boolean))
  }
}

function esArchivo(p) {
  try {
    return statSync(p).isFile()
  } catch {
    return false
  }
}

function probar(base) {
  for (const p of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (esArchivo(p)) return p
  }
  return null
}

export async function resolve(especificador, contexto, siguiente) {
  if (DOBLES[especificador]) return { url: `doble:${especificador}`, shortCircuit: true }
  let base = null
  if (especificador.startsWith('@/')) base = join(ROOT, especificador.slice(2))
  else if (especificador.startsWith('.') && contexto.parentURL?.startsWith('file:')) {
    base = join(dirname(fileURLToPath(contexto.parentURL)), especificador)
  }
  if (base) {
    const p = probar(base)
    if (p) return { url: pathToFileURL(p).href, shortCircuit: true }
  }
  if (especificador.startsWith('node:') || especificador.startsWith('file:')) return siguiente(especificador, contexto)
  // Paquetes: siempre desde la raíz del repo (node_modules).
  return siguiente(especificador, { ...contexto, parentURL: pathToFileURL(join(ROOT, 'package.json')).href })
}

export async function load(url, contexto, siguiente) {
  if (url.startsWith('doble:')) {
    return { format: 'module', source: DOBLES[url.slice('doble:'.length)], shortCircuit: true }
  }
  if (url.startsWith('file:')) {
    const ruta = fileURLToPath(url)
    const rel = relative(ROOT, ruta).split(sep).join('/')
    const delRepo = !rel.startsWith('..') && !rel.startsWith('node_modules/')
    if (delRepo && /\.(tsx?)$/.test(ruta)) {
      const fuente = REF && cambiados.has(rel)
        ? execFileSync('git', ['-C', ROOT, 'show', `${REF}:${rel}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
        : await readFile(ruta, 'utf8')
      const { code } = transformar(fuente, {
        transforms: ['typescript', 'jsx'],
        jsxRuntime: 'automatic',
        production: true,
        filePath: ruta,
      })
      return { format: 'module', source: code, shortCircuit: true }
    }
  }
  return siguiente(url, contexto)
}
