'use client'

import Script from 'next/script'

interface GoogleAdsTagProps {
  conversionId: string
  conversionLabel?: string
}

/**
 * Componente que inyecta el Google Ads Tag (gtag.js) en la página.
 * Se renderiza solo si existe un conversionId activo desde la integración Google Ads.
 *
 * Eventos automáticos:
 * - config: se configura automáticamente al cargar el tag
 *
 * Eventos manuales (desde otros componentes vía window.gtag):
 * - gtag('event', 'conversion', { send_to: 'AW-XXXXX/LABEL', value: 150000, currency: 'COP', transaction_id: 'ORD-001' })
 * - gtag('event', 'conversion', { send_to: 'AW-XXXXX/LABEL', value: 50000, currency: 'COP' }) // Lead
 * - gtag('event', 'conversion', { send_to: 'AW-XXXXX/LABEL', value: 250000, currency: 'COP' }) // Reserva
 */
export default function GoogleAdsTag({ conversionId, conversionLabel }: GoogleAdsTagProps) {
  if (!conversionId) return null

  return (
    <>
      <Script
        id="gtag-js"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${conversionId}`}
      />
      <Script
        id="gtag-config"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${conversionId}');
            ${conversionLabel ? `window.__GOOGLE_ADS_CONVERSION_LABEL = '${conversionLabel}';` : ''}
            window.__GOOGLE_ADS_CONVERSION_ID = '${conversionId}';
          `,
        }}
      />
    </>
  )
}
