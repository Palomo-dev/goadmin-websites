/**
 * Píxeles tipados y «Ocultar de los buscadores» de Sitio web › Analítica / SEO y redes del ERP.
 *
 * Columnas de `website_settings` (fila del principal, `branch_id IS NULL`, que es la que escribe
 * el ERP en `/api/sitio-web/analitica/pixeles` y `/api/sitio-web/seo`): `meta_pixel_id`,
 * `gtm_id`, `google_ads_id`, `tiktok_pixel_id` y `search_noindex`. Las crea la migración
 * pendiente 20261008090000_seoanalitica_pixeles_noindex del ERP. GA4 sigue en `analytics_id`,
 * que ya se lee con los ajustes.
 *
 * Mientras la migración no esté aplicada la consulta falla con 42703 (columna inexistente) y se
 * devuelve VACIO: la web hace exactamente lo de hoy (píxeles de las integraciones, indexable).
 * El veredicto se cachea como todo lo estructural (SETTINGS_TTL), así que no hay una consulta
 * fallida por visita.
 *
 * Validación de formato: la misma de los CHECK de la migración. Un valor que no la cumpla no se
 * pinta (nunca se interpola en un <script> un texto sin validar).
 */
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/server'
import { cacheStructural, SETTINGS_TTL } from '@/lib/supabase/cache'

export interface PixelesSitio {
  metaPixelId: string | null
  gtmId: string | null
  googleAdsId: string | null
  tiktokPixelId: string | null
  /** «Ocultar de los buscadores»: el sitio se ve, pero pide noindex. */
  noindex: boolean
}

export const PIXELES_VACIO: PixelesSitio = { metaPixelId: null, gtmId: null, googleAdsId: null, tiktokPixelId: null, noindex: false }

/** Columnas que lee esta función (verify-sitio-publico las ejecuta contra la base). */
export const COLUMNAS_PIXELES = 'meta_pixel_id, gtm_id, google_ads_id, tiktok_pixel_id, search_noindex'

/** Mismos patrones que los CHECK de 20261008090000. */
export const FORMATO_PIXEL = {
  meta: /^[0-9]{8,20}$/,
  gtm: /^GTM-[A-Z0-9]{4,12}$/,
  googleAds: /^AW-[0-9]{6,15}$/,
  tiktok: /^[A-Z0-9]{15,25}$/,
} as const

function conFormato(valor: unknown, formato: RegExp): string | null {
  return typeof valor === 'string' && formato.test(valor.trim()) ? valor.trim() : null
}

/** Fila cruda → píxeles validados (puro). */
export function pixelesDesdeFila(fila: Record<string, unknown> | null | undefined): PixelesSitio {
  if (!fila) return PIXELES_VACIO
  return {
    metaPixelId: conFormato(fila.meta_pixel_id, FORMATO_PIXEL.meta),
    gtmId: conFormato(fila.gtm_id, FORMATO_PIXEL.gtm),
    googleAdsId: conFormato(fila.google_ads_id, FORMATO_PIXEL.googleAds),
    tiktokPixelId: conFormato(fila.tiktok_pixel_id, FORMATO_PIXEL.tiktok),
    noindex: fila.search_noindex === true,
  }
}

async function getPixelesSitioSinCache(organizationId: number): Promise<PixelesSitio> {
  const supabase = createAdminClient()
  if (!supabase) return PIXELES_VACIO
  const { data, error } = await (supabase as any)
    .from('website_settings')
    .select(COLUMNAS_PIXELES)
    .eq('organization_id', organizationId)
    .is('branch_id', null)
    .limit(1)
    .maybeSingle()
  if (error) {
    // Migración aún sin aplicar: comportamiento de hoy, y se cachea.
    if (error.code === '42703' || /does not exist/i.test(error.message || '')) return PIXELES_VACIO
    // Otro fallo: lanzar para que unstable_cache NO lo guarde; quien llama cae a VACIO.
    throw new Error(`website_settings (píxeles): ${error.message || error.code}`)
  }
  return pixelesDesdeFila(data as Record<string, unknown> | null)
}

const getPixelesSitioCacheada = cacheStructural('getPixelesSitio', getPixelesSitioSinCache, SETTINGS_TTL)

/** Píxeles y noindex del sitio. Cacheado entre peticiones y deduplicado en la misma (react.cache). */
export const getPixelesSitio = cache(async (organizationId: number): Promise<PixelesSitio> => {
  try {
    return await getPixelesSitioCacheada(organizationId)
  } catch (error) {
    console.error('[seo] No se pudieron leer los píxeles del sitio; se sigue sin ellos', {
      organizationId, error: error instanceof Error ? error.message : String(error),
    })
    return PIXELES_VACIO
  }
})
