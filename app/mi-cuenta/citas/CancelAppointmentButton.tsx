'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  appointmentId: string
  primaryColor: string
}

export function CancelAppointmentButton({ appointmentId, primaryColor }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleCancel = async () => {
    if (!confirm('¿Estás seguro de que deseas cancelar esta cita?')) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/services/appointments/${appointmentId}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'No se pudo cancelar')
      } else {
        router.refresh()
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleCancel}
        disabled={loading}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
      >
        {loading ? 'Cancelando...' : 'Cancelar cita'}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
