'use client'

import { useEffect } from 'react'

/**
 * Espera a que window.fbq esté disponible antes de disparar un evento.
 *
 * El pixel base se inyecta asíncronamente vía CustomScripts en OrganizationLayout
 * (componente padre), cuyo useEffect corre DESPUÉS que los efectos de las páginas
 * (hijos). Sin esta espera, los eventos disparados en montaje se descartan
 * silenciosamente porque window.fbq aún no existe.
 *
 * Resuelve inmediatamente si fbq ya es una función; si no, hace polling cada
 * 100ms hasta `timeoutMs` (default 3000). Rechaza silenciosamente si expira.
 */
function waitForFbq(timeoutMs = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const w = window as any
    if (typeof w.fbq === 'function') return resolve()
    const start = Date.now()
    const interval = setInterval(() => {
      if (typeof (window as any).fbq === 'function') {
        clearInterval(interval)
        resolve()
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval)
        reject(new Error('fbq not available within timeout'))
      }
    }, 100)
  })
}

/**
 * Dispara evento fbq('track', 'Purchase') en la página de resultado de checkout.
 * Se renderiza solo si el pago fue exitoso y fbq está disponible.
 */
export function MetaPixelPurchase({
  orderNumber,
  value,
  currency = 'COP',
  contentIds,
  contents,
  numItems,
}: {
  orderNumber: string
  value: number
  currency?: string
  contentIds?: string[]
  contents?: { id: string; quantity: number }[]
  numItems?: number
}) {
  // Clave estable: los arrays se recrean en cada render del server component.
  const contentsKey = JSON.stringify(contents || contentIds || [])
  useEffect(() => {
    let cancelled = false
    waitForFbq()
      .then(() => {
        if (cancelled) return
        const w = window as any
        const ids = contents && contents.length > 0 ? contents.map(c => c.id) : contentIds
        w.fbq('track', 'Purchase', {
          value,
          currency,
          content_type: 'product',
          ...(ids && ids.length > 0 && { content_ids: ids }),
          ...(contents && contents.length > 0 && { contents }),
          ...(numItems && { num_items: numItems }),
        }, { eventID: orderNumber })
      })
      .catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber, value, currency, contentsKey, numItems])

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
    let cancelled = false
    waitForFbq()
      .then(() => {
        if (cancelled) return
        const w = window as any
        w.fbq('track', 'InitiateCheckout', {
          ...(value !== undefined && { value }),
          currency,
          ...(numItems && { num_items: numItems }),
        })
      })
      .catch(() => {})
    return () => { cancelled = true }
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
    let cancelled = false
    waitForFbq()
      .then(() => {
        if (cancelled) return
        const w = window as any
        w.fbq('track', 'ViewContent', {
          content_ids: [contentId],
          content_type: 'product',
          content_name: contentName,
          ...(value !== undefined && { value }),
          currency,
        })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [contentId, contentName, value, currency])

  return null
}

/**
 * Función helper para disparar fbq('track', 'AddToCart').
 * La llama CartEventTracker (un solo punto para todos los caminos que agregan
 * al carrito); no hace falta invocarla desde cada botón.
 * `contentId` debe ser el SKU (retailer_id del catálogo de Meta) cuando exista.
 */
export function trackMetaAddToCart(contentId: string, productName: string, value: number, currency = 'COP', quantity = 1) {
  waitForFbq()
    .then(() => {
      const w = window as any
      w.fbq('track', 'AddToCart', {
        content_ids: [contentId],
        content_type: 'product',
        content_name: productName,
        contents: [{ id: contentId, quantity }],
        value,
        currency,
      })
    })
    .catch(() => {})
}

/**
 * Función helper para disparar fbq('track', 'Purchase') de forma imperativa.
 * Se usa para pedidos sin pasarela (efectivo/transferencia), que terminan en
 * el propio CheckoutWizard y nunca pasan por /checkout/resultado. `eventID`
 * = número de pedido, para deduplicar con la Conversions API.
 */
export function trackMetaPurchase(params: {
  orderNumber: string
  value: number
  currency?: string
  contents?: { id: string; quantity: number }[]
  numItems?: number
}) {
  const { orderNumber, value, currency = 'COP', contents, numItems } = params
  waitForFbq()
    .then(() => {
      const w = window as any
      w.fbq('track', 'Purchase', {
        value,
        currency,
        content_type: 'product',
        ...(contents && contents.length > 0 && {
          contents,
          content_ids: contents.map(c => c.id),
        }),
        ...(numItems && { num_items: numItems }),
      }, { eventID: orderNumber })
    })
    .catch(() => {})
}

/**
 * Función helper para disparar fbq('track', 'Lead') desde formularios de contacto.
 */
export function trackMetaLead(value = 0, currency = 'COP') {
  waitForFbq()
    .then(() => {
      const w = window as any
      w.fbq('track', 'Lead', { value, currency })
    })
    .catch(() => {})
}

/**
 * Función helper para disparar fbq('track', 'Schedule') desde formularios de cita/reserva.
 */
export function trackMetaSchedule(value = 0, currency = 'COP') {
  waitForFbq()
    .then(() => {
      const w = window as any
      w.fbq('track', 'Schedule', { value, currency })
    })
    .catch(() => {})
}

/**
 * Función helper para disparar fbq('track', 'Subscribe') desde compra de membresía.
 */
export function trackMetaSubscribe(value: number, currency = 'COP') {
  waitForFbq()
    .then(() => {
      const w = window as any
      w.fbq('track', 'Subscribe', { value, currency })
    })
    .catch(() => {})
}
