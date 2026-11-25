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
import { estiloDeHeaderLayout, normalizarOpcionShell } from './v2/mapeoAjustes'

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

/** Una subcategoría de la fila (el ícono es el mismo que pinta el menú del celular). */
export interface HijoCategoria {
  clave: string
  nombre: string
  href: string
  icono: string | null
}

/** Una fila del desplegable: categoría raíz (o ítem del mega menú) con sus hijos. */
export interface EntradaCategoria {
  clave: string
  nombre: string
  href: string
  icono: string | null
  color: string | null
  imagen: string | null
  hijos: HijoCategoria[]
}

/**
 * Nodo del árbol de categorías de la tienda (`getMenuCategories`): solo activas, con la regla de
 * sede de la tienda y los hijos (parent_id) ya en el orden de la tienda (display_order, rank).
 */
export interface CategoriaMenu {
  id: number | string
  name: string
  slug: string
  icon?: string | null
  color?: string | null
  image_url?: string | null
  children?: CategoriaMenu[]
}

/**
 * Ítem del mega menú tal como sale del servidor (lib/get-org-context.ts). `categoriaId` marca los
 * ítems de categoría; `color` e `imagen` los pone `completarMenuMega` desde la categoría.
 */
export interface ItemMenu {
  name: string
  href: string
  icon?: string | null
  badge?: string | null
  color?: string | null
  imagen?: string | null
  categoriaId?: number | null
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
    hijos: (c.children ?? []).map((h) => ({ clave: `c${h.id}`, nombre: h.name, href: ruta(`/categorias/${h.slug}`), icono: h.icon ?? null })),
  }))
}

/** Ítems del mega menú configurado en el editor → filas (los enlaces van tal cual). */
export function entradasDesdeMenu(items: readonly ItemMenu[]): EntradaCategoria[] {
  return items.map((it, i) => ({
    clave: `m${i}`,
    nombre: it.name,
    href: it.href,
    icono: it.icon ?? null,
    color: it.color ?? null,
    imagen: it.imagen ?? null,
    hijos: (it.children ?? []).map((h, j) => ({ clave: `m${i}-${j}`, nombre: h.name, href: h.href, icono: h.icon ?? null })),
  }))
}

/**
 * Completa los ítems de categoría del mega menú con la categoría real de la tienda (reporte de
 * soporte 2026-11-25: salían planos y sin ícono, porque el menú solo traía id, nombre y slug).
 *
 * `arbol` es el MISMO árbol de categorías de la tienda que ya carga getOrgContext
 * (`getMenuCategories`, cacheado): activas y con la regla de sede de la tienda. Ninguna consulta
 * nueva, nada por ítem.
 * - Ícono, color e imagen de la categoría. Un ícono propio del ítem (menú legacy) manda.
 * - Sin hijos puestos a mano en el editor: sus subcategorías activas (parent_id), en el orden de
 *   la tienda. Con hijos a mano: esos, tal cual (sin los de categorías inactivas).
 * - Categoría que no está en el árbol (inactiva, de otra sede o borrada): el ítem no sale.
 * - Nombre, enlace, orden y los ítems que no son categorías: como los dejó el editor.
 * - Árbol vacío (tienda sin categorías activas o lectura fallida): los ítems tal cual, como antes.
 */
export function completarMenuMega<T extends ItemMenu>(items: readonly T[], arbol: readonly CategoriaMenu[] | null | undefined): T[] {
  if (!arbol || arbol.length === 0) return [...items]
  const porId = new Map<number, CategoriaMenu>()
  const indexar = (nodos: readonly CategoriaMenu[]) => {
    for (const n of nodos) {
      porId.set(Number(n.id), n)
      if (n.children) indexar(n.children)
    }
  }
  indexar(arbol)
  const hija = (c: CategoriaMenu): ItemMenu => ({
    name: c.name,
    href: `/categorias/${c.slug}`,
    icon: c.icon ?? undefined,
    color: c.color ?? undefined,
    imagen: c.image_url ?? undefined,
    categoriaId: Number(c.id),
  })
  const completar = (it: ItemMenu): ItemMenu | null => {
    const manuales = it.children ?? []
    const propios = manuales.map(completar).filter((h): h is ItemMenu => h !== null)
    if (it.categoriaId === null || it.categoriaId === undefined) {
      return manuales.length > 0 ? { ...it, children: propios.length > 0 ? propios : undefined } : it
    }
    const cat = porId.get(Number(it.categoriaId))
    if (!cat) return null
    const hijos = manuales.length > 0 ? propios : (cat.children ?? []).map(hija)
    return {
      ...it,
      icon: it.icon || cat.icon || undefined,
      color: cat.color || undefined,
      imagen: cat.image_url || undefined,
      children: hijos.length > 0 ? hijos : undefined,
    }
  }
  return items.map(completar).filter((it): it is ItemMenu => it !== null) as T[]
}

/**
 * ¿La cabecera usa el mega menú del editor? Solo con la composición «mega» (HeaderMega), igual que
 * siempre: el editor lo explica en esa composición y las demás nunca lo pintaron. Misma regla que
 * SiteHeader para elegir la variante.
 */
export function usaMenuMega(ajustes: Ajustes): boolean {
  const estilo = estiloDeHeaderLayout(ajustes?.header_layout) || ajustes?.header_style || 'default'
  return estilo === 'mega'
}

/**
 * Las categorías de la cabecera: UNA fuente para el botón de computador (todas las composiciones),
 * el menú del celular (cajón, pantalla completa, configurable), el encabezado mínimo y la hoja de
 * categorías (pestañas y menú inferior).
 * - Composición mega con mega menú: sus ítems (ya completados con `completarMenuMega`).
 * - Si no: el árbol de categorías de la tienda, con `show_categories_in_header` encendido (la hoja
 *   de categorías, que el comprador abre a propósito, pasa `sinAjuste`: lo de antes).
 */
export function entradasCategoriasCabecera(
  ajustes: Ajustes,
  categorias: readonly CategoriaMenu[] | null | undefined,
  itemsMega: readonly ItemMenu[] | null | undefined,
  ruta?: (p: string) => string,
  opciones: { sinAjuste?: boolean } = {},
): EntradaCategoria[] {
  if (itemsMega && itemsMega.length > 0 && usaMenuMega(ajustes)) return entradasDesdeMenu(itemsMega)
  if ((opciones.sinAjuste || ajustes?.show_categories_in_header === true) && categorias && categorias.length > 0) {
    return entradasDesdeCategorias(categorias, ruta)
  }
  return []
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
  const entradas = entradasCategoriasCabecera(ajustes, categorias, itemsMega, ruta)
  return entradas.length > 0 ? { texto, entradas } : null
}

/** Ítem de navegación de las categorías (forma de NavItem de HeaderShared). */
export interface ItemNavCategorias {
  name: string
  href: string
  icon?: string | null
  children?: ItemNavCategorias[]
}

/**
 * Ítem «Categorías» del menú del celular y del encabezado mínimo, con las mismas filas que el botón
 * (cada categoría con su ícono y, si tiene, sus subcategorías). `null` si no hay nada que listar.
 * Los enlaces van sin prefijo de sede, como siempre (los del mega menú ya lo traen).
 */
export function itemCategoriasMenu(
  ajustes: Ajustes,
  categorias: readonly CategoriaMenu[] | null | undefined,
  itemsMega: readonly ItemMenu[] | null | undefined,
): ItemNavCategorias | null {
  const entradas = entradasCategoriasCabecera(ajustes, categorias, itemsMega)
  if (entradas.length === 0) return null
  return {
    name: 'Categorías',
    href: '/categorias',
    children: entradas.map((e) => ({
      name: e.nombre,
      href: e.href,
      icon: e.icono,
      // Subcategorías: la padre se despliega dentro del menú (SubmenuCategoria).
      ...(e.hijos.length > 0 ? { children: e.hijos.map((h) => ({ name: h.nombre, href: h.href, icon: h.icono })) } : {}),
    })),
  }
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
