// Verifica el arreglo del scroll horizontal a 768 px (encabezado de escritorio y pie en grilla).
import { readFileSync } from 'node:fs'
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const pie = readFileSync(new URL('../components/site/footer/PieTema.tsx', import.meta.url), 'utf8')
const ok = (c, m) => { if (!c) { console.error('FALLA:', m); process.exit(1) } console.log('ok:', m) }
const bloque = css.slice(css.indexOf('@media (min-width: 768px) and (max-width: 1023.98px)'))
ok(bloque.length > 0 && !css.includes('@media (min-width: 768px) and (max-width: 1023.98px)') === false, 'regla acotada a 768-1023')
ok(/header \.hidden\.md\\:flex > nav,\s*header nav\.hidden\.md\\:flex \{\s*min-width: 0;\s*overflow-x: auto;/.test(bloque), 'el menú cede ancho y se desliza')
ok(bloque.includes('justify-content: safe center') && bloque.includes('justify-content: safe flex-end'), 'centrado/derecha se conservan cuando cabe')
ok(!/min-width: 1024px/.test(bloque.split('}\n}')[0]), '≥1024 sin cambios')
ok(/key=\{c\.clave\} style=\{\{ overflowWrap: 'anywhere' \}\}/.test(pie), 'columnas del pie parten palabras largas solo si no caben')
