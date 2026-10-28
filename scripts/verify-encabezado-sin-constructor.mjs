// (e) Constructor → Encabezado: lo que solo hacía el Constructor se lee de opciones de Encabezado,
// con lectura retrocompatible de header_builder; sin valores, nada cambia.
import { readFileSync } from 'node:fs'
import { cajaIconosEncabezado, menusAdicionales, botonesExtraEncabezado, leerConstructor } from '../lib/website/constructorEncabezado.ts'
let fallos = 0
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FALLA: ') + m); if (!c) fallos++ }
const org134 = { header_builder: { icon_container: { icon: 22, scope: 'all', shape: 'none', stroke: 2, weight: 'contorno' } } }
const c = cajaIconosEncabezado(org134)
ok(c && c.shape === 'none' && c.icon === 22 && c.stroke === 2, 'org 134: se sigue leyendo icon_container (22 px, sin caja)')
ok(JSON.stringify(c) === JSON.stringify(leerConstructor(org134).contenedor), 'org 134: misma caja que leía el Constructor')
ok(cajaIconosEncabezado({ ...org134, header_icons_box: { shape: 'rounded', icon: 28, scope: 'all', gradient_1: '#ff0000', gradient_2: '#0000ff', shadow: 'md', hover_scale: 110, hover_background: '#00ff00' } })?.shape === 'rounded', 'Encabezado gana sobre el Constructor')
const r = cajaIconosEncabezado({ header_icons_box: { shape: 'square', icon: 20, scope: 'all', gradient_1: '#ff0000', gradient_2: '#0000ff', shadow: 'lg', hover_scale: 110, hover_background: '#00ff00' } })
ok(r.icon === 20 && r.gradient1 === '#ff0000' && r.shadow === 'lg' && r.hoverScale === 110 && r.hoverBackground === '#00ff00', 'tamaño, degradado, sombra y hover')
ok(cajaIconosEncabezado({}) === null && cajaIconosEncabezado({ header_icons_box: null }) === null, 'sin valor: sin caja (lo de hoy)')
ok(menusAdicionales({}).length === 0 && botonesExtraEncabezado({}).length === 0, 'sin valor: sin menús ni botones extra')
const m = menusAdicionales({ header_menu2_label: 'Marcas', header_menu2_links: [{ label: 'A', href: '/a' }, { label: '', href: '/x' }], header_menu3_label: 'Vacío', header_menu3_links: [] })
ok(m.length === 1 && m[0].label === 'Marcas' && m[0].links.length === 1, 'menús adicionales de Encabezado')
const mv = menusAdicionales({ header_builder: { menus: [{ name: 'Viejo', zone: 'menu_right', items: [{ label: 'B', href: '/b', kind: 'link' }] }] } })
ok(mv.length === 1 && mv[0].label === 'Viejo', 'menús del Constructor: lectura retrocompatible')
const b = botonesExtraEncabezado({ header_cta3_text: 'Tres', header_cta3_url: '/tres', header_cta4_text: 'Sin url' })
ok(b.length === 1 && b[0].texto === 'Tres', 'botones 3 a 6')
const bv = botonesExtraEncabezado({ header_builder: { buttons: [{ text: 'Uno', action: 'link', href: '/1' }, { text: 'Dos', action: 'link', href: '/2' }, { text: 'WA', action: 'whatsapp' }] } })
ok(bv.length === 1 && bv[0].url === 'whatsapp', 'botones del Constructor desde el tercero: lectura retrocompatible')
const sh = readFileSync(new URL('../components/site/SiteHeader.tsx', import.meta.url), 'utf8')
ok(!sh.includes('<HeaderPorZonas') && sh.includes('conMenusAdicionales('), 'ninguna opción cambia de encabezado (sin HeaderPorZonas)')
const hs = readFileSync(new URL('../components/site/header/HeaderShared.tsx', import.meta.url), 'utf8')
ok(hs.includes('const contenedor = cajaIconosEncabezado(settings)') && hs.includes('botonesExtraEncabezado(settings)'), 'HeaderShared lee caja y botones de Encabezado')
const mt = readFileSync(new URL('../components/site/header/mobile/MobileTabs.tsx', import.meta.url), 'utf8')
ok(mt.includes('leerConstructor(settings)?.contenedor'), 'MobileTabs sin tocar')
const mapa = readFileSync(new URL('../lib/website/v2/mapeoAjustes.ts', import.meta.url), 'utf8')
ok(['header_icons_box', 'header_cta3_text', 'header_cta6_url', 'header_menu2_label', 'header_menu4_links'].every((k) => new RegExp(`  ${k}: \\{ zona: 'header', porDefecto: null`).test(mapa)), 'claves nuevas sin valor por defecto')
if (fallos) { console.error(fallos + ' fallos'); process.exit(1) }
