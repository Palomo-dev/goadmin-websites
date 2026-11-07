/**
 * Datos de las secciones nuevas de tienda del paquete W6 (PLANO §3): qué productos y categorías
 * piden, cómo se resuelven contra lo que la página ya cargó y cuándo una sección no tiene nada
 * real que pintar.
 *
 * Fuentes, en este orden (ninguna se inventa):
 * - `data.productosTienda`: los productos elegidos por id (`lib/queries/tienda/productosPorId.ts`,
 *   una consulta por render, cacheada por organización).
 * - `data.products` / `data.productosCategoria`: el listado que la página ya precargó (500).
 * - `data.categories`: las categorías de la organización (y de la sede).
 *
 * Puro: sin React, Next ni Supabase. Lo usan los componentes (cliente) y el cargador (servidor),
 * y lo prueba `scripts/verify-secciones-tienda.mjs`.
 */

import {
  anatomiaVisible,
  compraElLookVisible,
  normalizarAnatomiaProducto,
  normalizarAntesDespues,
  normalizarColumnasFoto,
  normalizarCompraElLook,
  normalizarIndiceProductos,
  normalizarNubeEnlaces,
  normalizarTarjetasServicio,
  nubeEnlacesVisible,
  PRODUCTOS_INDICE_POR_DEFECTO,
  type EnlaceTienda,
} from '@/lib/website/v2/contrato/seccionesTienda'

type Contenido = Record<string, unknown> | null | undefined
type Producto = Record<string, any>

/** Lo que las secciones leen de `data` (lo pone `app/[[...slug]]/page.tsx`). */
export interface DatosPaginaTienda {
  productosTienda?: unknown
  products?: unknown
  productosCategoria?: unknown
  categories?: unknown
  productsError?: unknown
  listados?: unknown
  prefijoSede?: unknown
  branchId?: unknown
  productsTotal?: unknown
}

/** Sección tal como llega a la página (legacy o V2 ya convertida por `vistaPublica`). */
export interface SeccionPagina {
  section_type: string
  section_variant: string
  content: unknown
  is_visible?: boolean | null
}

/** Tope de ids por página: 12 del índice + 6 del look + 1 de la anatomía, con holgura. */
export const MAX_IDS_TIENDA = 24

/** Productos que se piden para el índice sin `product_ids` cuando la página no trajo el listado. */
export const LISTADO_INDICE_SIN_IDS = 24

function lista(v: unknown): Producto[] {
  return Array.isArray(v) ? (v.filter((p) => p && typeof p === 'object') as Producto[]) : []
}

function contenido(c: unknown): Record<string, unknown> {
  return c && typeof c === 'object' && !Array.isArray(c) ? (c as Record<string, unknown>) : {}
}

function esDe(s: SeccionPagina, tipo: string, variante: string): boolean {
  return s.section_type === tipo && s.section_variant === variante && s.is_visible !== false
}

// ─── Qué piden las secciones de la página ──────────────────────────────────────────────────

/** Ids de producto que eligen el índice, la anatomía y el look (sin repetir, ordenados, tope). */
export function idsProductosTienda(secciones: readonly SeccionPagina[] | null | undefined): number[] {
  const ids = new Set<number>()
  for (const s of secciones ?? []) {
    const c = contenido(s.content)
    if (esDe(s, 'product_index', 'list')) normalizarIndiceProductos(c).productIds.forEach((id) => ids.add(id))
    else if (esDe(s, 'product_anatomy', 'default')) {
      const id = normalizarAnatomiaProducto(c).productId
      if (id !== null) ids.add(id)
    } else if (esDe(s, 'shop_the_look', 'hotspots')) normalizarCompraElLook(c).hotspots.forEach((h) => ids.add(h.productId))
    else {
      // Otra sección: no pide productos por id.
    }
  }
  return Array.from(ids).sort((a, b) => a - b).slice(0, MAX_IDS_TIENDA)
}

/** ¿Hay un índice sin productos elegidos (pinta los primeros con foto del listado)? */
export function pideListadoGeneral(secciones: readonly SeccionPagina[] | null | undefined): boolean {
  return (secciones ?? []).some((s) => esDe(s, 'product_index', 'list') && normalizarIndiceProductos(contenido(s.content)).productIds.length === 0)
}

/** ¿Hay una nube de enlaces que sale de las categorías reales? */
export function pideCategorias(secciones: readonly SeccionPagina[] | null | undefined): boolean {
  return (secciones ?? []).some((s) => esDe(s, 'link_cloud', 'pills') && normalizarNubeEnlaces(contenido(s.content)).source === 'categories')
}

// ─── Resolver contra lo que la página cargó ────────────────────────────────────────────────

/** Producto por id: primero los pedidos por id, luego el listado precargado. `null` si no está. */
export function buscarProducto(data: DatosPaginaTienda | null | undefined, id: number | null | undefined): Producto | null {
  if (id === null || id === undefined) return null
  for (const fuente of [data?.productosTienda, data?.products, data?.productosCategoria]) {
    const p = lista(fuente).find((x) => Number(x.id) === id)
    if (p) return p
  }
  return null
}

/** Productos por ids, en el orden pedido; los que no están (inactivos, de otra sede) se omiten. */
export function productosEnOrden(data: DatosPaginaTienda | null | undefined, ids: readonly number[]): Producto[] {
  const salida: Producto[] = []
  for (const id of ids) {
    const p = buscarProducto(data, id)
    if (p) salida.push(p)
  }
  return salida
}

function tieneFoto(p: Producto): boolean {
  return Array.isArray(p.product_images) && p.product_images.some((img: any) => img && (img.storage_path || img.shared_images?.storage_path))
}

/** Los primeros `n` productos con foto del listado precargado (orden de carga). */
export function primerosConFoto(data: DatosPaginaTienda | null | undefined, n: number): Producto[] {
  const vistos = new Set<number>()
  const salida: Producto[] = []
  for (const p of [...lista(data?.products), ...lista(data?.productosTienda)]) {
    const id = Number(p.id)
    if (vistos.has(id) || !tieneFoto(p)) continue
    vistos.add(id)
    salida.push(p)
    if (salida.length >= n) break
  }
  return salida
}

/** Productos del índice: los elegidos, o sin elección los primeros con foto. */
export function productosIndice(content: Contenido, data: DatosPaginaTienda | null | undefined): Producto[] {
  const n = normalizarIndiceProductos(content)
  return n.productIds.length > 0 ? productosEnOrden(data, n.productIds) : primerosConFoto(data, PRODUCTOS_INDICE_POR_DEFECTO)
}

/** Nombre de la categoría del producto (de `data.categories`; si no, el embed del listado). */
export function nombreCategoria(data: DatosPaginaTienda | null | undefined, producto: Producto): string | null {
  const cat = lista(data?.categories).find((c) => Number(c.id) === Number(producto.category_id))
  const nombre = cat?.name ?? producto.categories?.name
  return typeof nombre === 'string' && nombre.trim() ? nombre.trim() : null
}

/** Enlaces de la nube: los manuales o las categorías reales (con slug), hasta `max`. */
export function enlacesNube(content: Contenido, data: DatosPaginaTienda | null | undefined): EnlaceTienda[] {
  const n = normalizarNubeEnlaces(content)
  if (n.source === 'manual') return n.links.slice(0, n.max)
  const salida: EnlaceTienda[] = []
  for (const c of lista(data?.categories)) {
    const label = typeof c.name === 'string' ? c.name.trim() : ''
    const slug = typeof c.slug === 'string' ? c.slug.trim() : ''
    if (!label || !slug) continue
    salida.push({ label, url: `/categorias/${encodeURIComponent(slug)}` })
    if (salida.length >= n.max) break
  }
  return salida
}

/** Puntos del look cuyo producto existe (sin producto real, el punto no se pinta). */
export function puntosLook(content: Contenido, data: DatosPaginaTienda | null | undefined) {
  return normalizarCompraElLook(content).hotspots
    .map((h) => ({ ...h, producto: buscarProducto(data, h.productId) }))
    .filter((h): h is typeof h & { producto: Producto } => h.producto !== null)
}

// ─── ¿Hay algo real que pintar? ─────────────────────────────────────────────────────────────

export interface SeccionVacia {
  titulo: string
  texto: string
}

/**
 * Motivo por el que una sección de W6 no tiene nada que pintar, o `null` si sí lo tiene.
 * Con motivo, el sitio público no pinta nada (ni el margen de la sección) y la vista previa del
 * editor muestra el aviso. `welcome_popup` nunca se pinta en el flujo: no entra aquí.
 * Otros tipos: `null` (no es asunto de este archivo).
 */
export function motivoSeccionTiendaVacia(tipo: string, variante: string, content: Contenido, data: DatosPaginaTienda | null | undefined): SeccionVacia | null {
  const clave = `${tipo}.${variante}`
  if (clave === 'link_cloud.pills') {
    const n = normalizarNubeEnlaces(content)
    return nubeEnlacesVisible(enlacesNube(content, data).length)
      ? null
      : {
          titulo: 'Nube de enlaces sin suficientes enlaces',
          texto: n.source === 'manual' ? 'Agrega al menos 3 enlaces con texto y destino.' : 'Se arma con tus categorías: hacen falta al menos 3.',
        }
  }
  if (clave === 'service_cards.over_image') {
    return normalizarTarjetasServicio(content).cards.length > 0 ? null : { titulo: 'Tarjetas sin contenido', texto: 'Agrega una tarjeta con título, enlaces o beneficios.' }
  }
  if (clave === 'features_grid.photo_columns') {
    return normalizarColumnasFoto(content).items.length > 0 ? null : { titulo: 'Columnas sin contenido', texto: 'Agrega columnas con foto, título o texto.' }
  }
  if (clave === 'transformation.slider') {
    return normalizarAntesDespues(content).items.length > 0 ? null : { titulo: 'Antes y después sin fotos', texto: 'Agrega un par con la foto de antes y la de después.' }
  }
  if (clave === 'shop_the_look.hotspots') {
    const l = normalizarCompraElLook(content)
    return compraElLookVisible(l) && puntosLook(content, data).length > 0 ? null : { titulo: 'Compra el look incompleto', texto: 'Agrega la foto y al menos un punto con un producto activo.' }
  }
  if (clave === 'product_index.list') {
    return productosIndice(content, data).length > 0 ? null : { titulo: 'Índice sin productos', texto: 'Elige productos activos o publica productos con foto.' }
  }
  if (clave === 'product_anatomy.default') {
    const a = normalizarAnatomiaProducto(content)
    return anatomiaVisible(a) && buscarProducto(data, a.productId) ? null : { titulo: 'Anatomía incompleta', texto: 'Elige un producto activo y agrega al menos un detalle.' }
  }
  if (clave === 'products_grid.editorial') {
    return null // La rejilla decide con su listado (filtros del visitante incluidos).
  }
  return null
}
