/**
 * Lectura de los ajustes del sitio (./ajustesSitio.ts) en el servidor.
 *
 * NO hace consultas nuevas: reutiliza `getOrgSettings` (lib/outlet/theme-merge.ts), la misma
 * fila global (`branch_id IS NULL`) que ya lee `getOrgContext` en cada render, con
 * `react.cache` (una vez por petición) y `cacheStructural` (compartida entre peticiones,
 * CONTENT_TTL). Esa lectura es `select('*')`, así que ya trae las columnas nuevas.
 *
 * Por qué la fila global y no los ajustes efectivos de la sede: el ERP escribe estos ajustes
 * solo en la fila global (`update_website_settings` y `fn_sitio_web_guardar_sedes` filtran
 * `branch_id IS NULL`). Son de la organización, no de la sede.
 *
 * Cualquier fallo → los DEFAULT (el comportamiento de antes), con el error registrado.
 */
import { cache } from 'react'
import { getOrgSettings } from '@/lib/outlet/theme-merge'
import { AJUSTES_POR_DEFECTO, ajustesSitioDesdeFila, type AjustesSitio } from './ajustesSitio'

export const getAjustesSitio = cache(async (organizationId: number): Promise<AjustesSitio> => {
  try {
    const fila = await getOrgSettings(organizationId)
    return ajustesSitioDesdeFila(fila as unknown as Record<string, unknown> | null)
  } catch (error) {
    console.error('[ajustes-sitio] No se pudieron leer los ajustes; se sirve lo de siempre', {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    })
    return AJUSTES_POR_DEFECTO
  }
})
