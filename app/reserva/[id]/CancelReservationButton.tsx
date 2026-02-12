'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertCircle, Loader2, XCircle } from 'lucide-react'

interface CancelReservationButtonProps {
  reservationId: string
  primaryColor: string
}

export function CancelReservationButton({ reservationId, primaryColor }: CancelReservationButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cancelled, setCancelled] = useState(false)

  const handleCancel = async () => {
    if (!email) {
      setError('Ingresa tu correo electrónico para confirmar')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/reservations/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId, email })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al cancelar')
        return
      }

      setCancelled(true)
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  if (cancelled) {
    return (
      <div className="bg-red-50 rounded-lg p-4 text-center">
        <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
        <p className="font-semibold text-red-700">Reservación cancelada</p>
        <p className="text-sm text-red-600 mt-1">La cancelación se ha procesado exitosamente.</p>
      </div>
    )
  }

  if (!showConfirm) {
    return (
      <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50" onClick={() => setShowConfirm(true)}>
        Cancelar reservación
      </Button>
    )
  }

  return (
    <div className="bg-red-50 rounded-lg p-4 space-y-3">
      <p className="text-sm font-medium text-red-700">¿Estás seguro de cancelar esta reservación?</p>
      <p className="text-xs text-red-600">Ingresa el correo asociado a la reserva para confirmar:</p>
      <Input
        type="email"
        placeholder="tu@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border-red-200"
      />
      {error && (
        <div className="flex items-start gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => { setShowConfirm(false); setError('') }}>
          Volver
        </Button>
        <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" disabled={loading} onClick={handleCancel}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar cancelación'}
        </Button>
      </div>
    </div>
  )
}
