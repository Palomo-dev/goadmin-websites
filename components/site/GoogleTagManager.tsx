'use client'

import Script from 'next/script'

/**
 * Google Tag Manager (Sitio web › Analítica del ERP, columna `gtm_id`). El id llega ya validado
 * con el formato del CHECK (`GTM-XXXX`, lib/seo/pixelesSitio.ts): nunca se interpola otro texto.
 */
export default function GoogleTagManager({ containerId }: { containerId: string }) {
  if (!/^GTM-[A-Z0-9]{4,12}$/.test(containerId)) return null
  return (
    <>
      <Script
        id="gtm-js"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${containerId}');`,
        }}
      />
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${containerId}`}
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
          title="Google Tag Manager"
        />
      </noscript>
    </>
  )
}
