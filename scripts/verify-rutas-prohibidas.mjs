/**
 * verify-rutas-prohibidas.mjs — guardia de las plantillas de tienda (PLANO §5 W7, riesgos R1 y R6).
 *
 *   npm run verify:rutas-prohibidas
 *   BASE_REF=main npm run verify:rutas-prohibidas     (por defecto origin/main)
 *
 * Falla si la rama toca, respecto a BASE_REF, alguna ruta del dinero o el esquema estricto del
 * documento del sitio. Mira lo commiteado (`git diff --name-only BASE_REF...HEAD`) y además lo que
 * aún no se ha commiteado (`git diff --name-only HEAD` y, desde el 2026-11-23, los archivos nuevos
 * sin seguimiento: antes una ruta nueva dentro de una carpeta prohibida, como
 * app/api/shipping/quote/route.ts, no se veía), para avisar antes del commit.
 *
 * Excepciones: PERMITIDAS_TEMPORALES, archivo por archivo, con motivo y fecha de vencimiento. Al
 * vencer, la guardia vuelve a fallar por esas rutas si siguen sin estar en BASE_REF.
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

/**
 * Cambios del dinero que SÍ se revisaron, con fecha de vencimiento (inclusive, día de Bogotá).
 *
 * 2026-11-23 — Logística Fase 1 (domicilio propio, Colombia; ERP docs/logistica/FASE1-CIMIENTOS.md,
 * TODO 6). Esta guardia es de las plantillas de tienda (W1–W7): que un trabajo de diseño no toque
 * el dinero. La Fase 1 SÍ tiene que tocarlo, y lo hace para endurecerlo; revisado uno por uno:
 * - app/api/orders/route.ts: el envío lo decide SIEMPRE el servidor (antes se cobraba el
 *   `shipping` del navegador salvo con ORDERS_ENFORCE_SERVER_SHIPPING=true, y aceptaba 0).
 *   Domicilio propio con zonas: `logistica_cotizar_envio` con el subtotal del servidor y la
 *   organización de la sesión del host; fuera de cobertura o bajo el mínimo, 422; tarifa ajena,
 *   409. El `shipping` del navegador solo se registra como desfase.
 * - app/api/orders/[id]/tracking/route.ts: `logistica_rastreo_publico` con service role SOLO con
 *   el token `?t=` válido; sin él, ningún dato del envío. Sin fotos ni firmas de entrega
 *   (`shipment-pod` es privado) y sin teléfono del domiciliario.
 * - app/api/orders/[id]/delivery/route.ts: solo el primer nombre del domiciliario; sin teléfono,
 *   foto de perfil, fotos ni firma de la prueba de entrega; sin token, nada del envío.
 * - app/api/shipping/quote/route.ts (nueva): cotización informativa del checkout; organización del
 *   host, sede validada contra ella, límite por IP y respuesta recortada (`cotizacionPublica`).
 * - components/site/CheckoutWizard.tsx: muestra la cotización por zona y manda el barrio; el
 *   total que pinta es informativo, /api/orders vuelve a cotizar.
 * Vence el 2026-12-07: para entonces la Fase 1 debe estar en origin/main (y la excepción sobra).
 * Comprobado por scripts/verify-zonas-envio.mjs (cobro del servidor, recorte de la cotización,
 * token del rastreo, sin fotos ni teléfono).
 */
const PERMITIDAS_TEMPORALES = [
  { ruta: 'app/api/orders/route.ts', hasta: '2026-12-07', motivo: 'Logística Fase 1: envío decidido en el servidor' },
  { ruta: 'app/api/orders/[id]/tracking/route.ts', hasta: '2026-12-07', motivo: 'Logística Fase 1: rastreo público con token' },
  { ruta: 'app/api/orders/[id]/delivery/route.ts', hasta: '2026-12-07', motivo: 'Logística Fase 1: sin teléfono ni fotos' },
  { ruta: 'app/api/shipping/quote/route.ts', hasta: '2026-12-07', motivo: 'Logística Fase 1: cotización del checkout' },
  { ruta: 'components/site/CheckoutWizard.tsx', hasta: '2026-12-07', motivo: 'Logística Fase 1: domicilio por zona' },
]

/** Día calendario de hoy en Bogotá (YYYY-MM-DD), sin pasar por UTC. */
function hoyBogota() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

/** La excepción vigente de una ruta en el día `hoy`, o null. */
export function excepcionVigente(ruta, hoy, lista = PERMITIDAS_TEMPORALES) {
  return lista.find((e) => e.ruta === ruta && hoy <= e.hasta) ?? null
}

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
// Las excepciones: exactas (no la carpeta), y caducan.
const PRUEBA_EXC = [{ ruta: 'app/api/orders/route.ts', hasta: '2026-12-07', motivo: 'prueba' }]
const autopruebaExc = [
  ['app/api/orders/route.ts', '2026-11-23', true],
  ['app/api/orders/route.ts', '2026-12-07', true],
  ['app/api/orders/route.ts', '2026-12-08', false],
  ['app/api/orders/otra/route.ts', '2026-11-23', false],
]
for (const [r, hoy, esperado] of autopruebaExc) {
  if (!!excepcionVigente(r, hoy, PRUEBA_EXC) !== esperado) fallosAutoprueba.push([`${r} @ ${hoy}`])
}
if (fallosAutoprueba.length > 0) {
  console.error(`✗ verify-rutas-prohibidas: el comparador falla en ${fallosAutoprueba.map(([r]) => r).join(', ')}`)
  process.exit(1)
}

const commiteados = archivos(['diff', '--name-only', `${BASE_REF}...HEAD`])
const pendientes = [
  ...archivos(['diff', '--name-only', 'HEAD']),
  ...archivos(['ls-files', '--others', '--exclude-standard']),
]
const hoy = hoyBogota()
const prohibidasTocadas = [...new Set([...commiteados, ...pendientes])].filter(esProhibida).sort()
const permitidas = prohibidasTocadas.filter((r) => excepcionVigente(r, hoy))
const tocadas = prohibidasTocadas.filter((r) => !excepcionVigente(r, hoy))

for (const r of permitidas) {
  const e = excepcionVigente(r, hoy)
  console.log(`! verify-rutas-prohibidas: ${r} permitida hasta el ${e.hasta} (${e.motivo})`)
}
const vencidas = PERMITIDAS_TEMPORALES.filter((e) => hoy > e.hasta && prohibidasTocadas.includes(e.ruta))
for (const e of vencidas) console.error(`  (la excepción de ${e.ruta} venció el ${e.hasta})`)

if (tocadas.length > 0) {
  console.error(`✗ verify-rutas-prohibidas: la rama toca rutas prohibidas respecto a ${BASE_REF}:`)
  for (const r of tocadas) console.error(`  - ${r}${pendientes.includes(r) && !commiteados.includes(r) ? ' (sin commitear)' : ''}`)
  process.exit(1)
}
console.log(`✓ verify-rutas-prohibidas: ${commiteados.length} archivos cambiados respecto a ${BASE_REF} (+${pendientes.length} sin commitear), ninguno en las ${PROHIBIDAS.length} rutas prohibidas${permitidas.length ? ` salvo ${permitidas.length} con excepción vigente` : ''}`)
