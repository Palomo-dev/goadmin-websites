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

  // ==========================================================================================
  // Interruptores que se ocultaron el 2026-10-07 y ya se implementaron (docs del ERP:
  // `docs/sitio-web/PENDIENTE-interruptores-sin-implementar.md`).
  // ==========================================================================================

  /** El contrario de `interruptor`: ausente = no se pinta (como antes); con la clave en true, sí. */
  function encender({ nombre, Comp, props, clave, marcas, valor = true }) {
    casos++
    const sin = pintar(Comp, props)
    const sobran = marcas.filter((m) => sin.includes(m))
    if (sobran.length) fallos.push(`${nombre}: sin «${clave}» (ausente = como antes) ya se pinta ${sobran.map((m) => `«${m}»`).join(', ')}`)
    const con = pintar(Comp, { ...props, content: { ...props.content, [clave]: valor } })
    const faltan = marcas.filter((m) => !con.includes(m))
    if (faltan.length) fallos.push(`${nombre}: con «${clave}: ${valor}» falta ${faltan.map((m) => `«${m}»`).join(', ')}`)
  }
  /** Comprueba un atributo `data-carrusel-*` con la clave ausente y con la clave puesta. */
  function opcion({ nombre, Comp, props, clave, atributo, ausente }) {
    const a = `data-carrusel-${atributo}="${ausente}"`
    const b = `data-carrusel-${atributo}="${!ausente}"`
    contiene(`${nombre}: sin «${clave}» = como antes (${ausente})`, pintar(Comp, props), [a], [b])
    contiene(`${nombre}: «${clave}: ${!ausente}»`, pintar(Comp, { ...props, content: { ...props.content, [clave]: !ausente } }), [b], [a])
  }

  // ---------------------------------------------------------------- lógica pura del carrusel
  const { leerOpcionesCarrusel, indiceSiguiente, indiceAnterior } = await cargar('lib/carrusel/opcionesCarrusel.ts')
  const { crearControlAutoplay } = await cargar('lib/carrusel/controlAutoplay.ts')
  const { destinoDesplazamiento } = await cargar('lib/carrusel/desplazamiento.ts')
  {
    casos++
    const base = { autoplay: false, intervaloMs: 3000, bucle: true, pausarAlPasar: false, flechas: false, puntos: false, deslizar: false }
    const a = leerOpcionesCarrusel({}, base)
    if (JSON.stringify(a) !== JSON.stringify(base)) fallos.push('carrusel: con el contenido vacío las opciones no son las de hoy')
    const b = leerOpcionesCarrusel({ autoplay: 'true', loop: false, show_arrows: true, interval_ms: 99999 }, base)
    if (!b.autoplay || b.bucle || !b.flechas || b.intervaloMs !== 15000) fallos.push(`carrusel: no lee las claves del editor (${JSON.stringify(b)})`)
    if (indiceSiguiente(2, 3, true) !== 0 || indiceSiguiente(2, 3, false) !== null) fallos.push('carrusel: «Repetir en bucle» no decide si da la vuelta al final')
    if (indiceAnterior(0, 3, true) !== 2 || indiceAnterior(0, 3, false) !== null) fallos.push('carrusel: «Repetir en bucle» no decide si da la vuelta al principio')
    const fin = { scrollLeft: 600, scrollWidth: 1000, clientWidth: 400 }
    if (JSON.stringify(destinoDesplazamiento(fin, 'siguiente', true, 0.8)) !== '{"a":0}') fallos.push('carrusel desplazable: con bucle no vuelve al inicio')
    if (destinoDesplazamiento(fin, 'siguiente', false, 0.8) !== null) fallos.push('carrusel desplazable: sin bucle sigue avanzando en el final')
  }
  {
    // Reloj falso: el autoplay avanza solo sin motivos de pausa.
    casos++
    let reloj = null
    const relojFalso = { setInterval: (fn) => (reloj = fn), clearInterval: () => (reloj = null) }
    let pasos = 0
    const c = crearControlAutoplay({ intervaloMs: 1000, avanzar: () => { pasos++; return pasos < 3 }, reloj: relojFalso })
    reloj?.()
    if (pasos !== 1) fallos.push('autoplay: no avanza con el reloj')
    for (const motivo of ['puntero', 'foco', 'pestana', 'movimiento']) {
      c.pausar(motivo)
      if (c.corriendo()) fallos.push(`autoplay: no se pausa por «${motivo}»`)
      c.reanudar(motivo)
      if (!c.corriendo()) fallos.push(`autoplay: no se reanuda tras «${motivo}»`)
    }
    reloj?.(); reloj?.()
    if (c.corriendo()) fallos.push('autoplay: sin bucle sigue corriendo en el último')
  }

  // ---------------------------------------------------------------- gallery: carousel y fullscreen
  const IMGS = [1, 2, 3].map((i) => ({ url: `https://x/g${i}.jpg`, alt: `Foto ${i}` }))
  const { GalleryCarousel } = await cargar('components/sections/gallery/GalleryCarousel.tsx')
  const { GalleryFullscreen } = await cargar('components/sections/gallery/GalleryFullscreen.tsx')
  const galeria = { content: { images: IMGS }, primaryColor: '#123456' }
  interruptor({ nombre: 'gallery/carousel', Comp: GalleryCarousel, props: galeria, clave: 'show_arrows', marcas: ['aria-label="Foto anterior"', 'aria-label="Foto siguiente"'] })
  interruptor({ nombre: 'gallery/carousel', Comp: GalleryCarousel, props: galeria, clave: 'show_dots', marcas: ['data-carrusel-puntos'] })
  contiene('gallery/carousel: con bucle (ausente) la flecha «anterior» del primero da la vuelta', pintar(GalleryCarousel, galeria), [], ['disabled=""'])
  contiene('gallery/carousel: «loop: false» desactiva «anterior» en la primera foto', pintar(GalleryCarousel, { ...galeria, content: { ...galeria.content, loop: false } }), ['disabled=""'])
  opcion({ nombre: 'gallery/carousel', Comp: GalleryCarousel, props: galeria, clave: 'autoplay', atributo: 'autoplay', ausente: false })
  opcion({ nombre: 'gallery/carousel', Comp: GalleryCarousel, props: galeria, clave: 'pause_on_hover', atributo: 'pausa', ausente: true })
  opcion({ nombre: 'gallery/carousel', Comp: GalleryCarousel, props: galeria, clave: 'enable_swipe', atributo: 'deslizar', ausente: false })
  encender({ nombre: 'gallery/carousel', Comp: GalleryCarousel, props: galeria, clave: 'enable_swipe', marcas: ['touch-pan-y'] })
  encender({ nombre: 'gallery/fullscreen', Comp: GalleryFullscreen, props: galeria, clave: 'show_arrows', marcas: ['aria-label="Foto anterior"', 'aria-label="Foto siguiente"'] })
  interruptor({ nombre: 'gallery/fullscreen', Comp: GalleryFullscreen, props: galeria, clave: 'show_dots', marcas: ['data-carrusel-puntos'] })
  contiene('gallery/fullscreen: «loop: false» + flechas desactiva «anterior» en la primera', pintar(GalleryFullscreen, { ...galeria, content: { ...galeria.content, loop: false, show_arrows: true } }), ['disabled=""'])
  opcion({ nombre: 'gallery/fullscreen', Comp: GalleryFullscreen, props: galeria, clave: 'autoplay', atributo: 'autoplay', ausente: false })
  opcion({ nombre: 'gallery/fullscreen', Comp: GalleryFullscreen, props: galeria, clave: 'pause_on_hover', atributo: 'pausa', ausente: true })
  opcion({ nombre: 'gallery/fullscreen', Comp: GalleryFullscreen, props: galeria, clave: 'enable_swipe', atributo: 'deslizar', ausente: false })

  // ---------------------------------------------------------------- partners: carousel
  const { PartnersCarousel } = await cargar('components/sections/partners/PartnersCarousel.tsx')
  const aliados = { content: { items: [1, 2, 3, 4, 5, 6, 7].map((i) => ({ name: `Aliado ${i}` })) }, primaryColor: '#123456' }
  encender({ nombre: 'partners/carousel', Comp: PartnersCarousel, props: aliados, clave: 'show_arrows', marcas: ['aria-label="Aliados anteriores"', 'aria-label="Más aliados"'] })
  encender({ nombre: 'partners/carousel', Comp: PartnersCarousel, props: aliados, clave: 'show_dots', marcas: ['data-carrusel-puntos', 'aria-label="Ir a la posición 1 de 7"'] })
  contiene('partners/carousel: «loop: false» + flechas desactiva «anterior» al inicio y deja 3 posiciones', pintar(PartnersCarousel, { ...aliados, content: { ...aliados.content, loop: false, show_arrows: true, show_dots: true } }), ['disabled=""', 'Ir a la posición 3 de 3'], ['Ir a la posición 4'])
  opcion({ nombre: 'partners/carousel', Comp: PartnersCarousel, props: aliados, clave: 'autoplay', atributo: 'autoplay', ausente: true })
  opcion({ nombre: 'partners/carousel', Comp: PartnersCarousel, props: aliados, clave: 'loop', atributo: 'bucle', ausente: true })
  opcion({ nombre: 'partners/carousel', Comp: PartnersCarousel, props: aliados, clave: 'pause_on_hover', atributo: 'pausa', ausente: false })
  opcion({ nombre: 'partners/carousel', Comp: PartnersCarousel, props: aliados, clave: 'enable_swipe', atributo: 'deslizar', ausente: false })

  // ---------------------------------------------------------------- brands: logos (distribución carrusel)
  const { BrandsLogos } = await cargar('components/sections/retail/BrandsLogos.tsx')
  const marcas = { content: { layout: 'carousel', items: [1, 2, 3].map((i) => ({ name: `Marca ${i}` })) }, primaryColor: '#123456' }
  opcion({ nombre: 'brands/logos', Comp: BrandsLogos, props: marcas, clave: 'autoplay', atributo: 'autoplay', ausente: false })
  opcion({ nombre: 'brands/logos', Comp: BrandsLogos, props: marcas, clave: 'loop', atributo: 'bucle', ausente: false })
  opcion({ nombre: 'brands/logos', Comp: BrandsLogos, props: marcas, clave: 'pause_on_hover', atributo: 'pausa', ausente: true })
  opcion({ nombre: 'brands/logos', Comp: BrandsLogos, props: marcas, clave: 'show_arrows', atributo: 'flechas', ausente: true })
  opcion({ nombre: 'brands/logos', Comp: BrandsLogos, props: marcas, clave: 'show_dots', atributo: 'paginacion', ausente: false })
  opcion({ nombre: 'brands/logos', Comp: BrandsLogos, props: marcas, clave: 'enable_swipe', atributo: 'deslizar', ausente: true })
  interruptor({ nombre: 'brands/logos', Comp: BrandsLogos, props: marcas, clave: 'enable_swipe', marcas: ['overflow-x-auto'] })

  // ---------------------------------------------------------------- productos: carruseles
  const PRODUCTOS = [
    { id: 1, uuid: 'u1', name: 'Café de origen', sku: 'CAF-1', category_id: 10, categories: { name: 'Bebidas' }, product_prices: [{ price: 80, compare_price: 100 }] },
    { id: 2, uuid: 'u2', name: 'Pan de bono', sku: 'PAN-2', category_id: 20, categories: { name: 'Panadería' }, product_prices: [{ price: 50, compare_price: null }] },
    { id: 3, uuid: 'u3', name: 'Té verde', sku: 'TE-3', category_id: 10, categories: { name: 'Bebidas' }, product_prices: [{ price: 30, compare_price: 30 }] },
  ]
  const datosProductos = { products: PRODUCTOS, categories: [{ id: 10, name: 'Bebidas' }, { id: 20, name: 'Panadería' }] }
  const { ProductsCarousel } = await cargar('components/sections/products/ProductsCarousel.tsx')
  const { FeaturedProductsCarousel } = await cargar('components/sections/products/FeaturedProductsCarousel.tsx')
  for (const [nombre, Comp] of [['products_grid/carousel', ProductsCarousel], ['featured_products/carousel', FeaturedProductsCarousel]]) {
    const props = { content: {}, data: datosProductos, organization: { subdomain: 'x', website_settings: {} } }
    opcion({ nombre, Comp, props, clave: 'autoplay', atributo: 'autoplay', ausente: false })
    opcion({ nombre, Comp, props, clave: 'loop', atributo: 'bucle', ausente: false })
    opcion({ nombre, Comp, props, clave: 'enable_swipe', atributo: 'deslizar', ausente: true })
    interruptor({ nombre, Comp, props, clave: 'enable_swipe', marcas: ['overflow-x-auto'] })
  }

  // ---------------------------------------------------------------- precio tachado
  const { precioAnteriorValido } = await cargar('lib/products/precioAnterior.ts')
  casos++
  if (precioAnteriorValido(100, 80) !== 100 || precioAnteriorValido(80, 80) !== null || precioAnteriorValido(null, 80) !== null || precioAnteriorValido(0, 80) !== null) {
    fallos.push('precio tachado: solo un compare_price real y mayor que el precio cuenta')
  }
  const TACHADO = 'data-precio-anterior'
  encender({ nombre: 'featured_products/hero_product', Comp: FeaturedProductsHero, props: { content: {}, data: datosProductos }, clave: 'show_compare_price', marcas: [TACHADO, 'Precio anterior: </span>$100'] })
  contiene('featured_products/hero_product: sin compare_price mayor, nada tachado', pintar(FeaturedProductsHero, { content: { show_compare_price: true }, data: { products: [PRODUCTOS[1], PRODUCTOS[2]] } }), [], [TACHADO])
  const { SpecialtiesFeatured } = await cargar('components/sections/restaurant/SpecialtiesFeatured.tsx')
  encender({ nombre: 'specialties/featured', Comp: SpecialtiesFeatured, props: { content: {}, data: datosProductos }, clave: 'show_compare_price', marcas: [TACHADO] })
  const planConOferta = { id: 'p1', name: 'Mensual', description: '', price: 90000, compare_price: 120000, duration_value: 1, duration_unit: 'month', benefits: [] }
  encender({ nombre: 'membership_plans/pricing_table', Comp: MembershipPlansPricing, props: { content: {}, data: { membershipPlans: [planConOferta] } }, clave: 'show_compare_price', marcas: [TACHADO, '120.000'] })
  contiene('membership_plans: sin compare_price, nada tachado', pintar(MembershipPlansPricing, { content: { show_compare_price: true }, data: { membershipPlans: [{ ...planConOferta, compare_price: null }] } }), [], [TACHADO])
  const { MenuPreviewTabs } = await cargar('components/sections/restaurant/MenuPreviewTabs.tsx')
  const carta = { products: PRODUCTOS.map((p) => ({ ...p, status: 'active', is_menu_item: true })), categories: datosProductos.categories }
  encender({ nombre: 'menu_preview/tabs', Comp: MenuPreviewTabs, props: { content: {}, organization: { id: 1 }, data: carta }, clave: 'show_compare_price', marcas: [TACHADO] })

  // ---------------------------------------------------------------- filtros y buscador
  const { filtrarProductos, FILTROS_INICIALES } = await cargar('lib/products/filtrosProductos.ts')
  casos++
  {
    const ids = (estado) => filtrarProductos(PRODUCTOS, { ...FILTROS_INICIALES, ...estado }).map((p) => p.id).join(',')
    if (ids({}) !== '1,2,3') fallos.push('filtros: con el estado inicial cambian la lista')
    if (ids({ busqueda: 'cafe' }) !== '1') fallos.push('buscador: «cafe» no encuentra «Café de origen» (tildes)')
    if (ids({ busqueda: 'bebidas' }) !== '1,3') fallos.push('buscador: no busca por categoría')
    if (ids({ busqueda: 'pan-2' }) !== '2') fallos.push('buscador: no busca por referencia')
    if (ids({ categoria: 20 }) !== '2') fallos.push('filtros: la categoría no filtra')
    if (ids({ soloOfertas: true }) !== '1') fallos.push('filtros: «Ofertas» no deja solo los que tienen compare_price mayor')
    if (ids({ orden: 'price_asc' }) !== '3,2,1') fallos.push('filtros: el orden por precio no ordena')
  }
  const BARRA = 'Precio: menor a mayor</option>'
  const BUSCADOR = 'data-buscador-productos'
  const { ProductsGrid } = await cargar('components/sections/products/ProductsGrid.tsx')
  const { ProductsList } = await cargar('components/sections/products/ProductsList.tsx')
  const { FeaturedProducts } = await cargar('components/sections/products/FeaturedProducts.tsx')
  const { OffersGrid } = await cargar('components/sections/retail/OffersGrid.tsx')
  const propsLista = { content: {}, data: datosProductos, organization: { subdomain: 'x', website_settings: {} } }
  // ProductsGrid (default, grid) ya pintaba los filtros: ausente = se ven.
  interruptor({ nombre: 'products_grid/grid', Comp: ProductsGrid, props: propsLista, clave: 'show_filters', marcas: [BARRA, '>Bebidas<'] })
  encender({ nombre: 'products_grid/grid', Comp: ProductsGrid, props: propsLista, clave: 'show_search', marcas: [BUSCADOR, 'aria-label="Buscar productos"'] })
  for (const [nombre, Comp] of [
    ['products_grid/carousel', ProductsCarousel],
    ['products_grid/list', ProductsList],
    ['featured_products/grid', FeaturedProducts],
    ['featured_products/carousel', FeaturedProductsCarousel],
    ['featured_products/hero_product', FeaturedProductsHero],
  ]) {
    encender({ nombre, Comp, props: propsLista, clave: 'show_filters', marcas: [BARRA, '>Bebidas<'] })
    encender({ nombre, Comp, props: propsLista, clave: 'show_search', marcas: [BUSCADOR] })
  }
  const propsOfertas = { content: {}, data: { offerProducts: PRODUCTOS }, organization: { subdomain: 'x', website_settings: {} } }
  // OffersGrid siempre pintó sus filtros: ausente = se ven.
  interruptor({ nombre: 'offers/grid', Comp: OffersGrid, props: propsOfertas, clave: 'show_filters', marcas: ['Mayor descuento</option>'] })
  encender({ nombre: 'offers/grid', Comp: OffersGrid, props: propsOfertas, clave: 'show_search', marcas: [BUSCADOR, 'aria-label="Buscar ofertas"'] })

  // ---------------------------------------------------------------- gallery: lightbox (las cuatro)
  const { GalleryGrid } = await cargar('components/sections/gallery/GalleryGrid.tsx')
  const { GalleryMasonry } = await cargar('components/sections/gallery/GalleryMasonry.tsx')
  for (const [nombre, Comp] of [['gallery/masonry', GalleryMasonry], ['gallery/grid', GalleryGrid], ['gallery/carousel', GalleryCarousel], ['gallery/fullscreen', GalleryFullscreen]]) {
    encender({ nombre, Comp, props: { ...galeria, organization: { website_settings: {} } }, clave: 'lightbox', marcas: ['data-lightbox', 'aria-label="Ampliar foto: Foto 1"'] })
  }

  // ---------------------------------------------------------------- show_description restantes
  const { SpacesCards } = await cargar('components/sections/hotel/SpacesCards.tsx')
  encender({
    nombre: 'room_types/cards',
    Comp: SpacesCards,
    props: { content: {}, data: { spaces: [], spaceTypes: [{ id: 't1', name: 'Doble', description: 'DESC-HABITACION', base_rate: 100, capacity: 2, amenities: [] }] } },
    clave: 'show_description',
    marcas: ['DESC-HABITACION'],
  })
  encender({ nombre: 'specialties/featured', Comp: SpecialtiesFeatured, props: { content: {}, data: { products: [{ ...PRODUCTOS[0], description: 'DESC-PLATO' }] } }, clave: 'show_description', marcas: ['DESC-PLATO'] })
  const { ParkingPassPlansCards } = await cargar('components/sections/parking/ParkingPassPlansCards.tsx')
  encender({ nombre: 'parking_pass_plans/cards', Comp: ParkingPassPlansCards, props: { content: {}, data: { passTypes: [{ id: 1, name: 'Mensual', description: 'DESC-PASE', price: 1000, duration_days: 30 }] } }, clave: 'show_description', marcas: ['DESC-PASE'] })
  const { ServicesListIconsRow } = await cargar('components/sections/services/ServicesListIconsRow.tsx')
  encender({ nombre: 'services_list/icons_row', Comp: ServicesListIconsRow, props: { content: {}, data: servicios }, clave: 'show_description', marcas: ['DESC-SERVICIO'] })

  // ---------------------------------------------------------------- botones de tarjeta (card_buttons[])
  const conBoton = (boton) => ({ ...propsLista, content: { card_buttons: [boton] } })
  for (const [nombre, Comp] of [
    ['products_grid/grid', ProductsGrid],
    ['products_grid/carousel', ProductsCarousel],
    ['products_grid/list', ProductsList],
    ['featured_products/grid', FeaturedProducts],
    ['featured_products/carousel', FeaturedProductsCarousel],
  ]) {
    contiene(`${nombre}: card_buttons[].open_new_tab ausente = misma pestaña`, pintar(Comp, conBoton({ action: 'view_detail', variant: 'solid' })), [], ['data-nueva-pestana'])
    contiene(`${nombre}: card_buttons[].open_new_tab`, pintar(Comp, conBoton({ action: 'view_detail', variant: 'solid', open_new_tab: true })), ['data-nueva-pestana'])
    contiene(`${nombre}: card_buttons[].full_width_mobile ausente = como antes`, pintar(Comp, conBoton({ action: 'view_detail', full_width: false })), [], ['w-full sm:w-auto'])
    contiene(`${nombre}: card_buttons[].full_width_mobile`, pintar(Comp, conBoton({ action: 'view_detail', full_width: false, full_width_mobile: true })), ['w-full sm:w-auto'])
  }

  // ---------------------------------------------------------------- hero: buttons[].full_width e icon_only
  for (const [v, Comp] of Object.entries(heroes)) {
    if (v === 'slider') continue // el slider pinta los botones de cada diapositiva: abajo
    const props = (b) => ({ content: { ...contenidoHero(v), buttons: [{ label: 'BOTON-REPETIDOR', url: '/x', variant: 'solid', icon: 'ArrowRight', ...b }] }, organization: org, primaryColor: '#3B82F6' })
    contiene(`hero/${v}: buttons[].full_width ausente = como antes`, pintar(Comp, props({})), ['w-full sm:w-auto'], ['font-semibold transition-transform hover:scale-105 px-6 py-3 text-base   w-full"'])
    contiene(`hero/${v}: buttons[].full_width`, pintar(Comp, props({ full_width: true })), ['   w-full"'])
    contiene(`hero/${v}: buttons[].icon_only ausente = con texto`, pintar(Comp, props({})), ['BOTON-REPETIDOR<'], ['aria-label="BOTON-REPETIDOR"'])
    contiene(`hero/${v}: buttons[].icon_only`, pintar(Comp, props({ icon_only: true })), ['aria-label="BOTON-REPETIDOR"'], ['BOTON-REPETIDOR<'])
  }
  {
    const props = (b) => ({ content: { slides: [{ title: 'T', image_url: 'https://x/s.jpg', buttons: [{ label: 'BOTON-SLIDE', url: '/x', variant: 'solid', icon: 'ArrowRight', ...b }] }] }, organization: org, primaryColor: '#3B82F6' })
    contiene('hero/slider: buttons[].full_width', pintar(heroes.slider, props({ full_width: true })), ['   w-full"'])
    contiene('hero/slider: buttons[].icon_only', pintar(heroes.slider, props({ icon_only: true })), ['aria-label="BOTON-SLIDE"'], ['BOTON-SLIDE<'])
    contiene('hero/slider: botones ausentes = como antes', pintar(heroes.slider, props({})), ['BOTON-SLIDE<', 'w-full sm:w-auto'], ['aria-label="BOTON-SLIDE"'])
  }
} finally {
  await rm(TMP, { recursive: true, force: true })
}

if (fallos.length) {
  console.error(`✗ verify-interruptores: ${fallos.length} fallo(s) en ${casos} casos\n`)
  for (const f of fallos) console.error(`  - ${f}`)
  process.exit(1)
}
console.log(`✓ verify-interruptores: ${casos} casos — cada interruptor apaga lo que dice y, ausente, el sitio se ve como antes`)
