/**
 * Plano de mesas público de una sede (plantilla «Café de especialidad», `reservation` ·
 * `floor_plan`, Figma 2223:46106 láminas 03 y 04).
 *
 * Puro: lo importan el servidor (planoMesas.server.ts, la ruta de disponibilidad, la página) y el
 * cliente (ReservaPlano). Sin React ni Supabase.
 *
 * Fuentes (ERP, migración 20261008134326_plano_publico_rpc y 20261008134614_plano_disponibilidad_por_mesa,
 * verificadas por MCP el 2026-11-07 en taqjemqjtumhwptchcxk):
 * - `get_restaurant_floor_plan_public(p_organization_id, p_branch_id)` → jsonb
 *   `{ branch_id, has_layout, zones[], tables[], elements[] }`. Nunca trae el estado de la mesa,
 *   sesiones, montos ni meseros.
 * - `get_restaurant_table_availability(p_organization_id, p_branch_id, p_date, p_time, p_party_size,
 *   p_validar_reglas)` → filas `(table_id, estado)`, estado ∈ libre | ocupada | no_alcanza | no_web.
 *
 * Geometría: la misma del editor de POS › Mesas (src/components/pos/mesas/plano/planoMesasLogica.ts
 * y estadoMesaPlano.ts del ERP): `position_x/y` es la esquina de la caja ya girada; la mesa sin
 * girar va centrada en esa caja y se rota sobre su centro.
 */

import { ajustesDeSede, sedeAceptaReservas, type SedeSitio, type SedesRestaurante } from './sedes-modelo'

export type FormaMesa = 'cuadrada' | 'redonda' | 'larga' | 'barra'
export type TamanoMesa = 's' | 'm' | 'l'
export type TipoElemento = 'column' | 'planter' | 'bar' | 'wall' | 'door' | 'window' | 'label'
export type EstadoMesaWeb = 'libre' | 'ocupada' | 'no_alcanza' | 'no_web'

export interface MesaDelPlano {
  id: string
  nombre: string
  zona: string | null
  capacidad: number
  forma: FormaMesa
  tamano: TamanoMesa
  /** Esquina de la caja girada; `null` = la mesa no tiene posición en el plano. */
  x: number | null
  y: number | null
  rotacion: number
  reservableWeb: boolean
  /** Personas para reservarla en la web; `null` = de 1 a la capacidad. */
  webMin: number | null
  webMax: number | null
}

export interface ZonaDelPlano {
  nombre: string
  /** Recuadro guardado en `restaurant_zone_layouts`; `null` = se calcula alrededor de sus mesas. */
  caja: Caja | null
  orden: number
}

export interface ElementoDelPlano {
  id: string
  zona: string | null
  tipo: TipoElemento
  etiqueta: string
  x: number
  y: number
  ancho: number
  alto: number
  rotacion: number
}

export interface PlanoSede {
  branchId: number
  /** Alguna mesa visible tiene posición (lo calcula la RPC con las mismas zonas). */
  hayPlano: boolean
  zonas: ZonaDelPlano[]
  mesas: MesaDelPlano[]
  elementos: ElementoDelPlano[]
}

export interface Caja {
  x: number
  y: number
  w: number
  h: number
}

const FORMAS: Record<string, FormaMesa> = { square: 'cuadrada', round: 'redonda', long: 'larga', bar: 'barra' }
const TIPOS: readonly TipoElemento[] = ['column', 'planter', 'bar', 'wall', 'door', 'window', 'label']
/** Margen del recuadro de la zona alrededor de sus mesas (el mismo del editor). */
const MARGEN_ZONA = { x: 24, arriba: 40, abajo: 24 }
/** Aire alrededor del dibujo. */
const MARGEN_PLANO = 24

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}
function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function entero(v: unknown, min: number, max: number): number | null {
  const n = numero(v)
  return n !== null && Number.isInteger(n) && n >= min && n <= max ? n : null
}

/** Forma por defecto (sin `shape`): 2 o menos redonda, hasta 4 cuadrada, más larga (como el ERP). */
export function formaPorCapacidad(capacidad: number): FormaMesa {
  if (capacidad <= 2) return 'redonda'
  if (capacidad <= 4) return 'cuadrada'
  return 'larga'
}

/** Tamaño de la mesa sin girar (px del editor a escala 1). Igual a `tamanoEnPlanoBase` del ERP. */
export function tamanoMesa(forma: FormaMesa, tamano: TamanoMesa): { w: number; h: number } {
  const base = forma === 'redonda' ? { w: 110, h: 110 } : forma === 'larga' ? { w: 184, h: 102 } : forma === 'barra' ? { w: 184, h: 60 } : { w: 110, h: 110 }
  const f = tamano === 's' ? 0.8 : tamano === 'l' ? 1.25 : 1
  return { w: Math.round(base.w * f), h: Math.round(base.h * f) }
}

function normalizarRotacion(r: number): number {
  return ((Math.round(r) % 360) + 360) % 360
}

/** Caja de un rectángulo girado (la de la mesa o del elemento). */
export function cajaGirada(w: number, h: number, rotacion: number): { w: number; h: number } {
  const r = (normalizarRotacion(rotacion) * Math.PI) / 180
  const cos = Math.abs(Math.cos(r))
  const sin = Math.abs(Math.sin(r))
  return { w: Math.round(w * cos + h * sin), h: Math.round(w * sin + h * cos) }
}

export function cajaMesa(m: Pick<MesaDelPlano, 'forma' | 'tamano' | 'rotacion' | 'x' | 'y'>): Caja | null {
  if (m.x === null || m.y === null) return null
  const t = tamanoMesa(m.forma, m.tamano)
  const c = cajaGirada(t.w, t.h, m.rotacion)
  return { x: m.x, y: m.y, w: c.w, h: c.h }
}

export function cajaElemento(e: ElementoDelPlano): Caja {
  const c = cajaGirada(e.ancho, e.alto, e.rotacion)
  return { x: e.x, y: e.y, w: c.w, h: c.h }
}

/** Lee la respuesta de `get_restaurant_floor_plan_public`. Forma inesperada = `null`. */
export function leerPlanoPublico(raw: unknown, branchId: number): PlanoSede | null {
  if (!esObjeto(raw)) return null
  const mesas: MesaDelPlano[] = []
  for (const t of Array.isArray(raw.tables) ? raw.tables : []) {
    if (!esObjeto(t)) continue
    const id = texto(t.id)
    if (!id) continue
    const capacidad = entero(t.capacity, 1, 500) ?? 4
    const x = numero(t.position_x)
    const y = numero(t.position_y)
    const webMin = entero(t.web_min_party, 1, 500)
    const webMax = entero(t.web_max_party, 1, 500)
    mesas.push({
      id,
      nombre: texto(t.name) ?? 'Mesa',
      zona: texto(t.zone),
      capacidad,
      forma: FORMAS[String(t.shape ?? '')] ?? formaPorCapacidad(capacidad),
      tamano: t.size === 's' || t.size === 'l' ? t.size : 'm',
      x: x !== null && y !== null ? x : null,
      y: x !== null && y !== null ? y : null,
      rotacion: normalizarRotacion(numero(t.rotation) ?? 0),
      reservableWeb: t.is_web_bookable !== false,
      webMin,
      webMax,
    })
  }
  const zonas: ZonaDelPlano[] = []
  for (const z of Array.isArray(raw.zones) ? raw.zones : []) {
    if (!esObjeto(z)) continue
    const nombre = texto(z.zone_name)
    if (!nombre || zonas.some((x) => x.nombre === nombre)) continue
    const x = numero(z.position_x)
    const y = numero(z.position_y)
    const w = numero(z.width)
    const h = numero(z.height)
    zonas.push({
      nombre,
      caja: x !== null && y !== null && w !== null && h !== null && w > 0 && h > 0 ? { x, y, w, h } : null,
      orden: numero(z.sort_order) ?? zonas.length,
    })
  }
  const elementos: ElementoDelPlano[] = []
  for (const e of Array.isArray(raw.elements) ? raw.elements : []) {
    if (!esObjeto(e)) continue
    const id = texto(e.id)
    const tipo = TIPOS.find((t) => t === e.kind)
    const x = numero(e.position_x)
    const y = numero(e.position_y)
    if (!id || !tipo || x === null || y === null) continue
    elementos.push({
      id,
      zona: texto(e.zone_name),
      tipo,
      etiqueta: (texto(e.label) ?? '').slice(0, 60),
      x,
      y,
      ancho: entero(e.width, 4, 4000) ?? 60,
      alto: entero(e.height, 4, 4000) ?? 60,
      rotacion: normalizarRotacion(numero(e.rotation) ?? 0),
    })
  }
  return {
    branchId,
    hayPlano: raw.has_layout === true && mesas.some((m) => m.x !== null),
    zonas,
    mesas,
    elementos,
  }
}

/**
 * Lo que se dibuja con las zonas de la sección (`zones` del contrato; vacío = las que devuelve la
 * RPC, que ya aplica las `allowed_zones` de la sede). Una mesa sin zona sigue visible solo sin filtro.
 */
export function planoConZonas(plano: PlanoSede, zonas: readonly string[]): PlanoSede {
  if (zonas.length === 0) return plano
  const visibles = new Set(zonas.map((z) => z.toLowerCase()))
  const dentro = (z: string | null) => z !== null && visibles.has(z.toLowerCase())
  const mesas = plano.mesas.filter((m) => dentro(m.zona))
  return {
    ...plano,
    hayPlano: mesas.some((m) => m.x !== null),
    zonas: plano.zonas.filter((z) => dentro(z.nombre)),
    mesas,
    elementos: plano.elementos.filter((e) => e.zona === null || dentro(e.zona)),
  }
}

function unir(cajas: Caja[]): Caja | null {
  if (cajas.length === 0) return null
  const x = Math.min(...cajas.map((c) => c.x))
  const y = Math.min(...cajas.map((c) => c.y))
  return { x, y, w: Math.max(...cajas.map((c) => c.x + c.w)) - x, h: Math.max(...cajas.map((c) => c.y + c.h)) - y }
}

/** Recuadro de cada zona: el guardado o el que rodea sus mesas y elementos. */
export function recuadrosDeZona(plano: PlanoSede): { nombre: string; caja: Caja }[] {
  const salida: { nombre: string; caja: Caja }[] = []
  for (const z of [...plano.zonas].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'))) {
    if (z.caja) {
      salida.push({ nombre: z.nombre, caja: z.caja })
      continue
    }
    const contenido = unir([
      ...plano.mesas.filter((m) => m.zona === z.nombre).map(cajaMesa).filter((c): c is Caja => c !== null),
      ...plano.elementos.filter((e) => e.zona === z.nombre).map(cajaElemento),
    ])
    if (!contenido) continue
    salida.push({
      nombre: z.nombre,
      caja: {
        x: contenido.x - MARGEN_ZONA.x,
        y: contenido.y - MARGEN_ZONA.arriba,
        w: contenido.w + MARGEN_ZONA.x * 2,
        h: contenido.h + MARGEN_ZONA.arriba + MARGEN_ZONA.abajo,
      },
    })
  }
  return salida
}

/** Lienzo del dibujo: todo lo que se pinta, con aire alrededor. `null` = no hay nada que dibujar. */
export function lienzoDelPlano(plano: PlanoSede): Caja | null {
  const todo = unir([
    ...plano.mesas.map(cajaMesa).filter((c): c is Caja => c !== null),
    ...plano.elementos.map(cajaElemento),
    ...recuadrosDeZona(plano).map((z) => z.caja),
  ])
  if (!todo) return null
  return { x: todo.x - MARGEN_PLANO, y: todo.y - MARGEN_PLANO, w: todo.w + MARGEN_PLANO * 2, h: todo.h + MARGEN_PLANO * 2 }
}

/** Rango de personas con que se reserva la mesa en la web. */
export function rangoWeb(m: Pick<MesaDelPlano, 'capacidad' | 'webMin' | 'webMax'>): { min: number; max: number } {
  return { min: m.webMin ?? 1, max: m.webMax ?? m.capacidad }
}

/**
 * Estado que se sabe sin consultar la base (modo WhatsApp, o antes de elegir hora): la mesa no se
 * reserva en la web, o no alcanza para el grupo. Todo lo demás se ve libre: el equipo confirma.
 * Mismas reglas que la RPC (`no_web` antes que `no_alcanza`).
 */
export function estadoSinConsulta(m: MesaDelPlano, personas: number): EstadoMesaWeb {
  if (!m.reservableWeb) return 'no_web'
  const r = rangoWeb(m)
  if (m.capacidad < personas || personas < r.min || personas > r.max) return 'no_alcanza'
  return 'libre'
}

/** Lee las filas de `get_restaurant_table_availability`. */
export function leerDisponibilidadMesas(raw: unknown): Record<string, EstadoMesaWeb> {
  const salida: Record<string, EstadoMesaWeb> = {}
  if (!Array.isArray(raw)) return salida
  for (const f of raw) {
    if (!esObjeto(f)) continue
    const id = texto(f.table_id)
    const estado = f.estado
    if (id && (estado === 'libre' || estado === 'ocupada' || estado === 'no_alcanza' || estado === 'no_web')) salida[id] = estado
  }
  return salida
}

/** «Mesa 9 · Salón · hasta 4 personas» (la fila «Mesa elegida» del formulario). */
export function resumenMesa(m: Pick<MesaDelPlano, 'nombre' | 'zona' | 'capacidad'>): string {
  return [m.nombre, m.zona, `hasta ${m.capacidad} ${m.capacidad === 1 ? 'persona' : 'personas'}`].filter(Boolean).join(' · ')
}

/**
 * Nota con la mesa elegida. La reserva entra por el flujo de siempre (`/api/restaurant-reservations`,
 * que todavía no recibe `p_table_id`): la mesa viaja como preferencia en las notas, y el equipo la ve
 * en POS › Reservas de mesas.
 */
export function notaConMesa(m: Pick<MesaDelPlano, 'nombre' | 'zona'> | null, notas: string, prefijo?: string | null): string {
  const partes: string[] = []
  if (prefijo?.trim()) partes.push(prefijo.trim())
  if (m) partes.push(`Mesa elegida en el plano: ${m.nombre}${m.zona ? ` (${m.zona})` : ''}`)
  if (notas.trim()) partes.push(notas.trim())
  return partes.join(' · ').slice(0, 500)
}

/**
 * Sillas alrededor de la mesa (decorativas, en coordenadas de la mesa SIN girar, centradas en 0,0).
 * Redonda: repartidas en círculo. Larga: arriba y abajo, y una en cada cabecera si sobran.
 * Barra: una fila abajo. Cuadrada: por lados, en orden arriba, abajo, izquierda, derecha.
 */
export function sillasDeMesa(forma: FormaMesa, w: number, h: number, capacidad: number): { x: number; y: number; giro: number }[] {
  const n = Math.max(0, Math.min(capacidad, 12))
  const sep = 9
  if (n === 0) return []
  if (forma === 'redonda') {
    const r = w / 2 + sep
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2
      return { x: Math.cos(a) * r, y: Math.sin(a) * r, giro: (a * 180) / Math.PI + 90 }
    })
  }
  const fila = (k: number, lado: 'arriba' | 'abajo') =>
    Array.from({ length: k }, (_, i) => ({
      x: -w / 2 + (w * (i + 1)) / (k + 1),
      y: lado === 'arriba' ? -h / 2 - sep : h / 2 + sep,
      giro: lado === 'arriba' ? 0 : 180,
    }))
  if (forma === 'barra') return fila(n, 'abajo')
  if (forma === 'larga') {
    const cabeceras = n >= 6 && n % 2 === 0 ? 2 : n >= 5 ? 1 : 0
    const lados = n - cabeceras
    const arriba = Math.ceil(lados / 2)
    const salida = [...fila(arriba, 'arriba'), ...fila(lados - arriba, 'abajo')]
    if (cabeceras >= 1) salida.push({ x: -w / 2 - sep, y: 0, giro: 270 })
    if (cabeceras >= 2) salida.push({ x: w / 2 + sep, y: 0, giro: 90 })
    return salida
  }
  // Cuadrada: hasta 4 por lado, en el orden arriba, abajo, izquierda, derecha.
  const porLado = [0, 0, 0, 0]
  for (let i = 0; i < n; i++) porLado[i % 4]++
  const salida = [...fila(porLado[0], 'arriba'), ...fila(porLado[1], 'abajo')]
  const columna = (k: number, lado: 'izq' | 'der') =>
    Array.from({ length: k }, (_, i) => ({
      x: lado === 'izq' ? -w / 2 - sep : w / 2 + sep,
      y: -h / 2 + (h * (i + 1)) / (k + 1),
      giro: lado === 'izq' ? 270 : 90,
    }))
  return [...salida, ...columna(porLado[2], 'izq'), ...columna(porLado[3], 'der')]
}

/** ¿La sede tiene las reservas web activas? Sin ajustes propios, los de la organización; sin ninguno, sí. */
export function reservasActivas(sede: SedeSitio, datos: SedesRestaurante): boolean {
  return ajustesDeSede(sede, datos)?.habilitada ?? true
}

/**
 * Sedes de la reserva con plano: con mesas (sin mesas no hay plano), la de la página si es el sitio
 * de una sede, las elegidas en `branch_ids` y, si el dueño fijó «Directo al ERP», solo las que
 * aceptan reservas web. Sin modo guardado, una sede con las reservas apagadas entra en modo
 * WhatsApp (`resolverModoReserva`, E1). La usan la página (qué planos leer) y la sección.
 */
export function sedesDeReservaPlano(
  datos: SedesRestaurante,
  opciones: { sedePagina: number | null; elegidas: readonly number[]; modoGuardado: unknown },
): SedeSitio[] {
  return datos.sedes
    .filter((s) => s.mesas > 0)
    .filter((s) => (opciones.sedePagina !== null ? s.id === opciones.sedePagina : true))
    .filter((s) => opciones.elegidas.length === 0 || opciones.elegidas.includes(s.id))
    .filter((s) => opciones.modoGuardado !== 'erp' || sedeAceptaReservas(s, datos))
}
