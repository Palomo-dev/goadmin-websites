'use client'

import { useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function BoldButtonContent() {
  const searchParams = useSearchParams()
  const containerRef = useRef<HTMLDivElement>(null)
  const scriptLoadedRef = useRef(false)

  const apiKey = searchParams.get('apiKey') || ''
  const orderId = searchParams.get('orderId') || ''
  const amount = searchParams.get('amount') || ''
  const currency = searchParams.get('currency') || 'COP'
  const description = searchParams.get('description') || ''
  const integritySignature = searchParams.get('integritySignature') || ''
  const redirectionUrl = searchParams.get('redirectionUrl') || ''
  const customerDataStr = searchParams.get('customerData') || ''
  const billingAddressStr = searchParams.get('billingAddress') || ''

  useEffect(() => {
    // Cargar el script del Botón de Pagos de Bold
    const existingScript = document.querySelector('script[src="https://checkout.bold.co/library/boldPaymentButton.js"]')
    if (existingScript) {
      scriptLoadedRef.current = true
      renderButton()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://checkout.bold.co/library/boldPaymentButton.js'
    script.async = true
    script.onload = () => {
      scriptLoadedRef.current = true
      renderButton()
    }
    document.head.appendChild(script)

    return () => {
      // No remover el script al desmontar para permitir reusarlo
    }
  }, [])

  function renderButton() {
    if (!containerRef.current || !scriptLoadedRef.current) return
    if (!apiKey) return

    // Limpiar contenedor
    containerRef.current.innerHTML = ''

    // Crear el script del botón con los atributos data-*
    const btnScript = document.createElement('script')
    btnScript.setAttribute('data-bold-button', 'dark-L')
    btnScript.setAttribute('data-api-key', apiKey)

    if (orderId) btnScript.setAttribute('data-order-id', orderId)
    if (amount) btnScript.setAttribute('data-amount', amount)
    if (currency) btnScript.setAttribute('data-currency', currency)
    if (description) btnScript.setAttribute('data-description', description)
    if (integritySignature) btnScript.setAttribute('data-integrity-signature', integritySignature)
    if (redirectionUrl) btnScript.setAttribute('data-redirection-url', redirectionUrl)

    // Pre-llenar datos del cliente
    if (customerDataStr) {
      btnScript.setAttribute('data-customer-data', customerDataStr)
    }

    // Pre-llenar dirección de facturación
    if (billingAddressStr) {
      btnScript.setAttribute('data-billing-address', billingAddressStr)
    }

    containerRef.current.appendChild(btnScript)
  }

  // Auto-clic en el botón cuando aparezca
  useEffect(() => {
    if (!scriptLoadedRef.current) return

    const timer = setTimeout(() => {
      const btn = containerRef.current?.querySelector('button, a, [role="button"]')
      if (btn) {
        (btn as HTMLElement).click()
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [scriptLoadedRef.current])

  if (!apiKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <p className="text-red-600 font-semibold mb-4">Faltan parámetros para iniciar el pago con Bold.</p>
          <a href="/checkout" className="text-blue-600 hover:underline">Volver al checkout</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Procesando pago con Bold</h1>
        <p className="text-gray-500 text-sm mb-6">
          Pedido: <strong>{orderId}</strong> — ${Number(amount).toLocaleString('es-CO')} {currency}
        </p>
        <p className="text-gray-400 text-xs mb-6">
          Si el botón no aparece automáticamente, haz clic abajo para continuar.
        </p>
        <div ref={containerRef} className="flex justify-center" />
        <a href="/checkout" className="inline-block mt-6 text-sm text-gray-400 hover:text-gray-600">
          ← Volver al checkout
        </a>
      </div>
    </div>
  )
}

export default function BoldCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400">Cargando pago...</div>
      </div>
    }>
      <BoldButtonContent />
    </Suspense>
  )
}
