/**
 * franja-movimiento.mjs — la franja de texto con «reducir movimiento» (Playwright).
 *
 *   PRUEBAS_INTERNAS=1 npx next start -p 3459   (con un build hecho)
 *   BASE=http://localhost:3459 node scripts/pruebas/franja-movimiento.mjs
 *
 * Sobre el arnés app/pruebas-internas/franja, a 390 y 1280 px:
 * - reducedMotion 'reduce', franja de texto: la pista se mueve (transform distinto entre dos
 *   capturas), la duración es el doble y no hay scroll horizontal (ni en la página ni en la franja).
 * - Lo mismo con respect_reduced_motion: true: la pista queda quieta (como antes).
 * - Sin reducir movimiento: corre con la duración de siempre.
 * - Franja de fotos con reducir movimiento: quieta, con scroll manual (como antes).
 */
import { createRequire } from 'node:module'
const requerir = createRequire(import.meta.url)
const { chromium } = requerir('playwright')

const BASE = process.env.BASE ?? 'http://localhost:3459'
const problemas = []
let casos = 0
const check = (cond, msg) => { casos++; if (!cond) problemas.push(msg) }

const navegador = await chromium.launch()
for (const ancho of [390, 1280]) {
  for (const c of [
    { nombre: 'texto, reducir movimiento', q: 'variante=text', reduce: true, seMueve: true, duracion: '60s' },
    { nombre: 'texto, reducir movimiento, respect_reduced_motion', q: 'variante=text&respetar=1', reduce: true, seMueve: false },
    { nombre: 'texto, sin reducir movimiento', q: 'variante=text', reduce: false, seMueve: true, duracion: '30s' },
    { nombre: 'texto sm, reducir movimiento', q: 'variante=text&tamano=sm', reduce: true, seMueve: true, duracion: '60s' },
    { nombre: 'fotos, reducir movimiento', q: 'variante=photos', reduce: true, seMueve: false },
  ]) {
    const ctx = await navegador.newContext({ viewport: { width: ancho, height: 800 }, reducedMotion: c.reduce ? 'reduce' : 'no-preference' })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/pruebas-internas/franja?${c.q}`, { waitUntil: 'load' })
    // El mouse fuera de la franja: en hover se pausa a propósito (WCAG 2.2.2).
    await page.mouse.move(5, 790)
    const medir = () => page.evaluate(() => {
      const pista = document.querySelector('[data-franja] section > div[aria-hidden], [data-franja] section > div')
      const seccion = document.querySelector('[data-franja] section')
      const cs = getComputedStyle(pista)
      return {
        transform: cs.transform,
        duracion: cs.animationDuration,
        nombre: cs.animationName,
        overflowX: getComputedStyle(seccion).overflowX,
        barra: seccion.offsetHeight - seccion.clientHeight,
        scrollPagina: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }
    })
    const a = await medir()
    await page.waitForTimeout(700)
    const b = await medir()
    const etiqueta = `${ancho}px · ${c.nombre}`
    if (c.seMueve) {
      check(a.transform !== b.transform, `${etiqueta}: la pista se mueve (${a.transform} → ${b.transform})`)
      check(a.duracion === c.duracion, `${etiqueta}: duración ${c.duracion} (${a.duracion})`)
    } else {
      check(a.transform === b.transform, `${etiqueta}: la pista queda quieta (${a.transform} → ${b.transform})`)
    }
    check(a.scrollPagina <= 0 && b.scrollPagina <= 0, `${etiqueta}: sin scroll horizontal en la página (${b.scrollPagina}px)`)
    if (c.q.includes('text')) {
      check(a.overflowX === 'hidden' && a.barra === 0, `${etiqueta}: franja recortada y sin barra de scroll (overflow-x ${a.overflowX}, barra ${a.barra}px)`)
    } else {
      check(a.overflowX === 'auto', `${etiqueta}: fotos con scroll manual, como antes (overflow-x ${a.overflowX})`)
    }
    console.log(`${etiqueta}: ${a.transform} → ${b.transform} · ${a.duracion} · overflow-x ${a.overflowX} · barra ${a.barra}px · scroll página ${b.scrollPagina}px`)
    await ctx.close()
  }
}
await navegador.close()
if (problemas.length) {
  console.error(`franja-movimiento: ${problemas.length} fallo(s) de ${casos}`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`franja-movimiento: ${casos} casos`)
