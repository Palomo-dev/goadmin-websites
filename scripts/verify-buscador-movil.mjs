/**
 * verify-buscador-movil.mjs — buscador del celular en conjunto o por separado.
 *
 *   npm run verify:buscador-movil
 *
 * - Interruptor «Buscador del celular igual al de escritorio» (apagado por defecto).
 * - Encendido: el celular usa `search_style`; compacta, grande, píldora y barra → bajo el logo.
 * - Apagado: `mobile_search_style` acepta las 7 opciones; `null` sigue a computador (nunca solo
 *   lupa con barra, compacta, grande o píldora); ausente → ícono. 'icon', 'bar' y 'hidden' guardados
 *   se ven igual que antes.
 */
import { readFileSync } from 'node:fs'
import { ajustesBuscadorMovil, buscadorIgualEscritorio, buscadorMovil, buscadorMovilConEstilo, buscadorMovilEfectivo, buscadorMovilElegido, BUSCADORES_MOVIL } from '../lib/website/opcionUnica.ts'
import { OPCIONES_SHELL } from '../lib/website/v2/mapeoAjustes.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => { casos++; if (!cond) problemas.push(msg) }
const K = 'mobile_search_same_as_desktop'

check(buscadorIgualEscritorio(undefined) === false && buscadorIgualEscritorio({}) === false, 'ausente: como hoy')
check(buscadorIgualEscritorio({ [K]: 'true' }) === false && buscadorIgualEscritorio({ [K]: true }) === true, 'solo true la enciende')
// La forma de cada opción en el celular (lupa, barra bajo el logo o nada)
const esp = { icon: 'icon', bar: 'bar', mini: 'bar', icon_overlay: 'icon', mega: 'bar', pill_floating: 'bar', hidden: 'hidden' }
check(BUSCADORES_MOVIL.length === 7 && BUSCADORES_MOVIL.every((v) => v in esp), 'las 7 opciones del selector')
const TODOS = [...BUSCADORES_MOVIL, undefined]

// Apagado: la forma no depende del interruptor (= buscadorMovil)
for (const st of TODOS) {
  for (const m of [undefined, null, ...BUSCADORES_MOVIL]) {
    const a = { search_style: st, mobile_search_style: m }
    check(buscadorMovilEfectivo(a) === buscadorMovil(a), `apagado = buscadorMovil (${st}/${m})`)
    check(buscadorMovilEfectivo({ ...a, [K]: false }) === buscadorMovil(a), `false = ausente (${st}/${m})`)
  }
}

// Encendido (en conjunto): sigue a computador para las 7, sin importar lo guardado en celular
for (const [st, e] of Object.entries(esp)) {
  for (const m of [undefined, null, ...BUSCADORES_MOVIL]) {
    const a = { search_style: st, mobile_search_style: m, [K]: true }
    check(buscadorMovilEfectivo(a) === e, `encendido: ${st} (celular ${m}) → ${e}`)
    check(buscadorMovilElegido(a) === st, `encendido: elegido = ${st} (celular ${m})`)
  }
}
check(buscadorMovilEfectivo({ [K]: true }) === 'icon', 'encendido sin search_style: ícono')

// Apagado (por separado): el celular acepta las 7 opciones, sin importar computador
for (const [m, e] of Object.entries(esp)) {
  for (const st of TODOS) {
    const a = { search_style: st, mobile_search_style: m }
    check(buscadorMovilEfectivo(a) === e, `apagado: celular ${m} (computador ${st}) → ${e}`)
    check(buscadorMovilElegido(a) === m, `apagado: elegido = ${m} (computador ${st})`)
  }
}
// Ejemplo del pedido: lupa en computador y buscador grande bajo el logo en celular
check(buscadorMovilEfectivo({ search_style: 'icon', mobile_search_style: 'mega' }) === 'bar', 'lupa en computador + grande en celular → barra')

// Apagado y celular en null: sigue a computador; barra, compacta, grande y píldora nunca son solo lupa
for (const [st, e] of Object.entries(esp)) {
  check(buscadorMovilEfectivo({ search_style: st, mobile_search_style: null }) === e, `null sigue a computador: ${st} → ${e}`)
}
check(buscadorMovilEfectivo({ mobile_search_style: null }) === 'icon', 'null sin search_style: ícono')
check(buscadorMovilEfectivo({ search_style: 'raro', mobile_search_style: null }) === 'icon', 'null con valor desconocido: ícono')

// Compatibilidad: lo guardado antes se ve igual (icon/bar/hidden propio; ausente → ícono)
for (const st of TODOS) {
  for (const m of ['icon', 'bar', 'hidden']) check(buscadorMovilEfectivo({ search_style: st, mobile_search_style: m }) === m, `compat: celular ${m} (computador ${st})`)
  check(buscadorMovilEfectivo({ search_style: st }) === 'icon', `compat: sin clave de celular → ícono (computador ${st})`)
  check(buscadorMovilEfectivo({ search_style: st, mobile_search_style: 'raro' }) === 'icon', `valor desconocido → ícono (computador ${st})`)
}

// Estilo propio del celular: solo compacta, grande y píldora
for (const m of BUSCADORES_MOVIL) {
  check(buscadorMovilConEstilo({ search_style: 'icon', mobile_search_style: m }) === (m === 'mini' || m === 'mega' || m === 'pill_floating'), `con estilo: ${m}`)
}
check(buscadorMovilConEstilo({ search_style: 'mega', mobile_search_style: 'icon', [K]: true }) === true, 'con estilo en conjunto: el de computador')

// ajustesBuscadorMovil: el tipo del celular sobre el estilo de computador
const hb = { search: { type: 'icon_overlay', radius: 'pill', border: 'thick' }, zones: { left: [] } }
const sep = ajustesBuscadorMovil({ search_style: 'icon_overlay', mobile_search_style: 'mega', header_builder: hb })
check(sep.search_style === 'mega' && sep.header_builder.search.type === 'mega', 'por separado: tipo del celular')
check(sep.header_builder.search.radius === 'pill' && sep.header_builder.search.border === 'thick' && sep.header_builder.zones === hb.zones, 'por separado: el resto del estilo de computador')
check(hb.search.type === 'icon_overlay', 'no muta los ajustes')
const sinHb = ajustesBuscadorMovil({ search_style: 'icon', mobile_search_style: 'pill_floating' })
check(sinHb.search_style === 'pill_floating' && !('header_builder' in sinHb), 'sin header_builder: solo search_style')
const conj = { search_style: 'mega', mobile_search_style: 'icon', [K]: true }
check(ajustesBuscadorMovil(conj) === conj, 'en conjunto: los ajustes tal cual')
const igual = { search_style: 'mini', mobile_search_style: 'mini' }
check(ajustesBuscadorMovil(igual) === igual, 'misma opción: los ajustes tal cual')
check(ajustesBuscadorMovil(undefined) === undefined, 'sin ajustes: nada')

const op = OPCIONES_SHELL[K]
check(op && op.zona === 'header' && op.porDefecto === false && op.regla?.tipo === 'booleano', 'registrada en OPCIONES_SHELL con default false')
check(!OPCIONES_SHELL.mobile_search_bar_categories, 'la clave de prueba anterior no queda')

for (const f of ['HeaderMovilConfigurable', 'MobileDrawer', 'MobileTabs', 'MobileBottomSheet', 'MobileFullscreen']) {
  const src = readFileSync(new URL(`../components/site/header/mobile/${f}.tsx`, import.meta.url), 'utf8')
  check(src.includes('ajustesCromoMovil(settings)') && src.includes('<BuscadorMovilComoEscritorio settings={cromoMovil}') && src.includes('buscadorMovilEfectivo('), `${f} pinta el buscador del celular (en conjunto o por separado)`)
  check(!src.includes('hayCromoEnBarra(settings)'), `${f} no decide el estilo por su cuenta`)
  check(src.includes('<SearchBarInline'), `${f} conserva la barra de siempre`)
}
const cromo = readFileSync(new URL('../components/site/header/BuscadorCromo.tsx', import.meta.url), 'utf8')
check(cromo.includes('export function ajustesCromoMovil(') && cromo.includes('if (buscadorIgualEscritorio(s)) return hayCromoEnBarra(settings) ? settings : null') && cromo.includes('if (!buscadorMovilConEstilo(s)) return null'), 'ajustesCromoMovil: en conjunto el de computador; por separado solo compacta, grande y píldora')
const conf = readFileSync(new URL('../components/site/header/mobile/HeaderMovilConfigurable.tsx', import.meta.url), 'utf8')
check(/buscadorIgualEscritorio\(settings as Record<string, unknown>\)\n\s+\? \(presentacion\.buscador === 'fullscreen' && efectivo === 'icon' \? 'fullscreen' : efectivo\)\n\s+: presentacion\.buscador \?\? efectivo/.test(conf), 'configurable: en conjunto manda computador; por separado, mobile_header.search de antes')
check(cromo.includes("sinIcono: presentacion.button !== 'none' && !lupaEnCampo"), 'escritorio: sin lupa en el campo cuando hay botón de buscar')
check(/<BuscadorCromo presentacion=\{\{ \.\.\.cromo[^\n]*lupaEnCampo \/>/.test(cromo), 'celular (igual a escritorio) conserva la lupa')
const zonas = readFileSync(new URL('../components/site/header/HeaderPorZonas.tsx', import.meta.url), 'utf8')
check(zonas.includes("lupaEnCampo={dispositivo === 'mobile'}"), 'HeaderPorZonas: el celular conserva la lupa')
const campo = readFileSync(new URL('../components/site/SearchBarInput.tsx', import.meta.url), 'utf8')
check(campo.includes('{!cromo?.sinIcono && <SearchIconComp') && campo.includes("cromo.sinIcono ? 'px-4'"), 'SearchBarInput: sin lupa y con px-4 solo con sinIcono')
check(cromo.includes("cromo?.tipo === 'mega'") && cromo.includes('<BuscadorCromoCompacto'), 'Buscador grande usa el compacto con Todas')

if (problemas.length) {
  console.error(`verify-buscador-movil: ${problemas.length} fallo(s) de ${casos}`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`verify-buscador-movil: ${casos} casos`)
