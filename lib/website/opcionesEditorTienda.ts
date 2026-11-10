/**
 * Tres decisiones del dueño sobre el editor de las plantillas de tienda (2026-11-10) que el sitio
 * no pintaba todavía. Todo es aditivo: clave ausente o inválida = lo de hoy, byte a byte.
 *
 * 1. Categorías · estilo «Lista de texto»: `category_style: 'text_list'` (lo lee
 *    `estiloCategoria()`; aquí solo las clases de la fila).
 * 2. Antes/Después: etiquetas editables `before_label` / `after_label` en `transformation · slider`
 *    (por defecto «Antes» y «Después», los rótulos de hoy).
 * 3. Bloques de color como UNA sección con repetidor: `blocks: [...]` en `image_text · color_block`.
 *    Cada bloque usa las claves del bloque único (`normalizarBloqueColor`). Sin `blocks` (o sin
 *    ningún bloque con título o foto), la sección pinta el bloque único de siempre.
 *
 * Las claves nuevas no están en el contrato compartido (`v2/contrato/seccionesTienda.ts`, copia
 * byte a byte del ERP): se leen aquí y cada componente las suma a su `CONTENT_KEYS`.
 */
import { MAX_BLOQUES_COLOR, normalizarBloqueColor, type BloqueColor } from '@/lib/website/v2/contrato/seccionesTienda'

// ─── 1. «Lista de texto» ─────────────────────────────────────────────────────────────────────

export const ESTILO_CATEGORIA_LISTA_TEXTO = 'text_list' as const

/**
 * Contenedor de la fila de palabras. Celular: un carril que se desliza (sin partir); escritorio:
 * filas que se parten, centradas salvo `align: 'left'` (la regla de las pastillas).
 */
export function clasesListaTexto(align: unknown): string {
  const centro = align === 'left' ? '' : ' md:justify-center'
  return `flex gap-x-6 gap-y-2 overflow-x-auto whitespace-nowrap pb-2 md:flex-wrap md:whitespace-normal${centro}`
}

// ─── 2. Etiquetas de Antes/Después ───────────────────────────────────────────────────────────

export const CLAVES_ETIQUETAS_ANTES_DESPUES = ['before_label', 'after_label'] as const
export const MAX_ETIQUETA_ANTES_DESPUES = 24

export interface EtiquetasAntesDespues {
  antes: string
  despues: string
}

export const ETIQUETAS_ANTES_DESPUES_POR_DEFECTO: EtiquetasAntesDespues = { antes: 'Antes', despues: 'Después' }

function etiqueta(valor: unknown, porDefecto: string): string {
  if (typeof valor !== 'string') return porDefecto
  const t = valor.replace(/\s+/g, ' ').trim()
  return t ? t.slice(0, MAX_ETIQUETA_ANTES_DESPUES) : porDefecto
}

export function etiquetasAntesDespues(content: Record<string, unknown> | null | undefined): EtiquetasAntesDespues {
  const c = content ?? {}
  return {
    antes: etiqueta(c.before_label, ETIQUETAS_ANTES_DESPUES_POR_DEFECTO.antes),
    despues: etiqueta(c.after_label, ETIQUETAS_ANTES_DESPUES_POR_DEFECTO.despues),
  }
}

// ─── 3. Bloques de color con repetidor ───────────────────────────────────────────────────────

export const CLAVE_BLOQUES_COLOR = 'blocks' as const

/**
 * Los bloques del repetidor que se pintan: los que tienen título o foto, en su orden, máximo
 * `MAX_BLOQUES_COLOR`. `[]` (clave ausente, no lista o todos vacíos) = el bloque único de hoy.
 */
export function bloquesColor(content: Record<string, unknown> | null | undefined): BloqueColor[] {
  const lista = (content ?? {})[CLAVE_BLOQUES_COLOR]
  if (!Array.isArray(lista)) return []
  const salida: BloqueColor[] = []
  for (const item of lista) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const b = normalizarBloqueColor(item as Record<string, unknown>)
    if (!b.title && !b.imageUrl) continue
    salida.push(b)
    if (salida.length >= MAX_BLOQUES_COLOR) break
  }
  return salida
}

/** Columnas de escritorio según cuántos bloques hay (clases literales para Tailwind). */
export function columnasBloquesColor(n: number): string {
  if (n <= 1) return ''
  if (n === 2) return 'md:grid-cols-2'
  if (n === 3) return 'md:grid-cols-3'
  if (n === 4) return 'md:grid-cols-2 lg:grid-cols-4'
  return 'md:grid-cols-3 lg:grid-cols-5'
}
