// Verifica el arreglo del scroll horizontal del encabezado de escritorio (768/1024) y del pie en grilla.
import { readFileSync } from 'node:fs'
import { debeDeslizar } from '../components/site/header/menuDeslizable.ts'
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const pie = readFileSync(new URL('../components/site/footer/PieTema.tsx', import.meta.url), 'utf8')
const nav = readFileSync(new URL('../components/site/header/NavDropdown.tsx', import.meta.url), 'utf8')
const ok = (c, m) => { if (!c) { console.error('FALLA:', m); process.exit(1) } console.log('ok:', m) }
const i = css.indexOf('@media (min-width: 768px) {\n  header .hidden.md\\:flex > nav')
ok(i > 0, 'regla desde 768 (cubre 1024+)')
const b = css.slice(i)
ok(/header nav\[data-nav-desliza\] \{\s*overflow-x: auto;/.test(b), 'solo el menú marcado se desliza')
ok(b.includes('header nav[data-nav-desliza] .relative {\n    position: static;') && b.includes('header :has(> nav[data-nav-desliza])'), 'submenús anclados fuera de la caja que se desliza')
ok(b.includes('justify-content: safe center') && b.includes('justify-content: safe flex-end'), 'centrado/derecha se conservan')
ok(!debeDeslizar(1280, 600, 600) && !debeDeslizar(1024, 601, 600) && debeDeslizar(1024, 700, 600) && !debeDeslizar(700, 900, 600), 'debeDeslizar: solo ≥768 y si no cabe')
ok(nav.includes('style={posPanel}') && nav.includes('ref={ancla}'), 'NavDropdown se coloca bajo su enlace al deslizar')
ok(/key=\{c\.clave\} style=\{\{ overflowWrap: 'anywhere' \}\}/.test(pie), 'columnas del pie parten palabras largas solo si no caben')
