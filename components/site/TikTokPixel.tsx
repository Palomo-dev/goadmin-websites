'use client'

import Script from 'next/script'

/**
 * TikTok Pixel (Sitio web › Analítica del ERP, columna `tiktok_pixel_id`). El id llega ya
 * validado con el formato del CHECK (lib/seo/pixelesSitio.ts): nunca se interpola otro texto.
 * Solo PageView; los eventos de compra siguen en los componentes de cada flujo.
 */
export default function TikTokPixel({ pixelId }: { pixelId: string }) {
  if (!/^[A-Z0-9]{15,25}$/.test(pixelId)) return null
  return (
    <Script
      id="tiktok-pixel"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${pixelId}');ttq.page();}(window,document,'ttq');`,
      }}
    />
  )
}
