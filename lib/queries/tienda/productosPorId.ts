/**
 * Datos de las secciones nuevas de tienda (paquete W6, PLANO §3): los productos que eligen por id
 * `product_index · list`, `product_anatomy · default` y `shop_the_look · hotspots`, y las
 * categorías de `link_cloud · pills`.
 *
 * Rendimiento (CLAUDE.md, incidente 2026-09-14): solo consulta si la página tiene la sección, una
 * vez por render para TODAS las secciones juntas, y con la caché del catálogo por organización.
 * - Ids → `getProductsByIdsCatalog`: la misma consulta de favoritos, re-pedidos y
 *   `signature_dishes` (organización + sede + carta de la sede, `react.cache` + `cacheCatalog`
 *   con la etiqueta `catalogo-<org>`). No es una segunda versión de la lectura de productos.
 *   Los ids que ya vinieron en `data.products` no se vuelven a pedir.
 * - Índice sin ids y sin listado precargado → `getOrganizationProductsConEstado` (24, cacheada).
 * - Nube por categorías sin `data.categories` → `getOrganizationCategories` (cacheada, 60 s).
 *
 * `organizationId` sale del host (getOrgContext), nunca del contenido de la sección. Los
 * productos se filtran por esa organización y `status='active'` dentro de la consulta de siempre.
 *
 * Servidor: importa `lib/supabase/queries` (service role). Los componentes NO importan este
 * archivo: leen `data.productosTienda` con las ayudas puras de `components/sections/tienda/datosTienda.ts`.
 */

import { getOrganizationCategories, getOrganizationProductsConEstado, getProductsByIdsCatalog } from '@/lib/supabase/queries'
import {
  idsProductosTienda,
  LISTADO_INDICE_SIN_IDS,
  pideCategorias,
  pideListadoGeneral,
  type SeccionPagina,
} from '@/components/sections/tienda/datosTienda'

/**
 * Columnas de `products` que leen las secciones de W6 (además de precio e imágenes). Todas vienen
 * en el `*` de `getProductsByIds` y en `PRODUCT_LIST_COLUMNS`; `scripts/verify-secciones-tienda.mjs`
 * las pide contra el esquema real. Verificadas por MCP (taqjemqjtumhwptchcxk) el 2026-11-07.
 */
export const COLUMNAS_PRODUCTO_TIENDA = ['id', 'uuid', 'name', 'category_id', 'is_parent', 'length_cm', 'width_cm', 'height_cm'] as const

/** Lo que agrega a `data`. Solo las claves que hizo falta cargar. */
export interface DatosSeccionesTienda {
  productosTienda?: any[]
  products?: any[]
  categories?: any[]
}

function ids(lista: unknown): Set<number> {
  return new Set(Array.isArray(lista) ? lista.map((p: { id?: unknown }) => Number(p?.id)).filter((n) => Number.isInteger(n)) : [])
}

/**
 * Carga lo que piden las secciones de W6 de la página. Sin ninguna de ellas no consulta nada y
 * devuelve `{}` (la página queda igual que hoy). `data` es lo que la página ya precargó.
 */
export async function cargarDatosSeccionesTienda(
  organizationId: number,
  branchId: number | null | undefined,
  secciones: readonly SeccionPagina[],
  data: { products?: unknown; categories?: unknown },
): Promise<DatosSeccionesTienda> {
  const salida: DatosSeccionesTienda = {}
  const yaCargados = ids(data.products)
  const faltan = idsProductosTienda(secciones).filter((id) => !yaCargados.has(id))
  const sinListado = !Array.isArray(data.products) && pideListadoGeneral(secciones)
  const sinCategorias = !Array.isArray(data.categories) && pideCategorias(secciones)

  const [porId, listado, categorias] = await Promise.all([
    faltan.length > 0 ? getProductsByIdsCatalog(faltan, organizationId, branchId) : null,
    sinListado ? getOrganizationProductsConEstado(organizationId, LISTADO_INDICE_SIN_IDS, branchId) : null,
    sinCategorias ? getOrganizationCategories(organizationId, branchId) : null,
  ])
  if (porId) salida.productosTienda = porId
  else {
    // Nada que pedir por id: la sección resuelve con `data.products`.
  }
  if (listado && !listado.error) salida.products = listado.products
  else {
    // Sin listado (no hacía falta o falló): el índice sin ids no se pinta.
  }
  if (categorias) salida.categories = categorias
  else {
    // Categorías ya cargadas por la página, o ninguna nube por categorías.
  }
  return salida
}
