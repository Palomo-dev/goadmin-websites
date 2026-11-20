/**
 * Botón «Todas las categorías» del encabezado, estilo marketplace (Figma «16 Sitio web»
 * 2689:57377, aprobado el 2026-11-19).
 *
 * - Computador: botón con el color primario a la izquierda de la barra de menú; abre la lista
 *   vertical de categorías (con sus subcategorías a la derecha). Reemplaza al «Categorías ⌄» que
 *   iba al final del menú.
 * - Celular y encabezado mínimo: sin botón en la barra; el ítem de categorías pasa a ser el
 *   primero del menú, con el texto del botón.
 * - Editor › Encabezado: `header_categories_button` (encendido por defecto) y
 *   `header_categories_button_text`. Apagado = lo de antes. Viven en el documento V2
 *   (`shell.header.opciones`), sin columna nueva.
 *
 * Puro: servidor, navegador y scripts/verify-boton-categorias.mjs.
 */
import { normalizarOpcionShell } from './v2/mapeoAjustes'

export const TEXTO_BOTON_CATEGORIAS = 'Todas las categorías'

type Ajustes = Record<string, unknown> | null | undefined

export interface OpcionBotonCategorias {
  activo: boolean
  texto: string
}

/** Interruptor y texto del botón, ya validados por el contrato (sin clave: encendido, texto por defecto). */
export function opcionBotonCategorias(ajustes: Ajustes): OpcionBotonCategorias {
  const activo = normalizarOpcionShell('header_categories_button', ajustes?.header_categories_button) !== false
  const texto = normalizarOpcionShell('header_categories_button_text', ajustes?.header_categories_button_text)
  return { activo, texto: typeof texto === 'string' && texto ? texto : TEXTO_BOTON_CATEGORIAS }
}

/** Una fila del desplegable: categoría raíz (o ítem del mega menú) con sus hijos. */
export interface EntradaCategoria {
  clave: string
  nombre: string
  href: string
  icono: string | null
  color: string | null
  imagen: string | null
  hijos: { clave: string; nombre: string; href: string }[]
}

interface CategoriaMenu {
  id: number | string
  name: string
  slug: string
  icon?: string | null
  color?: string | null
  image_url?: string | null
  children?: CategoriaMenu[]
}

interface ItemMenu {
  name: string
  href: string
  icon?: string | null
  children?: ItemMenu[]
}

/** Categorías de la tienda (ya en el orden de la tienda) → filas, con `ruta` para el sitio de una sede. */
export function entradasDesdeCategorias(categorias: readonly CategoriaMenu[], ruta: (p: string) => string = (p) => p): EntradaCategoria[] {
  return categorias.map((c) => ({
    clave: `c${c.id}`,
    nombre: c.name,
    href: ruta(`/categorias/${c.slug}`),
    icono: c.icon ?? null,
    color: c.color ?? null,
    imagen: c.image_url ?? null,
    hijos: (c.children ?? []).map((h) => ({ clave: `c${h.id}`, nombre: h.name, href: ruta(`/categorias/${h.slug}`) })),
  }))
}

/** Ítems del mega menú configurado en el editor → filas (los enlaces van tal cual). */
export function entradasDesdeMenu(items: readonly ItemMenu[]): EntradaCategoria[] {
  return items.map((it, i) => ({
    clave: `m${i}`,
    nombre: it.name,
    href: it.href,
    icono: it.icon ?? null,
    color: null,
    imagen: null,
    hijos: (it.children ?? []).map((h, j) => ({ clave: `m${i}-${j}`, nombre: h.name, href: h.href })),
  }))
}

/**
 * Qué muestra el botón en la barra de computador, o `null` si no va (apagado o sin nada que listar).
 * Mismas fuentes que el «Categorías ⌄» de antes: el mega menú del editor si tiene ítems; si no, las
 * categorías de la tienda cuando `show_categories_in_header` está encendido.
 */
export function botonCategoriasBarra(
  ajustes: Ajustes,
  categorias: readonly CategoriaMenu[] | null | undefined,
  itemsMega: readonly ItemMenu[] | null | undefined,
  ruta?: (p: string) => string,
): { texto: string; entradas: EntradaCategoria[] } | null {
  const { activo, texto } = opcionBotonCategorias(ajustes)
  if (!activo) return null
  if (itemsMega && itemsMega.length > 0) return { texto, entradas: entradasDesdeMenu(itemsMega) }
  if (ajustes?.show_categories_in_header === true && categorias && categorias.length > 0) {
    return { texto, entradas: entradasDesdeCategorias(categorias, ruta) }
  }
  return null
}

/**
 * Menú del celular o del encabezado mínimo: con el botón encendido, el ítem de categorías va de
 * primero y con el texto del botón; apagado, al final como «Categorías» (lo de antes).
 */
export function menuConCategorias<T extends { name: string }>(items: readonly T[], categorias: T | null, ajustes: Ajustes): T[] {
  if (!categorias) return [...items]
  const { activo, texto } = opcionBotonCategorias(ajustes)
  return activo ? [{ ...categorias, name: texto }, ...items] : [...items, categorias]
}

/** Texto blanco o casi negro sobre `fondo` (#RGB o #RRGGBB), el de mejor contraste; otro formato: blanco. */
export function colorTextoSobre(fondo: string | null | undefined): '#FFFFFF' | '#111827' {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((fondo || '').trim())
  if (!m) return '#FFFFFF'
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  const canal = (i: number) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const L = 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4)
  // Contraste con blanco (1.05/(L+0.05)) frente a #111827 (L≈0.0123).
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.0623 ? '#FFFFFF' : '#111827'
}
