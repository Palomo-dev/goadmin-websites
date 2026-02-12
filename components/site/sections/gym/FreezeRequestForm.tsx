'use client'

import { useState } from 'react'

interface FreezeRequestFormProps {
  membershipId: number
  customerId: string
  organizationId: number
  primaryColor?: string
}

export function FreezeRequestForm({ membershipId, customerId, organizationId, primaryColor = '#3B82F6' }: FreezeRequestFormProps) {
  const [expanded, setExpanded] = useState(false)
  const [days, setDays] = useState(15)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; error?: string; status?: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/memberships/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId, customerId, organizationId, reason, requestedDays: days }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ success: true, status: 'pending' })
        setExpanded(false)
      } else {
        setResult({ error: data.error || 'Error al enviar solicitud' })
      }
    } catch {
      setResult({ error: 'Error de conexión' })
    } finally {
      setLoading(false)
    }
  }

  if (result?.success) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <span className="text-xl">❄️</span>
        <div>
          <p className="font-semibold text-blue-800 text-sm">Solicitud enviada</p>
          <p className="text-blue-700 text-xs mt-0.5">Tu solicitud de congelamiento está pendiente de aprobación por el administrador.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-lg border hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">❄️</span>
          <span className="font-medium text-sm">Solicitar congelamiento</span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <form onSubmit={handleSubmit} className="mt-3 p-4 bg-gray-50 rounded-xl border space-y-4">
          <p className="text-xs text-gray-500">
            Puedes solicitar un congelamiento temporal de tu membresía. Un administrador revisará tu solicitud.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Días de congelamiento</label>
            <input
              type="number"
              min={1}
              max={90}
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': primaryColor } as any}
            />
            <p className="text-xs text-gray-400 mt-1">Mínimo 1 día, máximo 90 días</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Ej: Viaje, lesión, motivos personales..."
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 resize-none"
              style={{ '--tw-ring-color': primaryColor } as any}
            />
          </div>

          {result?.error && (
            <p className="text-red-600 text-xs">{result.error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            {loading ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </form>
      )}
    </div>
  )
}
