/**
 * «Proporción» (`aspect_ratio` de GRID_FIELDS) de las celdas de una lista: testimonios, galería,
 * FAQ, estadísticas, características y por qué elegirnos. `auto` o sin clave = como hoy.
 * Las clases son literales para que Tailwind las genere. Con `aspect-ratio` la celda crece si el
 * texto no cabe (min-height automática), así nunca se corta contenido.
 */
const HIJOS: Record<string, string> = {
  '1/1': '[&>*]:aspect-square',
  '4/3': '[&>*]:aspect-[4/3]',
  '3/4': '[&>*]:aspect-[3/4]',
  '16/9': '[&>*]:aspect-video',
  '3/1': '[&>*]:aspect-[3/1]',
}
const CELDA: Record<string, string> = {
  '1/1': 'aspect-square',
  '4/3': 'aspect-[4/3]',
  '3/4': 'aspect-[3/4]',
  '16/9': 'aspect-video',
  '3/1': 'aspect-[3/1]',
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
