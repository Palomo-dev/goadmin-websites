/**
 * Cartas por horario del ERP (Sitio web › Carta) aplicadas a la sección `menu_full`.
 *
 * Fuente: la RPC `get_public_menu` (migraciones del ERP 20261008150100_carta_restaurante,
 * 20261008150200_carta_opciones_visibles y 20261010090000_get_public_menu_sitio), la MISMA que
 * usa la vista previa del ERP: una sola regla de vigencia (`fn_carta_vigente`). De su respuesta
 * el sitio solo toma la ESTRUCTURA de cada carta —categorías en orden, platos en orden,
 * destacados, ocultos y variantes/extras ocultos—. Precio, foto, etiquetas y agotados siguen
 * saliendo del catálogo de la página (`getMenuCatalogProducts`), como siempre: un solo punto
 * de verdad por dato.
 *
 * Cómo se traduce al modelo que ya pinta la vista (MenuFullView):
 * - Una carta → `selectedCategoryIds` (sus secciones) + `CartaPlatos` (orden, ocultos, destacados).
 *   Ocultos = platos del catálogo en esas categorías que la carta no trae (oculto en la carta).
 * - Varias cartas en la variante «tabs» → una pestaña por carta (`MenuSchedule`) con su horario
 *   de hoy y su propia `CartaPlatos`.
 * - «Carta fija» (`content.carta_id` del editor) → solo esa carta, esté o no en horario.
 * Sin RPC, sin cartas creadas o con la respuesta ilegible → `null`: la vía actual (contenido de
 * la sección: `menus`, `carta_platos`, `selected_category_ids`), sin cambios.
 *
 * Código puro.
 */
import type { CartaPlatos } from './cartaPlatos'
import type { MenuSchedule } from './menuFull'

export interface PlatoDeCarta {
  id: number
  destacado: boolean
  variantesOcultas: number[]
  extrasOcultos: number[]
}

export interface SeccionDeCarta {
  categoriaId: number
  platos: PlatoDeCarta[]
}

export interface Franja {
  from: string
  to: string
}

export interface CartaPublica {
  id: string
  nombre: string
  pdfUrl: string | null
  /** Día ISO (1 = lunes … 7 = domingo) → franjas «HH:MM». Ausente = no se muestra ese día. */
  horario: Record<string, Franja[]>
  /** Vigente al leerla (regla de la base). */
  vigente: boolean
  secciones: SeccionDeCarta[]
}

export interface CartasPublicas {
  zonaHoraria: string
  /** Día ISO en la zona de la sede cuando se leyó. */
  dia: number
  cartas: CartaPublica[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/
const MAX_CARTAS = 30
const MAX_SECCIONES = 400
const MAX_PLATOS = 3000

const entero = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null)
const enteros = (v: unknown): number[] => (Array.isArray(v) ? v.map(entero).filter((n): n is number => n !== null).slice(0, 200) : [])
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)

export function esIdCarta(v: unknown): v is string {
  return typeof v === 'string' && UUID.test(v)
}

function leerHorario(v: unknown): Record<string, Franja[]> {
  const o = obj(v)
  const out: Record<string, Franja[]> = {}
  if (!o) return out
  for (const dia of ['1', '2', '3', '4', '5', '6', '7']) {
    const lista = Array.isArray(o[dia]) ? (o[dia] as unknown[]) : []
    const franjas: Franja[] = []
    for (const f of lista.slice(0, 10)) {
      const ff = obj(f)
      if (ff && typeof ff.from === 'string' && typeof ff.to === 'string' && HORA.test(ff.from) && HORA.test(ff.to)) {
        franjas.push({ from: ff.from, to: ff.to })
      }
    }
    if (franjas.length > 0) out[dia] = franjas
  }
  return out
}

/**
 * Respuesta cruda de la RPC → estructura mínima validada (lo que se cachea). Descarta todo lo
 * que el sitio no usa (precios, nombres, etiquetas), así el valor cacheado es pequeño.
 */
export function leerCartasPublicas(crudo: unknown): CartasPublicas | null {
  const r = obj(crudo)
  if (!r || !Array.isArray(r.cartas)) return null
  const dia = entero(r.dia)
  const cartas: CartaPublica[] = []
  let platos = 0
  for (const c of (r.cartas as unknown[]).slice(0, MAX_CARTAS)) {
    const cc = obj(c)
    if (!cc || !esIdCarta(cc.id) || typeof cc.nombre !== 'string') continue
    const secciones: SeccionDeCarta[] = []
    for (const s of (Array.isArray(cc.secciones) ? (cc.secciones as unknown[]) : []).slice(0, MAX_SECCIONES)) {
      const ss = obj(s)
      const categoriaId = entero(ss?.categoriaId)
      if (!ss || categoriaId === null) continue
      const lista: PlatoDeCarta[] = []
      for (const p of Array.isArray(ss.productos) ? (ss.productos as unknown[]) : []) {
        if (platos >= MAX_PLATOS) break
        const pp = obj(p)
        const id = entero(pp?.id)
        if (!pp || id === null) continue
        platos++
        lista.push({
          id,
          destacado: pp.destacado === true,
          variantesOcultas: enteros(pp.variantesOcultas),
          extrasOcultos: enteros(pp.extrasOcultos),
        })
      }
      secciones.push({ categoriaId, platos: lista })
    }
    cartas.push({
      id: cc.id,
      nombre: cc.nombre.trim().slice(0, 80) || 'Carta',
      pdfUrl: typeof cc.pdfUrl === 'string' && /^(https:\/\/|\/)/i.test(cc.pdfUrl) ? cc.pdfUrl.slice(0, 1000) : null,
      horario: leerHorario(cc.horario),
      // La RPC de 20261008150100 (sin `vigente`) solo devuelve vigentes.
      vigente: typeof cc.vigente === 'boolean' ? cc.vigente : true,
      secciones,
    })
  }
  return {
    zonaHoraria: typeof r.zonaHoraria === 'string' ? r.zonaHoraria : 'America/Bogota',
    dia: dia !== null && dia <= 7 ? dia : 1,
    cartas,
  }
}

/** Categorías de la carta en su orden. */
export function categoriasDeCarta(carta: CartaPublica): number[] {
  return carta.secciones.map((s) => s.categoriaId)
}

/**
 * Excepciones de la carta en el formato que aplica la vista (`aplicarCartaPlatos`).
 * `catalogo`: id y categoría de los platos que cargó la página, para saber cuáles oculta la
 * carta (los que la RPC no devuelve en una categoría que sí está en la carta).
 */
export function platosDeCarta(carta: CartaPublica, catalogo: { id: number; category_id: number | null }[]): CartaPlatos {
  const orden: Record<string, number[]> = {}
  const enCarta = new Set<number>()
  const destacados: number[] = []
  for (const s of carta.secciones) {
    orden[String(s.categoriaId)] = s.platos.map((p) => p.id)
    for (const p of s.platos) {
      enCarta.add(p.id)
      if (p.destacado) destacados.push(p.id)
    }
  }
  const categorias = new Set(carta.secciones.map((s) => s.categoriaId))
  const ocultos = catalogo
    .filter((p) => p.category_id !== null && categorias.has(Number(p.category_id)) && !enCarta.has(p.id))
    .map((p) => p.id)
  return { orden, ocultos, destacados, textos: {} }
}

/** Variantes y extras que la carta no muestra, por plato (solo los que tienen alguno). */
export function opcionesOcultasDeCarta(carta: CartaPublica): Record<number, { variantes: number[]; extras: number[] }> {
  const out: Record<number, { variantes: number[]; extras: number[] }> = {}
  for (const s of carta.secciones) {
    for (const p of s.platos) {
      if (p.variantesOcultas.length > 0 || p.extrasOcultos.length > 0) {
        out[p.id] = { variantes: p.variantesOcultas, extras: p.extrasOcultos }
      }
    }
  }
  return out
}

/**
 * Pestaña de la carta para hoy: sus franjas del día ISO `dia` (más la de ayer que cruza la
 * medianoche, como `fn_carta_vigente`) y el primer inicio de mañana para «Disponible mañana».
 */
export function pestanaDeCarta(carta: CartaPublica, dia: number, platos: CartaPlatos): MenuSchedule {
  const ayer = dia === 1 ? 7 : dia - 1
  const manana = dia === 7 ? 1 : dia + 1
  const hoy = carta.horario[String(dia)] ?? []
  const deAyer = (carta.horario[String(ayer)] ?? []).filter((f) => f.to <= f.from && f.to !== '00:00').map((f) => ({ from: '00:00', to: f.to }))
  const franjas = [...deAyer, ...hoy].sort((a, b) => a.from.localeCompare(b.from))
  const primera = hoy[0] ?? null
  return {
    name: carta.nombre,
    start_time: primera?.from ?? null,
    end_time: primera?.to ?? null,
    category_ids: categoriasDeCarta(carta),
    franjas,
    inicioManana: carta.horario[String(manana)]?.[0]?.from ?? null,
    carta: platos,
  }
}

/**
 * Qué carta pinta una sección que no usa pestañas: la fija (si está activa en la sede), si no la
 * primera vigente, si no la primera. `null` sin cartas.
 */
export function cartaDeSeccion(cartas: CartasPublicas, cartaFijaId: unknown): CartaPublica | null {
  if (cartas.cartas.length === 0) return null
  if (esIdCarta(cartaFijaId)) {
    const fija = cartas.cartas.find((c) => c.id === cartaFijaId)
    if (fija) return fija
  }
  return cartas.cartas.find((c) => c.vigente) ?? cartas.cartas[0]
}

/**
 * Variantes y grupos de extras que se muestran en la hoja del plato. Nunca se ocultan los
 * grupos obligatorios (el pedido los exige) ni todas las variantes (el plato quedaría sin poder
 * pedirse): en esos casos se muestran como hoy.
 */
export function filtrarOpcionesDePlato<V extends { id: number }, G extends { id: number; required?: boolean; min_selections?: number }>(
  variantes: V[],
  grupos: Map<number, G[]>,
  ocultas: { variantes: number[]; extras: number[] } | null | undefined,
): { variantes: V[]; grupos: Map<number, G[]> } {
  if (!ocultas || (ocultas.variantes.length === 0 && ocultas.extras.length === 0)) return { variantes, grupos }
  const sinVariantes = new Set(ocultas.variantes)
  const visibles = variantes.filter((v) => !sinVariantes.has(v.id))
  const sinExtras = new Set(ocultas.extras)
  const filtrados = new Map<number, G[]>()
  grupos.forEach((lista, productoId) => {
    filtrados.set(productoId, lista.filter((g) => !sinExtras.has(g.id) || g.required === true || (g.min_selections ?? 0) > 0))
  })
  return { variantes: visibles.length > 0 ? visibles : variantes, grupos: filtrados }
}
