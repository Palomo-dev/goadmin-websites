'use client'

import { useState, useEffect } from 'react'

interface EstimatedTimeProps {
  organizationId: number
  branchId?: number
  orderCreatedAt: string
  primaryColor?: string
}

export function EstimatedTime({ organizationId, branchId, orderCreatedAt, primaryColor = '#3B82F6' }: EstimatedTimeProps) {
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    async function fetchEstimate() {
      try {
        const params = new URLSearchParams({ organizationId: String(organizationId) })
        if (branchId) params.set('branchId', String(branchId))
        const res = await fetch(`/api/orders/estimate-time?${params}`)
        if (res.ok) {
          const data = await res.json()
          setEstimatedMinutes(data.estimatedMinutes)
        }
      } catch { /* silent */ }
    }
    fetchEstimate()
  }, [organizationId, branchId])

  // Actualizar elapsed cada 30s
  useEffect(() => {
    function updateElapsed() {
      const diff = Date.now() - new Date(orderCreatedAt).getTime()
      setElapsed(Math.floor(diff / 60000))
    }
    updateElapsed()
    const interval = setInterval(updateElapsed, 30000)
    return () => clearInterval(interval)
  }, [orderCreatedAt])

  if (estimatedMinutes === null) return null

  const progress = Math.min((elapsed / estimatedMinutes) * 100, 100)
  const remaining = Math.max(estimatedMinutes - elapsed, 0)

  return (
    <div className="bg-white rounded-2xl border p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">Tiempo estimado de preparación</span>
        <span className="text-sm font-bold" style={{ color: primaryColor }}>
          {remaining > 0 ? `~${remaining} min restantes` : 'Listo pronto'}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${progress}%`, backgroundColor: progress >= 100 ? '#10B981' : primaryColor }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-gray-400">
        <span>{elapsed} min transcurridos</span>
        <span>~{estimatedMinutes} min total</span>
      </div>
    </div>
  )
}
