'use client'

import Script from 'next/script'

interface MetaPixelProps {
  pixelId: string
}

/**
 * Componente que inyecta el Meta Pixel (Facebook Pixel) en la página.
 * Se renderiza solo si existe un pixelId activo desde la integración Meta Marketing.
 *
 * Eventos automáticos:
 * - PageView: se dispara automáticamente al cargar el pixel
 *
 * Eventos manuales (desde otros componentes):
 * - fbq('track', 'ViewContent', { content_ids: ['SKU'], value: 50000, currency: 'COP' })
 * - fbq('track', 'AddToCart', { content_ids: ['SKU'], value: 50000, currency: 'COP' })
 * - fbq('track', 'InitiateCheckout', { value: 95000, currency: 'COP', num_items: 2 })
 * - fbq('track', 'Purchase', { content_ids: [...], value: 95000, currency: 'COP' }, { eventID: 'order_123' })
 * - fbq('track', 'Lead', { value: 0, currency: 'COP' })
 * - fbq('track', 'Schedule', { value: 50000, currency: 'COP' })
 */
export default function MetaPixel({ pixelId }: MetaPixelProps) {
  if (!pixelId) return null

  return (
    <>
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixelId}');
            fbq('track', 'PageView');
          `,
        }}
      />
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  )
}
