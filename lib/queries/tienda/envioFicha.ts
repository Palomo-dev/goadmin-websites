/**
 * Zonas de envío activas de la organización, para la línea corta de envío junto al botón de la
 * ficha (pestañas de la ficha, Figma «Ficha — pestañas reales» 3255-99475): promesa de entrega y
 * envío gratis. La regla está en `resumenEnvioFicha` (components/sections/product-detail/anclasFicha.ts).
 *
 * Rendimiento: solo se consulta si la ficha tiene la pestaña «Envío y devoluciones» (lo decide
 * `app/productos/[id]/page.tsx`), una vez por render (`react.cache`) y con la caché estructural
 * (5 min): las zonas cambian cuando el comercio las edita, no por visita.
 *
 * Columnas verificadas por MCP (proyecto taqjemqjtumhwptchcxk, 2026-11-25): `shipping_zones.
 * organization_id`, `is_active`, `promise_min_minutes`, `promise_max_minutes`, `free_shipping_from`.
 */

import { cache } from 'react'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { cacheStructural, SETTINGS_TTL } from '@/lib/supabase/cache'
import type { PromesaZona } from '@/components/sections/product-detail/anclasFicha'

export const SELECT_ZONAS_ENVIO_FICHA = 'promise_min_minutes, promise_max_minutes, free_shipping_from'

async function getZonasEnvioFichaUncached(organizationId: number): Promise<PromesaZona[]> {
  const supabase = createAdminClient() || createPublicClient()
  const { data, error } = await (supabase as any)
    .from('shipping_zones')
    .select(SELECT_ZONAS_ENVIO_FICHA)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .limit(200)
  // Lanzar para que la caché NO guarde el fallo; quien llama pinta la ficha sin esos datos.
  if (error) throw new Error(error.message || 'shipping_zones')
  return ((data || []) as { promise_min_minutes: number | null; promise_max_minutes: number | null; free_shipping_from: number | string | null }[])
    .map((z) => ({
      min_minutos: z.promise_min_minutes ?? null,
      max_minutos: z.promise_max_minutes ?? null,
      envio_gratis_desde: z.free_shipping_from === null || z.free_shipping_from === undefined ? null : Number(z.free_shipping_from),
    }))
}

const getZonasEnvioFichaCacheado = cacheStructural('getZonasEnvioFicha', getZonasEnvioFichaUncached, SETTINGS_TTL)

/** Zonas activas (promesa y envío gratis). Nunca lanza: con error, `null` (la línea usa lo del sitio). */
export const getZonasEnvioFicha = cache(async (organizationId: number): Promise<PromesaZona[] | null> => {
  try {
    return await getZonasEnvioFichaCacheado(organizationId)
  } catch {
    return null
  }
})
