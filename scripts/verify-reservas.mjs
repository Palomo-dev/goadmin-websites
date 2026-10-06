/**
 * verify-reservas — contrato del sitio con las RPC de reserva de mesa (paquete D).
 *
 * Sin dependencias ni base de datos:
 * 1. `lib/restaurant/reservas-errores.ts`: cada prefijo de la migración D1
 *    (`supabase/pendientes/20261007100100_reservas_reglas_servidor.sql` del ERP)
 *    tiene su HTTP y su texto legible; un mensaje sin prefijo (RPC anterior) da
 *    `null`, así que la ruta cae en su mapeo de siempre.
 * 2. Las rutas llaman a las RPC por NOMBRE de parámetro: con la sobrecarga de
 *    D1/D6 una llamada posicional sería ambigua.
 * 3. Si el ERP está al lado (o ERP_REPO), cada prefijo que lanza la migración D1
 *    está en el sitio.
 *
 * Uso: node --disable-warning=ExperimentalWarning scripts/verify-reservas.mjs
 */
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { stripTypeScriptTypes } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let fallos = 0
let total = 0
function check(cond, msg) {
  total++
  if (!cond) {
    fallos++
    console.error('✗', msg)
  }
}

const dir = await mkdtemp(join(tmpdir(), 'verify-reservas-'))
let e
try {
  const ts = await readFile(join(ROOT, 'lib/restaurant/reservas-errores.ts'), 'utf8')
  await writeFile(join(dir, 'errores.mjs'), stripTypeScriptTypes(ts, { mode: 'strip' }))
  e = await import(pathToFileURL(join(dir, 'errores.mjs')).href)
} finally {
  await rm(dir, { recursive: true, force: true })
}

// ─── 1. Prefijos ─────────────────────────────────────────────────────────────
const casos = [
  ['FUERA_DE_HORARIO: La hora elegida esta fuera del horario de reservas', 400],
  ['ANTICIPACION: Reserva con al menos 60 minutos de anticipacion', 400],
  ['ANTICIPACION: Solo se reserva con hasta 60 dias de anticipacion', 400],
  ['AFORO: No hay mesas disponibles para la fecha y hora seleccionadas (cupo de la franja completo)', 409],
  ['ZONA: La zona elegida no admite reservas', 400],
  ['CONTACTO: El celular es obligatorio', 400],
  ['PERSONAS: El numero maximo de personas es 12', 400],
  ['DESHABILITADA: Las reservas online estan deshabilitadas para este restaurante', 403],
  ['PASADA: La hora de la reserva ya paso. Escribe al restaurante para cualquier cambio', 422],
]
for (const [mensaje, status] of casos) {
  const regla = e.reglaDeError(mensaje)
  check(regla !== null, `sin regla para «${mensaje}»`)
  if (regla) {
    const r = e.respuestaDeRegla(regla)
    check(r.status === status, `${regla.codigo}: status ${r.status}, esperado ${status}`)
    check(typeof r.mensaje === 'string' && r.mensaje.length > 10, `${regla.codigo}: sin mensaje legible`)
  }
}
check(e.respuestaDeRegla(e.reglaDeError('PERSONAS: El numero maximo de personas es 12')).mensaje === 'El número máximo de personas es 12.', 'detalle con tildes de PERSONAS')
check(e.reglaDeError('No hay mesas disponibles para la fecha y hora seleccionadas') === null, 'mensaje viejo sin prefijo → null (mapeo de siempre)')
check(e.reglaDeError('OTRO: algo') === null, 'prefijo desconocido → null')
check(e.rutaGestionReserva('0b7e0d4e-9b6c-4f5b-9a77-1f1f1f1f1f1f') === '/reserva/mesa/0b7e0d4e-9b6c-4f5b-9a77-1f1f1f1f1f1f', 'ruta de gestión')
check(e.tokenValido('0b7e0d4e-9b6c-4f5b-9a77-1f1f1f1f1f1f') && !e.tokenValido('ABC12345'), 'token: solo uuid')
check(existsSync(join(ROOT, 'app/reserva/mesa/[token]/page.tsx')), 'existe la página de gestión /reserva/mesa/[token]')

// ─── 2. Llamadas por nombre ──────────────────────────────────────────────────
for (const ruta of ['lib/restaurant/reservas-servidor.ts', 'app/api/contact/route.ts', 'app/api/restaurant-reservations/token/[token]/cancel/route.ts']) {
  const fuente = await readFile(join(ROOT, ruta), 'utf8')
  for (const m of fuente.matchAll(/\.rpc\(\s*'([a-z_]+)'\s*,\s*([^)]{0,40})/g)) {
    const args = m[2].trim()
    check(args.startsWith('{') || /^[a-zA-Z]+[,)]?$/.test(args), `${ruta}: ${m[1]} debe llamarse con un objeto de parámetros con nombre`)
  }
}

// ─── 3. Prefijos de la migración D1 ──────────────────────────────────────────
const erp = process.env.ERP_REPO || join(ROOT, '..', 'go-admin-erp')
const d1 = join(erp, 'supabase/pendientes/20261007100100_reservas_reglas_servidor.sql')
const d1Aplicada = join(erp, 'supabase/migrations/20261007100100_reservas_reglas_servidor.sql')
const ruta = existsSync(d1) ? d1 : existsSync(d1Aplicada) ? d1Aplicada : null
if (ruta) {
  const sql = await readFile(ruta, 'utf8')
  const prefijos = new Set([...sql.matchAll(/'([A-Z_]{4,}): /g)].map((x) => x[1]))
  const sitio = new Set(['FUERA_DE_HORARIO', 'ANTICIPACION', 'AFORO', 'ZONA', 'CONTACTO', 'PERSONAS', 'DESHABILITADA', 'PASADA'])
  const soloEquipo = new Set(['MESA', 'SEDE', 'ORIGEN'])
  for (const p of prefijos) {
    check(sitio.has(p) || soloEquipo.has(p), `la migración D1 lanza «${p}:» y el sitio no lo traduce`)
  }
} else {
  console.warn('verify-reservas: no se encontró la migración D1 del ERP (ERP_REPO=<ruta>); se omite la comparación de prefijos')
}

// ─── 4. Revisión 2026-10-07 ──────────────────────────────────────────────────
{
  const servidor = await readFile(join(ROOT, 'lib/restaurant/reservas-servidor.ts'), 'utf8')
  // Interruptor como Wompi: SOLO 'true' bloquea; sin la variable, observa.
  check(/RESERVAS_ENFORCE_REGLAS !== 'true'/.test(servidor), 'RESERVAS_ENFORCE_REGLAS: sin la variable debe observar, no bloquear')
  check(!/RESERVAS_ENFORCE_REGLAS === 'false'/.test(servidor), 'RESERVAS_ENFORCE_REGLAS: el default invertido volvió')
  check(/p_validar_reglas: bloquear/.test(servidor), 'crearReservaWeb manda p_validar_reglas explícito')
  // Una sola regla «la sede gana, la organización respalda» sobre filas crudas.
  check(/filaEfectiva/.test(servidor) && !/filas\.find\(/.test(servidor), 'reservas-servidor usa filaEfectiva (sin un segundo find de sede/organización)')

  const cancelar = await readFile(join(ROOT, 'app/api/restaurant-reservations/[id]/cancel/route.ts'), 'utf8')
  check(/conToken\.error\.code === '42703'/.test(cancelar), '/[id]/cancel: la vía sin token solo con la columna inexistente (42703)')
  check(/status: 503/.test(cancelar), '/[id]/cancel: otros errores de lectura → 503, nunca cancelar sin token')
  check(/reglaDeError\(errMsg\)/.test(cancelar) && /no se presento/.test(cancelar), '/[id]/cancel: mapea PASADA/ANTICIPACION y no_show')

  const cta = await readFile(join(ROOT, 'components/sections/restaurant/ReservationCtaForm.tsx'), 'utf8')
  const vista = await readFile(join(ROOT, 'components/sections/restaurant/ReservationView.tsx'), 'utf8')
  check(/limitesPersonas\(/.test(cta) && /limitesPersonas\(/.test(vista), 'reservation_cta y reservation comparten limitesPersonas (ajustes de la sede)')
  check(/ajustesDeSede\(/.test(cta), 'reservation_cta resuelve los ajustes de la sede como reservation')
}

if (fallos > 0) {
  console.error(`verify-reservas: ${fallos} de ${total} comprobaciones fallaron`)
  process.exit(1)
}
console.log(`verify-reservas: ${total} comprobaciones OK`)
