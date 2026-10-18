/**
 * verify-favicon.mjs — la pestaña usa el favicon publicado, no el logo.
 *
 *   npm run verify:favicon
 *
 * Sin base de datos. El documento V2 guarda el favicon en identidad.faviconUrl.
 * La fila legacy puede venir vacía y el logo de la organización no debe taparlo.
 * Una sede que lo vació no hereda el del principal.
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { stripTypeScriptTypes } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MODULOS = {
  documentoSitio: 'lib/website/v2/contrato/documentoSitio.ts',
  faviconPublico: 'lib/website/v2/faviconPublico.ts',
}

function aMjs(ts) {
  return stripTypeScriptTypes(ts, { mode: 'strip' })
    .replace(/^import\s+type[^\n]*\n/gm, '')
    .replace(/from\s+'\.\/(?:contrato\/)?([A-Za-z]+)'/g, (_, nombre) => {
      if (!MODULOS[nombre]) throw new Error(`import no puro: ${nombre}`)
      return `from './${nombre}.mjs'`
    })
}

const dir = join(ROOT, '.verify-favicon-tmp')
await rm(dir, { recursive: true, force: true })
await mkdir(dir)
let mod
try {
  for (const [nombre, ruta] of Object.entries(MODULOS)) {
    await writeFile(join(dir, `${nombre}.mjs`), aMjs(await readFile(join(ROOT, ruta), 'utf8')))
  }
  mod = await import(pathToFileURL(join(dir, 'faviconPublico.mjs')).href)
} finally {
  await rm(dir, { recursive: true, force: true })
}

const { urlFaviconEfectiva, faviconLegacyDe, urlFaviconParaFetch, urlIdentidadPublica, hrefIconoFavicon } = mod
const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const igual = (a, b, msg) => check(a === b, `${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`)

const FAVICON = 'https://cdn.example/favicon.png'
const LOGO = 'https://cdn.example/logo.png'
const LEGACY = 'https://cdn.example/legacy.png'
const doc = (faviconUrl) => ({ identidad: faviconUrl === undefined ? {} : { faviconUrl } })

igual(
  urlFaviconEfectiva({ documento: doc({ mode: 'value', value: FAVICON }), principal: null, faviconLegacy: null, logoUrl: LOGO }),
  FAVICON,
  'el publicado gana al logo',
)
igual(
  urlFaviconEfectiva({ documento: doc({ mode: 'value', value: `  ${FAVICON}  ` }), principal: null, faviconLegacy: LEGACY, logoUrl: LOGO }),
  FAVICON,
  'recorta la url publicada',
)
igual(
  urlFaviconEfectiva({ documento: doc({ mode: 'value', value: '//otro.example/icono.png' }), principal: null, faviconLegacy: LEGACY, logoUrl: LOGO }),
  LEGACY,
  'rechaza protocolo relativo y usa el legacy',
)
igual(
  urlFaviconEfectiva({ documento: doc({ mode: 'value', value: 'http://cdn.example/icono.png' }), principal: null, faviconLegacy: null, logoUrl: LOGO }),
  LOGO,
  'rechaza http',
)
igual(
  urlFaviconEfectiva({ documento: doc({ mode: 'value', value: '/icono.png' }), principal: null, faviconLegacy: LEGACY, logoUrl: LOGO }),
  '/icono.png',
  'acepta ruta propia',
)
igual(
  urlFaviconEfectiva({ documento: doc(undefined), principal: null, faviconLegacy: null, logoUrl: LOGO }),
  LOGO,
  'sin favicon publicado usa el logo',
)
igual(
  urlFaviconEfectiva({ documento: null, principal: null, faviconLegacy: LEGACY, logoUrl: LOGO }),
  LEGACY,
  'sitio legacy usa la fila',
)
igual(
  urlFaviconEfectiva({
    documento: doc({ mode: 'inherit' }),
    principal: { documento: doc({ mode: 'value', value: FAVICON }) },
    faviconLegacy: LEGACY,
    logoUrl: LOGO,
  }),
  FAVICON,
  'la sede hereda el del principal',
)
igual(
  urlFaviconEfectiva({
    documento: doc({ mode: 'clear' }),
    principal: { documento: doc({ mode: 'value', value: FAVICON }) },
    faviconLegacy: LEGACY,
    logoUrl: LOGO,
  }),
  LOGO,
  'la sede que lo vació no hereda el del principal ni el legacy',
)
igual(
  urlFaviconEfectiva({
    documento: doc({ mode: 'value', value: 'https://cdn.example/sede.png' }),
    principal: { documento: doc({ mode: 'value', value: FAVICON }) },
    faviconLegacy: null,
    logoUrl: LOGO,
  }),
  'https://cdn.example/sede.png',
  'la sede con favicon propio no usa el del principal',
)

igual(
  faviconLegacyDe([{ branch_id: 9, favicon_url: 'https://cdn.example/sede.png' }, { branch_id: null, favicon_url: LEGACY }]),
  LEGACY,
  'el embed en lista usa la fila del principal',
)
igual(faviconLegacyDe({ branch_id: null, favicon_url: LEGACY }), LEGACY, 'el embed objeto se lee igual')
igual(faviconLegacyDe([{ branch_id: 4, favicon_url: 12 }]), null, 'un valor que no es texto no sale')
igual(urlIdentidadPublica('javascript:alert(1)'), null, 'rechaza esquemas raros')

const cabeceras = new Headers({ host: 'tienda.example', 'x-forwarded-proto': 'https' })
igual(urlFaviconParaFetch(FAVICON, cabeceras), FAVICON, 'https se pide tal cual')
igual(urlFaviconParaFetch('/icono.png', cabeceras), 'https://tienda.example/icono.png', 'la ruta propia se absolutiza')
igual(urlFaviconParaFetch('//otro.example/icono.png', cabeceras), null, 'no se pide un protocolo relativo')

const selloPublicado = hrefIconoFavicon(FAVICON)
const selloLogo = hrefIconoFavicon(LOGO)
check(selloPublicado?.startsWith('/api/favicon?v='), 'el enlace lleva sello para no reusar el cache')
check(selloPublicado !== selloLogo, 'cambiar el favicon cambia el enlace')
igual(hrefIconoFavicon(FAVICON), selloPublicado, 'el sello es estable')
igual(hrefIconoFavicon(null), null, 'sin url no hay enlace')

const ruta = await readFile(join(ROOT, 'app/api/favicon/route.ts'), 'utf8')
const layout = await readFile(join(ROOT, 'app/layout.tsx'), 'utf8')
const pagina = await readFile(join(ROOT, 'app/[[...slug]]/page.tsx'), 'utf8')
const cuenta = await readFile(join(ROOT, 'app/mi-cuenta/layout.tsx'), 'utf8')
const middleware = await readFile(join(ROOT, 'middleware.ts'), 'utf8')
check(ruta.includes('urlFaviconDeLaPeticion'), 'la ruta del favicon lee el documento publicado')
check(!ruta.includes('max-age=86400'), 'el favicon no se cachea un día')
check(ruta.includes('max-age=300'), 'el favicon se cachea cinco minutos')
for (const [nombre, fuente] of [['raíz', layout], ['página', pagina], ['cuenta', cuenta]]) {
  check(fuente.includes('hrefIconoFavicon'), `${nombre} sella el enlace del favicon`)
  check(fuente.includes('urlFaviconDeLaPeticion'), `${nombre} resuelve el favicon publicado`)
}
check(middleware.includes("destino.pathname = '/api/favicon'"), 'favicon.ico se reescribe a la ruta')
check(!middleware.includes('favicon.ico|'), 'el matcher deja pasar favicon.ico')

if (problemas.length) {
  for (const p of problemas) console.error(`✗ ${p}`)
  process.exit(1)
}
console.log(`✓ favicon publicado (${casos} casos)`)
