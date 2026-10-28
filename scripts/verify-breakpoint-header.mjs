import { cssBreakpointHeader } from '../lib/website/breakpointHeader.ts'
let n = 0
const check = (c, m) => { if (!c) { console.error('✗ ' + m); process.exit(1) } n++ }
check(cssBreakpointHeader(768, 'movil') === null && cssBreakpointHeader(768, 'escritorio') === null, '768: sin CSS ni envoltorio (igual a hoy)')
const m1024 = cssBreakpointHeader(1024, 'movil')
check(m1024.includes('[data-hdr-bp="movil"] .flex.md\\:hidden:not(.hidden){display:flex}'), '1024 celular: md:hidden se ve entre 768 y 1023')
check(m1024.includes('.hidden.md\\:flex') && m1024.includes('{display:none}'), '1024 celular: las filas de computador no se ven')
const e640 = cssBreakpointHeader(640, 'escritorio')
check(e640.includes('[data-hdr-bp="escritorio"] .hidden.md\\:flex{display:flex}'), '640 computador: las filas se ven entre 640 y 767')
check(e640.includes('[data-hdr-bp="escritorio"] .md\\:hidden{display:none}'), '640 computador: lo de celular no se ve')
check(e640.includes('@media (max-width:767.98px)') && e640.includes('header nav{overflow-x:auto') && !cssBreakpointHeader(1024, 'escritorio').includes('overflow-x'), '640 computador bajo 768: el menú cede ancho y no desborda; 1024 no cambia')
check(cssBreakpointHeader(640, 'movil') !== null && cssBreakpointHeader(1024, 'escritorio') !== null, 'los dos modos tienen CSS con 640 y 1024')
console.log(`✓ verify-breakpoint-header: ${n} casos`)
