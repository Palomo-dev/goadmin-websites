/**
 * verify-lienzo-borrador.mjs — el lienzo del editor del ERP pinta el BORRADOR, sin dependencias.
 *
 *   node --disable-warning=ExperimentalWarning scripts/verify-lienzo-borrador.mjs
 *   ERP_REPO=/ruta/a/go-admin-erp node … scripts/verify-lienzo-borrador.mjs
 *
 * El lienzo del editor cargaba la página PUBLICADA (`<host>/<slug>?preview=1`): una página que solo
 * existe en el borrador (sitio sin publicar, sede aún no activada, página oculta o recién creada y
 * vacía) salía «404 Página no encontrada». Ahora carga la capa interior de la vista previa privada
 * y firmada (`/vista-previa/<token>/<slug>?marco=1&preview=1`), la misma del botón «Vista previa».
 *
 * Qué comprueba:
 * 1. lib/website/v2/lienzoVistaPrevia.ts: a la página solo pasan `preview=1` y `hora=HH:MM`.
 * 2. lib/website/v2/vistaPublica.ts: la página oculta solo sale con `incluirOcultas` (vista previa);
 *    sin la opción, como siempre (la web pública nunca la pasa).
 * 3. Reglas en el fuente: la capa interior pasa esos parámetros; `getPaginaPublica` pide las ocultas
 *    SOLO con el borrador de la vista previa fijado (`sitioVistaPreviaDe`); la página vacía del
 *    borrador se pinta vacía solo en la vista previa, con su else; la vista previa sigue exigiendo
 *    firma y la organización del host.
 * 4. Si el ERP está al lado: la URL que arma el lienzo (src/components/sitio-web/editor/direccionSitio.ts)
 *    es una ruta que este sitio sirve con el token y la página, y «Ver sitio publicado» de una sede
 *    es la URL que el sitio resuelve como esa sede.
 */
import { readFile, writeFile, mkdtemp, rm, access } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve, relative } from 'node:path'
import { stripTypeScriptTypes } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ERP = resolve(process.env.ERP_REPO || join(ROOT, '..', 'go-admin-erp'))
let fallos = 0
let total = 0
const notas = []
function check(cond, msg) {
  total++
  if (!cond) {
    fallos++
    console.error('✗', msg)
  }
}
const igual = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), `${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`)
const existe = (p) => access(p).then(() => true, () => false)
const leer = (rel) => readFile(join(ROOT, rel), 'utf8')

/**
 * Carga un módulo TS y sus importaciones relativas o con `@/` (transpiladas a .mjs en `tmp`).
 * Las importaciones de paquetes quedan tal cual (el directorio temporal vive en node_modules).
 * `@/` es la raíz del sitio y `src/` en el ERP.
 */
async function cargarTs(raiz, ruta, tmp, hechos = new Map()) {
  const arroba = raiz === ROOT ? ROOT : join(raiz, 'src')
  const absoluto = join(raiz, ruta)
  if (hechos.has(absoluto)) return hechos.get(absoluto)
  const destino = join(tmp, `${relative(raiz, absoluto).replace(/[\\/]/g, '__').replace(/\.tsx?$/, '')}-${hechos.size}.mjs`)
  hechos.set(absoluto, destino)
  let js = stripTypeScriptTypes(await readFile(absoluto, 'utf8'), { mode: 'strip' }).replace(/^import\s+type[^\n]*\n/gm, '')
  const resolver = async (spec) => {
    if (!spec.startsWith('.') && !spec.startsWith('@/')) return spec
    const base = spec.startsWith('@/') ? join(arroba, spec.slice(2)) : join(dirname(absoluto), spec)
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      if (await existe(base + ext)) return pathToFileURL(await cargarTs(raiz, relative(raiz, base + ext), tmp, hechos)).href
    }
    throw new Error(`${ruta}: no se encontró ${spec}`)
  }
  const specs = [...js.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1])
  const mapa = new Map()
  for (const s of specs) mapa.set(s, await resolver(s))
  js = js.replace(/from\s+'([^']+)'/g, (m, s) => `from '${mapa.get(s)}'`)
  await writeFile(destino, js)
  return destino
}

const tmp = await mkdtemp(join(ROOT, 'node_modules', '.verify-lienzo-borrador-'))
try {
  // ─── 1. Parámetros que pasan a la página ────────────────────────────────────────────────────
  const lienzo = await import(pathToFileURL(await cargarTs(ROOT, 'lib/website/v2/lienzoVistaPrevia.ts', tmp)).href)
  igual(lienzo.parametrosDelLienzo({ marco: '1', preview: '1' }), { preview: '1' }, 'lienzo: ?marco=1&preview=1 → la página recibe preview=1')
  igual(lienzo.parametrosDelLienzo({ marco: '1', preview: '1', hora: '21:30' }), { preview: '1', hora: '21:30' }, 'lienzo: «Ver como» (hora) también pasa')
  igual(lienzo.parametrosDelLienzo({ marco: '1' }), {}, 'Vista previa (barra): sin preview, la página no recibe nada, como antes')
  igual(lienzo.parametrosDelLienzo({ preview: ['1', '1'], hora: '9:30', mesa: 'x', sitio: 'y' }), {}, 'lienzo: listas, horas mal formadas y otros parámetros se descartan')

  // ─── 2. Página oculta solo en la vista previa ───────────────────────────────────────────────
  const vista = await import(pathToFileURL(await cargarTs(ROOT, 'lib/website/v2/vistaPublica.ts', tmp)).href)
  const doc = {
    paginas: [
      { id: 'p1', slug: 'home', tipo: 'home', titulo: 'Inicio', publicada: true, secciones: [] },
      { id: 'p2', slug: 'carta-qr', tipo: 'carta_qr', titulo: 'Carta QR', publicada: false, secciones: [] },
    ],
  }
  const ctx = { organizationId: 326, branchId: 531 }
  let oculta = null
  let publica = null
  let sinOpcion = null
  try {
    oculta = vista.paginaPublicaDesdeDocumento(doc, 'carta-qr', ctx, { incluirOcultas: true })
    publica = vista.paginaPublicaDesdeDocumento(doc, 'carta-qr', ctx, { incluirOcultas: false })
    sinOpcion = vista.paginaPublicaDesdeDocumento(doc, 'carta-qr', ctx)
  } catch (e) {
    check(false, `vistaPublica: paginaPublicaDesdeDocumento lanzó (${e.message})`)
  }
  check(oculta?.slug === 'carta-qr', 'vista previa: la página oculta del borrador sale (no «404» en el lienzo)')
  check(publica === null && sinOpcion === null, 'web pública: la página oculta sigue sin salir')
  check(vista.paginaPublicaDesdeDocumento(doc, '__product_detail', ctx, { incluirOcultas: true }) === null, 'vista previa: las plantillas siguen sin servirse como ruta')

  // ─── 3. Reglas en el fuente ─────────────────────────────────────────────────────────────────
  const previa = await leer('app/vista-previa/[token]/[[...slug]]/page.tsx')
  check(/searchParams: Promise\.resolve\(parametrosDelLienzo\(busqueda\)\)/.test(previa), 'vista-previa: la capa interior pasa preview/hora a la página')
  check(/if \(!verificacion\.ok\) \{[\s\S]{0,120}notFound\(\)/.test(previa) && /if \(orgDelHost !== carga\.o\) \{[\s\S]{0,160}notFound\(\)/.test(previa), 'vista-previa: sigue exigiendo firma válida y la organización del host')
  const lector = await leer('lib/website/v2/lectorPublico.ts')
  check(/const enBorrador = sitioVistaPreviaDe\(organizationId\) !== null[\s\S]{0,200}\{ incluirOcultas: enBorrador \}/.test(lector), 'getPaginaPublica: las ocultas solo con el borrador de la vista previa fijado')
  const catchAll = await leer('app/[[...slug]]/page.tsx')
  check(/if \(page && sitioVistaPreviaDe\(organization\.id\) !== null\) \{[\s\S]{0,1400}sections=\{\[\]\}[\s\S]{0,300}\} else \{/.test(catchAll), 'page.tsx: la página vacía del borrador se pinta vacía solo en la vista previa, con su else')
  const iVacia = catchAll.indexOf('if (page && sitioVistaPreviaDe(organization.id) !== null)')
  const iFallback = catchAll.indexOf('if (fallback) return fallback')
  check(iFallback !== -1 && iVacia > iFallback, 'page.tsx: los fallbacks de siempre (p. ej. /menu) van antes que la página vacía')
  const almacen = await leer('lib/website/v2/vistaPreviaBorrador.ts')
  const quienesFijan = (await leer('app/vista-previa/[token]/[[...slug]]/page.tsx')).includes('fijarSitioVistaPrevia(carga.o, borrador.sitio)')
  check(quienesFijan && /cache\(/.test(almacen), 'el borrador solo se fija en la vista previa firmada, por petición')

  // ─── 4. ERP al lado ─────────────────────────────────────────────────────────────────────────
  const direccionErp = join(ERP, 'src/components/sitio-web/editor/direccionSitio.ts')
  if (await existe(direccionErp)) {
    let erp = null
    try {
      erp = await import(pathToFileURL(await cargarTs(ERP, 'src/components/sitio-web/editor/direccionSitio.ts', tmp)).href)
    } catch (e) {
      check(false, `arnés del ERP: no se pudo cargar direccionSitio.ts (${e.message})`)
    }
    if (erp) {
      const host = 'https://hotel-ejemplo.goadmin.io'
      const url = new URL(erp.urlLienzoBorrador(host, 'carga.firma', 'carta-qr'))
      url.searchParams.set('preview', '1') // lo añade LienzoEditor
      const segmentos = url.pathname.split('/').filter(Boolean)
      check(url.origin === host && segmentos[0] === 'vista-previa' && segmentos[1] === 'carga.firma' && segmentos[2] === 'carta-qr', `ERP→sitio: el lienzo pide /vista-previa/<token>/<página> en el host de la organización (${url})`)
      igual(lienzo.parametrosDelLienzo(Object.fromEntries(url.searchParams)), { preview: '1' }, 'ERP→sitio: con ?marco=1&preview=1 la página entra en modo lienzo')
      check(new URL(erp.urlLienzoBorrador(host, 'carga.firma', 'home')).pathname === '/vista-previa/carga.firma', 'ERP→sitio: la portada va sin ruta')
      const sede = { id: 531, is_main: false, is_active: true, is_web_published: true, slug: 'restaurante', custom_domain: null }
      check(erp.urlPublicaSitio(host, 531, [sede]) === `${host}/restaurante`, 'ERP: «Ver sitio publicado» de la sede abre /<slug> (lo que el sitio resuelve como la sede)')
      check(erp.urlPublicaSitio(host, null, [sede]) === host, 'ERP: «Ver sitio publicado» del principal, como siempre')
      check(erp.baseLienzoSitio(host, 531, null) === undefined, 'ERP: con la sede elegida y sus datos sin llegar, el lienzo espera (no pinta el principal)')
    }
    const lienzoErp = await readFile(join(ERP, 'src/components/sitio-web/editor/LienzoEditor.tsx'), 'utf8')
    check(/u\.searchParams\.set\('preview', '1'\)/.test(lienzoErp), 'ERP: el lienzo añade ?preview=1 a su URL')
  } else {
    notas.push(`Sin el ERP en ${ERP}: no se revisa la URL que arma el lienzo.`)
  }
} finally {
  await rm(tmp, { recursive: true, force: true })
}

for (const n of notas) console.log(`· ${n}`)
if (fallos > 0) {
  console.error(`✗ verify-lienzo-borrador: ${fallos} de ${total} comprobaciones fallaron`)
  process.exit(1)
}
console.log(`✓ verify-lienzo-borrador: ${total} comprobaciones OK`)
