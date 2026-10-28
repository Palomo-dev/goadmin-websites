import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const src = readFileSync(new URL('../components/site/BarraMovilGiro.tsx', import.meta.url), 'utf8')
const m = src.match(/export function clasesCorteBarra[\s\S]*?\n}\n/)[0].replace(/: \{[^)]*?\}(?= \{)/, '').replace(/\(breakpoint\?: number \| null\)/, '(breakpoint)')
const f = new Function(m.replace('export ', '') + '; return clasesCorteBarra')()
const casos = [[undefined,'lg:hidden',null],[null,'lg:hidden',null],[768,'lg:hidden',null],[640,'','640px'],[1024,'','1024px']]
for (const [bp, clase, css] of casos) { const r = f(bp); assert.equal(r.clase, clase); css ? assert.ok(r.css.includes(css)) : assert.equal(r.css, null) }
const hm = readFileSync(new URL('../components/site/header/mobile/HeaderMovilConfigurable.tsx', import.meta.url), 'utf8')
assert.ok(hm.includes('mostrarCuentaMovil={iconos?.showAccount === true}') && !hm.includes('hideAuth='))
console.log(`verify-corte-barra: ${casos.length + 1} casos ok`)
