/**
 * Reglas puras de la ficha de producto para las plantillas de tienda (paquete W4, PLANO §2 ítem
 * 26 y §3). Sin React ni Supabase: las comprueba `scripts/verify-ficha-plantilla.mjs`.
 *
 * Regla de oro: sin las claves nuevas, todo da exactamente lo de hoy.
 * - `resolverDisenoFicha`: con `page_settings` (legacy) manda lo de siempre; sin él (V2), el
 *   `page_layout` del bloque `product_gallery`, y sin `page_layout`, los defaults de hoy.
 * - Las pestañas solo existen si la página tiene un `product_anchor_nav` visible (planPestanasFicha).
 * - El mosaico solo cambia la galería con `gallery_layout: 'mosaic'`.
 */

import {
  esDestinoPestanaFicha,
  normalizarDisenoFicha,
  normalizarPestanasAncla,
  type DestinoPestanaFicha,
} from '@/lib/website/v2/contrato/seccionesTienda'

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

// ─── «Envío y devoluciones» y «Beneficios» de fábrica dicen lo mismo ────────────────────────

function contenidoDe(seccion: { content?: unknown }): Record<string, unknown> {
  const c = seccion.content
  return c && typeof c === 'object' && !Array.isArray(c) ? (c as Record<string, unknown>) : {}
}

/**
 * Quita de la ficha el bloque «Envío y devoluciones» (`product_shipping`) que nadie ha tocado
 * cuando la ficha también pinta los «Beneficios» de fábrica (`product_benefits` sin `items`).
 *
 * Tres plantillas de tienda (Moderna, Clásica y Vibrante) traían los dos bloques. Sin configurar,
 * cada uno pinta sus textos de fábrica y son los mismos datos dos veces: «Tiempo de entrega ·
 * 24-48 horas hábiles» y «Envío rápido · 24-48 horas»; «Devoluciones · 30 días» y «Garantía ·
 * 30 días». El comercio veía la ficha «con todo doble» (2026-11-25).
 *
 * Se queda «Beneficios» (sus textos se editan desde el panel). Desde el 2026-11-25 los de «Envío y
 * devoluciones» también se editan (bloque 2): si el comercio escribe uno, el bloque ya está tocado.
 *
 * Solo aplica al caso de fábrica. Cualquiera de estas cosas deja los dos bloques como están:
 * - el comercio tocó «Envío y devoluciones» (título, mensaje, un interruptor, estilo…);
 * - el comercio escribió sus propios beneficios (`items`): ya no repiten nada de fábrica;
 * - no hay «Beneficios» visibles, o es un restaurante (ahí los de fábrica no se pintan).
 *
 * El catálogo de plantillas del ERP ya no arma los dos bloques; esto cubre las tiendas que
 * aplicaron la plantilla antes.
 *
 * Con «Envío y devoluciones» como pestaña (Figma 3255-99475) no se aplica: el detalle va en su
 * pestaña y arriba solo queda una línea corta con los datos reales de la tienda (no los de
 * fábrica), así que no repite los beneficios. Lo decide ProductDetailRenderer.
 */
export function sinEnvioRepetidoDeFabrica<T extends { section_type: string; content?: unknown }>(
  visibles: readonly T[],
  opciones: { restaurante?: boolean } = {},
): T[] {
  if (opciones.restaurante) return [...visibles]
  const beneficiosDeFabrica = visibles.some((s) => {
    if (s.section_type !== 'product_benefits') return false
    const items = contenidoDe(s).items
    return !Array.isArray(items) || items.length === 0
  })
  if (!beneficiosDeFabrica) return [...visibles]
  return visibles.filter((s) => s.section_type !== 'product_shipping' || Object.keys(contenidoDe(s)).length > 0)
}

// ─── Pestañas de la ficha (`product_anchor_nav`) ────────────────────────────────────────────

/** Una pestaña con su bloque (el primer bloque visible de ese tipo). */
export interface PestanaPlan<T> {
  label: string
  target: DestinoPestanaFicha
  seccion: T
}

export interface PlanPestanasFicha<T> {
  /** El bloque «Pestañas de la ficha» (el primero visible). */
  nav: T
  items: PestanaPlan<T>[]
}

/** Título que el comercio le puso al bloque (`title`; en la descripción, `title_description`). */
export function tituloPropioBloque(tipo: string, contenido: Record<string, unknown>): string | null {
  const valor = tipo === 'product_description' ? contenido.title_description : contenido.title
  return typeof valor === 'string' && valor.trim() ? valor.trim().slice(0, 40) : null
}

/**
 * Qué bloques pasan a ser pestañas (Figma «Ficha — pestañas reales» 3255-99475): las pestañas del
 * bloque, en su orden, cuyo destino puede ser pestaña (DESTINOS_PESTANA_FICHA) y está en la página.
 * Una pestaña hacia otro bloque (p. ej. la «Resumen» de antes, hacia la información) no se pinta y
 * su bloque se queda donde está. Sin bloque de pestañas, `null`: la ficha de siempre.
 *
 * Nombre de cada pestaña: el que se le puso en «Pestañas» (editor del ERP). Si las pestañas no se
 * tocaron, el título propio del bloque (p. ej. «Características» del bloque de ficha técnica) y,
 * sin él, el de fábrica.
 *
 * Los bloques de la lista salen de su sitio y se pintan en los paneles, debajo de las dos
 * columnas; «Envío y devoluciones» deja además una línea corta junto al botón.
 */
export function planPestanasFicha<T extends { section_type: string; content?: unknown }>(
  visibles: readonly T[],
): PlanPestanasFicha<T> | null {
  const nav = visibles.find((s) => s.section_type === TIPO_PESTANAS_ANCLA)
  if (!nav) return null
  const contenido = contenidoDe(nav)
  const { items } = normalizarPestanasAncla(contenido)
  // Pestañas sin tocar: el título propio del bloque, si lo tiene, pone el nombre de su pestaña.
  const tocadas = Array.isArray(contenido.items) && contenido.items.length > 0
  const plan: PestanaPlan<T>[] = []
  for (const item of items) {
    if (!esDestinoPestanaFicha(item.target)) continue
    const seccion = visibles.find((s) => s.section_type === item.target)
    if (!seccion) continue
    const label = (tocadas ? null : tituloPropioBloque(item.target, contenidoDe(seccion))) ?? item.label
    plan.push({ label, target: item.target, seccion })
  }
  return { nav, items: plan }
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
