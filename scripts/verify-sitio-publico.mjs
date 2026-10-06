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
let rp
try {
  const tsP = await readFile(join(ROOT, 'lib/seo/reglaPixeles.ts'), 'utf8')
  const jsP = stripTypeScriptTypes(tsP, { mode: 'strip' }).replace(/^import\s+type[^\n]*\n/gm, '')
  if (/^import\s/m.test(jsP)) throw new Error('lib/seo/reglaPixeles.ts dejó de ser puro (import con valor)')
  await writeFile(join(dir, 'reglaPixeles.mjs'), jsP)
  rp = await import(pathToFileURL(join(dir, 'reglaPixeles.mjs')).href)

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

  const elegida = (cartas, fija) => cp.cartasParaSeccion(cartas, fija)?.elegida.id ?? null
  igual(elegida(c, ID_B), ID_B, 'carta fija aunque no esté vigente')
  igual(elegida(c, null), ID_A, 'sin fija: la vigente')
  igual(elegida(c, '99999999-9999-4999-8999-999999999999'), ID_A, 'fija inexistente en la sede: la vigente')
  igual(cp.cartasParaSeccion({ ...c, cartas: [] }, null), null, 'sin cartas: null')
  // Carta sin secciones: nunca «todas» (buildMenuGroups trata [] como el catálogo completo).
  const vacia = { id: '33333333-3333-4333-8333-333333333333', nombre: 'Nueva', pdfUrl: null, horario: {}, vigente: true, secciones: [] }
  const conVacia = { ...c, cartas: [vacia, ...c.cartas] }
  igual(elegida(conVacia, null), ID_A, 'la vigente vacía se salta: la siguiente con categorías')
  igual(cp.cartasParaSeccion(conVacia, vacia.id), null, 'carta fija vacía: vía actual, no otra carta')
  igual(cp.cartasParaSeccion({ ...c, cartas: [vacia] }, null), null, 'solo cartas vacías: vía actual')
  igual(cp.cartasParaSeccion(conVacia, null).lista.map((x) => x.id), [ID_A, ID_B], 'las pestañas no incluyen la carta vacía')
  igual(cp.cartasParaSeccion('x', null), null, 'datos que no son cartas: vía actual')
  // URLs: protocolo relativo = otro dominio.
  igual(cp.leerCartasPublicas({ cartas: [{ id: ID_A, nombre: 'P', pdfUrl: '//evil.example/x.pdf', secciones: [] }] }).cartas[0].pdfUrl, null, 'PDF con //host se descarta')
  igual(cp.leerCartasPublicas({ cartas: [{ id: ID_A, nombre: 'P', pdfUrl: '/carta.pdf', secciones: [] }] }).cartas[0].pdfUrl, '/carta.pdf', 'PDF con ruta propia se conserva')

  const tab = cp.pestanaDeCarta(c.cartas[1], 2, platos)
  igual(tab.franjas, [{ from: '00:00', to: '02:00' }], 'martes: la franja del lunes que cruza la medianoche')
  igual(tab.start_time, null, 'sin franja propia hoy')
  const tabA = cp.pestanaDeCarta(c.cartas[0], 2, platos)
  igual([tabA.start_time, tabA.end_time, tabA.inicioManana], ['07:00', '11:00', '07:30'], 'pestaña con franja de hoy y de mañana')
  igual(tabA.category_ids, [10], 'categorías de la pestaña')
  igual(tabA.opcionesOcultas, { 100: { variantes: [5], extras: [7] } }, 'la pestaña lleva SUS variantes y extras ocultos')
  igual(tab.opcionesOcultas, {}, 'otra pestaña: los suyos (ninguno), no los de la vigente')

  const grupos = new Map([[100, [{ id: 7, required: false, min_selections: 0 }, { id: 8, required: true }, { id: 9, min_selections: 1 }]]])
  const f = cp.filtrarOpcionesDePlato([{ id: 5 }, { id: 6 }], grupos, { variantes: [5], extras: [7, 8, 9] })
  igual(f.variantes.map((v) => v.id), [6], 'variante oculta')
  igual(f.grupos.get(100).map((g) => g.id), [8, 9], 'nunca se ocultan grupos obligatorios')
  const todas = cp.filtrarOpcionesDePlato([{ id: 5 }], grupos, { variantes: [5], extras: [] })
  igual(todas.variantes.map((v) => v.id), [5], 'si se ocultan todas las variantes, se muestran como hoy')
  check(cp.filtrarOpcionesDePlato([{ id: 5 }], grupos, null).grupos === grupos, 'sin ocultas: los mismos datos')
}

// ─── 1c. Píxeles: una regla para el layout y /checkout ──────────────────────────────────────
{
  const vacio = { metaPixelId: null, gtmId: null, googleAdsId: null, tiktokPixelId: null, noindex: false }
  const tipados = { metaPixelId: '1234567890', gtmId: 'GTM-ABCD12', googleAdsId: 'AW-123456789', tiktokPixelId: 'ABCDEFGHIJKLMNO12', noindex: false }
  const integ = { metaPixelId: '999999999', googleAds: { conversionId: 'AW-123456789', conversionLabel: 'lbl' } }
  const hoy = rp.resolverPixeles(vacio, integ, null)
  igual([hoy.meta, hoy.googleAds, hoy.gtm, hoy.tiktok], ['999999999', integ.googleAds, null, null], 'sin tipados: exactamente lo de hoy (integración)')
  const t = rp.resolverPixeles(tipados, integ, null)
  igual([t.meta, t.googleAds, t.gtm, t.tiktok], ['1234567890', { conversionId: 'AW-123456789', conversionLabel: 'lbl' }, 'GTM-ABCD12', 'ABCDEFGHIJKLMNO12'], 'tipados ganan; etiqueta de Ads solo si es del mismo id')
  igual(rp.resolverPixeles({ ...tipados, googleAdsId: 'AW-555555' }, integ, null).googleAds, { conversionId: 'AW-555555', conversionLabel: undefined }, 'otro id de Ads: sin la etiqueta ajena')
  const snippet = "<script>!function(f,b,e,v){}(window);fbq('init', '777777777');fbq('track','PageView');</script>"
  const dup = rp.resolverPixeles(tipados, integ, snippet)
  igual([dup.meta, dup.metaTipadoOmitidoPorSnippet], ['999999999', true], 'snippet con fbq(init): el Meta tipado no se pinta encima (queda lo de hoy)')
  igual(rp.resolverPixeles(tipados, {}, snippet).meta, null, 'snippet con fbq(init) y sin integración: solo el snippet')
  check(!rp.snippetConMeta("fbq('track','Purchase')"), 'un fbq(track) suelto no cuenta como init')
  check(rp.snippetConMeta('fbq ( "init" , "1")'), 'fbq("init") con comillas dobles y espacios')
  for (const ruta of ['components/site/OrganizationLayoutCliente.tsx', 'app/checkout/page.tsx']) {
    const fuente = await readFile(join(ROOT, ruta), 'utf8')
    check(fuente.includes('<PixelesSitio') || fuente.includes('<PixelesDelSitio'), `${ruta} pinta los píxeles con el componente compartido`)
    check(!/<MetaPixel\s/.test(fuente) && !/<GoogleAdsTag\s/.test(fuente), `${ruta} no pinta píxeles por su cuenta (regla duplicada)`)
  }
  const checkout = await readFile(join(ROOT, 'app/checkout/page.tsx'), 'utf8')
  check(checkout.includes('getPixelesSitio('), '/checkout lee los píxeles tipados')
}

// ─── 1b. Contratos en el fuente (sin base) ──────────────────────────────────────────────────
{
  const servidor = await readFile(join(ROOT, 'lib/menu/cartasPublicas.server.ts'), 'utf8')
  const llamadas = servidor.match(/\.rpc\('get_public_menu'[^)]*\)/g) ?? []
  check(llamadas.length === 1 && llamadas.every((l) => l.includes('p_todas')), 'cartasPublicas.server.ts solo llama a get_public_menu con p_todas (la firma de 3 argumentos haría alternar la carta según la hora)')
  const avance = await readFile(join(ROOT, 'components/sections/restaurant/MenuPreviewTabs.tsx'), 'utf8')
  check(/pageSlug === 'menu'[\s\S]{0,200}<MenuFull/.test(avance), 'menu_preview en /menu delega en MenuFull (las 8 cartas en vivo usan menu_preview)')
  check(avance.includes('cartasParaSeccion('), 'el avance de la home usa la misma elección de carta que /menu')
  const vista = await readFile(join(ROOT, 'lib/website/v2/vistaPublica.ts'), 'utf8')
  check(!vista.includes('/^(https:\\/\\/|\\/)/i'), 'vistaPublica.ts: el logo no acepta //host')
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
      pendiente(`get_public_menu con p_todas no existe (20261010090000 sin aplicar; la carta sigue con el contenido de la sección, aunque exista la firma de 3 argumentos de 20261008150100)`)
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
