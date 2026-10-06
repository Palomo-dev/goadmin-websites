/**
 * Regla única de qué píxeles pinta el sitio (layout de todas las páginas y /checkout, que no usa
 * OrganizationLayout). Código puro: lo comparten `components/site/PixelesSitio.tsx` y
 * `scripts/verify-sitio-publico.mjs`.
 *
 * - El id tipado de Sitio web › Analítica (ERP) es el punto de verdad; sin él, el de la
 *   integración (lo de hoy). La etiqueta de conversión de Google Ads solo se conserva si es del
 *   mismo id.
 * - Meta: si los scripts propios (`custom_scripts`) ya inicializan un píxel de Meta
 *   (`fbq('init'…)`), el id tipado NO se pinta encima: cada snippet hace su propio init y
 *   PageView, así que se contarían dos veces (o se repartirían entre dos píxeles). En ese caso
 *   se queda exactamente lo de hoy: el píxel de la integración (si hay) y el snippet.
 * - GTM y TikTok solo existen tipados.
 */
import type { PixelesSitio } from './pixelesSitio'

export interface IntegracionPixeles {
  metaPixelId?: string | null
  googleAds?: { conversionId: string; conversionLabel?: string } | null
}

export interface PixelesResueltos {
  meta: string | null
  googleAds: { conversionId: string; conversionLabel?: string } | null
  gtm: string | null
  tiktok: string | null
  /** El snippet propio ya trae Meta y había un id tipado que se dejó de pintar. */
  metaTipadoOmitidoPorSnippet: boolean
}

/** ¿Los scripts propios inicializan un píxel de Meta? */
export function snippetConMeta(customScripts: unknown): boolean {
  return typeof customScripts === 'string' && /fbq\s*\(\s*['"]init['"]/.test(customScripts)
}

export function resolverPixeles(
  pixeles: PixelesSitio | null | undefined,
  integracion: IntegracionPixeles,
  customScripts: unknown,
): PixelesResueltos {
  const metaIntegracion = integracion.metaPixelId ?? null
  const adsIntegracion = integracion.googleAds ?? null
  const metaTipado = pixeles?.metaPixelId ?? null
  const omitido = metaTipado !== null && snippetConMeta(customScripts)
  const adsTipado = pixeles?.googleAdsId ?? null
  return {
    meta: metaTipado !== null && !omitido ? metaTipado : metaIntegracion,
    googleAds: adsTipado
      ? { conversionId: adsTipado, conversionLabel: adsIntegracion?.conversionId === adsTipado ? adsIntegracion.conversionLabel : undefined }
      : adsIntegracion,
    gtm: pixeles?.gtmId ?? null,
    tiktok: pixeles?.tiktokPixelId ?? null,
    metaTipadoOmitidoPorSnippet: omitido,
  }
}
