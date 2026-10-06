/**
 * verify-sedes.mjs — compuerta de sedes, navegación y horario (paquete C del plan de restaurante).
 *
 *   node --disable-warning=ExperimentalWarning scripts/verify-sedes.mjs
 *   npm run verify:sedes            (corre con TZ=UTC y con TZ=America/Bogota)
 *
 * Sin base de datos ni dependencias nuevas: carga los módulos PUROS reales con
 * `module.stripTypeScriptTypes` de Node 22 (el método de verify-orders.mjs) y comprueba:
 *
 * 1. Rutas de sede (lib/outlet/rutaSitio.ts): con la sede servida por prefijo, TODOS los href
 *    internos que salen del árbol de navegación, del mega menú y de rutaSitio empiezan por
 *    /<sede>; los externos, las anclas y las rutas globales (/auth, /mi-cuenta, /api) no se
 *    tocan; sin sede nada cambia; conPrefijo es idempotente.
 * 2. Slugs reservados: cada ruta propia de app/ está reservada (una sede con ese slug sería
 *    inalcanzable) y la lista del sitio está dentro de RESERVED_SLUGS del ERP
 *    (go-admin-erp/src/lib/utils/webIdentityValidation.ts), que es la que valida al guardar.
 * 3. Horario (lib/restaurant/horario.ts): turnos partidos (16:30 entre turnos → cerrado y
 *    «abre hoy a las 19:00»), turno que cruza la medianoche, horario por defecto del ERP en las
 *    formas reales de la BD (verificadas por MCP el 2026-10-06), días en español de
 *    business_hours, «Horario {}» → sin filas, y horaEnZona con la zona de la sede. Además
 *    horarioDeSede (el por defecto no rechaza pedidos) y franjasPedido con turno partido: ninguna
 *    franja en el hueco entre turnos y todas aceptadas por validarMomentoPedido.
 * 4. «Cómo llegar» (lib/maps/comoLlegar.ts).
 */

import { readFile, writeFile, mkdtemp, rm, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { stripTypeScriptTypes } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const MODULOS = {
  rutaSitio: 'lib/outlet/rutaSitio.ts',
  horario: 'lib/restaurant/horario.ts',
  ventanaPedido: 'lib/restaurant/ventanaPedido.ts',
  comoLlegar: 'lib/maps/comoLlegar.ts',
}

function aMjs(ts) {
  const js = stripTypeScriptTypes(ts, { mode: 'strip' })
  return js
    .replace(/from\s+'(?:@\/lib\/[a-z]+\/|\.\/)([A-Za-z-]+)'/g, (_, nombre) => {
      if (!MODULOS[nombre]) throw new Error(`import no puro en un módulo puro: ${nombre}`)
      return `from './${nombre}.mjs'`
    })
    .replace(/^import\s+type[^\n]*\n/gm, '')
}

const dir = await mkdtemp(join(tmpdir(), 'verify-sedes-'))
const m = {}
try {
  for (const [nombre, ruta] of Object.entries(MODULOS)) {
    await writeFile(join(dir, `${nombre}.mjs`), aMjs(await readFile(join(ROOT, ruta), 'utf8')))
  }
  for (const nombre of Object.keys(MODULOS)) {
    m[nombre] = await import(pathToFileURL(join(dir, `${nombre}.mjs`)).href)
  }
} finally {
  await rm(dir, { recursive: true, force: true })
}

const problemas = []
let casos = 0
function check(cond, msg) {
  casos++
  if (!cond) problemas.push(msg)
}
function igual(a, b, msg) {
  check(JSON.stringify(a) === JSON.stringify(b), `${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`)
}

// ─── 1. Rutas de sede ───────────────────────────────────────────────────────────────────────
{
  const { rutaSitio, conPrefijo, prefijoSede, prefijarArbolNav, prefijarItemsNav, quitarPrefijo } = m.rutaSitio
  const sede = { branchSlug: 'sede-norte' }
  const P = '/sede-norte'

  igual(prefijoSede(sede, true), P, 'prefijo con sede por ruta')
  igual(prefijoSede(sede, false), '', 'sin prefijo si la sede va por host')
  igual(prefijoSede(null, true), '', 'sin sede, sin prefijo')

  const casosRuta = [
    ['/', P],
    ['', P],
    ['/menu', `${P}/menu`],
    ['menu', `${P}/menu`],
    ['/productos/12?x=1', `${P}/productos/12?x=1`],
    ['/?mesa=4', `${P}?mesa=4`],
    ['/#reservar', `${P}#reservar`],
    ['#reservar', '#reservar'],
    ['?sede=3', '?sede=3'],
    ['https://wa.me/57300', 'https://wa.me/57300'],
    ['tel:+57300', 'tel:+57300'],
    ['mailto:a@b.co', 'mailto:a@b.co'],
    ['//cdn.ejemplo.co/x', '//cdn.ejemplo.co/x'],
    ['/auth', '/auth'],
    ['/mi-cuenta/pedidos', '/mi-cuenta/pedidos'],
    ['/api/orders', '/api/orders'],
    [`${P}/menu`, `${P}/menu`],
    [P, P],
  ]
  for (const [entrada, esperado] of casosRuta) {
    igual(rutaSitio(entrada, sede, true), esperado, `rutaSitio(${JSON.stringify(entrada)})`)
    igual(rutaSitio(entrada, sede, false), entrada, `sin prefijo no cambia ${JSON.stringify(entrada)}`)
    igual(conPrefijo(conPrefijo(entrada, P), P), conPrefijo(entrada, P), `idempotente ${JSON.stringify(entrada)}`)
  }
  // /sede-nortex no es la sede: se prefija.
  igual(conPrefijo('/sede-nortex', P), `${P}/sede-nortex`, 'slug parecido no se confunde con el prefijo')

  // Árbol de navegación como lo pinta pageToNavItem: home → '/', resto → `/${slug}`.
  const href = (slug) => (slug === 'home' ? '/' : `/${slug}`)
  const arbol = [
    { slug: 'home', children: [] },
    { slug: 'menu', children: [{ slug: 'categorias/entradas', children: [] }] },
    { slug: 'reservas-mesa', children: [] },
    { slug: 'https://instagram.com/x', children: [] },
    { slug: '#contacto', children: [] },
  ]
  const conSede = prefijarArbolNav(arbol, P)
  const hrefs = []
  const recorrer = (nodos) => nodos.forEach((n) => { hrefs.push(href(n.slug)); recorrer(n.children ?? []) })
  recorrer(conSede)
  const internos = hrefs.filter((h) => !h.startsWith('/https:') && !h.startsWith('/#'))
  check(internos.length === 4, `árbol: 4 enlaces internos, hay ${internos.length}`)
  for (const h of internos) check(h === P || h.startsWith(`${P}/`), `href de navegación sin prefijo de sede: ${h}`)
  igual(prefijarArbolNav(arbol, ''), arbol, 'sin sede el árbol es el mismo objeto')
  check(prefijarArbolNav(arbol, '') === arbol, 'sin sede no se copia el árbol')

  const mega = prefijarItemsNav([{ name: 'A', href: '/categorias/a', children: [{ name: 'B', href: '/categorias/b' }] }], P)
  igual(mega[0].href, `${P}/categorias/a`, 'mega menú con prefijo')
  igual(mega[0].children[0].href, `${P}/categorias/b`, 'mega menú hijo con prefijo')

  igual(quitarPrefijo(`${P}/checkout`, P), '/checkout', 'quitarPrefijo')
  igual(quitarPrefijo(P, P), '/', 'quitarPrefijo portada')
  igual(quitarPrefijo('/checkout', ''), '/checkout', 'quitarPrefijo sin sede')
}

// ─── 2. Slugs reservados ────────────────────────────────────────────────────────────────────
{
  const { SLUGS_RESERVADOS } = m.rutaSitio
  const entradas = await readdir(join(ROOT, 'app'), { withFileTypes: true })
  const rutasPropias = entradas.filter((e) => e.isDirectory() && !e.name.startsWith('[') && !e.name.startsWith('(')).map((e) => e.name)
  for (const ruta of rutasPropias) {
    check(SLUGS_RESERVADOS.includes(ruta), `la ruta app/${ruta} no está en SLUGS_RESERVADOS: una sede con ese slug la taparía`)
  }

  const rutaErp = process.env.ERP_REPO
    ? join(process.env.ERP_REPO, 'src/lib/utils/webIdentityValidation.ts')
    : join(ROOT, '..', 'go-admin-erp', 'src/lib/utils/webIdentityValidation.ts')
  if (existsSync(rutaErp)) {
    const fuente = await readFile(rutaErp, 'utf8')
    const bloque = /export const RESERVED_SLUGS\s*=\s*\[([\s\S]*?)\]/.exec(fuente)
    check(!!bloque, 'no se encontró RESERVED_SLUGS en el ERP')
    const erp = bloque ? [...bloque[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : []
    for (const slug of SLUGS_RESERVADOS) {
      check(erp.includes(slug), `«${slug}» está reservado en el sitio pero el ERP deja guardarlo como slug de sede`)
    }
  } else {
    console.warn(`verify-sedes: no se encontró el ERP en ${rutaErp} (ERP_REPO=<ruta> para indicarlo); se omite la comparación con RESERVED_SLUGS`)
  }
}

// ─── 3. Horario ─────────────────────────────────────────────────────────────────────────────
{
  const { parseHorario, estadoApertura, ahoraEnZona, esHorarioPorDefecto, horarioRevisado, normalizarDias, filasHorario, horaEnZona, turnosDe, rango } = m.horario
  const BOG = 'America/Bogota'
  // 2026-10-07 es miércoles. 16:30 en Bogotá = 21:30 UTC.
  const en = (hhmm) => new Date(`2026-10-07T${hhmm}:00-05:00`)

  const partido = parseHorario({
    wednesday: { open: '12:00', close: '23:00', tramos: [{ open: '19:00', close: '23:00' }, { open: '12:00', close: '15:00' }] },
    thursday: { open: '12:00', close: '22:00' },
  })
  igual(turnosDe(partido.wednesday), [{ abre: '12:00', cierra: '15:00' }, { abre: '19:00', cierra: '23:00' }], 'turnos ordenados')
  igual([partido.wednesday.abre, partido.wednesday.cierra], ['12:00', '23:00'], 'envolvente del día para los consumidores actuales')
  igual(rango(partido.wednesday), '12:00 – 15:00 · 19:00 – 23:00', 'rango con turnos')
  igual(turnosDe(partido.thursday), [{ abre: '12:00', cierra: '22:00' }], 'un solo tramo sin tramos')

  const a1630 = estadoApertura(partido, ahoraEnZona(BOG, en('16:30')))
  igual(a1630?.estado, 'closed', '16:30 entre turnos: cerrado')
  igual(a1630?.texto, 'Cerrado · Abre hoy a las 19:00', '16:30: próxima apertura')
  igual(estadoApertura(partido, ahoraEnZona(BOG, en('13:00')))?.estado, 'open', '13:00 abierto')
  igual(estadoApertura(partido, ahoraEnZona(BOG, en('14:30')))?.estado, 'closing_soon', '14:30 cierra pronto (turno de mediodía)')
  igual(estadoApertura(partido, ahoraEnZona(BOG, en('20:00')))?.texto, 'Abierto ahora · Cierra a las 23:00', '20:00 segundo turno')
  igual(estadoApertura(partido, ahoraEnZona(BOG, en('23:30')))?.texto, 'Cerrado · Abre mañana a las 12:00', '23:30 mañana')

  // Turno que cruza la medianoche (último turno del martes hasta las 02:00).
  const noche = parseHorario({ tuesday: { open: '12:00', close: '02:00', tramos: [{ open: '12:00', close: '15:00' }, { open: '18:00', close: '02:00' }] } })
  igual(estadoApertura(noche, ahoraEnZona(BOG, en('01:00')))?.estado, 'closing_soon', 'miércoles 01:00 sigue el turno del martes')
  igual(estadoApertura(noche, ahoraEnZona(BOG, en('02:30')))?.estado, 'closed', 'miércoles 02:30 cerrado')

  // Turnos solapados: el que se pisa se descarta.
  igual(turnosDe(parseHorario({ monday: { tramos: [{ open: '12:00', close: '16:00' }, { open: '15:00', close: '20:00' }] } }).monday), [{ abre: '12:00', cierra: '16:00' }], 'turno solapado descartado')

  // Formas reales del horario por defecto en la BD (MCP 2026-10-06): 69 + 7 sedes.
  const L = { open: '09:00', close: '18:00', closed: false }
  const sabado = { open: '10:00', close: '15:00', closed: false }
  const defecto = { monday: L, tuesday: L, wednesday: L, thursday: L, friday: L, saturday: sabado, sunday: { closed: true } }
  check(esHorarioPorDefecto(defecto), 'por defecto (69 sedes)')
  check(esHorarioPorDefecto({ ...defecto, sunday: { open: '09:00', close: '18:00', closed: true } }), 'por defecto con domingo cerrado y horas (7 sedes)')
  check(esHorarioPorDefecto(parseHorario(defecto)), 'por defecto ya leído')
  check(!esHorarioPorDefecto({ ...defecto, saturday: { open: '10:00', close: '12:00' } }), 'sábado distinto no es por defecto')
  check(!esHorarioPorDefecto({ ...defecto, saturday: { ...sabado, closed: true } }), 'sábado cerrado no es por defecto')
  check(!esHorarioPorDefecto(null) && !esHorarioPorDefecto({}), 'sin horario no es «por defecto»')
  igual(horarioRevisado(parseHorario(defecto)), null, 'horarioRevisado descarta el por defecto')
  check(horarioRevisado(partido) === partido, 'horarioRevisado conserva un horario real')

  // business_hours con días en español sin tildes (forma real) y '{}' (89 filas).
  const bh = { lunes: { open: '12:00', close: '22:00' }, miercoles: { open: '12:00', close: '22:00' }, sabado: { open: '12:00', close: '23:30' }, domingo: { closed: true } }
  const semana = parseHorario(normalizarDias(bh))
  igual(semana?.wednesday, { abre: '12:00', cierra: '22:00' }, 'miercoles → wednesday')
  igual(semana?.saturday, { abre: '12:00', cierra: '23:30' }, 'sabado → saturday')
  igual(semana?.sunday, null, 'domingo cerrado')
  igual(parseHorario(normalizarDias({ 'Miércoles': { open: '08:00', close: '10:00' } }))?.wednesday, { abre: '08:00', cierra: '10:00' }, 'con tilde y mayúscula')
  igual(parseHorario(normalizarDias({})), null, "'{}' no produce horario («Horario {}» nunca se pinta)")
  igual(filasHorario(semana, null)[0], { etiqueta: 'Lunes', horas: '12:00 – 22:00', esHoy: false }, 'fila legible')

  // horarioDeSede: la regla de la carta, el checkout y /api/orders (por defecto → sin horario).
  igual(m.horario.horarioDeSede(defecto), null, 'horarioDeSede descarta el por defecto del ERP')
  igual(m.horario.horarioDeSede({}), null, 'horarioDeSede sin datos')
  igual(m.horario.horarioDeSede({ wednesday: { open: '12:00', close: '22:00' } })?.wednesday, { abre: '12:00', cierra: '22:00' }, 'horarioDeSede conserva un horario real')
  // Con el por defecto, «lo antes posible» a las 20:00 se acepta (no se valida con un horario inventado).
  check(m.ventanaPedido.validarMomentoPedido(m.horario.horarioDeSede(defecto), BOG, null, en('20:00')).ok, 'horario por defecto: el pedido «ya» a las 20:00 no se rechaza')

  // Franjas con turno partido: ninguna en el hueco 15:00-19:00 y todas las acepta validarMomentoPedido.
  {
    const { franjasPedido, validarMomentoPedido } = m.ventanaPedido
    const ahora = en('10:00')
    const franjas = franjasPedido(partido, BOG, ahora, { diasAdelante: 1 })
    const horas = franjas.map((iso) => horaEnZona(iso, BOG))
    check(horas.length > 0, 'turno partido: hay franjas')
    const enHueco = horas.filter((h) => h >= '15:00' && h < '19:00')
    check(enHueco.length === 0, `turno partido: franjas en el hueco entre turnos ${JSON.stringify(enHueco)}`)
    igual([horas[0], horas.includes('14:30'), horas.includes('19:00'), horas[horas.length - 1]], ['12:00', true, true, '22:30'], 'turno partido: franjas de los dos turnos')
    const rechazadas = franjas.filter((iso) => !validarMomentoPedido(partido, BOG, iso, ahora).ok)
    check(rechazadas.length === 0, `turno partido: el servidor rechazaría franjas ofrecidas ${JSON.stringify(rechazadas.map((iso) => horaEnZona(iso, BOG)))}`)
    // Turno de ayer que pasa la medianoche: miércoles 00:10 ofrece 01:00 y 01:30 del turno del martes.
    const deNoche = franjasPedido(noche, BOG, en('00:10'), { diasAdelante: 1 }).map((iso) => horaEnZona(iso, BOG))
    igual(deNoche, ['01:00', '01:30'], 'turno de ayer que cruza la medianoche (00:10 + 30 min de antelación, cierra 02:00)')
  }

  igual(horaEnZona('2026-10-07T21:30:00Z', BOG), '16:30', 'horaEnZona Bogotá')
  igual(horaEnZona(new Date('2026-10-07T21:30:00Z'), 'Europe/Madrid'), '23:30', 'horaEnZona Madrid')
  igual(horaEnZona('no-es-fecha', BOG), null, 'horaEnZona inválida')
}

// ─── 4. Cómo llegar ─────────────────────────────────────────────────────────────────────────
{
  const { urlComoLlegar, urlMapaEmbebido, destinoMapa } = m.comoLlegar
  igual(destinoMapa({ lat: 4.6, lng: -74.08, direccion: 'Calle 1' }), '4.6,-74.08', 'coordenadas primero')
  igual(urlComoLlegar({ direccion: 'Calle 1 # 2-3, Bogotá' }), 'https://www.google.com/maps/dir/?api=1&destination=Calle%201%20%23%202-3%2C%20Bogot%C3%A1', 'cómo llegar por dirección')
  igual(urlMapaEmbebido({ direccion: '  ' }), null, 'sin dirección no hay mapa')
}

if (problemas.length > 0) {
  console.error(`verify-sedes: ${problemas.length} de ${casos} comprobaciones fallaron (TZ del proceso: ${process.env.TZ ?? 'local'})`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`verify-sedes: ${casos} comprobaciones OK (TZ del proceso: ${process.env.TZ ?? 'local'})`)
