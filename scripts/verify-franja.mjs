/**
 * verify-franja.mjs — franja en movimiento (`marquee`), variante texto.
 *
 *   npm run verify:franja
 *
 * - `size` 'sm' | 'md' | 'lg' (ausente = 'lg', la franja de siempre) y `separator_color`.
 * - Las dos claves están en CONTENT_KEYS (manifiesto que el ERP verifica contra su editor).
 * - Con «reducir movimiento», la franja de texto no muestra barra de scroll.
 */
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'

const problemas = []
let casos = 0
const check = (cond, msg) => { casos++; if (!cond) problemas.push(msg) }
const leer = (r) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8')

const src = leer('components/sections/restaurant/Marquee.tsx')
const css = leer('components/sections/restaurant/motion.module.css')

// CONTENT_KEYS
const claves = src.match(/export const CONTENT_KEYS = \[([^\]]*)\]/)?.[1].split(',').map((x) => x.trim().replace(/'/g, '')) ?? []
for (const k of ['phrases', 'separator', 'separator_color', 'images', 'speed', 'size', 'label']) check(claves.includes(k), `CONTENT_KEYS incluye ${k}`)

// colorSeparador (función pura, se evalúa aislada)
const ini = src.indexOf('export function colorSeparador(')
const fin = src.indexOf('\n}\n', ini) + 2
const fn = new Function(`${stripTypeScriptTypes(src.slice(ini, fin)).replace('export function', 'function')}; return colorSeparador`)()
check(fn('secondary') === 'var(--secondary-color)', 'secondary → var(--secondary-color)')
check(fn('primary') === 'var(--primary-color)', 'primary → var(--primary-color)')
check(fn('#C9A227') === '#C9A227' && fn(' #abc ') === '#abc', 'hex')
for (const malo of [undefined, '', 'rojo', '#12345', 'red;x', 5]) check(fn(malo) === undefined, `separator_color inválido ${JSON.stringify(malo)}: el color del texto (hoy)`)

// Tamaños
check(src.includes("const size = TEXT_SIZE[oneOf(content.size, SIZES, 'lg')]"), "size: 'lg' por defecto")
const lg = src.match(/lg: \{\s*section: '([^']*)',\s*track: '([^']*)',/)
check(lg && lg[1] === 'py-4 md:py-6', 'lg: el mismo relleno de siempre')
check(lg && ['text-2xl', 'md:text-4xl', 'leading-8', 'md:leading-10', '[font-family:var(--font-heading)]', 'font-bold', 'uppercase', 'gap-6', 'pr-6', 'md:gap-10', 'md:pr-10'].every((c) => lg[2].split(' ').includes(c)), 'lg: las mismas clases de texto de siempre')
const sm = src.match(/sm: \{\s*section: '([^']*)',\s*track: '([^']*)',\s*gap: '([^']*)'/)
check(sm && sm[1] === 'py-2', 'sm: py-2')
check(sm && ['text-[13px]', 'md:text-sm', 'font-semibold', 'tracking-[0.12em]', '[font-family:var(--font-body)]', 'gap-6'].every((c) => sm[2].split(' ').includes(c)) && sm[3] === 'gap-6', 'sm: 13px/14px, seminegrita, tracking 0.12em, fuente del cuerpo, gap-6')
check(src.includes("<span style={sepColor ? { color: sepColor } : undefined}>{separator}</span>"), 'el separador toma separator_color')

// Movimiento reducido: la franja de texto sin barra de scroll; la de fotos sigue con scroll manual
check(src.includes('className={cn(m.marqueeViewport, m.marqueeText, size.section,'), 'la franja de texto lleva marqueeText')
const reducido = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
check(/\.marqueeViewport \{\s*overflow-x: auto;/.test(reducido), 'fotos: scroll horizontal manual (como antes)')
check(/\.marqueeViewport\.marqueeText \{\s*overflow: hidden;\s*scrollbar-width: none;/.test(reducido), 'texto: overflow hidden y sin barra')

if (problemas.length) {
  console.error(`verify-franja: ${problemas.length} fallo(s) de ${casos}`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`verify-franja: ${casos} casos`)
