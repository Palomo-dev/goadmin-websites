import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { conInterruptorPaginacion } from '../lib/website/v2/interruptorPaginacion.ts'
import { resolverPaginacion } from '../lib/website/v2/paginacionCarrusel.ts'
const panel = resolverPaginacion({ legado: 'grilla', porPagina: 12 }, null, { usar_global: false, porPaginaEscritorio: 8 }, false)
assert.equal(panel.activo, true)
assert.equal(conInterruptorPaginacion(false, panel).activo, false)
assert.equal(conInterruptorPaginacion(true, panel).activo, true)
assert.equal(conInterruptorPaginacion(undefined, panel), panel)
const sin = resolverPaginacion({ legado: 'grilla', porPagina: 12 }, null, null, false)
assert.equal(conInterruptorPaginacion(false, sin), sin)
for (const f of ['products/ProductsGrid.tsx', 'retail/OffersGrid.tsx']) {
  assert.ok(readFileSync(new URL(`../components/sections/${f}`, import.meta.url), 'utf8').includes('conInterruptorPaginacion(content.show_pagination, resolverPaginacion('))
}
console.log('verify-interruptor-paginacion: 7 casos ok')
