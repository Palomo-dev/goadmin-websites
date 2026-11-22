/**
 * Títulos y rejilla de las columnas del pie (SiteFooter y PieTema). Lógica pura, sin React.
 *
 * Problema que resuelve (org 358 y otras, 2026-11-21): todas las columnas de enlaces salían con el
 * título fijo «Enlaces», un menú del pie sin enlaces se pintaba como columna vacía y la rejilla iba
 * fija por `footer_columns` (lg:grid-cols-4), así que la columna legal caía a una segunda fila.
 *
 * Reglas:
 * - Título de cada menú: el nombre guardado en el documento (`menus[].nombre`, editable en el ERP en
 *   Sitio web › Editor › Pie de página › Contenido › Menús del pie › Editar). Nunca se reemplaza lo
 *   que el cliente configuró.
 * - Menú de páginas del pie (`paginas-pie`): si no tiene nombre o sigue con el que puso el
 *   importador («Páginas del pie», un nombre interno), sale «Tienda».
 * - Un menú sin enlaces no se pinta.
 * - La rejilla se calcula con las columnas que de verdad se pintan (marca + columnas con
 *   contenido): sin huecos y sin filas de más (ver columnasRejillaPie sobre `footer_columns`).
 */

/** Nombre que el importador (ERP importadorLegacy.ts) pone al menú `paginas-pie`. */
export const NOMBRE_IMPORTADO_PAGINAS_PIE = 'Páginas del pie'

/** Título del menú de páginas del pie cuando el cliente no le puso nombre propio. */
export const TITULO_PAGINAS_PIE_POR_DEFECTO = 'Tienda'

/** Último recurso para un menú nombrado sin nombre (el editor no lo permite, pero el JSON sí). */
export const TITULO_MENU_SIN_NOMBRE = 'Enlaces'

/** Columnas de la rejilla del pie en escritorio como máximo (más no caben en el contenedor). */
export const MAX_COLUMNAS_PIE = 6

const limpio = (nombre: unknown): string => (typeof nombre === 'string' ? nombre.trim() : '')

/** Título de la columna del menú de páginas del pie (`paginas-pie` / footerPaginas). */
export function tituloPaginasPie(nombre: string | null | undefined): string {
  const n = limpio(nombre)
  if (!n || n.toLocaleLowerCase('es') === NOMBRE_IMPORTADO_PAGINAS_PIE.toLocaleLowerCase('es')) {
    return TITULO_PAGINAS_PIE_POR_DEFECTO
  }
  return n
}

/** Título de un menú nombrado del pie: su propio nombre. */
export function tituloMenuPie(nombre: string | null | undefined): string {
  return limpio(nombre) || TITULO_MENU_SIN_NOMBRE
}

export interface MenuPieEntrada<I> {
  name: string | null | undefined
  footer_column?: number | null
  items: I[]
}

export interface ColumnaMenuPie<E> {
  columna: number
  titulo: string
  enlaces: E[]
}

/**
 * Agrupa los menús del pie por `footer_column` (V2: uno por columna; legacy puede compartir) y
 * descarta las columnas sin enlaces. El título de una columna es el nombre del primer menú de esa
 * columna que tiene enlaces. Orden: por número de columna.
 */
export function columnasMenusPie<I, E>(
  menus: MenuPieEntrada<I>[] | null | undefined,
  enlacesDe: (items: I[]) => E[],
): ColumnaMenuPie<E>[] {
  const porColumna = new Map<number, ColumnaMenuPie<E>>()
  for (const menu of menus ?? []) {
    const enlaces = enlacesDe(menu.items ?? [])
    if (enlaces.length === 0) continue
    const col = menu.footer_column ?? 1
    const existente = porColumna.get(col)
    if (existente) existente.enlaces.push(...enlaces)
    else porColumna.set(col, { columna: col, titulo: tituloMenuPie(menu.name), enlaces: [...enlaces] })
  }
  return Array.from(porColumna.values()).sort((a, b) => a.columna - b.columna)
}

/**
 * Columnas de la rejilla en escritorio para `pintadas` columnas: exactamente las pintadas (sin
 * huecos ni fila de más), hasta MAX_COLUMNAS_PIE.
 *
 * `footer_columns` (2, 3 o 4 en el editor) sigue guardándose y editándose igual, pero no reparte en
 * filas: con 4 pedidas y 5 con contenido, la quinta quedaba sola abajo (la legal, en org 358). Con
 * menos columnas con contenido que las pedidas, la rejilla se ajusta a las que hay (sin huecos).
 */
export function columnasRejillaPie(pintadas: number): number {
  return Math.max(1, Math.min(Math.floor(pintadas) || 1, MAX_COLUMNAS_PIE))
}

// Literales completos: Tailwind solo emite las clases que encuentra escritas (lib/ está en content).
const LG: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
}
const MD: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
}

/** Rejilla del pie «default»: celular 1 columna, tableta 2 (1 si solo hay una), escritorio las pintadas. */
export function claseRejillaPie(pintadas: number): string {
  const lg = columnasRejillaPie(pintadas)
  const md = Math.min(lg, 2)
  return `grid grid-cols-1 ${MD[md]} ${LG[lg]} gap-8 md:gap-12`
}

/** Rejilla de «three_columns» (marca | páginas | contacto): las que se pinten, hasta 3, desde tableta. */
export function claseRejillaTresColumnas(pintadas: number): string {
  const n = Math.max(1, Math.min(Math.floor(pintadas) || 1, 3))
  return `grid grid-cols-1 ${MD[n]} gap-8`
}
