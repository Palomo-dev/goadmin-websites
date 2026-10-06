'use client'

import { useEffect, useMemo, useState } from 'react'
import { Clock, Zap } from 'lucide-react'
import type { HorarioSemana } from '@/lib/restaurant/horario'
import { franjasPedido, momentoPedido, validarMomentoPedido } from '@/lib/restaurant/ventanaPedido'

interface ScheduleSelectorProps {
  isScheduled: boolean
  scheduledAt: string | null
  onScheduledChange: (isScheduled: boolean) => void
  onTimeChange: (scheduledAt: string | null) => void
  primaryColor: string
  /**
   * Horario de la sede del pedido. Con él, las franjas salen de `franjasPedido` (dentro del horario
   * y en la zona de la sede, la misma regla que valida /api/orders) y, con la sede cerrada, «Lo
   * antes posible» se deshabilita. Sin él (otras verticales o sede sin horario), la generación de
   * siempre, sin cambios.
   */
  horario?: HorarioSemana | null
  /** Zona IANA de la sede (`branches.timezone` → `organizations.timezone`). */
  zona?: string | null
  /** «Recoger» / «Domicilio» / «Comer aquí»: cambia el texto de la pregunta. */
  verbo?: 'recoges' | 'recibes' | 'quieres'
}

export function ScheduleSelector({
  isScheduled, scheduledAt, onScheduledChange, onTimeChange, primaryColor, horario, zona, verbo = 'quieres',
}: ScheduleSelectorProps) {
  // Reloj de la página: se refresca cada minuto para que las franjas y el «cerrado» no se queden
  // viejos si el cliente deja el checkout abierto.
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 60 * 1000)
    return () => clearInterval(t)
  }, [])

  const conHorario = !!horario
  const franjas = useMemo(
    () => (horario ? franjasPedido(horario, zona, ahora, { pasoMin: 30, antelacionMin: 30, diasAdelante: 2 }) : []),
    [horario, zona, ahora],
  )
  const ahoraMismo = useMemo(
    () => (horario ? validarMomentoPedido(horario, zona, null, ahora) : null),
    [horario, zona, ahora],
  )
  const cerrada = !!ahoraMismo && !ahoraMismo.ok
  const proximaApertura = ahoraMismo && !ahoraMismo.ok ? ahoraMismo.proximaApertura : null

  // Sede cerrada: «Programar» preseleccionado con la primera franja.
  useEffect(() => {
    if (!conHorario) return
    if (cerrada && !isScheduled) {
      onScheduledChange(true)
    }
    if (isScheduled && (!scheduledAt || !franjas.includes(scheduledAt)) && franjas.length > 0) {
      onTimeChange(franjas[0])
    } else if (isScheduled && franjas.length === 0 && scheduledAt) {
      onTimeChange(null)
    }
  }, [conHorario, cerrada, isScheduled, scheduledAt, franjas, onScheduledChange, onTimeChange])

  // ── Sin horario: generación anterior (cada 30 min desde ahora + 30 min hasta +8 h, hasta las 23:00) ──
  const getTimeSlots = (): string[] => {
    const slots: string[] = []
    const start = new Date(ahora)
    start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30 + 30, 0, 0)
    for (let i = 0; i < 16; i++) {
      const slot = new Date(start.getTime() + i * 30 * 60 * 1000)
      if (slot.getHours() >= 23) break
      slots.push(slot.toISOString())
    }
    return slots
  }
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })
  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) return 'Hoy'
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (d.toDateString() === tomorrow.toDateString()) return 'Mañana'
    return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
  }
  const timeSlotsLegacy = conHorario ? [] : getTimeSlots()

  const pregunta = verbo === 'recoges' ? '¿Cuándo lo recoges?' : verbo === 'recibes' ? '¿Cuándo lo recibes?' : '¿Para cuándo?'

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">{pregunta}</h3>
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={pregunta}>
        <button
          type="button"
          role="radio"
          aria-checked={!isScheduled}
          disabled={cerrada}
          onClick={() => { onScheduledChange(false); onTimeChange(null) }}
          className={`p-3 rounded-xl border-2 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
            !isScheduled ? 'border-current shadow-sm' : 'border-gray-200 hover:border-gray-300'
          }`}
          style={!isScheduled ? { borderColor: primaryColor } : {}}
        >
          <Zap className="h-5 w-5 mb-1" aria-hidden="true" style={{ color: !isScheduled ? primaryColor : '#9CA3AF' }} />
          <p className="font-semibold text-sm" style={!isScheduled ? { color: primaryColor } : { color: '#374151' }}>
            Lo antes posible
          </p>
          <p className="text-xs text-gray-500">
            {cerrada ? (proximaApertura || 'Cerrado ahora') : 'Preparamos tu pedido ahora'}
          </p>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={isScheduled}
          onClick={() => onScheduledChange(true)}
          className={`p-3 rounded-xl border-2 text-left transition-all ${
            isScheduled ? 'border-current shadow-sm' : 'border-gray-200 hover:border-gray-300'
          }`}
          style={isScheduled ? { borderColor: primaryColor } : {}}
        >
          <Clock className="h-5 w-5 mb-1" aria-hidden="true" style={{ color: isScheduled ? primaryColor : '#9CA3AF' }} />
          <p className="font-semibold text-sm" style={isScheduled ? { color: primaryColor } : { color: '#374151' }}>
            Programar
          </p>
          <p className="text-xs text-gray-500">Elige el día y la hora</p>
        </button>
      </div>

      {cerrada && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
          <strong className="font-semibold">La sede está cerrada ahora.</strong>{' '}
          Puedes programar tu pedido para cuando abra{proximaApertura ? ` (${proximaApertura.replace(/^Cerrado · /, '').toLowerCase()})` : ''}.
        </div>
      )}

      {isScheduled && conHorario && (
        <div className="mt-3">
          {franjas.length > 0 ? (
            <label className="block">
              <span className="sr-only">Hora del pedido</span>
              <select
                value={scheduledAt && franjas.includes(scheduledAt) ? scheduledAt : franjas[0]}
                onChange={(e) => onTimeChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2"
                style={{ ['--tw-ring-color' as any]: primaryColor }}
              >
                {franjas.map((iso) => (
                  <option key={iso} value={iso}>{momentoPedido(iso, zona, ahora)}</option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm text-gray-500">No hay horas disponibles en los próximos dos días.</p>
          )}
        </div>
      )}

      {isScheduled && !conHorario && (
        <div className="mt-3">
          {timeSlotsLegacy.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {timeSlotsLegacy.map(slot => {
                const isSelected = scheduledAt === slot
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => onTimeChange(slot)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      isSelected
                        ? 'text-white border-transparent'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                    }`}
                    style={isSelected ? { backgroundColor: primaryColor } : {}}
                  >
                    <span className="block text-[10px] text-gray-400 font-normal">
                      {!isSelected && formatDate(slot)}
                    </span>
                    {formatTime(slot)}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No hay horarios disponibles para hoy. Intenta mañana.</p>
          )}
        </div>
      )}
    </div>
  )
}
