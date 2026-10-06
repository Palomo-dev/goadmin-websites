/**
 * Píxeles y scripts de seguimiento del sitio: los mismos en el layout (OrganizationLayoutCliente)
 * y en /checkout, que no usa ese layout. Una sola regla (lib/seo/reglaPixeles.ts), así la página
 * del producto y el checkout disparan siempre al mismo píxel.
 *
 * Orden de siempre: Meta, scripts propios (después de Meta, para el Event Setup Tool), el código
 * a medida del ERP (`custom_code`, solo si hay bloques), Google Ads, GTM, TikTok y GA4. Sin píxeles tipados sale exactamente lo de antes.
 *
 * Sin directiva: solo compone componentes de cliente y se usa desde servidor y desde cliente.
 */
import MetaPixel from './MetaPixel'
import CustomScripts from './CustomScripts'
import { CodigoPropio } from './CodigoPropio'
import GoogleAdsTag from './GoogleAdsTag'
import GoogleTagManager from './GoogleTagManager'
import TikTokPixel from './TikTokPixel'
import GoogleAnalytics from './GoogleAnalytics'
import type { PixelesSitio as PixelesTipados } from '@/lib/seo/pixelesSitio'
import { resolverPixeles, type IntegracionPixeles } from '@/lib/seo/reglaPixeles'
import type { BloqueCodigo } from '@/lib/website/ajustesSitio'

interface PixelesSitioProps {
  pixeles?: PixelesTipados | null
  integracion: IntegracionPixeles
  customScripts?: string | null
  analyticsId?: string | null
  /** Código a medida del ERP (`custom_code`), ya validado. Ausente o vacío = nada (lo de hoy). */
  codigoPropio?: readonly BloqueCodigo[] | null
  /** Prefijo de la sede servida por ruta, para comparar el alcance de cada bloque. */
  prefijoSede?: string
}

export function PixelesSitio({ pixeles, integracion, customScripts, analyticsId, codigoPropio, prefijoSede }: PixelesSitioProps) {
  const p = resolverPixeles(pixeles, integracion, customScripts)
  return (
    <>
      {p.meta && <MetaPixel pixelId={p.meta} />}
      {customScripts && <CustomScripts scripts={customScripts} />}
      {codigoPropio && codigoPropio.length > 0 && <CodigoPropio bloques={codigoPropio} prefijoSede={prefijoSede} />}
      {p.googleAds && <GoogleAdsTag conversionId={p.googleAds.conversionId} conversionLabel={p.googleAds.conversionLabel} />}
      {p.gtm && <GoogleTagManager containerId={p.gtm} />}
      {p.tiktok && <TikTokPixel pixelId={p.tiktok} />}
      {analyticsId && <GoogleAnalytics measurementId={analyticsId} />}
    </>
  )
}
