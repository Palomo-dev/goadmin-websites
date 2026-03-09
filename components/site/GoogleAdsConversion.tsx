'use client'

import { useEffect } from 'react'

interface GoogleAdsConversionProps {
  transactionId: string
  value: number
  currency?: string
}

/**
 * Componente client que dispara un evento de conversión de Google Ads.
 * Se renderiza en la página de resultado de checkout cuando el pago es exitoso.
 * Requiere que gtag.js ya esté cargado (vía GoogleAdsTag en el layout).
 */
export default function GoogleAdsConversion({ transactionId, value, currency = 'COP' }: GoogleAdsConversionProps) {
  useEffect(() => {
    const w = window as any
    if (typeof w.gtag !== 'function' || !w.__GOOGLE_ADS_CONVERSION_ID) return

    const sendTo = w.__GOOGLE_ADS_CONVERSION_LABEL
      ? `${w.__GOOGLE_ADS_CONVERSION_ID}/${w.__GOOGLE_ADS_CONVERSION_LABEL}`
      : w.__GOOGLE_ADS_CONVERSION_ID

    w.gtag('event', 'conversion', {
      send_to: sendTo,
      value,
      currency,
      transaction_id: transactionId,
    })
  }, [transactionId, value, currency])

  return null
}
