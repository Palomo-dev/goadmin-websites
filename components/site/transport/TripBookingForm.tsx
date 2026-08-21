'use client'

import { useState } from 'react'
import { User, Mail, Phone, CreditCard, Loader2, AlertCircle, CheckCircle } from 'lucide-react'

interface Gateway {
  code: string
  name: string
}

interface TripBookingFormProps {
  tripId: string
  tripCode: string
  routeName: string
  selectedSeats: { id: string; label: string }[]
  fare: number
  currency: string
  organizationId: number
  primaryColor: string
  gateways: Gateway[]
}

export function TripBookingForm({
  tripId,
  tripCode,
  routeName,
  selectedSeats,
  fare,
  currency,
  organizationId,
  primaryColor,
  gateways,
}: TripBookingFormProps) {
  const [step, setStep] = useState<'form' | 'paying' | 'done'>('form')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [docType, setDocType] = useState('CC')
  const [docNumber, setDocNumber] = useState('')
  const [selectedGateway, setSelectedGateway] = useState(gateways[0]?.code || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const totalFare = fare * selectedSeats.length

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !selectedGateway || selectedSeats.length === 0) {
      setError('Completa todos los campos requeridos')
      return
    }

    setLoading(true)
    setError('')

    try {
      // 1. Reservar asientos temporalmente
      const reserveRes = await fetch('/api/transport/reserve-seat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          seatIds: selectedSeats.map(s => s.id),
          sessionId: `web-${Date.now()}`,
        }),
      })

      if (!reserveRes.ok) {
        const reserveErr = await reserveRes.json()
        throw new Error(reserveErr.error || 'Error reservando asientos')
      }

      // 2. Crear ticket
      const ticketRes = await fetch('/api/transport/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          organizationId,
          seatIds: selectedSeats.map(s => s.id),
          passengerName: name,
          passengerEmail: email,
          passengerPhone: phone,
          passengerDocType: docType,
          passengerDocNumber: docNumber,
        }),
      })

      if (!ticketRes.ok) {
        const ticketErr = await ticketRes.json()
        throw new Error(ticketErr.error || 'Error creando boleto')
      }

      const ticketData = await ticketRes.json()

      // 3. Iniciar checkout con pasarela
      const checkoutRes = await fetch('/api/checkout/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'trip_ticket',
          sourceId: ticketData.tickets[0].id,
          gateway: selectedGateway,
          returnUrl: `${window.location.origin}/ticket/${ticketData.tickets[0].ticketNumber}`,
        }),
      })

      if (!checkoutRes.ok) {
        const checkoutErr = await checkoutRes.json()
        throw new Error(checkoutErr.error || 'Error iniciando pago')
      }

      const checkoutData = await checkoutRes.json()

      if (checkoutData.checkoutUrl) {
        setStep('paying')
        window.location.href = checkoutData.checkoutUrl
      } else {
        throw new Error('No se recibió URL de pago')
      }
    } catch (err: any) {
      setError(err.message || 'Error procesando la compra')
      setLoading(false)
    }
  }

  if (step === 'paying') {
    return (
      <div className="bg-white rounded-xl border p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" style={{ color: primaryColor }} />
        <p className="font-medium">Redirigiendo a la pasarela de pago...</p>
        <p className="text-sm text-gray-500 mt-1">No cierres esta ventana</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 space-y-5">
      <h3 className="font-semibold text-lg">Datos del pasajero</h3>

      {/* Resumen */}
      <div className="bg-blue-50 rounded-lg p-4 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-600">Viaje</span>
          <span className="font-medium">{tripCode} — {routeName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Asientos</span>
          <span className="font-medium">{selectedSeats.map(s => s.label).join(', ')}</span>
        </div>
        <div className="flex justify-between border-t border-blue-100 pt-1 mt-1">
          <span className="text-gray-600">Total ({selectedSeats.length} × ${fare.toLocaleString('es-CO')})</span>
          <span className="font-bold text-lg" style={{ color: primaryColor }}>${totalFare.toLocaleString('es-CO')} {currency}</span>
        </div>
      </div>

      {/* Campos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
          <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
            <User className="h-4 w-4 text-gray-400" />
            <input type="text" required className="w-full outline-none text-sm" placeholder="Juan Pérez" value={name} onChange={e => setName(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
            <Mail className="h-4 w-4 text-gray-400" />
            <input type="email" required className="w-full outline-none text-sm" placeholder="correo@ejemplo.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
          <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
            <Phone className="h-4 w-4 text-gray-400" />
            <input type="tel" className="w-full outline-none text-sm" placeholder="300 123 4567" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Documento</label>
          <div className="flex items-center gap-2 border rounded-lg">
            <select className="border-r px-2 py-2 text-sm bg-gray-50 rounded-l-lg outline-none" value={docType} onChange={e => setDocType(e.target.value)}>
              <option value="CC">CC</option>
              <option value="CE">CE</option>
              <option value="PP">PP</option>
              <option value="TI">TI</option>
            </select>
            <input type="text" className="w-full outline-none text-sm py-2 pr-3" placeholder="1234567890" value={docNumber} onChange={e => setDocNumber(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Pasarela */}
      {gateways.length > 1 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Método de pago</label>
          <div className="flex flex-wrap gap-2">
            {gateways.map(gw => (
              <button
                key={gw.code}
                type="button"
                onClick={() => setSelectedGateway(gw.code)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  selectedGateway === gw.code
                    ? 'text-white border-transparent'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                style={selectedGateway === gw.code ? { backgroundColor: primaryColor } : {}}
              >
                <CreditCard className="h-3.5 w-3.5 inline mr-1.5" />
                {gw.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || selectedSeats.length === 0}
        className="w-full py-3 rounded-lg text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ backgroundColor: primaryColor }}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Procesando...
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4" />
            Pagar ${totalFare.toLocaleString('es-CO')} {currency}
          </>
        )}
      </button>
    </form>
  )
}
