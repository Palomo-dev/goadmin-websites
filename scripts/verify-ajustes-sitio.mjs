/**
 * verify-ajustes-sitio.mjs — contrato de los ajustes del ERP (Configuración y Ventas en línea)
 * que lee el sitio público, y la regla de pedido mínimo y compra como invitado.
 *
 *   npm run verify:ajustes                                        (solo la lógica pura)
 *   node --env-file=.env.local scripts/verify-ajustes-sitio.mjs   (además, contra la base)
 *
 * 1. Sin base:
 *    - lib/website/ajustesSitio.ts: con la fila nula, vacía o con los DEFAULT de las columnas
 *      sale EXACTAMENTE lo de antes (sin mantenimiento, es-CO, sin código, sin WhatsApp,
 *      invitado permitido, sin mínimo, selector). Valores fuera del contrato → default.
 *      Código a medida con las reglas del ERP (activo, nombre, alcance, ≤ 20 000, ≤ 20).
 *    - lib/orders/reglasCheckoutSitio.ts: con los DEFAULT nunca bloquea; el mínimo se compara
 *      con el subtotal; sin cuenta y con invitado apagado → 401; con sesión, ok.
 * 2. Con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (service role, solo lecturas):
 *    ejecuta el `select` de COLUMNAS_AJUSTES contra website_settings (una columna inexistente da
 *    42703) y pasa cada fila por ajustesSitioDesdeFila. Informa cuántas usan cada ajuste
 *    (conteos, nunca nombres).
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { stripTypeScriptTypes } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

/** Columnas del contrato (verificadas por MCP el 2026-10-06). */
const COLUMNAS_AJUSTES = [
  'organization_id', 'maintenance_mode', 'maintenance_message', 'site_locale', 'custom_code',
  'whatsapp_number', 'whatsapp_greeting', 'checkout_guest_enabled', 'checkout_min_order_amount',
  'multi_outlet_mode',
]

const problemas = []
const notas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const igual = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), `${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`)

// ─── Carga de los módulos puros ──────────────────────────────────────────────────────────────
async function cargarPuro(dir, ruta, nombre) {
  const ts = await readFile(join(ROOT, ruta), 'utf8')
  const js = stripTypeScriptTypes(ts, { mode: 'strip' }).replace(/^import\s+type[^\n]*\n/gm, '')
  if (/^import\s/m.test(js)) throw new Error(`${ruta} dejó de ser puro (import con valor)`)
  await writeFile(join(dir, nombre), js)
  return import(pathToFileURL(join(dir, nombre)).href)
}

const dir = join(ROOT, '.verify-ajustes-tmp')
await rm(dir, { recursive: true, force: true })
await mkdir(dir)
let a
let r
try {
  a = await cargarPuro(dir, 'lib/website/ajustesSitio.ts', 'ajustesSitio.mjs')
  r = await cargarPuro(dir, 'lib/orders/reglasCheckoutSitio.ts', 'reglasCheckoutSitio.mjs')
} finally {
  await rm(dir, { recursive: true, force: true })
}

// ─── 1a. Ajustes: con default, lo de antes ───────────────────────────────────────────────────
const ANTES = {
  mantenimiento: { activo: false, mensaje: null },
  idioma: 'es-CO',
  codigoPropio: [],
  whatsapp: null,
  checkout: { invitado: true, pedidoMinimo: null },
  modoSedes: 'selector',
}
igual(a.ajustesSitioDesdeFila(null), ANTES, 'fila nula')
igual(a.ajustesSitioDesdeFila(undefined), ANTES, 'fila ausente')
igual(a.ajustesSitioDesdeFila({}), ANTES, 'fila sin las columnas (caché anterior a la migración)')
const DEFAULTS_BD = {
  maintenance_mode: false, maintenance_message: null, site_locale: 'es-CO', custom_code: [],
  whatsapp_number: null, whatsapp_greeting: null, checkout_guest_enabled: true,
  checkout_min_order_amount: null, multi_outlet_mode: 'selector',
}
igual(a.ajustesSitioDesdeFila(DEFAULTS_BD), ANTES, 'fila con los DEFAULT de la base')
igual(a.AJUSTES_POR_DEFECTO, ANTES, 'AJUSTES_POR_DEFECTO')

// Fuera del contrato → default.
const raro = a.ajustesSitioDesdeFila({
  maintenance_mode: 'true', site_locale: 'de', custom_code: 'texto', whatsapp_number: 'llámame',
  checkout_guest_enabled: null, checkout_min_order_amount: -5, multi_outlet_mode: 'otro',
})
igual(raro, ANTES, 'valores fuera del contrato')
igual(a.ajustesSitioDesdeFila({ checkout_min_order_amount: 0 }).checkout.pedidoMinimo, null, 'mínimo 0 = sin mínimo')
igual(a.ajustesSitioDesdeFila({ checkout_min_order_amount: '50000.00' }).checkout.pedidoMinimo, 50000, 'numeric llega como texto desde PostgREST')
igual(a.ajustesSitioDesdeFila({ checkout_guest_enabled: false }).checkout.invitado, false, 'invitado apagado')
igual(a.ajustesSitioDesdeFila({ multi_outlet_mode: 'per_branch' }).modoSedes, 'per_branch', 'un sitio por sede')
igual(a.ajustesSitioDesdeFila({ site_locale: 'en' }).idioma, 'en', 'idioma en')
igual(a.ajustesSitioDesdeFila({ maintenance_mode: true, maintenance_message: '  Vuelvo el lunes ' }).mantenimiento, { activo: true, mensaje: 'Vuelvo el lunes' }, 'mantenimiento con mensaje')
igual(a.ajustesSitioDesdeFila({ maintenance_message: 'x'.repeat(301) }).mantenimiento.mensaje, null, 'mensaje de mantenimiento > 300')
igual(a.ajustesSitioDesdeFila({ whatsapp_number: '+57 300 123 4567', whatsapp_greeting: 'Hola' }).whatsapp, { numero: '+57 300 123 4567', saludo: 'Hola' }, 'WhatsApp con saludo')
igual(a.ajustesSitioDesdeFila({ whatsapp_number: '   ' }).whatsapp, null, 'WhatsApp en blanco')
igual(a.enlaceWhatsapp({ numero: '300 123 4567', saludo: 'Hola, quiero pedir' }), 'https://wa.me/573001234567?text=Hola%2C%20quiero%20pedir', 'wa.me con 10 dígitos colombianos')
igual(a.enlaceWhatsapp({ numero: '+1 (555) 010-9999', saludo: null }), 'https://wa.me/15550109999', 'wa.me internacional sin saludo')

// ─── 1b. Código a medida: reglas del ERP ─────────────────────────────────────────────────────
const bloque = (extra = {}) => ({ id: 'b1', nombre: 'Chat', alcance: 'todas', posicion: 'body', activo: true, codigo: '<script>1</script>', creado_por: 'u', creado_en: 't', ...extra })
igual(a.bloquesCodigo([bloque()]), [{ id: 'b1', nombre: 'Chat', alcance: 'todas', posicion: 'body', codigo: '<script>1</script>' }], 'bloque válido (sin autor ni fecha en la salida)')
igual(a.bloquesCodigo([bloque({ activo: false })]), [], 'bloque inactivo')
igual(a.bloquesCodigo([bloque({ activo: undefined })]).length, 1, 'activo ausente = activo (codigoDeFila del ERP)')
igual(a.bloquesCodigo([bloque({ nombre: '' })]), [], 'sin nombre')
igual(a.bloquesCodigo([bloque({ id: null })]), [], 'sin id')
igual(a.bloquesCodigo([bloque({ alcance: 'gracias' })]), [], 'alcance sin barra')
igual(a.bloquesCodigo([bloque({ alcance: '/a b' })]), [], 'alcance con espacio')
igual(a.bloquesCodigo([bloque({ alcance: 'javascript:alert(1)' })]), [], 'alcance con esquema')
igual(a.bloquesCodigo([bloque({ codigo: '   ' })]), [], 'código en blanco')
igual(a.bloquesCodigo([bloque({ codigo: 'x'.repeat(20001) })]), [], 'código > 20 000')
igual(a.bloquesCodigo([bloque({ codigo: 'x'.repeat(20000) })]).length, 1, 'código de 20 000 justos')
igual(a.bloquesCodigo([bloque({ posicion: 'head' })])[0].posicion, 'head', 'posición head')
igual(a.bloquesCodigo([bloque({ posicion: 'footer' })])[0].posicion, 'body', 'posición desconocida → body (RPC del ERP)')
igual(a.bloquesCodigo(Array.from({ length: 25 }, (_, i) => bloque({ id: `b${i}` }))).length, 20, 'como mucho 20 bloques')
igual(a.bloquesCodigo([null, 3, 'x', [], bloque()]).length, 1, 'elementos que no son objetos')

const bTodas = { alcance: 'todas' }
const bGracias = { alcance: '/gracias' }
const bRaiz = { alcance: '/' }
check(a.bloqueAplicaEnRuta(bTodas, '/checkout'), '«todas» incluye /checkout (el ERP no lo excluye)')
check(a.bloqueAplicaEnRuta(bGracias, '/gracias'), '/gracias en /gracias')
check(a.bloqueAplicaEnRuta(bGracias, '/gracias/'), '/gracias en /gracias/')
check(a.bloqueAplicaEnRuta(bGracias, '/gracias/123?x=1'), '/gracias en /gracias/123?x=1')
check(!a.bloqueAplicaEnRuta(bGracias, '/graciasx'), '/gracias NO en /graciasx')
check(!a.bloqueAplicaEnRuta(bGracias, '/checkout'), '/gracias NO en /checkout')
check(a.bloqueAplicaEnRuta(bRaiz, '/') && !a.bloqueAplicaEnRuta(bRaiz, '/productos'), '«/» solo en la home')

// ─── 1c. Regla de pedido mínimo e invitado ───────────────────────────────────────────────────
const OK = { ok: true }
// Con los DEFAULT (invitado permitido, sin mínimo) nunca bloquea, con o sin sesión, con cualquier subtotal.
for (const conSesion of [true, false]) {
  for (const subtotal of [0, 1, 999999999, NaN]) {
    igual(r.evaluarCompraInvitado({ invitadoPermitido: true, conSesion }), OK, `invitado permitido (sesión=${conSesion})`)
    igual(r.evaluarPedidoMinimo({ minimo: null, subtotal }), OK, `sin mínimo (subtotal ${subtotal})`)
  }
}
igual(r.evaluarPedidoMinimo({ minimo: 0, subtotal: 0 }), OK, 'mínimo 0')
igual(r.evaluarCompraInvitado({ invitadoPermitido: false, conSesion: true }), OK, 'invitado apagado con sesión')
igual(r.evaluarCompraInvitado({ invitadoPermitido: false, conSesion: false }), { ok: false, codigo: 'requiere_cuenta', status: 401 }, 'invitado apagado sin sesión')
igual(r.evaluarPedidoMinimo({ minimo: 50000, subtotal: 50000 }), OK, 'subtotal igual al mínimo')
igual(r.evaluarPedidoMinimo({ minimo: 50000, subtotal: 49999.999 }), OK, 'redondeo de centavos')
igual(r.evaluarPedidoMinimo({ minimo: 50000, subtotal: 60000 }), OK, 'por encima del mínimo')
igual(r.evaluarPedidoMinimo({ minimo: 50000, subtotal: 32500.5 }), { ok: false, codigo: 'pedido_minimo', status: 422, faltante: 17499.5, minimo: 50000 }, 'por debajo del mínimo')
// Encadenado con la lectura: la fila de la base produce la regla.
const deFila = a.ajustesSitioDesdeFila({ checkout_min_order_amount: '30000.00', checkout_guest_enabled: false })
igual(r.evaluarPedidoMinimo({ minimo: deFila.checkout.pedidoMinimo, subtotal: 29000 }).codigo, 'pedido_minimo', 'mínimo leído de la fila')
igual(r.evaluarCompraInvitado({ invitadoPermitido: deFila.checkout.invitado, conSesion: false }).codigo, 'requiere_cuenta', 'invitado leído de la fila')

// ─── 1d. Cableado (texto del fuente) ─────────────────────────────────────────────────────────
const server = await readFile(join(ROOT, 'lib/website/ajustesSitio.server.ts'), 'utf8')
check(server.includes('getOrgSettings(') && !/\.from\(/.test(server), 'ajustesSitio.server.ts reutiliza getOrgSettings y no consulta la base por su cuenta')
check(/cache\(/.test(server), 'getAjustesSitio va en react.cache')
const layout = await readFile(join(ROOT, 'components/site/OrganizationLayout.tsx'), 'utf8')
check(layout.includes('getAjustesSitio(') && layout.includes('codigoPropio='), 'el layout pasa el código a medida')
const checkout = await readFile(join(ROOT, 'app/checkout/page.tsx'), 'utf8')
check(checkout.includes('getAjustesSitio(') && checkout.includes('codigoPropio='), '/checkout pasa el código a medida (mismo criterio de alcance)')

// ─── 2. Base de datos (opcional) ─────────────────────────────────────────────────────────────
if (!URL_BASE || !KEY) {
  notas.push('Sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY: no se revisó la base (node --env-file=.env.local …).')
} else {
  const res = await fetch(`${URL_BASE}/rest/v1/website_settings?select=${encodeURIComponent(COLUMNAS_AJUSTES.join(','))}&branch_id=is.null`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    problemas.push(`website_settings (ajustes): ${res.status} ${JSON.stringify(json).slice(0, 200)}`)
  } else {
    const filas = Array.isArray(json) ? json : []
    const leidas = filas.map((f) => a.ajustesSitioDesdeFila(f))
    const cuenta = (fn) => leidas.filter(fn).length
    notas.push(
      `${filas.length} filas · mantenimiento ${cuenta((x) => x.mantenimiento.activo)} · idioma≠es-CO ${cuenta((x) => x.idioma !== 'es-CO')} · ` +
        `código ${cuenta((x) => x.codigoPropio.length > 0)} · WhatsApp ${cuenta((x) => x.whatsapp)} · sin invitado ${cuenta((x) => !x.checkout.invitado)} · ` +
        `mínimo ${cuenta((x) => x.checkout.pedidoMinimo !== null)} · por sede ${cuenta((x) => x.modoSedes === 'per_branch')}`,
    )
    // Bloques guardados que el sitio descarta por no cumplir el contrato del ERP.
    const descartados = filas.reduce((n, f) => n + Math.max(0, (Array.isArray(f.custom_code) ? f.custom_code.filter((c) => c?.activo !== false).length : 0) - a.bloquesCodigo(f.custom_code).length), 0)
    check(descartados === 0, `${descartados} bloque(s) de custom_code activos no cumplen el contrato del ERP`)
  }
}

for (const n of notas) console.log(`· ${n}`)
if (problemas.length > 0) {
  console.error(`✗ verify-ajustes-sitio: ${problemas.length} problema(s) en ${casos} comprobaciones`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-ajustes-sitio: ${casos} comprobaciones`)
