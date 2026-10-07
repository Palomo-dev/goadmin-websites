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
 * 6. Las reglas de botón alcanzan los botones (marcados con data-boton, o con relleno horizontal y
 *    sin imagen) y NO tarjetas, filas con foto ni puntos de carrusel.
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
  contrasteColor: 'lib/website/v2/contrasteColor.ts',
  textoSobreAcento: 'lib/website/v2/textoSobreAcento.ts',
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
const { temaPublicoDesdeDocumento, temaPublicoDesdeMensaje, atributosTema, urlGoogleFonts, familiaSegura } = m.temaPublico
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

  // Lienzo del editor: el tema en edición llega en `goadmin:settings` y sale IGUAL que publicado.
  igual(temaPublicoDesdeMensaje({ tema: principal.tema, esSede: false, principal: null }), t, 'lienzo: mismo tema que publicado')
  igual(temaPublicoDesdeMensaje({ tema: sede.documento.tema, esSede: true, principal: principal.tema }), ts, 'lienzo: sede con herencia como publicada')
  igual(temaPublicoDesdeMensaje({ tema: sede.documento.tema, esSede: true, principal: null }), tsLegacy, 'lienzo: principal legacy no aporta')
  check(temaPublicoDesdeMensaje(undefined) === undefined, 'lienzo: sin tema se queda el del servidor')
  check(temaPublicoDesdeMensaje({ tema: { colores: {}, tipografia: {}, radio: { mode: 'value', value: 7 } } }) === undefined, 'lienzo: radio fuera del contrato se ignora')
  check(temaPublicoDesdeMensaje({ tema: { colores: {}, tipografia: {}, extra: 1 } }) === undefined, 'lienzo: tema con claves ajenas se ignora (esquema estricto)')
  const inyectada = temaPublicoDesdeMensaje({ tema: { colores: {}, tipografia: { titulos: { mode: 'value', value: "x'); } body { display:none" } } } })
  check(inyectada && inyectada.fuenteTitulos === null, 'lienzo: familia inyectada no llega al CSS')

  igual(atributosTema(null), { variables: {}, datos: {} }, 'legacy: ni variables ni atributos')
  igual(a.datos['data-tema-fondo'], 'claro', 'fondo #FAF7F2 → claro')
  igual(atributosTema({ ...t, fondo: '#0E0E0E', texto: '#F2EDE4' }).datos['data-tema-fondo'], 'oscuro', 'fondo #0E0E0E → oscuro')
  check(!('data-tema-fondo' in atributosTema({ ...t, fondo: null }).datos), 'sin fondo propio no se marca el modo')

  // Texto del botón sobre el acento (copia literal de textoSobreAcento del ERP).
  const { textoSobreAcento, textoSobreAcentoSiHex } = m.textoSobreAcento
  for (const claro of ['#C8A97E', '#D4AF37', '#B8975A', '#F2EDE4']) igual(textoSobreAcento(claro), '#111111', `acento claro ${claro} → texto negro`)
  for (const oscuro of ['#8C2F1B', '#1E40AF', '#111111']) igual(textoSobreAcento(oscuro), '#FFFFFF', `acento oscuro ${oscuro} → texto blanco`)
  check(textoSobreAcentoSiHex('rgb(0,0,0)') === null && textoSobreAcentoSiHex(undefined) === null, 'un color que no es hex no se mide')
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
    'data-tema-colores', 'data-tema-fondo', 'data-tema-fuente', 'data-radio-boton', 'data-estilo-boton', 'data-movimiento',
  ]
  for (const a of atributos) {
    // data-movimiento lo lee prefersReducedMotion (JS), no una regla CSS.
    if (a === 'data-movimiento') continue
    check(css.includes(`[${a}`), `app/globals.css no tiene regla para [${a}]`)
  }
  const motion = await readFile(join(ROOT, 'components/sections/restaurant/useSectionMotion.ts'), 'utf8')
  check(motion.includes('[data-movimiento="ninguno"]'), 'prefersReducedMotion respeta «Movimiento: Ninguno»')
}

// ─── 6. A QUÉ elementos alcanzan las reglas de botón ─────────────────────────────────────────
// No basta con que las reglas existan: se evalúa cada selector de botón de app/globals.css contra
// elementos de muestra sacados de las secciones reales (tarjeta de FeaturedProductsHero, punto de
// TeamCarousel, CTA marcado con data-boton…). Motor mínimo sobre postcss-selector-parser.
{
  const { default: parser } = await import('postcss-selector-parser')
  const css = await readFile(join(ROOT, 'app/globals.css'), 'utf8')
  const reglas = [...css.matchAll(/^(\[data-(?:radio|estilo)-boton[^{]*)\{([^}]*)\}/gm)].map((m) => ({ selector: m[1].trim(), cuerpo: m[2] }))
  check(reglas.length >= 4, 'globals.css: no se encontraron las reglas de botón')

  const attr = (el, nodo) => {
    const v = el.attrs[nodo.attribute]
    if (v === undefined) return false
    if (!nodo.operator) return true
    const buscado = nodo.value
    if (nodo.operator === '=') return v === buscado
    if (nodo.operator === '*=') return v.includes(buscado)
    throw new Error(`operador no soportado en el motor de prueba: ${nodo.operator}`)
  }
  const compuesto = (el, nodos) => nodos.every((n) => {
    if (n.type === 'tag') return el.tag === n.value
    if (n.type === 'attribute') return attr(el, n)
    if (n.type === 'pseudo') {
      const internos = n.nodes.map((sel) => sel.nodes)
      if (n.value === ':is') return internos.some((c) => compuesto(el, c))
      if (n.value === ':not') return !internos.some((c) => compuesto(el, c))
      if (n.value === ':has') return internos.some((c) => (el.hijos || []).some((h) => compuesto(h, c)))
    }
    throw new Error(`nodo no soportado en el motor de prueba: ${n.type} ${n.value}`)
  })
  /** ¿La regla alcanza a `el` dentro de <raíz {tema}><section data-section-id>…? */
  const alcanza = (regla, raiz, el) => {
    const ast = parser().astSync(regla.selector)
    return ast.nodes.some((sel) => {
      const partes = [[]]
      for (const n of sel.nodes) {
        if (n.type === 'combinator') partes.push([])
        else partes[partes.length - 1].push(n)
      }
      if (partes.length !== 3) throw new Error(`selector inesperado: ${regla.selector}`)
      return compuesto(raiz, partes[0]) && compuesto({ tag: 'section', attrs: { 'data-section-id': 'x' } }, partes[1]) && compuesto(el, partes[2])
    })
  }
  const el = (tag, clase, extra = {}) => ({ tag, attrs: { class: clase, ...(extra.attrs || {}) }, hijos: (extra.hijos || []).map((t) => ({ tag: t, attrs: {} })) })
  const tema = (estilo) => ({ tag: 'div', attrs: { 'data-radio-boton': 'propio', ...(estilo ? { 'data-estilo-boton': estilo } : {}) } })
  const deRadio = reglas.filter((r) => r.cuerpo.includes('--radio-boton') && !r.selector.includes('input'))
  const deEstilo = (e) => reglas.filter((r) => r.selector.includes(`[data-estilo-boton='${e}']`))
  const radio = (x) => deRadio.some((r) => alcanza(r, tema(null), x))
  const estilo = (e, x) => deEstilo(e).some((r) => alcanza(r, tema(e), x))
  check(deEstilo('contorno').length > 0 && deEstilo('sombra_dura').length > 0, 'faltan las reglas de contorno o sombra dura')

  const tarjeta = el('a', 'group block bg-white rounded-xl overflow-hidden shadow-sm', { attrs: { style: 'background-color: #fff' }, hijos: ['img'] })
  const tarjetaSinOverflow = el('a', 'flex items-center gap-4 rounded-lg px-3 py-3', { hijos: ['img'] })
  const punto = el('button', 'h-2 w-2 rounded-full transition-all', { attrs: { style: 'background-color: rgb(0,0,0)' } })
  const ctaMarcado = el('a', 'inline-flex items-center rounded-lg px-6 py-3 text-white', { attrs: { 'data-boton': 'primario', style: 'background-color: var(--primary-color)' } })
  const ctaSecundario = el('a', 'inline-flex rounded-lg border px-6 py-3', { attrs: { 'data-boton': 'secundario' } })
  const ctaSinMarca = el('a', 'inline-block px-8 py-3 rounded-lg text-white', { attrs: { style: 'background-color: red' } })
  const chipSinMarca = el('button', 'shrink-0 rounded-lg px-4 py-2 text-white', { attrs: { style: 'background-color: red' } })
  const fichaTarjeta = el('a', 'relative flex h-[140px] overflow-hidden rounded-xl border p-5', { attrs: { style: 'background: #fff' } })

  check(!radio(tarjeta), 'el redondeo de botón NO alcanza la tarjeta de producto (overflow-hidden + img)')
  check(!radio(tarjetaSinOverflow), 'el redondeo de botón NO alcanza una fila con foto')
  check(!radio(fichaTarjeta), 'el redondeo de botón NO alcanza las tarjetas del hero (overflow-hidden)')
  check(!radio(punto), 'el redondeo de botón NO alcanza los puntos del carrusel (rounded-full)')
  check(radio(ctaMarcado) && radio(ctaSecundario), 'el redondeo alcanza los botones marcados')
  check(radio(ctaSinMarca), 'el redondeo alcanza un botón sin marca (relleno horizontal, sin imagen)')
  for (const e of ['contorno', 'sombra_dura']) {
    check(estilo(e, ctaMarcado), `«${e}» alcanza la acción principal marcada`)
    check(!estilo(e, ctaSecundario), `«${e}» no toca la acción secundaria`)
    check(!estilo(e, punto), `«${e}» NO alcanza los puntos del carrusel`)
    check(!estilo(e, tarjeta), `«${e}» NO alcanza las tarjetas`)
    check(!estilo(e, chipSinMarca), `«${e}» NO alcanza chips ni botones sin marca`)
  }
  check(!radio({ ...ctaMarcado }) || deRadio.every((r) => !alcanza(r, { tag: 'div', attrs: {} }, ctaMarcado)), 'sin tema propio (sin data-radio-boton) nada cambia')

  // Los CTA principales de las secciones llevan la marca.
  for (const [ruta, marca] of [
    ['components/sections/hero/HeroButtons.tsx', 'BOTON_PRIMARIO'],
    ['components/sections/restaurant/RestaurantHeroView.tsx', 'BOTON_PRIMARIO'],
    ['components/sections/restaurant/ReservationView.tsx', 'BOTON_PRIMARIO'],
    ['components/sections/cta/CtaBanner.tsx', 'BOTON_PRIMARIO'],
    ['components/sections/cta/CtaCentered.tsx', 'BOTON_PRIMARIO'],
    ['components/sections/cta/CtaSplit.tsx', 'BOTON_PRIMARIO'],
    ['components/sections/cta/CtaWithImage.tsx', 'BOTON_PRIMARIO'],
  ]) {
    const fuente = await readFile(join(ROOT, ruta), 'utf8')
    check(new RegExp(`\\{\\.\\.\\.\\(?[^}]*${marca}`).test(fuente) || fuente.includes('{...marca}'), `${ruta}: el CTA principal no lleva data-boton`)
  }
}

// Relleno «Ninguno» (none = '') no cae al relleno por defecto (bug: `map[k] || lg`).
{
  const fuente = await readFile(join(ROOT, 'components/sections/SectionWrapper.tsx'), 'utf8')
  const m = fuente.match(/export function claseDe\(([^)]*)\)[^{]*\{([\s\S]*?)\n\}/)
  check(!!m, 'SectionWrapper: falta claseDe')
  if (m) {
    const claseDe = new Function('map', 'clave', 'fallback', m[2])
    const pt = { none: '', lg: 'pt-12 md:pt-16' }
    check(claseDe(pt, 'none', pt.lg) === '', 'relleno «none» queda sin clase (no cae a lg)')
    check(claseDe(pt, 'lg', '') === pt.lg, 'relleno «lg» se respeta')
    check(claseDe(pt, 'raro', pt.lg) === pt.lg, 'un valor desconocido usa el relleno por defecto')
  }
  for (const t of ['ptMap[paddingTop] || ptMap.lg', 'pbMap[paddingBottom] || pbMap.lg', 'PADDING_X_MAP[paddingX] || PADDING_X_MAP.md']) {
    check(!fuente.includes(t), `SectionWrapper: vuelve el patrón que convierte «none» en el defecto: ${t}`)
  }
}

if (problemas.length > 0) {
  console.error(`✗ verify-estilo-sitio: ${problemas.length} de ${casos} comprobaciones fallan`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-estilo-sitio: ${casos} comprobaciones`)
