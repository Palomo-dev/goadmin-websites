/**
 * Cabeceras de caché de los catálogos de ubicación (/api/locations/states y /cities).
 *
 * - Vacío: `no-store`. Una lista vacía casi siempre es un estado transitorio (tabla recién
 *   restaurada, sin cargar): nunca se guarda en el CDN ni en el navegador.
 * - Con datos: el CDN la puede servir una hora (y una más mientras revalida). Es el mismo
 *   catálogo para todas las tiendas y cambia muy rara vez, así que ahorra consultas a la base.
 *
 * La Data Cache de Next no entra aquí: las rutas declaran `revalidate = 0` y
 * `fetchCache = 'force-no-store'`, y `createPublicClient` pide `cache: 'no-store'`.
 */
export const SIN_CACHE = { 'Cache-Control': 'no-store' } as const

export function cabecerasCatalogo(filas: number): Record<string, string> {
  if (filas === 0) return { ...SIN_CACHE }
  return { 'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=3600' }
}
