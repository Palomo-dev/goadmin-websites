'use client'

import { useEffect } from 'react'

/**
 * Dispara evento fbq('track', 'Purchase') en la página de resultado de checkout.
 * Se renderiza solo si el pago fue exitoso y fbq está disponible.
 */
export function MetaPixelPurchase({
  orderNumber,
  value,
  currency = 'COP',
  contentIds,
  numItems,
}: {
  orderNumber: string
  value: number
  currency?: string
  contentIds?: string[]
  numItems?: number
}) {
  useEffect(() => {
    const w = window as any
    if (typeof w.fbq !== 'function') return

    w.fbq('track', 'Purchase', {
      value,
      currency,
      content_type: 'product',
      ...(contentIds && { content_ids: contentIds }),
      ...(numItems && { num_items: numItems }),
    }, { eventID: orderNumber })
  }, [orderNumber, value, currency, contentIds, numItems])

  return null
}

/**
 * Dispara evento fbq('track', 'InitiateCheckout') al cargar la página de checkout.
 */
export function MetaPixelInitiateCheckout({
  value,
  currency = 'COP',
  numItems,
}: {
  value?: number
  currency?: string
  numItems?: number
}) {
  useEffect(() => {
    const w = window as any
    if (typeof w.fbq !== 'function') return

    w.fbq('track', 'InitiateCheckout', {
      ...(value !== undefined && { value }),
      currency,
      ...(numItems && { num_items: numItems }),
    })
  }, [value, currency, numItems])

  return null
}

/**
 * Dispara evento fbq('track', 'ViewContent') al ver detalle de producto.
 */
export function MetaPixelViewContent({
  contentId,
  contentName,
  value,
  currency = 'COP',
}: {
  contentId: string
  contentName: string
  value?: number
  currency?: string
}) {
  useEffect(() => {
    const w = window as any
    if (typeof w.fbq !== 'function') return

    w.fbq('track', 'ViewContent', {
      content_ids: [contentId],
      content_type: 'product',
      content_name: contentName,
      ...(value !== undefined && { value }),
      currency,
    })
  }, [contentId, contentName, value, currency])

  return null
}

/**
 * Función helper para disparar fbq('track', 'AddToCart') desde handlers.
 * Se llama imperativamente desde AddToCartButton.
 */
export function trackMetaAddToCart(productId: string, productName: string, price: number, currency = 'COP') {
  const w = window as any
  if (typeof w.fbq !== 'function') return

  w.fbq('track', 'AddToCart', {
    content_ids: [productId],
    content_type: 'product',
    content_name: productName,
    value: price,
    currency,
  })
}

/**
 * Función helper para disparar fbq('track', 'Lead') desde formularios de contacto.
 */
export function trackMetaLead(value = 0, currency = 'COP') {
  const w = window as any
  if (typeof w.fbq !== 'function') return

  w.fbq('track', 'Lead', { value, currency })
}

/**
 * Función helper para disparar fbq('track', 'Schedule') desde formularios de cita/reserva.
 */
export function trackMetaSchedule(value = 0, currency = 'COP') {
  const w = window as any
  if (typeof w.fbq !== 'function') return

  w.fbq('track', 'Schedule', { value, currency })
}

/**
 * Función helper para disparar fbq('track', 'Subscribe') desde compra de membresía.
 */
export function trackMetaSubscribe(value: number, currency = 'COP') {
  const w = window as any
  if (typeof w.fbq !== 'function') return

  w.fbq('track', 'Subscribe', { value, currency })
}
