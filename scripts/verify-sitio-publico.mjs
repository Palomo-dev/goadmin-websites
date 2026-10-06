/**
 * verify-sitio-publico.mjs — contratos nuevos del sitio público con el ERP.
 *
 *   npm run verify:sitio-publico                       (solo la lógica pura)
 *   node --env-file=.env.local scripts/verify-sitio-publico.mjs   (además, contra la base)
 *
 * 1. Cartas por horario (lib/menu/cartasPublicas.ts), sin base: lectura defensiva de la respuesta
 *    de get_public_menu, ocultos por carta, pestaña de hoy (incluida la franja de ayer que cruza
 *    la medianoche), carta fija y «Variantes y extras» sin ocultar nunca un grupo obligatorio.
 * 2. Con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (service role, solo lecturas):
 *    - ejecuta tal cual el `select` de lib/seo/pixelesSitio.ts (COLUMNAS_PIXELES): una columna
 *      inexistente da 42703. Antes de aplicar 20261008090000 eso es lo ESPERADO y se informa
 *      como pendiente (el sitio degrada a lo de hoy); después, cualquier 42703 es un fallo.
 *    - llama a get_public_menu con la firma que usa lib/menu/cartasPublicas.server.ts. Sin la
 *      función (PGRST202) se informa como pendiente; con ella, la respuesta debe leerse con
 *      leerCartasPublicas. Opcional: SITIO_ORG_IDS=134,140 (ids, nunca nombres).
 *    - VERIFY_ESTRICTO=1 convierte los «pendiente» en fallo (para correrlo después de aplicar).
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { stripTypeScriptTypes } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ESTRICTO = process.env.VERIFY_ESTRICTO === '1'
const ORG_IDS = (process.env.SITIO_ORG_IDS || '134').split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0)

const problemas = []
const notas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const igual = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), `${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`)
const pendiente = (msg) => (ESTRICTO ? problemas.push(msg) : notas.push(`pendiente: ${msg}`))

// ─── Carga del módulo puro ───────────────────────────────────────────────────────────────────
const dir = join(ROOT, '.verify-sitio-tmp')
await rm(dir, { recursive: true, force: true })
await mkdir(dir)
let cp
try {
  const ts = await readFile(join(ROOT, 'lib/menu/cartasPublicas.ts'), 'utf8')
  const js = stripTypeScriptTypes(ts, { mode: 'strip' }).replace(/^import\s+type[^\n]*\n/gm, '')
  if (/^import\s/m.test(js)) throw new Error('lib/menu/cartasPublicas.ts dejó de ser puro (import con valor)')
  await writeFile(join(dir, 'cartasPublicas.mjs'), js)
  cp = await import(pathToFileURL(join(dir, 'cartasPublicas.mjs')).href)
} finally {
  await rm(dir, { recursive: true, force: true })
}

// ─── 1. Lógica de cartas ─────────────────────────────────────────────────────────────────────
const ID_A = '11111111-1111-4111-8111-111111111111'
const ID_B = '22222222-2222-4222-8222-222222222222'
const crudo = {
  zonaHoraria: 'America/Bogota',
  dia: 2,
  hora: '10:00',
  cartas: [
    {
      id: ID_A, nombre: 'Desayuno', pdfUrl: 'javascript:alert(1)', orden: 0, vigente: true,
      horario: { 2: [{ from: '07:00', to: '11:00' }], 3: [{ from: '07:30', to: '11:00' }] },
      secciones: [
        { categoriaId: 10, nombre: 'Huevos', productos: [
          { id: 101, precio: 9000, destacado: false, variantesOcultas: [], extrasOcultos: [] },
          { id: 100, precio: 8000, destacado: true, variantesOcultas: [5], extrasOcultos: [7, 'x'] },
        ] },
      ],
    },
    {
      id: ID_B, nombre: 'Bar', pdfUrl: 'https://cdn.ejemplo.co/bar.pdf', orden: 1, vigente: false,
      horario: { 1: [{ from: '20:00', to: '02:00' }], 2: [{ from: '18:00', to: '25:00' }] },
      secciones: [{ categoriaId: 20, productos: [{ id: 200 }] }],
    },
    { id: 'no-es-uuid', nombre: 'X', secciones: [] },
  ],
}
{
  const c = cp.leerCartasPublicas(crudo)
  check(c && c.cartas.length === 2, 'descarta la carta con id inválido')
  igual(c.cartas[0].pdfUrl, null, 'PDF que no es https se descarta')
  igual(c.cartas[1].pdfUrl, 'https://cdn.ejemplo.co/bar.pdf', 'PDF https se conserva')
  igual(c.cartas[1].horario, { 1: [{ from: '20:00', to: '02:00' }] }, 'franja con hora inválida se descarta')
  igual(c.cartas[0].secciones[0].platos[1], { id: 100, destacado: true, variantesOcultas: [5], extrasOcultos: [7] }, 'plato reducido a estructura')
  check(!JSON.stringify(c).includes('9000'), 'el precio de la RPC no se cachea (el precio sale del catálogo)')
  igual(cp.leerCartasPublicas({ cartas: 'x' }), null, 'respuesta ilegible → null (vía actual)')
  igual(cp.leerCartasPublicas({ cartas: [{ id: ID_A, nombre: 'Sin vigente', secciones: [] }] }).cartas[0].vigente, true, 'RPC vieja (sin vigente) solo trae vigentes')

  const catalogo = [{ id: 100, category_id: 10 }, { id: 101, category_id: 10 }, { id: 102, category_id: 10 }, { id: 300, category_id: 30 }]
  const platos = cp.platosDeCarta(c.cartas[0], catalogo)
  igual(platos.orden, { 10: [101, 100] }, 'orden de la carta')
  igual(platos.ocultos, [102], 'oculto = del catálogo en una categoría de la carta que la carta no trae')
  igual(platos.destacados, [100], 'destacados')
  igual(cp.opcionesOcultasDeCarta(c.cartas[0]), { 100: { variantes: [5], extras: [7] } }, 'variantes y extras ocultos por plato')

  igual(cp.cartaDeSeccion(c, ID_B).id, ID_B, 'carta fija aunque no esté vigente')
  igual(cp.cartaDeSeccion(c, null).id, ID_A, 'sin fija: la vigente')
  igual(cp.cartaDeSeccion(c, '99999999-9999-4999-8999-999999999999').id, ID_A, 'fija inexistente en la sede: la vigente')
  igual(cp.cartaDeSeccion({ ...c, cartas: [] }, null), null, 'sin cartas: null')

  const tab = cp.pestanaDeCarta(c.cartas[1], 2, platos)
  igual(tab.franjas, [{ from: '00:00', to: '02:00' }], 'martes: la franja del lunes que cruza la medianoche')
  igual(tab.start_time, null, 'sin franja propia hoy')
  const tabA = cp.pestanaDeCarta(c.cartas[0], 2, platos)
  igual([tabA.start_time, tabA.end_time, tabA.inicioManana], ['07:00', '11:00', '07:30'], 'pestaña con franja de hoy y de mañana')
  igual(tabA.category_ids, [10], 'categorías de la pestaña')

  const grupos = new Map([[100, [{ id: 7, required: false, min_selections: 0 }, { id: 8, required: true }, { id: 9, min_selections: 1 }]]])
  const f = cp.filtrarOpcionesDePlato([{ id: 5 }, { id: 6 }], grupos, { variantes: [5], extras: [7, 8, 9] })
  igual(f.variantes.map((v) => v.id), [6], 'variante oculta')
  igual(f.grupos.get(100).map((g) => g.id), [8, 9], 'nunca se ocultan grupos obligatorios')
  const todas = cp.filtrarOpcionesDePlato([{ id: 5 }], grupos, { variantes: [5], extras: [] })
  igual(todas.variantes.map((v) => v.id), [5], 'si se ocultan todas las variantes, se muestran como hoy')
  check(cp.filtrarOpcionesDePlato([{ id: 5 }], grupos, null).grupos === grupos, 'sin ocultas: los mismos datos')
}

// ─── 2. Base de datos (opcional) ─────────────────────────────────────────────────────────────
async function rest(path, { metodo = 'GET', cuerpo } = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    method: metodo,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = text }
  return { ok: res.ok, status: res.status, json }
}

if (!URL_BASE || !KEY) {
  notas.push('Sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY: no se revisó la base (node --env-file=.env.local …).')
} else {
  const fuente = await readFile(join(ROOT, 'lib/seo/pixelesSitio.ts'), 'utf8')
  const columnas = /export const COLUMNAS_PIXELES = '([^']+)'/.exec(fuente)?.[1]
  check(!!columnas, 'no se pudo leer COLUMNAS_PIXELES de lib/seo/pixelesSitio.ts')
  if (columnas) {
    const r = await rest(`website_settings?select=${encodeURIComponent(columnas)}&branch_id=is.null&limit=1`)
    if (r.ok) notas.push('píxeles y noindex: columnas presentes')
    else if (r.json?.code === '42703') pendiente(`website_settings sin ${columnas} (migración 20261008090000 sin aplicar; el sitio degrada a lo de hoy)`)
    else problemas.push(`website_settings (píxeles): ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`)
  }
  for (const org of ORG_IDS) {
    const r = await rest('rpc/get_public_menu', { metodo: 'POST', cuerpo: { p_org: org, p_branch: null, p_at: new Date().toISOString(), p_todas: true } })
    if (r.ok) {
      const c = cp.leerCartasPublicas(r.json)
      check(c !== null, `get_public_menu(org ${org}): respuesta que leerCartasPublicas no entiende`)
      notas.push(`get_public_menu(org ${org}): ${c?.cartas.length ?? 0} carta(s)`)
    } else if (r.json?.code === 'PGRST202') {
      pendiente(`get_public_menu con p_todas no existe (20261008150100 / 20261010090000 sin aplicar; la carta sigue con el contenido de la sección)`)
      break
    } else {
      problemas.push(`get_public_menu(org ${org}): ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`)
    }
  }
}

for (const n of notas) console.log(`· ${n}`)
if (problemas.length > 0) {
  console.error(`✗ verify-sitio-publico: ${problemas.length} problema(s) en ${casos} comprobaciones`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-sitio-publico: ${casos} comprobaciones`)
