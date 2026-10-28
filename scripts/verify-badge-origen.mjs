import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { clasesBadgeOrigen } from '../components/sections/testimonials/testimonialsUtils.ts'
const pill = 'text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
assert.equal(clasesBadgeOrigen(undefined), pill)
assert.equal(clasesBadgeOrigen('pill'), pill)
assert.ok(!clasesBadgeOrigen('plain').includes('rounded-full') && !clasesBadgeOrigen('plain').includes('bg-'))
for (const f of ['Minimal', 'Carousel', 'Grid', 'Quotes']) {
  assert.ok(readFileSync(new URL(`../components/sections/testimonials/Testimonials${f}.tsx`, import.meta.url), 'utf8').includes('clasesBadgeOrigen(content.source_badge_style)'), f)
}
console.log('verify-badge-origen: 7 casos ok')
