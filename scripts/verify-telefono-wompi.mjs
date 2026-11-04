/**
 * verify-telefono-wompi.mjs — prefijo y número que el checkout manda a Wompi (lib/payments/telefonoWompi.ts).
 *
 *   npm run verify:telefono-wompi
 *
 * Sin red ni base: carga el módulo PURO real con `module.stripTypeScriptTypes` de Node 22.
 * Caso real (org 338): «+573105407613» salía como prefijo «+5731» y número «05407613».
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { stripTypeScriptTypes } from 'node:module'
import assert from 'node:assert/strict'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = await mkdtemp(join(tmpdir(), 'verify-telefono-'))
let m
try {
  const ts = await readFile(join(ROOT, 'lib/payments/telefonoWompi.ts'), 'utf8')
  await writeFile(join(dir, 'telefonoWompi.mjs'), stripTypeScriptTypes(ts, { mode: 'strip' }))
  m = await import(pathToFileURL(join(dir, 'telefonoWompi.mjs')).href)
} finally {
  await rm(dir, { recursive: true, force: true })
}

const casos = [
  ['+573105407613', '+57', '3105407613', 'indicativo pegado (el caso de la org 338)'],
  ['+57 3042632496', '+57', '3042632496', 'indicativo con espacio'],
  ['+57-300-123-4567', '+57', '3001234567', 'indicativo con guiones'],
  ['3001234567', '+57', '3001234567', 'sin indicativo: Colombia'],
  ['300 123 4567', '+57', '3001234567', 'sin indicativo, con espacios'],
  ['573001234567', '+57', '3001234567', 'indicativo sin +'],
  ['+13055551234', '+1', '3055551234', 'Estados Unidos pegado'],
  ['+1 305 555 1234', '+1', '3055551234', 'Estados Unidos con espacios'],
  ['6012345', '', '6012345', 'fijo corto: sin prefijo'],
  ['', '', '', 'vacío'],
  [null, '', '', 'null'],
]
let n = 0
for (const [entrada, prefijo, numero, nombre] of casos) {
  assert.deepEqual(m.separarTelefonoWompi(entrada), { prefijo, numero }, nombre)
  n++
}
console.log(`verify-telefono-wompi: ${n} casos OK`)
