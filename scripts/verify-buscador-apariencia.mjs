/**
 * verify-buscador-apariencia.mjs — «Buscador personalizable» (Figma «16 Sitio web» 3241:99000,
 * lámina de claves 3252:99475; aprobado 2026-11-25).
 *
 *   npm run verify:buscador-apariencia
 *
 * Pura (sin base ni navegador). Comprueba:
 * 1. Sin ajustes = idéntica: `leerConstructor` y `ajustesConApariencia` devuelven lo mismo que hoy
 *    para todas las formas (sin la clave `apariencia`); `{}`, `null`, basura o solo `preset` cuentan
 *    como ausente. El único cambio visible por defecto es la ayuda en #6B7280 (4,6:1).
 * 2. Valores por defecto = lo de hoy de cada forma (lámina D).
 * 3. Normalización de subclaves: inválidas fuera, colores en #RRGGBB, tokens, topes.
 * 4. Herencia celular ← computador (vacía = copia; «igual al de escritorio» = la del computador).
 * 5. Contraste: aviso con sugerencia que sí cumple; nunca bloquea.
 * 6. Plantillas: 9, válidas, «Personalizado (desde …)» al tocar una subclave; reglas del celular.
 */
import { readFileSync } from 'node:fs'
import {
  ALTO_MIN_CELULAR,
  CLAVES_VISUALES,
  COLOR_AYUDA_HOY,
  PLANTILLAS_BUSCADOR,
  PLANTILLAS_VALORES,
  FORMAS_BUSCADOR,
  ajustesConApariencia,
  aparienciaActiva,
  aparienciaDeDispositivo,
  aplicarPlantilla,
  avisosContraste,
  cambiarApariencia,
  estadoPlantilla,
  estiloCajaApariencia,
  normalizarAparienciaBuscador,
  resolverApariencia,
  sombraUnNivelMas,
  variablesApariencia,
} from '../lib/website/v2/aparienciaBuscador.ts'
import { contraste } from '../lib/website/v2/contrasteColor.ts'
import { aparienciaDesdeConstructor, leerConstructor } from '../lib/website/constructorEncabezado.ts'
import { OPCIONES_SHELL } from '../lib/website/v2/mapeoAjustes.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => { casos++; if (!cond) problemas.push(msg) }
/** Igualdad sin importar el orden de las claves. */
const ordenar = (v) => Array.isArray(v) ? v.map(ordenar) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, ordenar(v[k])])) : v
const igual = (a, b) => JSON.stringify(ordenar(a)) === JSON.stringify(ordenar(b))
const COLORES = { primary: '#2563EB' }

// ─── 1. Sin ajustes = idéntica ────────────────────────────────────────────────────────────────
const AUSENTES = [undefined, null, {}, { preset: 'today' }, { preset: 'custom' }, 'barra', 42, [], { height: 'xl', border_width: 9, bg: 'rojo', button: 'gigante' }]
const BUILDERS = [
  undefined,
  { search: { type: 'bar', border: 'thick', radius: 'pill' } },
  { search: { type: 'mega', button: 'text' } },
  { search: { type: 'icon_overlay', mobile: 'fullscreen' } },
  { icon_container: { shape: 'circle' } },
]
for (const forma of [...FORMAS_BUSCADOR, undefined]) {
  for (const builder of BUILDERS) {
    for (const igualEsc of [undefined, true, false]) {
      for (const movil of [undefined, null, ...FORMAS_BUSCADOR]) {
        const base = { search_style: forma, header_builder: builder, mobile_search_same_as_desktop: igualEsc, mobile_search_style: movil }
        const hoy = leerConstructor(base)
        check(!hoy?.buscador || !('apariencia' in hoy.buscador), `sin apariencia, el cromo no trae la clave (${forma}/${JSON.stringify(builder)})`)
        check(ajustesConApariencia(base, 'celular') === base && ajustesConApariencia(base, 'computador') === base, `sin apariencia, los ajustes son el mismo objeto (${forma}/${movil})`)
        for (const nada of AUSENTES) {
          const con = { ...base, search_appearance: nada, mobile_search_appearance: nada }
          check(igual(leerConstructor(con), hoy), `apariencia ${JSON.stringify(nada)} = ausente (${forma}/${JSON.stringify(builder)}/${movil})`)
          check(ajustesConApariencia(con, 'celular') === con, `apariencia ${JSON.stringify(nada)}: celular igual (${forma}/${movil})`)
        }
      }
    }
  }
}
// La barra de siempre (search_style 'bar' sin Constructor) sigue sin cromo: la pinta SearchBarInline.
check(leerConstructor({ search_style: 'bar' }) === null, 'bar sin nada: null (la barra de hoy)')
check(leerConstructor({ search_style: 'icon' }) === null, 'icon sin nada: null')
// Con apariencia, «Barra visible» pasa a la barra con estilo; «Ícono» sigue sin cromo (va por el contexto).
const conBar = leerConstructor({ search_style: 'bar', search_appearance: { radius: 'square' } })
check(conBar?.buscador?.tipo === 'bar' && conBar.buscador.apariencia?.radius === 'square', 'bar con apariencia: cromo con apariencia')
check(leerConstructor({ search_style: 'icon', search_appearance: { radius: 'square' } }) === null, 'icon con apariencia: sin cromo (el campo que abre lo pinta ProductSearch)')
const conMega = leerConstructor({ search_style: 'mega', search_appearance: { shadow: 'md' } })?.buscador
check(conMega?.tipo === 'mega' && conMega.apariencia?.shadow === 'md' && conMega.button === 'icon', 'mega con apariencia: mismos campos de hoy + apariencia')

// El único cambio por defecto: la ayuda en #6B7280 en las barras y en el campo que abre la lupa.
for (const archivo of ['components/site/SearchBarInput.tsx', 'components/site/ProductSearch.tsx']) {
  const fuente = readFileSync(new URL(`../${archivo}`, import.meta.url), 'utf8')
  check(!fuente.includes('placeholder-gray-400'), `${archivo}: sin la ayuda #9CA3AF de antes`)
  check(fuente.includes('placeholder:text-[#6B7280]'), `${archivo}: ayuda #6B7280 por defecto`)
}
check(COLOR_AYUDA_HOY === '#6B7280', 'color de ayuda por defecto #6B7280')
check(contraste('#6B7280', '#F9FAFB') >= 4.5 && contraste('#6B7280', '#FFFFFF') >= 4.5, '#6B7280 cumple 4,5:1 en gris 50 y en blanco')
check(contraste('#9CA3AF', '#F9FAFB') < 4.5, 'el #9CA3AF de antes no cumplía')

// ─── 2. Valores por defecto = lo de hoy ───────────────────────────────────────────────────────
const bar = resolverApariencia(null, 'bar', COLORES)
check(bar.alto === 44 && bar.fondo === '#F9FAFB' && bar.bordeAncho === 1 && bar.bordeColor === '#E5E7EB', 'barra visible: 44 px, gris 50, borde 1 gris 200')
check(bar.radio === 9999 && bar.sombra === 'none' && bar.iconoLado === 'left' && bar.iconoColor === '#9CA3AF' && bar.iconoTamano === 20, 'barra visible: píldora, sin sombra, lupa izq. gris 400 de 20')
check(bar.boton === 'none' && bar.bordeFoco === '#2563EB' && bar.ayudaColor === '#6B7280' && bar.categorias === false, 'barra visible: sin botón, foco en la marca, ayuda #6B7280, sin «Todas»')
check(bar.desplegableRadio === 12 && bar.desplegableSombra === 'lg' && bar.desplegableImagenes && bar.desplegablePrecios, 'desplegable de hoy')
check(bar.anillo.includes('#2563EB') && bar.anillo.includes('40%'), 'anillo: marca al 40 % (hoy)')
const mini = resolverApariencia(null, 'mini', COLORES)
check(mini.alto === 40 && mini.radio === 6 && mini.iconoTamano === 16, 'barra compacta: 40 px, suave 6, lupa 16')
const mega = resolverApariencia(null, 'mega', COLORES)
check(mega.alto === 48 && mega.radio === 6 && mega.categorias && mega.categoriasSeparador && mega.boton === 'icon' && mega.botonPegado && mega.fondo === '#FFFFFF', 'buscador grande: suave 6, «Todas» + separador, botón ícono pegado')
check(mega.botonFondo === '#2563EB' && mega.botonColor === '#FFFFFF', 'botón de hoy: primario con ícono blanco')
const pildora = resolverApariencia(null, 'pill_floating', COLORES)
check(pildora.radio === 9999 && pildora.sombra === 'lg', 'píldora flotante: píldora + sombra')
for (const f of ['icon', 'icon_overlay']) check(igual({ ...resolverApariencia(null, f, COLORES), forma: 'bar' }, bar), `${f}: el campo que abre usa los valores de la barra visible`)

// ─── 3. Normalización ─────────────────────────────────────────────────────────────────────────
const n = normalizarAparienciaBuscador({
  preset: 'minimal', height: 52, width: 'fill', max_width: 9999, align: 'center', border_width: 3, border_color: '#abc', border_style: 'bottom',
  focus_border_color: 'same', radius: 'rounded', radius_px: 33, shadow: 'inner', focus_shadow: 'up', bg: 'transparent', text_color: 'primary',
  placeholder: '  Busca   aquí  ', placeholder_color: '#1e293b', font: 'heading', icon_side: 'none', icon_color: 'accent', icon_size: 18,
  button: 'icon_text', button_text: 'x'.repeat(21), button_bg: 'primary', button_fg: 'auto', button_attached: 'sí', button_radius: 'inherit',
  categories: 'show', categories_style: 'boxed', categories_divider: false, categories_text: 'Todo', focus_ring_color: '#000',
  dropdown_radius: 'pill', dropdown_shadow: 'md', dropdown_images: false, dropdown_prices: true, otra: 1,
})
check(n.height === 52 && n.width === 'fill' && n.max_width === undefined && n.align === 'center', 'alto 36–64 y ancho máximo 160–960')
check(n.border_color === '#AABBCC' && n.focus_border_color === 'same' && n.border_style === 'bottom', 'hex corto → #RRGGBB; `same` en el borde al enfocar')
check(n.radius_px === undefined && n.text_color === undefined && n.icon_size === undefined, 'fuera de rango o token donde va hex: se descarta')
check(n.placeholder === 'Busca aquí' && n.button_text === undefined && n.button_attached === undefined, 'textos recortados y con tope; booleanos estrictos')
check(n.icon_color === 'accent' && n.bg === 'transparent' && n.button_fg === 'auto' && n.focus_ring_color === '#000000', 'tokens, transparente y auto')
check(n.dropdown_radius === undefined && n.dropdown_images === false && !('otra' in n), 'desplegable: solo recta/suave/redondeada; claves desconocidas fuera')
check(normalizarAparienciaBuscador({ height: 35 })?.height === undefined && normalizarAparienciaBuscador({ height: 64 })?.height === 64, 'alto: bordes del rango')
check(aparienciaActiva(normalizarAparienciaBuscador({ preset: 'thick' })) === false, 'solo plantilla sin subclaves: no cambia nada')
check(CLAVES_VISUALES.length === 35, 'las 35 subclaves visuales de la lámina D')
for (const k of ['search_appearance', 'mobile_search_appearance']) {
  const def = OPCIONES_SHELL[k]
  check(def?.zona === 'header' && def.porDefecto === null && def.nueva === true, `${k} en shell.header.opciones, nueva y null por defecto`)
}
const vivos = readFileSync(new URL('../components/site/useAjustesVivosPreview.ts', import.meta.url), 'utf8')
check(vivos.includes("'search_appearance'"), 'la vista previa del editor acepta search_appearance en vivo')

// Lo que traía el Constructor pasa a subclaves y la apariencia nueva manda encima.
const viejo = aparienciaDesdeConstructor({ border: 'thick', border_color: '#ff0000', radius: 'semi', shadow: true, button: 'text', width: 500, placeholder: 'Hola' })
check(viejo.border_width === 2 && viejo.border_color === '#FF0000' && viejo.radius === 'soft' && viejo.radius_px === 8 && viejo.shadow === 'lg' && viejo.button === 'text' && viejo.max_width === 500 && viejo.placeholder === 'Hola', 'header_builder.search → subclaves')
const mezcla = leerConstructor({ search_style: 'bar', header_builder: { search: { type: 'bar', border: 'thick' } }, search_appearance: { border_width: 0 } })?.buscador?.apariencia
check(mezcla?.border_width === 0, 'search_appearance manda sobre header_builder.search')

// ─── 4. Herencia celular ← computador ─────────────────────────────────────────────────────────
const PC = { radius: 'square' }
const CEL = { radius: 'pill', height: 'lg' }
check(igual(aparienciaDeDispositivo({ search_appearance: PC }, 'celular'), PC), 'celular sin la suya: copia la del computador')
check(igual(aparienciaDeDispositivo({ search_appearance: PC, mobile_search_appearance: {} }, 'celular'), PC), 'celular vacía: copia')
check(igual(aparienciaDeDispositivo({ search_appearance: PC, mobile_search_appearance: { preset: 'today' } }, 'celular'), PC), 'celular solo con plantilla: copia')
check(igual(aparienciaDeDispositivo({ search_appearance: PC, mobile_search_appearance: CEL }, 'celular'), CEL), 'celular con la suya: la suya')
check(igual(aparienciaDeDispositivo({ search_appearance: PC, mobile_search_appearance: CEL, mobile_search_same_as_desktop: true }, 'celular'), PC), '«igual al de escritorio»: la del computador')
check(igual(aparienciaDeDispositivo({ search_appearance: PC, mobile_search_appearance: CEL }, 'computador'), PC), 'computador: la suya')
check(aparienciaDeDispositivo({ mobile_search_appearance: CEL }, 'computador') === null, 'computador nunca lee la del celular')
const ajCel = ajustesConApariencia({ search_style: 'bar', search_appearance: PC, mobile_search_appearance: CEL }, 'celular')
check(igual(ajCel.search_appearance, CEL), 'ajustes del celular: search_appearance = la del celular')
const cel = resolverApariencia({ height: 'sm', button: 'text', button_attached: false }, 'bar', COLORES, 'celular')
check(cel.alto === ALTO_MIN_CELULAR && cel.boton === 'icon' && cel.botonPegado && cel.categoriasSiCabe, 'celular: 44 px mínimo, botón pegado y solo ícono, «Todas» si cabe')

// ─── 5. Contraste ─────────────────────────────────────────────────────────────────────────────
check(avisosContraste(bar).length === 0, 'lo de hoy (con #6B7280) no avisa')
const malo = resolverApariencia({ bg: '#EFF6FF', placeholder_color: '#93C5FD', text_color: '#BFDBFE', button: 'text', button_bg: '#FDE68A', button_fg: '#FFFFFF' }, 'bar', COLORES)
const avisos = avisosContraste(malo)
check(igual(avisos.map((a) => a.campo).sort(), ['ayuda', 'boton', 'texto']), 'avisa texto, ayuda y botón')
for (const a of avisos) {
  const fondo = a.campo === 'boton' ? malo.botonFondo : malo.fondo
  check(!!a.sugerido && contraste(a.sugerido, fondo) >= a.minimo, `la sugerencia de ${a.campo} sí cumple`)
}
const transparente = resolverApariencia({ bg: 'transparent', text_color: '#FFFFFF' }, 'bar', COLORES)
check(avisosContraste(transparente, '#111827').every((a) => a.campo !== 'texto') && avisosContraste(transparente, '#FFFFFF').some((a) => a.campo === 'texto'), 'fondo transparente: se mide contra el encabezado')
check(sombraUnNivelMas('none') === 'sm' && sombraUnNivelMas('md') === 'lg' && sombraUnNivelMas('lg') === 'lg' && sombraUnNivelMas('inner') === 'inner', 'al enfocar: un nivel más')
check(variablesApariencia(bar)['--bq-sombra-foco'].includes('0 0 0 2px'), 'el anillo de foco siempre va en la sombra al enfocar')
const sinSombraFoco = resolverApariencia({ focus_shadow: 'none' }, 'bar', COLORES)
check(variablesApariencia(sinSombraFoco)['--bq-sombra-foco'].includes('0 0 0 2px'), 'sin sombra al enfocar, el anillo sigue')
const soloAbajo = estiloCajaApariencia(resolverApariencia({ border_style: 'bottom', border_width: 2 }, 'bar', COLORES))
check(soloAbajo.borderWidth === '0 0 2px 0' && soloAbajo.borderRadius === 0, 'borde «solo abajo»: sin esquinas')

// ─── 6. Plantillas ────────────────────────────────────────────────────────────────────────────
check(PLANTILLAS_BUSCADOR.length === 9, 'las 9 plantillas de la galería')
for (const id of PLANTILLAS_BUSCADOR) {
  const a = aplicarPlantilla(id)
  check(igual(normalizarAparienciaBuscador(a), a), `${id}: todas sus subclaves son válidas`)
  check(igual(estadoPlantilla(a), { base: id, personalizada: false }), `${id}: recién aplicada no está personalizada`)
  check(aparienciaActiva(a) === (id !== 'today'), `${id}: ${id === 'today' ? 'no cambia nada' : 'cambia la barra'}`)
  if (id !== 'today') {
    const tocada = cambiarApariencia(a, { border_width: a.border_width === 3 ? 0 : 3 })
    check(igual(estadoPlantilla(tocada), { base: id, personalizada: true }), `${id}: al tocar un ajuste queda «Personalizado (desde …)»`)
    for (const forma of ['bar', 'mega', 'pill_floating', 'mini']) {
      const pc = resolverApariencia(a, forma, COLORES)
      const ce = resolverApariencia(a, forma, COLORES, 'celular')
      check(pc.alto >= 36 && ce.alto >= ALTO_MIN_CELULAR, `${id}/${forma}: altos`)
      check(ce.boton === 'none' || (ce.boton === 'icon' && ce.botonPegado), `${id}/${forma}: celular con botón pegado y solo ícono`)
    }
    // Las plantillas nuevas usan ayudas legibles (decisión 5).
    const r = resolverApariencia(a, 'bar', COLORES)
    check(avisosContraste(r).filter((x) => x.campo !== 'boton').length === 0, `${id}: texto y ayuda cumplen 4,5:1`)
  }
}
check(Object.keys(PLANTILLAS_VALORES.today).length === 0, '«Hoy» no trae subclaves')
check(igual(estadoPlantilla(null), { base: 'today', personalizada: false }), 'sin nada: «Hoy»')
check(igual(estadoPlantilla({ bg: '#FFFFFF' }), { base: null, personalizada: true }), 'ajustes sin plantilla: personalizada')
check(cambiarApariencia({ bg: '#FFFFFF' }, { bg: null }) === null, 'quitar el último ajuste: null (lo de hoy)')
check(cambiarApariencia(aplicarPlantilla('dark'), { radius: 'pill' })?.preset === 'dark', 'cambiar conserva la plantilla de origen')

if (problemas.length) {
  console.error(`✗ verify-buscador-apariencia: ${problemas.length} de ${casos} casos fallan`)
  for (const p of problemas.slice(0, 40)) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-buscador-apariencia: ${casos} casos`)
