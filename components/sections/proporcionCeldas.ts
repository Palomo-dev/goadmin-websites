/**
 * «Proporción» (`aspect_ratio` de GRID_FIELDS) de las celdas de una lista: testimonios, galería,
 * FAQ, estadísticas, características y por qué elegirnos. `auto` o sin clave = como hoy.
 * Solo para rejillas: en listas a todo el ancho (FAQ, testimonios Minimal/Quotes, StatsInline) no se
 * aplica, porque cada fila mediría lo mismo que el ancho. `min-h-min` (min-content) deja crecer la
 * celda si el texto no cabe, también en tarjetas con overflow-hidden.
 */
const HIJOS: Record<string, string> = {
  '1/1': '[&>*]:aspect-square [&>*]:min-h-min',
  '4/3': '[&>*]:aspect-[4/3] [&>*]:min-h-min',
  '3/4': '[&>*]:aspect-[3/4] [&>*]:min-h-min',
  '16/9': '[&>*]:aspect-video [&>*]:min-h-min',
  '3/1': '[&>*]:aspect-[3/1] [&>*]:min-h-min',
}
const CELDA: Record<string, string> = {
  '1/1': 'aspect-square min-h-min',
  '4/3': 'aspect-[4/3] min-h-min',
  '3/4': 'aspect-[3/4] min-h-min',
  '16/9': 'aspect-video min-h-min',
  '3/1': 'aspect-[3/1] min-h-min',
}

function clave(content: unknown): string | null {
  const v = (content as { aspect_ratio?: unknown } | null | undefined)?.aspect_ratio
  return typeof v === 'string' && v in CELDA ? v : null
}

/** Clase para el contenedor de la lista: da la proporción a cada hijo. '' sin clave. */
export function proporcionHijos(content: unknown): string {
  const k = clave(content)
  return k ? HIJOS[k] : ''
}

/** Clase para una celda concreta, o el respaldo de siempre si no hay clave. */
export function proporcionCelda(content: unknown, respaldo: string): string {
  const k = clave(content)
  return k ? CELDA[k] : respaldo
}

/** Celda de la lista del inspector (cada `data-lista-item`): proporción y la tarjeta a toda la altura. */
export function proporcionEnvoltorio(content: unknown): string {
  const k = clave(content)
  return k ? `${CELDA[k]} [&>*]:h-full` : ''
}
