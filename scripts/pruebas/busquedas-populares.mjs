/**
 * busquedas-populares.mjs — «Populares» del buscador sin `search_popular` (Playwright).
 *
 *   PRUEBAS_INTERNAS=1 npx next start -p 3460   (con un build hecho)
 *   BASE=http://localhost:3460 node scripts/pruebas/busquedas-populares.mjs
 *
 * Tienda sin `search_popular` y con show_categories_in_header y footer_show_categories en false
 * (`sinAjustesCategorias=1` del arnés app/pruebas-internas/encabezado): al abrir el buscador, el
 * bloque [data-busquedas-populares] muestra sus 4 primeras categorías, en su orden, y nada más
 * (nunca etiquetas genéricas). Se prueba con la barra (computador), la lupa (computador) y la
 * barra del celular, en las tiendas del fixture que tienen categorías.
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const requerir = createRequire(import.meta.url)
const { chromium } = requerir('playwright')

const BASE = process.env.BASE ?? 'http://localhost:3460'
const fixture = JSON.parse(readFileSync(new URL('./fixtures/encabezados.json', import.meta.url), 'utf8'))
const tiendas = fixture.tiendas.filter((t) => (t.menuCategories ?? []).some((c) => c.parent_id == null)).map((t) => t.id)
const GENERICAS = ['Ofertas', 'Nuevo', 'Tenis', 'Accesorios']
const problemas = []
let casos = 0
const check = (cond, msg) => { casos++; if (!cond) problemas.push(msg) }

const navegador = await chromium.launch()
for (const org of tiendas) {
  for (const c of [
    { nombre: 'barra · 1280', ancho: 1280, search: 'bar' },
    { nombre: 'lupa · 1280', ancho: 1280, search: 'icon' },
    { nombre: 'barra · 390', ancho: 390, search: 'bar' },
  ]) {
    const ctx = await navegador.newContext({ viewport: { width: c.ancho, height: 900 }, locale: 'es-CO' })
    await ctx.route(/^(?!http:\/\/localhost)/, (r) => r.abort())
    const page = await ctx.newPage()
    await page.goto(`${BASE}/pruebas-internas/encabezado?org=${org}&search=${c.search}&msearch=${c.search}&sinAjustesCategorias=1`, { waitUntil: 'load' })
    await page.waitForSelector('html[data-pruebas-listo]', { state: 'attached' })
    const datos = await page.evaluate(() => JSON.parse(document.getElementById('datos-prueba-encabezado').textContent))
    const etiqueta = `org ${org} · ${c.nombre}`
    check(datos.search_popular === null && datos.show_categories_in_header === false && datos.footer_show_categories === false, `${etiqueta}: el caso no tiene search_popular ni ajustes de categorías`)
    // La lupa abre el panel; algunos encabezados (mega) pintan la barra aunque pidan lupa.
    const lupa = page.locator('header button[aria-label="Buscar productos"]:visible').first()
    if (c.search === 'icon' && (await lupa.count()) > 0) await lupa.click()
    else await page.locator('header input:visible').first().click()
    const bloque = page.locator('[data-busquedas-populares]:visible').first()
    await bloque.waitFor({ timeout: 5000 }).catch(() => {})
    const chips = (await bloque.locator('button').allInnerTexts().catch(() => [])).map((t) => t.trim())
    const esperado = datos.primerasCategorias
    check(esperado.length === 4, `${etiqueta}: la tienda tiene al menos 4 categorías (${esperado.length})`)
    check(JSON.stringify(chips) === JSON.stringify(esperado), `${etiqueta}: «Populares» = sus 4 primeras categorías (${JSON.stringify(chips)} ≠ ${JSON.stringify(esperado)})`)
    check(!chips.some((t) => GENERICAS.includes(t) && !esperado.includes(t)), `${etiqueta}: sin etiquetas genéricas (${JSON.stringify(chips)})`)
    console.log(`${etiqueta}: ${JSON.stringify(chips)}`)
    await ctx.close()
  }
}
await navegador.close()
if (problemas.length) {
  console.error(`busquedas-populares: ${problemas.length} fallo(s) de ${casos}`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`busquedas-populares: ${casos} casos (${tiendas.length} tiendas)`)
