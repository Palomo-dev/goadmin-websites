/**
 * verify-contador.mjs — contador clásico (lib/website/contadorColumnas.ts), sin red ni BD.
 *
 *   npm run verify:contador   (corre con TZ=UTC y TZ=Asia/Tokyo: el resultado no depende del visitante)
 *
 * Carga el módulo PURO real con `module.stripTypeScriptTypes` de Node 22 (método de verify-sedes).
 * Cubre la medianoche: antes `hour12:false` daba «24» en Chrome y el contador se ocultaba de 00:00 a 00:59.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { stripTypeScriptTypes } from 'node:module'
import assert from 'node:assert/strict'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MODULOS = { horario: 'lib/restaurant/horario.ts', contadorColumnas: 'lib/website/contadorColumnas.ts' }
const aMjs = (ts) =>
  stripTypeScriptTypes(ts, { mode: 'strip' })
    .replace(/from\s+'@\/lib\/[a-z]+\/([A-Za-z]+)'/g, (_, n) => {
      if (!MODULOS[n]) throw new Error(`import no puro: ${n}`)
      return `from './${n}.mjs'`
    })
    .replace(/^import\s+type[^\n]*\n/gm, '')

const dir = await mkdtemp(join(tmpdir(), 'verify-contador-'))
let m
try {
  for (const [n, r] of Object.entries(MODULOS)) await writeFile(join(dir, `${n}.mjs`), aMjs(await readFile(join(ROOT, r), 'utf8')))
  m = await import(pathToFileURL(join(dir, 'contadorColumnas.mjs')).href)
} finally {
  await rm(dir, { recursive: true, force: true })
}
const { proximoReinicio, instanteFin, zonaContador, partesEnZona, contadorEn, objetivoVigente } = m
const iso = (d) => d?.toISOString() ?? null
let n = 0
const ok = (c, msg) => { assert.ok(c, msg); n++ }
const eq = (a, b, msg) => { assert.equal(a, b, msg); n++ }

// Medianoche en Bogotá: la hora es 00 (h23), nunca 24.
eq(partesEnZona(new Date('2026-10-29T05:30:00Z'), 'America/Bogota').h, 0, 'medianoche = 00')
// Reinicio a las 0: a las 00:30 el próximo es la medianoche siguiente (no se oculta).
eq(iso(proximoReinicio(new Date('2026-10-29T05:30:00Z'), 'America/Bogota', 0)), '2026-10-30T05:00:00.000Z', '00:30 → mañana 00:00')
eq(iso(proximoReinicio(new Date('2026-10-29T05:00:00Z'), 'America/Bogota', 0)), '2026-10-30T05:00:00.000Z', 'justo 00:00 → mañana')
eq(iso(proximoReinicio(new Date('2026-10-29T04:59:59Z'), 'America/Bogota', 0)), '2026-10-29T05:00:00.000Z', '23:59:59 → en 1 s')
// Cada minuto de un día entero: siempre un objetivo válido, futuro y a ≤ 24 h.
for (let t = Date.parse('2026-10-28T00:00:00Z'); t < Date.parse('2026-10-29T00:00:00Z'); t += 60_000) {
  for (const [zona, h] of [['America/Bogota', 0], ['America/Bogota', 18], ['Europe/Madrid', 0], ['Asia/Kathmandu', 23]]) {
    const d = proximoReinicio(new Date(t), zona, h)
    ok(d && !Number.isNaN(d.getTime()) && d.getTime() > t && d.getTime() - t <= 25 * 3_600_000, `${zona} ${h} @ ${new Date(t).toISOString()}`)
  }
}
// Zona inválida o vacía → Bogotá, no la del visitante.
eq(zonaContador('Marte/Olympus'), 'America/Bogota')
eq(zonaContador(''), 'America/Bogota')
eq(zonaContador(undefined), 'America/Bogota')
eq(iso(instanteFin('2026-12-24T18:00', 'Marte/Olympus')), '2026-12-24T23:00:00.000Z', 'fin con zona inválida = Bogotá')
eq(iso(proximoReinicio(new Date('2026-10-29T05:30:00Z'), 'Marte/Olympus', 0)), '2026-10-30T05:00:00.000Z')
// Fin sin desfase en la zona; con Z, tal cual; basura → null.
eq(iso(instanteFin('2026-12-24T18:00', 'America/Bogota')), '2026-12-24T23:00:00.000Z')
eq(iso(instanteFin('2026-07-01T10:00', 'Europe/Madrid')), '2026-07-01T08:00:00.000Z')
eq(iso(instanteFin('2026-12-24T18:00:00Z', 'America/Bogota')), '2026-12-24T18:00:00.000Z')
eq(instanteFin('no', 'America/Bogota'), null)
// Ubicación: NULL = apagada.
eq(contadorEn({ countdown_enabled: true, countdown_show_in_cart: null }, 'countdown_show_in_cart'), false)
eq(contadorEn({ countdown_enabled: true, countdown_show_in_cart: true }, 'countdown_show_in_cart'), true)
// Cruce del reinicio sin recargar: se simula el intervalo de 1 s de CountdownBanner.
{
  const diario = { countdown_mode: 'daily_reset', countdown_timezone: 'America/Bogota', countdown_reset_hour: 0 }
  let t = Date.parse('2026-10-29T04:59:57Z') // 23:59:57 en Bogotá
  let obj = proximoReinicio(new Date(t), 'America/Bogota', 0)
  const restantes = []
  for (let i = 0; i < 6; i++, t += 1000) {
    obj = objetivoVigente(obj, new Date(t), diario)
    restantes.push(Math.round((obj.getTime() - t) / 1000))
  }
  // 3, 2, 1 s y luego 24 h, 24 h − 1 s, …: nunca 0 ni oculto.
  eq(JSON.stringify(restantes), JSON.stringify([3, 2, 1, 86400, 86399, 86398]), 'reinicio cruza sin recargar')
  eq(iso(obj), '2026-10-30T05:00:00.000Z')
  // Hasta una fecha: al pasar, el objetivo no cambia (el contador se oculta).
  const fin = instanteFin('2026-10-29T10:00', 'America/Bogota')
  const custom = { countdown_mode: 'custom', countdown_timezone: 'America/Bogota' }
  eq(objetivoVigente(fin, new Date('2026-10-29T16:00:00Z'), custom), fin, 'fecha pasada se mantiene')
  ok(objetivoVigente(fin, new Date('2026-10-29T16:00:00Z'), custom).getTime() < Date.parse('2026-10-29T16:00:00Z'), 'queda expirado')
}
console.log(`verify-contador: ${n} comprobaciones OK (TZ=${process.env.TZ ?? 'local'})`)
