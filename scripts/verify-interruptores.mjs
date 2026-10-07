/**
 * verify-interruptores.mjs — los interruptores del inspector del editor (ERP) apagan de verdad
 * lo que dicen apagar en el sitio.
 *
 *   npm run verify:interruptores
 *
 * El inspector del ERP guarda cada interruptor en `contenido[clave]` (true/false) y el sitio
 * recibe ese objeto tal cual en `content`, tanto en el lienzo (goadmin:preview) como en el sitio
 * publicado (vistaPublica). Si el componente no lee la clave, el dueño apaga «Mostrar título» y el
 * título sigue ahí. Pasó en la Portada «Video» (org 140) y en otras ocho secciones.
 *
 * Sin base de datos ni dependencias nuevas: transpila los componentes REALES con `typescript`
 * (ya es devDependency), cambia next/link, next/image y next/navigation por equivalentes mínimos y
 * los pinta con react-dom/server. Cada caso comprueba dos cosas:
 *
 *   1. Ausente = como antes: sin la clave, el elemento se pinta (los sitios que nunca tocaron el
 *      interruptor no cambian).
 *   2. Apagado = no se pinta: con la clave en `false`, el elemento desaparece.
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// Dentro del repo para que react, react-dom y lucide-react resuelvan desde node_modules.
const TMP = join(ROOT, '.verify-interruptores-tmp')

const STUBS = {
  'next/link': `import { createElement } from 'react'
export default function Link({ href, children, prefetch, scroll, replace, ...resto }) {
  return createElement('a', { href: typeof href === 'string' ? href : String(href?.pathname ?? ''), ...resto }, children)
}`,
  'next/image': `import { createElement } from 'react'
export default function Image({ src, alt, fill, sizes, priority, quality, placeholder, ...resto }) {
  return createElement('img', { src: typeof src === 'string' ? src : '', alt, ...resto })
}`,
  'next/navigation': `export function useSearchParams() { return new URLSearchParams() }
export function usePathname() { return '/' }
export function useRouter() { return { push() {}, replace() {}, refresh() {}, back() {}, prefetch() {} } }`,
}

/** Resuelve un import local (relativo o `@/`) a un archivo .ts/.tsx del repo. */
function resolverLocal(especificador, desde) {
  const base = especificador.startsWith('@/') ? join(ROOT, especificador.slice(2)) : resolve(dirname(desde), especificador)
  for (const ext of ['', '.tsx', '.ts', '/index.tsx', '/index.ts']) {
    const p = base + ext
    if (existsSync(p) && (p.endsWith('.ts') || p.endsWith('.tsx'))) return p
  }
  throw new Error(`no encuentro ${especificador} (desde ${relative(ROOT, desde)})`)
}

const compilados = new Map()

/** Transpila un .ts/.tsx (y lo que importe) a .mjs dentro de TMP. Devuelve la ruta de salida. */
async function compilar(ruta) {
  if (compilados.has(ruta)) return compilados.get(ruta)
  const salida = join(TMP, relative(ROOT, ruta)).replace(/\.tsx?$/, '.mjs')
  compilados.set(ruta, salida)
  const { outputText } = ts.transpileModule(await readFile(ruta, 'utf8'), {
    fileName: ruta,
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  })
  const especificadores = new Set()
  for (const m of outputText.matchAll(/(?:from\s*|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)) especificadores.add(m[1])
  let codigo = outputText
  for (const esp of especificadores) {
    let destino = null
    if (STUBS[esp]) destino = join(TMP, '__stubs', `${esp.replace(/\//g, '_')}.mjs`)
    else if (esp.startsWith('.') || esp.startsWith('@/')) destino = await compilar(resolverLocal(esp, ruta))
    if (!destino) continue
    let rel = relative(dirname(salida), destino)
    if (!rel.startsWith('.')) rel = `./${rel}`
    codigo = codigo.split(`'${esp}'`).join(`'${rel}'`).split(`"${esp}"`).join(`"${rel}"`)
  }
  await mkdir(dirname(salida), { recursive: true })
  await writeFile(salida, codigo)
  return salida
}

async function cargar(rutaRepo) {
  return import(pathToFileURL(await compilar(join(ROOT, rutaRepo))).href)
}

// ------------------------------------------------------------------------------------------
await rm(TMP, { recursive: true, force: true })
await mkdir(join(TMP, '__stubs'), { recursive: true })
for (const [nombre, codigo] of Object.entries(STUBS)) {
  await writeFile(join(TMP, '__stubs', `${nombre.replace(/\//g, '_')}.mjs`), codigo)
}

const fallos = []
let casos = 0

try {
  // React 18 avisa de `fetchPriority` en <img> (lo usa HeroSlider): es ruido, no un fallo.
  const errorOriginal = console.error
  console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('does not recognize the `%s` prop') && String(args[1]).includes('fetchPriority')) return
    if (typeof args[0] === 'string' && args[0].includes('fetchPriority')) return
    errorOriginal(...args)
  }
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  /** Pinta el componente; si revienta, el error cuenta como fallo y el resto de casos sigue. */
  const pintar = (Comp, props) => {
    try {
      return renderToStaticMarkup(createElement(Comp, props))
    } catch (e) {
      fallos.push(`${Comp.name}: revienta al pintar — ${e instanceof Error ? e.message : String(e)}`)
      return ''
    }
  }

  /**
   * Un interruptor: con `base` (sin la clave) cada marca de `marcas` aparece; con la clave en
   * false, ninguna. `extra` agrega claves al contenido apagado (p. ej. variantes de botón).
   */
  function interruptor({ nombre, Comp, props, clave, marcas }) {
    casos++
    const con = pintar(Comp, props)
    const faltan = marcas.filter((m) => !con.includes(m))
    if (faltan.length) fallos.push(`${nombre}: sin «${clave}» (ausente = como antes) falta ${faltan.map((m) => `«${m}»`).join(', ')}`)
    const apagado = pintar(Comp, { ...props, content: { ...props.content, [clave]: false } })
    const sobran = marcas.filter((m) => apagado.includes(m))
    if (sobran.length) fallos.push(`${nombre}: con «${clave}: false» se sigue pintando ${sobran.map((m) => `«${m}»`).join(', ')}`)
  }

  function contiene(nombre, html, marcas, noMarcas = []) {
    casos++
    for (const m of marcas) if (!html.includes(m)) fallos.push(`${nombre}: falta «${m}»`)
    for (const m of noMarcas) if (html.includes(m)) fallos.push(`${nombre}: sobra «${m}»`)
  }

  // ---------------------------------------------------------------- hero (Portada)
  const PORTADA = {
    title: 'TITULO-PORTADA',
    subtitle: 'SUBTITULO-PORTADA',
    cta_text: 'BOTON-PORTADA',
    cta_url: '/reservas',
    image_url: 'https://x/fondo.jpg',
    overlay_color: '#123456',
  }
  const org = { id: 1, name: 'Org', description: '', website_settings: {} }
  const heroes = {
    video: (await cargar('components/sections/hero/HeroVideo.tsx')).HeroVideo,
    fullscreen: (await cargar('components/sections/hero/HeroFullscreen.tsx')).HeroFullscreen,
    split: (await cargar('components/sections/hero/HeroSplit.tsx')).HeroSplit,
    minimal: (await cargar('components/sections/hero/HeroMinimal.tsx')).HeroMinimal,
    slider: (await cargar('components/sections/hero/HeroSlider.tsx')).HeroSlider,
  }
  const contenidoHero = (v) =>
    v === 'slider'
      ? { ...PORTADA, slides: [{ title: 'TITULO-PORTADA', subtitle: 'SUBTITULO-PORTADA', cta_text: 'BOTON-PORTADA', cta_url: '/reservas', image_url: 'https://x/s.jpg' }] }
      : v === 'video'
        ? { ...PORTADA, video_url: 'https://x/v.mp4' }
        : PORTADA
  for (const [v, Comp] of Object.entries(heroes)) {
    const props = { content: contenidoHero(v), organization: org, primaryColor: '#3B82F6' }
    // Nodos de texto (`>…<`): el título también va en el `alt` de la imagen, y eso no es pintarlo.
    interruptor({ nombre: `hero/${v}`, Comp, props, clave: 'show_title', marcas: ['>TITULO-PORTADA<', '>SUBTITULO-PORTADA<'] })
    interruptor({ nombre: `hero/${v}`, Comp, props, clave: 'show_cta', marcas: ['>BOTON-PORTADA<'] })
    // Con el repetidor de botones en vez del botón único.
    interruptor({
      nombre: `hero/${v} (botones)`,
      Comp,
      props: { ...props, content: { ...props.content, buttons: [{ label: 'BOTON-REPETIDOR', url: '/x', variant: 'solid' }] } },
      clave: 'show_cta',
      marcas: v === 'slider' ? [] : ['BOTON-REPETIDOR<'],
    })
  }
  // El overlay solo existe en las variantes con fondo: pantalla completa, slider y video.
  interruptor({ nombre: 'hero/video', Comp: heroes.video, props: { content: contenidoHero('video'), organization: org }, clave: 'show_overlay', marcas: ['background-color:#123456'] })
  interruptor({ nombre: 'hero/fullscreen', Comp: heroes.fullscreen, props: { content: contenidoHero('fullscreen'), organization: org }, clave: 'show_overlay', marcas: ['background-color:#123456'] })
  interruptor({ nombre: 'hero/slider', Comp: heroes.slider, props: { content: contenidoHero('slider'), organization: org }, clave: 'show_overlay', marcas: ['bg-black/40'] })

  // ---------------------------------------------------------------- services_list
  const servicios = { services: [{ name: 'Servicio', description: 'DESC-SERVICIO', price: 1000 }] }
  for (const [v, archivo, exp] of [
    ['cards', 'ServicesListCards', 'ServicesListCards'],
    ['grid', 'ServicesListGrid', 'ServicesListGrid'],
    ['list', 'ServicesListList', 'ServicesListList'],
  ]) {
    const Comp = (await cargar(`components/sections/services/${archivo}.tsx`))[exp]
    interruptor({ nombre: `services_list/${v}`, Comp, props: { content: { title: 'S' }, organization: org, data: servicios }, clave: 'show_description', marcas: ['DESC-SERVICIO'] })
  }

  // ---------------------------------------------------------------- pricing_table
  const { PricingTableColumns } = await cargar('components/sections/saas/PricingTableColumns.tsx')
  const plan = { name: 'Plan', price: 1000, description: 'DESC-PLAN', features: 'CARACT-UNO\nCARACT-DOS', cta_text: 'Empezar' }
  interruptor({ nombre: 'pricing_table/three_columns', Comp: PricingTableColumns, props: { content: { plans: [plan] } }, clave: 'show_description', marcas: ['DESC-PLAN'] })
  // El editor guarda las características como texto (una por línea): antes `.map` sobre un string rompía la página.
  contiene('pricing_table: características en texto', pintar(PricingTableColumns, { content: { plans: [plan] } }), ['<span>CARACT-UNO</span>', '<span>CARACT-DOS</span>'])
  contiene('pricing_table: características en lista (contenido viejo)', pintar(PricingTableColumns, { content: { plans: [{ ...plan, features: ['CARACT-LISTA'] }] } }), ['<span>CARACT-LISTA</span>'])
  // «Destacar» del editor escribe `highlighted`; el sitio leía `is_popular`. Se acepta la vieja de respaldo.
  contiene('pricing_table: Destacar (highlighted)', pintar(PricingTableColumns, { content: { plans: [{ ...plan, highlighted: true }] } }), ['MÁS POPULAR'])
  contiene('pricing_table: is_popular (respaldo)', pintar(PricingTableColumns, { content: { plans: [{ ...plan, is_popular: true }] } }), ['MÁS POPULAR'])
  contiene('pricing_table: sin destacar', pintar(PricingTableColumns, { content: { plans: [plan] } }), [], ['MÁS POPULAR'])
  contiene('pricing_table: highlighted false gana a is_popular', pintar(PricingTableColumns, { content: { plans: [{ ...plan, highlighted: false, is_popular: true }] } }), [], ['MÁS POPULAR'])

  // ---------------------------------------------------------------- membership_plans
  const { MembershipPlansPricing } = await cargar('components/sections/gym/MembershipPlansPricing.tsx')
  interruptor({
    nombre: 'membership_plans/pricing_table',
    Comp: MembershipPlansPricing,
    props: { content: {}, data: { membershipPlans: [{ id: 'p1', name: 'Mensual', description: 'DESC-MEMBRESIA', price: 1000, duration_value: 1, duration_unit: 'month', benefits: [] }] } },
    clave: 'show_description',
    marcas: ['DESC-MEMBRESIA'],
  })

  // ---------------------------------------------------------------- featured_products (hero_product)
  const { FeaturedProductsHero } = await cargar('components/sections/products/FeaturedProductsHero.tsx')
  interruptor({
    nombre: 'featured_products/hero_product',
    Comp: FeaturedProductsHero,
    props: { content: {}, data: { products: [{ id: 1, uuid: 'u1', name: 'Producto', description: 'DESC-PRODUCTO', product_prices: [{ price: 10 }] }] } },
    clave: 'show_description',
    marcas: ['DESC-PRODUCTO'],
  })

  // ---------------------------------------------------------------- room_types (detailed)
  const { SpacesDetailed } = await cargar('components/sections/hotel/SpacesDetailed.tsx')
  interruptor({
    nombre: 'room_types/detailed',
    Comp: SpacesDetailed,
    props: { content: {}, data: { spaces: [], spaceTypes: [{ id: 't1', name: 'Doble', description: 'DESC-HABITACION', base_rate: 100, capacity: 2, amenities: [] }] } },
    clave: 'show_description',
    marcas: ['DESC-HABITACION'],
  })

  // ---------------------------------------------------------------- contact_form
  const orgContacto = { id: 1, phone: 'TEL-ORG', email: 'CORREO-ORG', address: 'DIRECCION-ORG' }
  const { ContactFormSplit } = await cargar('components/sections/contact/ContactFormSplit.tsx')
  for (const [clave, marca] of [['show_phone', 'TEL-ORG'], ['show_email', 'CORREO-ORG'], ['show_address', 'DIRECCION-ORG']]) {
    interruptor({ nombre: 'contact_form/split', Comp: ContactFormSplit, props: { content: {}, organization: orgContacto }, clave, marcas: [marca] })
  }
  contiene(
    'contact_form/split: los tres apagados quitan la columna',
    pintar(ContactFormSplit, { content: { show_phone: false, show_email: false, show_address: false }, organization: orgContacto }),
    [],
    ['Información de Contacto'],
  )
  const { ContactFormWithMap } = await cargar('components/sections/contact/ContactFormWithMap.tsx')
  interruptor({ nombre: 'contact_form/with_map', Comp: ContactFormWithMap, props: { content: {}, organization: orgContacto }, clave: 'show_map', marcas: ['maps.google.com'] })
} finally {
  await rm(TMP, { recursive: true, force: true })
}

if (fallos.length) {
  console.error(`✗ verify-interruptores: ${fallos.length} fallo(s) en ${casos} casos\n`)
  for (const f of fallos) console.error(`  - ${f}`)
  process.exit(1)
}
console.log(`✓ verify-interruptores: ${casos} casos — cada interruptor apaga lo que dice y, ausente, el sitio se ve como antes`)
