'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Botón «Cancelar mi reserva» de la página por token. Pide confirmación en dos
 * pasos y llama a `/api/restaurant-reservations/token/[token]/cancel`; la base
 * vuelve a comprobar el plazo (en la zona de la sede) y el estado.
 */
export function CancelarReservaMesa({ token, primaryColor }: { token: string; primaryColor: string }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')

  const cancelar = async () => {
    setEnviando(true)
    setError(null)
    try {
      const res = await fetch(`/api/restaurant-reservations/token/${encodeURIComponent(token)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(motivo.trim() ? { reason: motivo.trim() } : {}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'No se pudo cancelar la reserva.')
        return
      }
      router.refresh()
    } catch {
      setError('No se pudo cancelar la reserva. Revisa tu conexión.')
    } finally {
      setEnviando(false)
    }
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="w-full rounded-lg border border-border px-4 py-3 text-base font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color)]"
      >
        Cancelar mi reserva
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4" aria-live="polite">
      <p className="font-medium">¿Seguro que quieres cancelar la reserva?</p>
      <label htmlFor="motivo-cancelacion" className="text-sm text-muted-foreground">
        Motivo (opcional)
      </label>
      <input
        id="motivo-cancelacion"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base"
        maxLength={300}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
      />
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={enviando}
          onClick={cancelar}
          className="rounded-lg px-4 py-2 font-medium text-white disabled:opacity-60"
          style={{ backgroundColor: primaryColor }}
        >
          {enviando ? 'Cancelando…' : 'Sí, cancelar'}
        </button>
        <button type="button" disabled={enviando} onClick={() => setConfirmando(false)} className="rounded-lg border border-border px-4 py-2">
          No, mantenerla
        </button>
      </div>
    </div>
  )
}
