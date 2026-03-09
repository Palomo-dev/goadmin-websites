'use client'

import { useState } from 'react'

interface Gateway {
  code: string
  name: string
}

interface Props {
  invoiceId: string
  gateways: Gateway[]
  primaryColor: string
}

export function InvoicePayButton({ invoiceId, gateways, primaryColor }: Props) {
  const [selectedGateway, setSelectedGateway] = useState(gateways[0]?.code || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handlePay = async () => {
    if (!selectedGateway) return
    setLoading(true)
    setError('')

    try {
      const returnUrl = `${window.location.origin}/mi-cuenta/facturas/${invoiceId}`

      const res = await fetch('/api/checkout/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway: selectedGateway,
          returnUrl,
          source: 'invoice',
          sourceId: invoiceId,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al iniciar el pago')
      } else if (data.redirectUrl) {
        window.location.href = data.redirectUrl
      } else {
        setError('No se obtuvo URL de pago')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const gatewayLabels: Record<string, string> = {
    wompi_co: 'Wompi',
    mp_checkout: 'MercadoPago',
    payu_co: 'PayU',
    stripe_payments: 'Stripe',
    paypal_checkout: 'PayPal',
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {/* Selector de pasarela */}
      {gateways.length > 1 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {gateways.map((gw) => (
            <button
              key={gw.code}
              onClick={() => setSelectedGateway(gw.code)}
              className={`px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                selectedGateway === gw.code
                  ? 'border-2 shadow-sm'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
              }`}
              style={selectedGateway === gw.code ? { borderColor: primaryColor, color: primaryColor } : {}}
            >
              {gatewayLabels[gw.code] || gw.name}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={handlePay}
        disabled={loading || !selectedGateway}
        className="w-full py-3 px-6 rounded-lg text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: primaryColor }}
      >
        {loading ? 'Procesando...' : `💳 Pagar con ${gatewayLabels[selectedGateway] || selectedGateway}`}
      </button>
    </div>
  )
}
