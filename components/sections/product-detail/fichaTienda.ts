/**
 * Reglas puras de la ficha de producto para las plantillas de tienda (paquete W4, PLANO §2 ítem
 * 26 y §3). Sin React ni Supabase: las comprueba `scripts/verify-ficha-plantilla.mjs`.
 *
 * Regla de oro: sin las claves nuevas, todo da exactamente lo de hoy.
 * - `resolverDisenoFicha`: con `page_settings` (legacy) manda lo de siempre; sin él (V2), el
 *   `page_layout` del bloque `product_gallery`, y sin `page_layout`, los defaults de hoy.
 * - Las anclas de las pestañas solo existen si la página tiene un `product_anchor_nav` visible.
 * - El mosaico solo cambia la galería con `gallery_layout: 'mosaic'`.
 */

import { DESTINOS_ANCLA, normalizarDisenoFicha, type DestinoAncla } from '@/lib/website/v2/contrato/seccionesTienda'

// ─── Columnas de la ficha (page_settings legacy o page_layout V2) ───────────────────────────

export interface DisenoFichaResuelto {
  /** '1' | '2' | '2+sidebar' (legacy admite '2+sidebar'; V2 solo '1' o '2'). */
  columns: string
  stickyColumn: boolean
  galleryWidth: number
  showBreadcrumb: boolean
}

/** Lo que hacía la ficha con `page_settings` (o `{}`): el comportamiento de hoy. */
function disenoDePageSettings(pageSettings: Record<string, any>): DisenoFichaResuelto {
  return {
    columns: pageSettings.columns || '2',
    stickyColumn: pageSettings.sticky_column !== false,
    galleryWidth: pageSettings.gallery_width ?? 50,
    showBreadcrumb: pageSettings.show_breadcrumb !== false,
  }
}

/**
 * Columnas, columna fija, ancho de la galería y migas de la ficha.
 * - `pageSettings` con valor (legacy, aunque sea `{}`): lo de siempre; `page_layout` no se lee.
 * - `pageSettings` nulo (V2) y la galería con `page_layout`: ese diseño.
 * - `pageSettings` nulo sin `page_layout`: los defaults de hoy.
 */
export function resolverDisenoFicha(
  pageSettings: Record<string, any> | null | undefined,
  secciones: ReadonlyArray<{ section_type: string; content?: unknown }>,
): DisenoFichaResuelto {
  if (pageSettings) return disenoDePageSettings(pageSettings)
  const galeria = secciones.find((s) => s.section_type === 'product_gallery')
  const contenido = galeria?.content && typeof galeria.content === 'object' && !Array.isArray(galeria.content)
    ? (galeria.content as Record<string, unknown>)
    : null
  const diseno = normalizarDisenoFicha(contenido)
  if (!diseno) return disenoDePageSettings({})
  return {
    columns: diseno.columns,
    stickyColumn: diseno.stickyColumn,
    galleryWidth: diseno.galleryWidth,
    showBreadcrumb: diseno.showBreadcrumb,
  }
}

// ─── Bloques nuevos dentro de la ficha ──────────────────────────────────────────────────────

/** Tipos nuevos de la ficha que se pintan como bloque (sin SectionWrapper si no traen diseño). */
export const TIPOS_BLOQUE_FICHA_TIENDA = ['product_anchor_nav', 'product_pager', 'complete_the_look'] as const

/** Tipos nuevos que van a todo el ancho, debajo de las columnas (como relacionados y reseñas). */
export const TIPOS_ANCHO_COMPLETO_TIENDA = ['complete_the_look', 'product_pager'] as const

export const TIPO_PESTANAS_ANCLA = 'product_anchor_nav'
export const TIPO_PAGINADOR_FICHA = 'product_pager'
export const TIPO_COMPLETA_EL_LOOK = 'complete_the_look'

/** ¿La página trae un bloque visible de este tipo? (Decide si se consulta su dato.) */
export function tieneBloque(secciones: ReadonlyArray<{ section_type: string; is_visible?: boolean | null }> | null | undefined, tipo: string): boolean {
  return !!secciones?.some((s) => s.section_type === tipo && s.is_visible !== false)
}

/** Destinos de ancla que existen en la página (bloques visibles), en el orden de DESTINOS_ANCLA. */
export function destinosPresentes(secciones: ReadonlyArray<{ section_type: string }>): DestinoAncla[] {
  const tipos = new Set(secciones.map((s) => s.section_type))
  return DESTINOS_ANCLA.filter((d) => tipos.has(d))
}

/** Las pestañas sin bloque visible al que saltar no se pintan. */
export function pestanasConDestino<T extends { target: string }>(items: readonly T[], presentes: readonly string[]): T[] {
  return items.filter((i) => presentes.includes(i.target))
}

/** Id del ancla de un bloque de la ficha (el tipo del bloque, como dice DESTINOS_ANCLA). */
export function idAncla(tipo: string): string | null {
  return (DESTINOS_ANCLA as readonly string[]).includes(tipo) ? tipo : null
}

// ─── Galería mosaico ────────────────────────────────────────────────────────────────────────

/**
 * Celdas del mosaico: 1 grande · 2 medianas · 1 grande, y se repite. Una mediana sin pareja (al
 * final) se pinta grande para no dejar un hueco.
 */
export function celdasMosaico(cantidad: number): ('grande' | 'mediana')[] {
  const n = Number.isInteger(cantidad) && cantidad > 0 ? cantidad : 0
  const salida: ('grande' | 'mediana')[] = []
  for (let i = 0; i < n; i += 1) {
    const enCiclo = i % 4
    if (enCiclo === 0 || enCiclo === 3) salida.push('grande')
    else if (enCiclo === 1) salida.push(i + 1 < n ? 'mediana' : 'grande')
    else salida.push('mediana')
  }
  return salida
}

// ─── Anterior y siguiente ───────────────────────────────────────────────────────────────────

/** Vecinos del producto en el orden de su categoría. Sin vuelta: el primero no tiene anterior. */
export function vecinosEnOrden(ids: readonly number[], id: number): { anteriorId: number | null; siguienteId: number | null } {
  const i = ids.indexOf(id)
  if (i < 0) return { anteriorId: null, siguienteId: null }
  return {
    anteriorId: i > 0 ? ids[i - 1] : null,
    siguienteId: i < ids.length - 1 ? ids[i + 1] : null,
  }
}

/** Enlace de un vecino del paginador, ya resuelto en el servidor. */
export interface VecinoFicha {
  uuid: string
  name: string
}

export interface PaginadorFichaDatos {
  anterior: VecinoFicha | null
  siguiente: VecinoFicha | null
}

// ─── Completa el look ───────────────────────────────────────────────────────────────────────

/**
 * Etiquetas que sirven para «Se lleva con»: las de `kind` general (o sin kind). Las de dieta,
 * alérgeno o picante describen el producto, no lo combinan con otro.
 */
export function etiquetaCombinable(kind: unknown): boolean {
  return kind === null || kind === undefined || kind === '' || kind === 'general'
}
