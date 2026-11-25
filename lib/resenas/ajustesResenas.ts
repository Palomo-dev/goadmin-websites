/**
 * Ajustes de reseñas de la tienda («Ajustes de reseñas», Figma 3131-92277). Valen para toda la
 * tienda y viven en `website_settings` (fila principal, `branch_id IS NULL`):
 *
 * | columna                      | NULL significa (= lo de hoy)                      |
 * |------------------------------|---------------------------------------------------|
 * | reviews_default_source       | ejemplos (`generated`); las tiendas nuevas: real   |
 * | reviews_auto_approve         | moderar antes de publicar                          |
 * | reviews_who_can_write        | cualquier cliente                                  |
 * | reviews_allow_photos         | fotos permitidas                                   |
 * | reviews_request_enabled      | sin correo «¿Qué te pareció tu compra?»            |
 * | reviews_request_days         | 7 días después de entregado                        |
 * | reviews_request_reminder     | un recordatorio                                    |
 *
 * Puro (sin red) salvo `cargarAjustesResenas`. Columnas verificadas por MCP (taqjemqjtumhwptchcxk)
 * el 2026-11-25, migración 20261125013000_resenas_reales_flujo del ERP.
 */

import { esOrigenResenas, type OrigenResenas } from '@/lib/website/v2/seccionesFicha'

export type QuienEscribe = 'any' | 'buyers'

export interface AjustesResenas {
  /** Origen cuando la sección no elige uno. `null` = ejemplos, como siempre. */
  origenPorDefecto: OrigenResenas | null
  moderar: boolean
  quienEscribe: QuienEscribe
  fotos: boolean
  correo: { activo: boolean; dias: number; recordatorio: boolean }
}

export const COLUMNAS_AJUSTES_RESENAS =
  'reviews_default_source, reviews_auto_approve, reviews_who_can_write, reviews_allow_photos, reviews_request_enabled, reviews_request_days, reviews_request_reminder'

export const DIAS_CORREO_POR_DEFECTO = 7
export const MAX_FOTOS_RESENA = 3
export const MAX_BYTES_FOTO_RESENA = 5 * 1024 * 1024

export function leerAjustesResenas(fila: Record<string, unknown> | null | undefined): AjustesResenas {
  const f = fila ?? {}
  const dias = Number(f.reviews_request_days)
  return {
    origenPorDefecto: esOrigenResenas(f.reviews_default_source) ? f.reviews_default_source : null,
    moderar: f.reviews_auto_approve !== true,
    quienEscribe: f.reviews_who_can_write === 'buyers' ? 'buyers' : 'any',
    fotos: f.reviews_allow_photos !== false,
    correo: {
      activo: f.reviews_request_enabled === true,
      dias: Number.isInteger(dias) && dias >= 1 && dias <= 30 ? dias : DIAS_CORREO_POR_DEFECTO,
      recordatorio: f.reviews_request_reminder !== false,
    },
  }
}

/**
 * Configuración base de reseñas para la ficha, a partir de los ajustes del sitio
 * (`organization.website_settings`, que se carga con `select('*')`).
 *
 * - `product_reviews` (si algún día existe en los ajustes) manda, como siempre.
 * - Si no, y la tienda tiene `reviews_default_source`, ese origen. Las tiendas anteriores al
 *   2026-11-25 lo tienen en NULL: devuelve `null`, exactamente lo de antes (= ejemplos).
 * - Las claves `quien_escribe`, `fotos_permitidas` y `moderar` solo informan al formulario; el
 *   servidor (`/api/reviews`) las vuelve a leer y es quien decide.
 */
export function configResenasSitio(ajustesSitio: unknown): Record<string, unknown> | null {
  const s = (ajustesSitio ?? null) as Record<string, unknown> | null
  if (!s) return null
  const propia = s.product_reviews
  const a = leerAjustesResenas(s)
  const formulario = { quien_escribe: a.quienEscribe, fotos_permitidas: a.fotos, moderar: a.moderar }
  if (propia && typeof propia === 'object') return { ...(propia as Record<string, unknown>), ...formulario }
  if (a.origenPorDefecto) return { reviews_source: a.origenPorDefecto, ...formulario }
  // Sin origen propio: lo de siempre (el `null` de antes) más lo que el formulario necesita saber.
  return a.quienEscribe === 'any' && a.fotos && a.moderar ? null : formulario
}

type Cliente = { from: (tabla: string) => any }

/** Lee los ajustes de la fila principal. `null` si la lectura falla (quien llama decide). */
export async function cargarAjustesResenas(sb: Cliente, organizationId: number): Promise<AjustesResenas | null> {
  const { data, error } = await sb
    .from('website_settings')
    .select(COLUMNAS_AJUSTES_RESENAS)
    .eq('organization_id', organizationId)
    .is('branch_id', null)
    .maybeSingle()
  if (error) {
    console.error('[resenas] No se pudieron leer los ajustes', { organizationId, error: error.message })
    return null
  }
  return leerAjustesResenas(data)
}
