/**
 * Píxeles tipados y «Ocultar de los buscadores» de Sitio web › Analítica / SEO y redes del ERP.
 *
 * Columnas de `website_settings` (fila del principal, `branch_id IS NULL`, que es la que escribe
 * el ERP en `/api/sitio-web/analitica/pixeles` y `/api/sitio-web/seo`): `meta_pixel_id`,
 * `gtm_id`, `google_ads_id`, `tiktok_pixel_id` y `search_noindex`. Las crea la migración
 * pendiente 20261008090000_seoanalitica_pixeles_noindex del ERP. GA4 sigue en `analytics_id`.
 *
 * Sin consulta nueva: salen de `getOrgSettings` (la fila del principal con `select('*')`, ya
 * cacheada entre peticiones y por petición). Mientras la migración no esté aplicada esas claves
 * no vienen y todo queda vacío: la web hace exactamente lo de hoy (píxeles de las
 * integraciones, indexable).
 *
 * Validación de formato: la misma de los CHECK de la migración. Un valor que no la cumpla no se
 * pinta (nunca se interpola en un <script> un texto sin validar).
 */
import { cache } from 'react'
import { getOrgSettings } from '@/lib/outlet/theme-merge'
import { snippetConMeta } from './reglaPixeles'

/** Organizaciones ya avisadas en este proceso (el aviso no se repite en cada visita). */
const avisadas = new Set<number>()

export interface PixelesSitio {
  metaPixelId: string | null
  gtmId: string | null
  googleAdsId: string | null
  tiktokPixelId: string | null
  /** «Ocultar de los buscadores»: el sitio se ve, pero pide noindex. */
  noindex: boolean
}

export const PIXELES_VACIO: PixelesSitio = { metaPixelId: null, gtmId: null, googleAdsId: null, tiktokPixelId: null, noindex: false }

/** Columnas que se leen (verify-sitio-publico las ejecuta contra la base). */
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

/** Píxeles y noindex del sitio (de la fila ya cacheada del principal). */
export const getPixelesSitio = cache(async (organizationId: number): Promise<PixelesSitio> => {
  try {
    const fila = (await getOrgSettings(organizationId)) as unknown as Record<string, unknown> | null
    const pixeles = pixelesDesdeFila(fila)
    // reglaPixeles no pinta el Meta tipado encima de un snippet propio que ya hace fbq('init'):
    // se registra una vez para que soporte lo migre (Analítica del ERP lo avisa también).
    if (pixeles.metaPixelId && snippetConMeta(fila?.custom_scripts) && !avisadas.has(organizationId)) {
      avisadas.add(organizationId)
      console.warn('[seo] Meta Pixel tipado sin pintar: custom_scripts ya inicializa un píxel de Meta', { organizationId })
    }
    return pixeles
  } catch (error) {
    console.error('[seo] No se pudieron leer los píxeles del sitio; se sigue sin ellos', {
      organizationId, error: error instanceof Error ? error.message : String(error),
    })
    return PIXELES_VACIO
  }
})
