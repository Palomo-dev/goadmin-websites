/**
 * verify-estilo-sitio.mjs — el sitio pinta el estilo que guarda el editor del ERP.
 *
 *   npm run verify:estilo
 *
 * Sin base de datos ni dependencias nuevas: carga los módulos puros (los mismos que usa
 * SectionWrapper y el layout) quitándoles los tipos con `node:module` y comprueba:
 *
 * 1. Visibilidad por dispositivo: V2 {escritorio, movil, tableta?} → settings.visibilidad
 *    {computador, tableta, celular} → atributos data-oculto-*; legacy igual.
 * 2. Precedencia: el Avanzado (`content`) gana al estilo de la sección, que solo rellena.
 * 3. Una sección SIN estilo sale idéntica: mismo content, ningún atributo, ninguna variable.
 * 4. Tema V2: herencia de sede con resolverCampo, tokens inválidos descartados, legacy → nada.
 * 5. Las reglas de app/globals.css existen para cada atributo que emiten los módulos.
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { stripTypeScriptTypes } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** nombre del import relativo → ruta del módulo (todos puros). */
const MODULOS = {
  documentoSitio: 'lib/website/v2/contrato/documentoSitio.ts',
  colorMarca: 'lib/website/v2/colorMarca.ts',
  fuenteTema: 'lib/website/v2/fuenteTema.ts',
  estiloSeccion: 'lib/website/v2/estiloSeccion.ts',
  temaPublico: 'lib/website/v2/temaPublico.ts',
  estiloSeccionPublico: 'lib/website/v2/estiloSeccionPublico.ts',
}

function aMjs(ts) {
  return stripTypeScriptTypes(ts, { mode: 'strip' })
    .replace(/^import\s+type[^\n]*\n/gm, '')
    .replace(/from\s+'\.\/(?:contrato\/)?([A-Za-z]+)'/g, (_, nombre) => {
      if (!MODULOS[nombre]) throw new Error(`import no puro en un módulo puro: ${nombre}`)
      return `from './${nombre}.mjs'`
    })
}

// Dentro del repo para que `zod` resuelva desde node_modules.
const dir = join(ROOT, '.verify-estilo-tmp')
const m = {}
await rm(dir, { recursive: true, force: true })
await mkdir(dir)
try {
  for (const [nombre, ruta] of Object.entries(MODULOS)) {
    await writeFile(join(dir, `${nombre}.mjs`), aMjs(await readFile(join(ROOT, ruta), 'utf8')))
  }
  for (const nombre of Object.keys(MODULOS)) {
    m[nombre] = await import(pathToFileURL(join(dir, `${nombre}.mjs`)).href)
  }
} finally {
  await rm(dir, { recursive: true, force: true })
}

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const igual = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), `${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`)

const { presentacionSeccion } = m.estiloSeccionPublico
const { visibilidadDesdeDocumento, visibilidadAlDocumento } = m.estiloSeccion
const { temaPublicoDesdeDocumento, atributosTema, urlGoogleFonts, familiaSegura } = m.temaPublico
const { validarDocumentoSitio } = m.documentoSitio

// ─── 1. Visibilidad ──────────────────────────────────────────────────────────────────────────
{
  igual(visibilidadDesdeDocumento({ escritorio: true, movil: false }), { computador: true, tableta: true, celular: false }, 'V2 sin tableta sigue al computador')
  igual(visibilidadDesdeDocumento({ escritorio: true, movil: true, tableta: false }), { computador: true, tableta: false, celular: true }, 'V2 con tableta propia')
  igual(visibilidadAlDocumento(visibilidadDesdeDocumento({ escritorio: false, movil: true, tableta: true })), { escritorio: false, movil: true, tableta: true }, 'ida y vuelta')

  const p = presentacionSeccion({ visibilidad: { computador: true, tableta: false, celular: true } }, {})
  igual(Object.keys(p.datos), ['data-oculto-tableta'], 'oculta solo en tableta')
  check(!p.oculta, 'visible en algún dispositivo no se descarta')
  const todo = presentacionSeccion({ visibilidad: { computador: false, tableta: false, celular: false } }, {})
  check(todo.oculta, 'oculta en los tres → no se pinta')
  const raro = presentacionSeccion({ visibilidad: { computador: 'no' } }, {})
  igual(raro.datos, {}, 'visibilidad inválida = visible en todo (como hoy)')
}

// ─── 2 y 3. Precedencia y sección sin estilo ─────────────────────────────────────────────────
{
  const content = { title: 'Hola', padding_top: 'md' }
  const sin = presentacionSeccion({ bg_color: '#fff' }, content)
  igual(sin.contenido, content, 'sin estilo: mismo content')
  igual(sin.datos, {}, 'sin estilo: sin atributos')
  igual(sin.variables, {}, 'sin estilo: sin variables')
  igual(sin.fuentes, [], 'sin estilo: sin fuentes')

  const estilo = { v: 1, espaciado: 'amplio', ancho: 'completo', fondo: 'alterno', entrada: 'aparecer' }
  const p = presentacionSeccion({ estilo }, { padding_top: 'sm' })
  igual(p.contenido.padding_top, 'sm', 'el Avanzado gana (padding_top)')
  igual(p.contenido.padding_bottom, 'xl', 'el estilo rellena padding_bottom (amplio)')
  igual(p.contenido.full_bleed, true, 'ancho completo → full_bleed')
  igual(p.datos['data-seccion-fondo'], 'alterno', 'fondo alterno')
  igual(p.datos['data-seccion-entrada'], 'aparecer', 'entrada aparecer')

  const conAvanzado = presentacionSeccion({ estilo }, { bg_type: 'color', bg_color: '#000000', container_width: 'md' })
  check(!('data-seccion-fondo' in conAvanzado.datos), 'fondo del Avanzado gana al del estilo')
  check(conAvanzado.contenido.full_bleed === undefined, 'container_width del Avanzado gana al ancho')

  const img = presentacionSeccion({ estilo: { v: 1, fondo: 'imagen' } }, { bg_image: 'https://x.co/a.jpg' })
  igual(img.contenido.bg_type, 'image', 'fondo imagen usa la imagen de la sección')
  const imgSin = presentacionSeccion({ estilo: { v: 1, fondo: 'imagen' } }, {})
  check(imgSin.contenido.bg_type === undefined && !('data-seccion-fondo' in imgSin.datos), 'fondo imagen sin imagen → el del tema')

  const tip = presentacionSeccion({
    estilo: {
      v: 1,
      tipografia: { modo: 'propia', titulo: { fuente: 'Playfair Display', tamano: 'L', mayusculas: true }, texto: { fuente: 'tema:cuerpo', grosor: 500 } },
      colores: { texto: 'marca:acento', borde: '#112233' },
    },
  }, {})
  igual(tip.variables['--seccion-fuente-titulo'], "'Playfair Display'", 'fuente propia del título')
  igual(tip.variables['--seccion-fuente-texto'], 'var(--font-body)', 'tema:cuerpo sigue al tema')
  igual(tip.variables['--seccion-tamano-titulo'], '40px', 'L = 40 px en computador')
  igual(tip.variables['--seccion-tamano-titulo-movil'], '32px', 'celular −20 %')
  igual(tip.variables['--seccion-color-texto'], 'var(--accent-color)', 'marca:acento sigue a la marca')
  igual(tip.variables['--seccion-color-borde'], '#112233', 'borde hex propio')
  igual(tip.fuentes, ['Playfair Display'], 'solo la familia propia se pide a Google Fonts')
  check('data-seccion-mayusculas-titulo' in tip.datos, 'mayúsculas del título')

  const inyeccion = presentacionSeccion({ estilo: { v: 1, tipografia: { modo: 'propia', titulo: { fuente: "x'); } body { display:none" } } } }, {})
  check(!('--seccion-fuente-titulo' in inyeccion.variables) && inyeccion.fuentes.length === 0, 'familia inválida no llega al CSS')
}

// ─── 4. Tema V2 ──────────────────────────────────────────────────────────────────────────────
{
  const base = {
    schemaVersion: 1,
    tema: {
      colores: { fondo: { mode: 'value', value: '#FAF7F2' }, texto: { mode: 'value', value: '#1B1B1B' } },
      tipografia: { titulos: { mode: 'value', value: 'Playfair Display' }, cuerpo: { mode: 'value', value: 'Lato' } },
      radio: { mode: 'value', value: 12 },
      estiloBoton: { mode: 'value', value: 'pastilla' },
      movimiento: { mode: 'value', value: 'bajo' },
    },
    shell: { header: { composicion: 'default', menuPrincipalId: null }, footer: { composicion: 'default' } },
    menus: [],
    paginas: [],
  }
  const v = validarDocumentoSitio(base)
  check(v.ok, `documento con tokens nuevos válido para el contrato: ${JSON.stringify(v.errores ?? [])}`)
  const principal = v.ok ? v.documento : null
  const t = temaPublicoDesdeDocumento(principal, false, null)
  igual(t, { fondo: '#FAF7F2', texto: '#1B1B1B', fuenteTitulos: 'Playfair Display', fuenteCuerpo: 'Lato', radio: 12, estiloBoton: 'pastilla', movimiento: 'bajo' }, 'tema del principal')
  const a = atributosTema(t)
  igual(a.variables['--radio-boton'], '9999px', 'pastilla = radio máximo')
  igual(a.datos['data-movimiento'], 'bajo', 'movimiento')
  igual(a.variables['--movimiento-distancia'], '8px', 'movimiento bajo = 8 px')
  check(!('data-estilo-boton' in a.datos), 'pastilla no necesita regla de estilo de botón')

  const sede = validarDocumentoSitio({
    ...base,
    tema: { colores: {}, tipografia: { cuerpo: { mode: 'clear' } }, movimiento: { mode: 'value', value: 'ninguno' } },
  })
  check(sede.ok, 'documento de sede válido')
  const ts = temaPublicoDesdeDocumento(sede.documento, true, principal)
  igual(ts.fondo, '#FAF7F2', 'la sede hereda el fondo')
  igual(ts.fuenteCuerpo, null, 'la sede vació la fuente del cuerpo')
  igual(ts.movimiento, 'ninguno', 'la sede pone su movimiento')
  igual(atributosTema(ts).datos['data-movimiento'], 'ninguno', 'ninguno se marca para apagar el movimiento')
  const tsLegacy = temaPublicoDesdeDocumento(sede.documento, true, null)
  igual(tsLegacy.fondo, null, 'principal legacy no aporta tokens')

  igual(atributosTema(null), { variables: {}, datos: {} }, 'legacy: ni variables ni atributos')
  check(urlGoogleFonts([]) === null, 'sin familias no hay hoja')
  check(urlGoogleFonts(['Playfair Display', 'Lato', 'Lato']).includes('family=Playfair+Display:wght@400;500;600;700&family=Lato'), 'hoja de Google Fonts')
  check(familiaSegura('a;b') === null, 'familia con ; rechazada')
}

// ─── 5. Reglas CSS ───────────────────────────────────────────────────────────────────────────
{
  const css = await readFile(join(ROOT, 'app/globals.css'), 'utf8')
  const atributos = [
    'data-oculto-celular', 'data-oculto-tableta', 'data-oculto-computador', 'data-seccion-fondo', 'data-seccion-entrada',
    'data-seccion-fuente-titulo', 'data-seccion-fuente-texto', 'data-seccion-tamano-titulo', 'data-seccion-tamano-texto',
    'data-seccion-grosor-titulo', 'data-seccion-grosor-texto', 'data-seccion-interlineado-titulo', 'data-seccion-interlineado-texto',
    'data-seccion-mayusculas-titulo', 'data-seccion-mayusculas-texto', 'data-seccion-color-texto', 'data-seccion-color-borde',
    'data-tema-colores', 'data-tema-fuente', 'data-radio-boton', 'data-estilo-boton', 'data-movimiento',
  ]
  for (const a of atributos) {
    // data-movimiento lo lee prefersReducedMotion (JS), no una regla CSS.
    if (a === 'data-movimiento') continue
    check(css.includes(`[${a}`), `app/globals.css no tiene regla para [${a}]`)
  }
  const motion = await readFile(join(ROOT, 'components/sections/restaurant/useSectionMotion.ts'), 'utf8')
  check(motion.includes('[data-movimiento="ninguno"]'), 'prefersReducedMotion respeta «Movimiento: Ninguno»')
}

if (problemas.length > 0) {
  console.error(`✗ verify-estilo-sitio: ${problemas.length} de ${casos} comprobaciones fallan`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-estilo-sitio: ${casos} comprobaciones`)
