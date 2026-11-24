/**
 * verify-secciones-ficha.mjs — Beneficios, Reseñas, Productos relacionados y Descripción de la
 * ficha con estilos y opciones (Figma «16 Sitio web», sección 2983:72501, aprobada el 2026-11-24).
 *
 *   npm run verify:secciones-ficha
 *
 * La regla que se prueba: SIN opciones guardadas cada sección se pinta EXACTAMENTE como hoy.
 *
 * 1. Contrato (lib/website/v2/seccionesFicha.ts, copia idéntica del ERP): sin claves nuevas
 *    `conOpciones === false` y los valores por defecto son el aspecto de hoy (Lista, 2 columnas,
 *    multicolor, sin líneas; Clásico; Carrusel; «Ver más» por 180 letras). Lo mismo con los
 *    contenidos que ya están publicados (`related_products_layout`, `items`). `layout` de la
 *    descripción (que la tienda nunca aplicó) no enciende nada. Fuentes de relacionados: a mano
 *    primero y sin repetir; «Comprados juntos»: a mano, luego calculados.
 * 2. Fuente: cada componente decide con `conOpciones` y conserva, tal cual, el marcado de hoy
 *    (instantáneas literales abajo). Las claves nuevas no viajan a `cardStyle`/`layoutConfig` de
 *    los relacionados. La página solo consulta elegidos a mano y comprados juntos si la sección
 *    los pide (o en el lienzo).
 */
import { readFileSync } from 'node:fs'
import {
  CLAVES_NUEVAS_BENEFICIOS,
  CLAVES_NUEVAS_DESCRIPCION,
  CLAVES_NUEVAS_RELACIONADOS,
  CLAVES_NUEVAS_RESENAS,
  filasParaGuardar,
  leerFilasPropias,
  leerOpcionesBeneficios,
  leerOpcionesDescripcion,
  leerOpcionesRelacionados,
  leerOpcionesResenas,
  productosCompradosJuntos,
  productosRelacionados,
  relacionadosPideDatos,
  sumaPrecios,
  ESTILOS_BENEFICIOS,
  ESTILOS_DESCRIPCION,
  ESTILOS_RELACIONADOS,
  ESTILOS_RESENAS,
  ICONOS_BENEFICIO,
  ICONOS_BENEFICIO_ANTERIORES,
  MEDIDAS_ICONO_INSIGNIA,
  SOLO_EN_ESTILOS_BENEFICIOS,
  SOLO_EN_ESTILOS_DESCRIPCION,
  SOLO_EN_ESTILOS_RELACIONADOS,
  SOLO_EN_ESTILOS_RESENAS,
  beneficiosConColorPropio,
  espacioBeneficios,
  seUsaEnEstilo,
} from '../lib/website/v2/seccionesFicha.ts'
import { buildSectionStyle, buildSurfaceStyle } from '../lib/sectionStyle.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const plano = (s) => s.replace(/\s+/g, ' ').trim()
const contiene = (fuente, instantanea) => plano(fuente).includes(plano(instantanea))

// ── 1. Contrato ──
const vacios = [{}, null, undefined]
for (const c of vacios) {
  check(!leerOpcionesBeneficios(c).conOpciones, `beneficios ${JSON.stringify(c)}: sin opciones`)
  check(!leerOpcionesResenas(c).conOpciones, `reseñas ${JSON.stringify(c)}: sin opciones`)
  check(!leerOpcionesRelacionados(c).conOpciones, `relacionados ${JSON.stringify(c)}: sin opciones`)
  check(!leerOpcionesDescripcion(c).conOpciones, `descripción ${JSON.stringify(c)}: sin opciones`)
}
// Contenidos publicados hoy (revisiones del 2026-11-24): ninguno enciende las opciones.
const publicados = {
  beneficios: { items: [{ icon: 'Truck', title: 'Envío', description: 'Gratis' }] },
  relacionados: { related_products_layout: 'grid' },
  descripcion: { layout: 'tabs', max_height: 300, show_specs: true },
  resenas: { reviews_source: 'real', empty_state_title: 'Nada aún' },
}
check(!leerOpcionesBeneficios(publicados.beneficios).conOpciones, 'beneficios con items: sin opciones')
check(!leerOpcionesRelacionados(publicados.relacionados).conOpciones, 'relacionados con related_products_layout: sin opciones')
check(leerOpcionesRelacionados(publicados.relacionados).estilo === 'rejilla', 'related_products_layout grid se lee como Rejilla')
check(!leerOpcionesDescripcion(publicados.descripcion).conOpciones, 'descripción con layout (nunca aplicado): sin opciones')
check(!leerOpcionesResenas(publicados.resenas).conOpciones, 'reseñas con fuente y textos del vacío: sin opciones')

const b = leerOpcionesBeneficios({})
check(b.estilo === 'lista' && b.columnas === 2 && b.modoColor === 'multicolor' && !b.lineas && b.fondo === 'suave' && b.forma === 'circulo' && b.tamano === 'md' && b.columnasCelular === null && b.mostrarDescripcion, 'beneficios: por defecto el aspecto de hoy')
const r = leerOpcionesResenas({})
check(r.estilo === 'clasico' && r.porPagina === 10 && r.orden === 'recent' && r.colorEstrellas === 'amarillo' && r.titulo === 'Opiniones de clientes', 'reseñas: por defecto Clásico, 10, recientes, amarillo')
const rel = leerOpcionesRelacionados({})
check(rel.estilo === 'carrusel' && rel.fuente === 'category' && rel.cantidad === 8 && rel.columnas === 4 && rel.flechas && rel.puntos && !rel.ocultarAgotados, 'relacionados: por defecto Carrusel, categoría, 8, 4 columnas')
const d = leerOpcionesDescripcion({})
check(d.estilo === 'ver_mas' && d.lineas === null && d.letras === 180 && d.vinetas === 'punto', 'descripción: por defecto «Ver más» por 180 letras con punto')
check(leerOpcionesDescripcion({ max_height: 300 }).letras === 300, 'descripción: max_height sigue mandando en las letras')

for (const [nombre, claves] of Object.entries({ CLAVES_NUEVAS_BENEFICIOS, CLAVES_NUEVAS_RESENAS, CLAVES_NUEVAS_RELACIONADOS, CLAVES_NUEVAS_DESCRIPCION })) {
  // `title` es nueva solo en Reseñas (antes el título era fijo); en Relacionados ya existía.
  for (const k of ['items', 'columns', 'gap', 'title', 'max_items', 'source', 'show_arrows', 'show_dots', 'related_products_layout', 'layout', 'max_height', 'reviews_source']) {
    if (k === 'title' && nombre === 'CLAVES_NUEVAS_RESENAS') continue
    check(!claves.includes(k), `${nombre} no incluye la clave de siempre «${k}»`)
  }
  check(!claves.some((k) => k.startsWith('card_')), `${nombre}: ninguna clave nueva empieza por card_ (encendería buildCardStyle)`)
}
check(leerOpcionesBeneficios({ benefits_style: 'tarjetas' }).conOpciones, 'beneficios: una clave nueva enciende las opciones')
check(leerOpcionesBeneficios({ benefits_style: 'nada' }).estilo === 'lista', 'beneficios: estilo inválido = Lista')

const p = (id) => ({ id })
const siempre = [p(1), p(2), p(3)]
check(JSON.stringify(productosRelacionados('category', { siempre }, 9, 8)) === JSON.stringify(siempre), 'fuente categoría = la lista de siempre')
check(JSON.stringify(productosRelacionados('manual', { siempre, manuales: [p(7), p(2)] }, 9, 8).map((x) => x.id)) === '[7,2,1,3]', 'a mano primero, sin repetir, completa con los de siempre')
check(JSON.stringify(productosRelacionados('bought_together', { siempre, juntosManuales: [p(5)], juntosCalculados: [p(6), p(5)] }, 9, 8).map((x) => x.id)) === '[5,6]', 'comprados juntos: a mano primero y luego calculados')
check(JSON.stringify(productosRelacionados('bought_together', { siempre }, 9, 8).map((x) => x.id)) === '[1,2,3]', 'comprados juntos sin datos: la lista de siempre')
check(productosCompradosJuntos({ siempre: [], juntosCalculados: [p(1), p(2), p(3), p(4)] }, 9).length === 3, 'comprados juntos: hasta 3 además del producto')
check(!productosRelacionados('manual', { siempre: [p(9), p(1)] }, 9, 8).some((x) => x.id === 9), 'nunca el producto de la ficha')
check(sumaPrecios([1000, null, 2500]) === 3500, 'suma de precios')
check(JSON.stringify(relacionadosPideDatos({})) === '{"manual":false,"juntos":false}', 'sin fuente: la página no consulta nada nuevo')
check(relacionadosPideDatos({ source: 'manual' }).manual && relacionadosPideDatos({ related_style: 'juntos' }).juntos, 'fuente a mano y estilo juntos piden datos')
check(leerFilasPropias([{ nombre: 'Voltaje', valor: '110 V' }, { nombre: '', valor: 'x' }, 'x']).length === 1, 'filas propias: solo las completas')
check(filasParaGuardar([{ nombre: ' ', valor: ' ' }]) === null, 'sin filas: se guarda null')

// ── 2. Fuente: marcado de hoy intacto en la rama sin opciones ──
const beneficios = leer('components/sections/product-detail/ProductBenefits.tsx')
check(beneficios.includes('if (opciones.conOpciones || beneficiosConColorPropio(content)) {'), 'beneficios: decide con conOpciones (o un color propio en un ítem)')
check(contiene(beneficios, `<div
      className={\`grid \${gridColsClass} \${gapPropio ? '' : 'gap-4 '}pt-6 border-t dark:border-gray-700\`}
      style={gapPropio ? { gap: \`\${content.gap}px\` } : undefined}
    >`), 'beneficios: rejilla de hoy intacta')
check(contiene(beneficios, '<div className={`w-10 h-10 rounded-full ${tono.fondo} flex items-center justify-center`}> <Icon className={`h-5 w-5 ${tono.icono}`} />'), 'beneficios: ícono de hoy intacto')

const descripcion = leer('components/sections/product-detail/ProductDescription.tsx')
check(descripcion.includes('if (opciones.conOpciones && product) {'), 'descripción: decide con conOpciones')
check(contiene(descripcion, `<h3 className="font-semibold text-gray-900 dark:text-white mb-2">Descripción</h3>
      <ExpandableDescription text={product.description} maxLength={content.max_height || 180} />`), 'descripción: marcado de hoy intacto')
const expandible = leer('components/site/ExpandableDescription.tsx')
check(contiene(expandible, "return <span className=\"text-gray-400 mt-1 shrink-0\">•</span>") && expandible.includes("vineta: VinetaTexto = 'punto'"), 'descripción: la viñeta de siempre es la de por defecto')

const resenas = leer('components/site/reviews/ProductReviews.tsx')
check(resenas.includes('if (opciones?.conOpciones) {'), 'reseñas: decide con conOpciones')
check(contiene(resenas, 'Más de <span className="font-semibold text-gray-700">{totalReviews.toLocaleString(\'es-CO\')}</span> opiniones verificadas'), 'reseñas: encabezado de hoy intacto')
check(contiene(resenas, '<div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10 p-6 bg-gray-50 rounded-xl">'), 'reseñas: resumen de hoy intacto')
check(resenas.indexOf('if (opciones?.conOpciones)') > resenas.lastIndexOf('useMemo('), 'reseñas: la rama nueva va después de todos los hooks')

const seccionRel = leer('components/sections/product-detail/RelatedProductsSection.tsx')
check(seccionRel.includes("opciones.fuente === 'category' && !extras\n    ? siempre"), 'relacionados: sin fuente ni extras, la lista de siempre tal cual')
check(seccionRel.includes('!CLAVES_NUEVAS_RELACIONADOS.includes(k)'), 'relacionados: las claves nuevas no viajan a cardStyle/layoutConfig')
check(seccionRel.includes('opcionesFicha={opciones.conOpciones ?'), 'relacionados: opciones de la ficha solo con conOpciones')
const relacionados = leer('components/site/RelatedProducts.tsx')
check(contiene(relacionados, `<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{title || 'Productos relacionados'}</h2>`), 'relacionados: título de hoy intacto')
check(relacionados.includes(`"flex overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide"`) && relacionados.includes('`flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(33.333%-11px)] ${lgWidth} snap-start`'), 'relacionados: carrusel de hoy intacto')
check(relacionados.includes(`"grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"`), 'relacionados: rejilla de hoy intacta')
check(relacionados.includes("const formaFlecha = opcionesFicha?.formaFlechas === 'cuadrado' ? 'rounded-lg' : 'rounded-full'"), 'relacionados: flechas redondas por defecto')

const pagina = leer('app/productos/[id]/page.tsx')
check(pagina.includes('const conRelacionados = enLienzo || pideRelacionados.manual || pideRelacionados.juntos'), 'página: elegidos a mano y comprados juntos solo si la sección los pide')
check(pagina.includes("opcionesRelacionados.fuente === 'tag')"), 'página: «Misma etiqueta» pone la etiqueta primero')
const consulta = leer('lib/queries/tienda/relacionados.ts')
check(consulta.includes("cacheCatalog('getRelacionadosFicha'") && consulta.includes("rpc('fn_comprados_juntos'") && consulta.includes(".eq('organization_id', organizationId)"), 'consulta: con caché, RPC acotada y por organización')

// ── 3. Beneficios: cada opción, en cada estilo, en computador y en celular (2026-11-24) ──
//
// El dueño reportó opciones sin efecto (Insignias, columnas en celular, Avanzado). La regla: la
// tienda pinta cada opción en los estilos de `SOLO_EN_ESTILOS_BENEFICIOS`, y en los demás el panel
// la oculta (y lo dice). Aquí se compara el mapa con el marcado real de cada rama.
{
  const fuente = beneficios
  const inicio = fuente.indexOf('function BeneficiosConOpciones(')
  check(inicio > 0, 'beneficios: existe BeneficiosConOpciones')
  const cuerpo = fuente.slice(inicio)
  const corte = (desde, hasta) => {
    const a = cuerpo.indexOf(desde)
    const b = hasta ? cuerpo.indexOf(hasta, a + 1) : cuerpo.length
    return a >= 0 && b > a ? cuerpo.slice(a, b) : ''
  }
  const ramas = {
    insignias: corte("if (o.estilo === 'insignias')", "const colsCelular"),
    tarjetas: corte("if (o.estilo === 'tarjetas')", "if (o.estilo === 'franja')"),
    franja: corte("if (o.estilo === 'franja')", '// Lista (por defecto)'),
    lista: corte('// Lista (por defecto)'),
  }
  for (const [estilo, rama] of Object.entries(ramas)) check(rama.length > 0, `beneficios: rama «${estilo}» encontrada`)
  // Señal de cada opción en el marcado de una rama.
  const senal = {
    columnas: 'colsEscritorio',
    columnasCelular: 'colsCelular',
    lineas: 'o.lineas',
    mostrarDescripcion: 'textos(item)',
    borde: 'o.borde',
    fondoItem: 'o.fondoItem',
  }
  for (const [opcion, texto] of Object.entries(senal)) {
    for (const estilo of ESTILOS_BENEFICIOS) {
      const usa = seUsaEnEstilo(SOLO_EN_ESTILOS_BENEFICIOS, opcion, estilo)
      check(ramas[estilo].includes(texto) === usa, `beneficios: «${opcion}» ${usa ? 'se pinta' : 'no se pinta'} en «${estilo}» (como dice SOLO_EN_ESTILOS_BENEFICIOS)`)
    }
  }
  // Opciones de todos los estilos: alineación, espacio y el ícono (color, fondo, forma, tamaño).
  for (const estilo of ESTILOS_BENEFICIOS) {
    check(/centro/.test(ramas[estilo]), `beneficios: alineación en «${estilo}»`)
    check(ramas[estilo].includes('gap'), `beneficios: espacio entre ítems en «${estilo}»`)
    check(ramas[estilo].includes('<IconoBeneficio'), `beneficios: ícono con color, fondo, forma y tamaño en «${estilo}»`)
  }
  // Insignias: sin tope de 12 px ni tamaño fijo «sm» (antes el espacio y el tamaño no hacían nada).
  check(!ramas.insignias.includes('Math.min(gap') && !ramas.insignias.includes("tamano: 'sm'"), 'insignias: el espacio y el tamaño elegidos se usan')
  check(ramas.insignias.includes('MEDIDAS_ICONO_INSIGNIA') && ramas.insignias.includes("'bg-gray-50"), 'insignias: tamaño propio de pastilla y fondo suave (Figma D)')
  // Computador y celular: Insignias y Tarjetas no cambian de forma por ancho salvo las columnas; las
  // columnas usan clases literales (Tailwind solo genera lo que ve escrito).
  check(!/\bmd:/.test(ramas.insignias), 'insignias: el mismo marcado en computador y en celular')
  for (const n of [1, 2, 3, 4]) {
    check(fuente.includes(`${n}: 'grid-cols-${n}'`) && fuente.includes(`${n}: 'md:grid-cols-${n}'`), `beneficios: clases literales de ${n} columna(s) en celular y computador`)
  }
  const cel = leerOpcionesBeneficios({ benefits_style: 'lista', columns: 3, columns_mobile: 1 })
  check(cel.columnas === 3 && cel.columnasCelular === 1, 'beneficios: 3 columnas en computador y 1 en celular se leen por separado')
  check(leerOpcionesBeneficios({ columns_mobile: 2 }).columnasCelular === 2 && leerOpcionesBeneficios({ columns_mobile: 5 }).columnasCelular === 2, 'beneficios: columnas en celular entre 1 y 2')
  check(ramas.lista.includes('${colsCelular} ${colsEscritorio}') && ramas.tarjetas.includes('${colsCelular} ${colsEscritorio}'), 'beneficios: Lista y Tarjetas, columnas de celular sin md: y de computador con md:')
  check(ramas.franja.includes('overflow-x-auto') && ramas.franja.includes('md:flex-1'), 'franja: se desliza en el celular y reparte el ancho en computador')
  // Espacio: 16 por defecto (hoy), 12 en Insignias; el elegido manda.
  check(espacioBeneficios(leerOpcionesBeneficios({})) === 16, 'espacio: 16 px por defecto')
  check(espacioBeneficios(leerOpcionesBeneficios({ benefits_style: 'insignias' })) === 12, 'espacio: 12 px por defecto en Insignias')
  check(espacioBeneficios(leerOpcionesBeneficios({ benefits_style: 'insignias', gap: 24 })) === 24, 'espacio: el elegido se usa en Insignias')
  check(MEDIDAS_ICONO_INSIGNIA.md.caja === 32 && MEDIDAS_ICONO_INSIGNIA.sm.caja < 32 && MEDIDAS_ICONO_INSIGNIA.lg.caja > 32, 'insignias: md = 32 px (el de siempre), sm más chico y lg más grande')
  // Color por ítem: enciende el pintado con opciones (si no, el color elegido no se veía).
  check(beneficiosConColorPropio({ items: [{ icon: 'Truck', title: 'Envío', color: '#DC2626' }] }), 'color por ítem: se detecta')
  check(!beneficiosConColorPropio(publicados.beneficios) && !beneficiosConColorPropio({ items: [{ icon: 'Truck', title: 'x', color: 'rojo' }] }), 'color por ítem: sin color (o inválido) no enciende nada')
  check(fuente.includes('opciones.conOpciones || beneficiosConColorPropio(content)'), 'beneficios: un color por ítem pinta con opciones')
  // Ícono de cada beneficio: los 12 del panel y los 2 de antes existen en la tienda.
  for (const icono of [...ICONOS_BENEFICIO, ...ICONOS_BENEFICIO_ANTERIORES]) {
    check(new RegExp(`\\n  ${icono},`).test(fuente), `beneficios: la tienda pinta el ícono «${icono}»`)
  }
  // Color de la marca: las tres variables existen en el layout del sitio.
  const layout = leer('components/site/OrganizationLayoutCliente.tsx')
  check(["'--primary-color'", "'--secondary-color'", "'--accent-color'"].every((v) => layout.includes(v)), 'color de la marca: primario, secundario y acento existen como variables del sitio')
}

// ── 4. Avanzado (radio, sombra, fondo, borde) también en los bloques de la ficha sin SectionWrapper ──
{
  const vacia = buildSurfaceStyle({})
  check(vacia.className === '' && !vacia.visible, 'superficie: sin claves no pinta nada (el marcado de hoy)')
  const conRadioSombra = buildSurfaceStyle({ radius: 8, shadow: 'lg' })
  check(conRadioSombra.className.includes('rounded-[var(--sec-radius)]') && conRadioSombra.className.includes('shadow-lg') && conRadioSombra.visible, 'superficie: radio 8 px y sombra fuerte')
  check(conRadioSombra.style['--sec-radius'] === '8px', 'superficie: el radio va como variable')
  check(!conRadioSombra.className.includes('mx-auto') && !conRadioSombra.className.includes('w-full'), 'superficie: sin ancho de contenedor')
  check(buildSurfaceStyle({ radius: 0, shadow: 'none', bg_type: 'none', border_width: 0 }).className === '', 'superficie: los valores por defecto del editor no pintan nada')
  check(buildSurfaceStyle({ bg_type: 'color', bg_color: '#F8FAFC' }).visible, 'superficie: un fondo es visible (lleva relleno)')
  // buildSectionStyle (SectionWrapper) da exactamente lo de antes.
  const seccion = buildSectionStyle({ radius: 8, shadow: 'lg', border_width: 2, border_color: '#000' }, null, 'product_benefits')
  check(seccion.className.startsWith('w-full rounded-[var(--sec-radius)] shadow-lg border mx-auto'), `buildSectionStyle: mismo orden de clases que antes (${seccion.className})`)
  check(buildSectionStyle({}, null, 'product_benefits').className.startsWith('w-full mx-auto'), 'buildSectionStyle: sin claves, como antes')
  const renderer = leer('components/sections/product-detail/ProductDetailRenderer.tsx')
  check(renderer.includes('buildSurfaceStyle((section.content') && renderer.includes('data-superficie-ficha'), 'ficha: los bloques sin SectionWrapper reciben Avanzado')
  check(renderer.includes('superficie?.className ? ('), 'ficha: sin claves de Avanzado, ninguna caja extra')
}

// ── 5. Reseñas, Relacionados y Descripción: lo que no llegaba a la tienda ──
{
  for (const [nombre, mapa, estilos] of [
    ['reseñas', SOLO_EN_ESTILOS_RESENAS, ESTILOS_RESENAS],
    ['relacionados', SOLO_EN_ESTILOS_RELACIONADOS, ESTILOS_RELACIONADOS],
    ['descripción', SOLO_EN_ESTILOS_DESCRIPCION, ESTILOS_DESCRIPCION],
  ]) {
    for (const [opcion, lista] of Object.entries(mapa)) check(lista.length > 0 && lista.every((e) => estilos.includes(e)), `${nombre}: «${opcion}» solo con estilos que existen`)
  }
  check(seUsaEnEstilo(SOLO_EN_ESTILOS_RELACIONADOS, 'flechas', 'carrusel') && !seUsaEnEstilo(SOLO_EN_ESTILOS_RELACIONADOS, 'flechas', 'rejilla'), 'relacionados: flechas solo en Carrusel')
  check(seUsaEnEstilo(SOLO_EN_ESTILOS_RELACIONADOS, 'ocultarAgotados', 'juntos'), 'sin entrada en el mapa: se usa en todos los estilos')
  const reviewsFuente = leer('components/site/reviews/ProductReviews.tsx')
  check(reviewsFuente.includes('key={`${opciones.porPagina}-${opciones.orden}`}'), 'reseñas: «Por página» y «Orden al abrir» se ven en vivo')
  const conOpcionesResenas = leer('components/site/reviews/ResenasConOpciones.tsx')
  check(conOpcionesResenas.includes('className={`mt-8 rounded-xl ${claseTarjeta} p-5`}'), 'reseñas: «Compacta» con «Sin borde» ya no pone borde')
  const descFuente = leer('components/sections/product-detail/ProductDescription.tsx')
  check(descFuente.includes('<ExpandableDescription text={texto} maxLength={o.letras} vineta={o.vinetas} />'), 'descripción: viñetas también con «Por letras»')
  check(/fontSize: PX_TEXTO\[o\.tamanoTexto\] }}>\s*<ExpandableDescription/.test(descFuente), 'descripción: tamaño del texto también con «Por letras»')
  check(descFuente.includes('<PestanasOAcordeon key={o.abierta}'), 'descripción: «Abierta al cargar» se ve en vivo')
  check(expandible.includes('return renderRichText(text, vineta)'), 'ExpandableDescription: pinta la viñeta pedida (sin ella, el punto)')
  check(pagina.includes('Math.max(8, opcionesRelacionados.cantidad)'), 'relacionados: «Cantidad máxima» 12 trae 12 (8 como mínimo, lo de siempre)')
}

if (problemas.length) {
  console.error(`✗ verify-secciones-ficha: ${problemas.length} de ${casos} fallaron`)
  for (const m of problemas) console.error(`  - ${m}`)
  process.exit(1)
}
console.log(`✓ verify-secciones-ficha: ${casos} comprobaciones`)
