/**
 * verify-rutas-prohibidas.mjs — guardia de las plantillas de tienda (PLANO §5 W7, riesgos R1 y R6).
 *
 *   npm run verify:rutas-prohibidas
 *   BASE_REF=main npm run verify:rutas-prohibidas     (por defecto origin/main)
 *
 * Falla si la rama toca, respecto a BASE_REF, alguna ruta del dinero o el esquema estricto del
 * documento del sitio. Mira lo commiteado (`git diff --name-only BASE_REF...HEAD`) y además lo que
 * aún no se ha commiteado (`git diff --name-only HEAD`), para avisar antes del commit.
 *
 * Sin dependencias: solo git.
 */
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE_REF = process.env.BASE_REF || 'origin/main'

/** Archivos exactos o carpetas (terminan en «/»). */
const PROHIBIDAS = [
  'components/site/CheckoutWizard.tsx',
  'app/api/orders/',
  'app/api/checkout/',
  'app/api/shipping/',
  'app/api/webhooks/',
  'lib/cart.ts',
  'lib/checkout/',
  'lib/website/v2/contrato/documentoSitio.ts',
]

function git(args) {
  return execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' })
}

function archivos(args) {
  return git(args).split('\n').map((l) => l.trim()).filter(Boolean)
}

export function esProhibida(ruta) {
  return PROHIBIDAS.some((p) => (p.endsWith('/') ? ruta.startsWith(p) : ruta === p))
}

try {
  git(['rev-parse', '--verify', '--quiet', `${BASE_REF}^{commit}`])
} catch {
  console.error(`✗ verify-rutas-prohibidas: no existe la referencia «${BASE_REF}» (BASE_REF=<rama> para otra)`)
  process.exit(1)
}

// Autoprueba del comparador: que la guardia no pase por un error de la propia guardia.
const autoprueba = [
  ['app/api/orders/route.ts', true],
  ['app/api/checkout/init/route.ts', true],
  ['app/api/webhooks/wompi_co/route.ts', true],
  ['lib/checkout/total.ts', true],
  ['lib/cart.ts', true],
  ['components/site/CheckoutWizard.tsx', true],
  ['lib/website/v2/contrato/documentoSitio.ts', true],
  ['lib/cartas.ts', false],
  ['app/api/ordersx/route.ts', false],
  ['components/site/CheckoutWizardAyuda.tsx', false],
  ['lib/website/v2/contrato/seccionesTienda.ts', false],
]
const fallosAutoprueba = autoprueba.filter(([r, esperado]) => esProhibida(r) !== esperado)
if (fallosAutoprueba.length > 0) {
  console.error(`✗ verify-rutas-prohibidas: el comparador falla en ${fallosAutoprueba.map(([r]) => r).join(', ')}`)
  process.exit(1)
}

const commiteados = archivos(['diff', '--name-only', `${BASE_REF}...HEAD`])
const pendientes = archivos(['diff', '--name-only', 'HEAD'])
const tocadas = [...new Set([...commiteados, ...pendientes])].filter(esProhibida).sort()

if (tocadas.length > 0) {
  console.error(`✗ verify-rutas-prohibidas: la rama toca rutas prohibidas respecto a ${BASE_REF}:`)
  for (const r of tocadas) console.error(`  - ${r}${pendientes.includes(r) && !commiteados.includes(r) ? ' (sin commitear)' : ''}`)
  process.exit(1)
}
console.log(`✓ verify-rutas-prohibidas: ${commiteados.length} archivos cambiados respecto a ${BASE_REF} (+${pendientes.length} sin commitear), ninguno en las ${PROHIBIDAS.length} rutas prohibidas`)
