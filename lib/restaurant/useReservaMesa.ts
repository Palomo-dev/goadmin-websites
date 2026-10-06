'use client'

/**
 * Llamadas del sitio a `/api/restaurant-reservations/**` (disponibilidad y
 * creación), compartidas por `reservation_cta` (ReservationCtaForm) y
 * `reservation` (ReservationView). La lógica de negocio vive en las RPC
 * `get_restaurant_availability` / `create_restaurant_reservation`; aquí sólo
 * hay estado de interfaz y la traducción de respuestas a mensajes.
 *
 * El comportamiento (mensajes, estados, campos enviados) es el que tenía
 * ReservationCtaForm antes de la extracción.
 */

import { useCallback, useState } from 'react'

export type EstadoReserva = 'idle' | 'checking' | 'submitting' | 'success' | 'error' | 'no_availability'

export interface FranjaDisponible {
  time: string
  available: boolean
  remaining: number
}

export interface ReservaCreada {
  id: string
  code: string
  /** `confirmed` o `pending` (la sede exige confirmación del equipo). */
  status: string
  date: string
  time: string
  partySize: number
}

export interface DatosReserva {
  date: string
  time: string
  guests: number
  name: string
  phone: string
  email: string
  notes?: string
  zone?: string | null
}

interface Opciones {
  organizationId: number | null | undefined
  /** Sede de la reserva; `null` = la organización (la RPC busca mesa en todas). */
  branchId: number | null
  slotInterval: string
  /** Mensaje genérico si la API falla sin detalle. */
  errorMessage: string
  /** Prefijo de los registros de consola. */
  origen?: string
  /**
   * Vaciar las horas si la respuesta no trae `slots`. ReservationCtaForm
   * conserva las anteriores (comportamiento histórico); las vistas nuevas no.
   */
  limpiarFranjas?: boolean
}

function esReservaCreada(v: unknown): v is ReservaCreada {
  return typeof v === 'object' && v !== null && 'code' in v && 'date' in v
}

export function useReservaMesa({ organizationId, branchId, slotInterval, errorMessage, origen = 'ReservationCtaForm', limpiarFranjas = false }: Opciones) {
  const [honeypot, setHoneypot] = useState('')
  const [status, setStatus] = useState<EstadoReserva>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [suggestedTimes, setSuggestedTimes] = useState<string[]>([])
  const [availableSlots, setAvailableSlots] = useState<FranjaDisponible[]>([])
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  /** true cuando ya hubo una respuesta de disponibilidad para la fecha actual. */
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false)
  const [reservationResult, setReservationResult] = useState<ReservaCreada | null>(null)

  /** Error de validación en el cliente (antes de llamar a la API). */
  const fallar = useCallback((mensaje: string) => {
    setErrorMsg(mensaje)
    setStatus('error')
  }, [])

  const checkAvailability = useCallback(
    async (date: string, time: string, guests: number, zone?: string | null) => {
      if (!organizationId || !date) return
      setAvailabilityLoading(true)
      setAvailabilityLoaded(false)
      setErrorMsg('')
      setSuggestedTimes([])

      try {
        const params = new URLSearchParams({
          organizationId: String(organizationId),
          date,
          partySize: String(guests),
          slotInterval,
        })
        if (time) params.set('time', time)
        if (zone) params.set('zone', zone)
        // Sólo para calcular «hoy» en la zona de la sede.
        if (branchId) params.set('branchId', String(branchId))

        const res = await fetch(`/api/restaurant-reservations/availability?${params}`)
        const data = await res.json()

        if (data.slots) {
          setAvailableSlots(data.slots)
        } else if (limpiarFranjas && !time) {
          setAvailableSlots([])
        }

        if (time) {
          // Modo hora específica
          if (!data.available) {
            setSuggestedTimes(data.suggestedTimes || [])
          }
        }
      } catch (e) {
        // Error silencioso: no bloquea el formulario
        console.error(`[${origen}] Availability check error:`, e)
      } finally {
        setAvailabilityLoading(false)
        setAvailabilityLoaded(true)
      }
    },
    [organizationId, slotInterval, branchId, origen, limpiarFranjas],
  )

  const submit = useCallback(
    async (datos: DatosReserva) => {
      if (!organizationId) {
        fallar('No se pudo identificar el restaurante.')
        return
      }
      setStatus('submitting')
      setErrorMsg('')

      try {
        const res = await fetch('/api/restaurant-reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId,
            // `organizations` no tiene `branch_id`: la sede llega de la página o del selector.
            branchId,
            date: datos.date,
            time: datos.time,
            partySize: datos.guests,
            name: datos.name,
            phone: datos.phone,
            email: datos.email,
            ...(datos.notes ? { notes: datos.notes } : {}),
            ...(datos.zone ? { zone: datos.zone } : {}),
            website: honeypot, // honeypot — debe estar vacío
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          if (data.suggestedTimes && data.suggestedTimes.length > 0) {
            setSuggestedTimes(data.suggestedTimes)
            setStatus('no_availability')
            setErrorMsg(data.error || 'No hay disponibilidad para esa hora.')
          } else {
            setStatus('error')
            setErrorMsg(data.error || errorMessage)
          }
          return
        }

        setReservationResult(esReservaCreada(data.data) ? data.data : null)
        setStatus('success')
      } catch (err) {
        console.error(`[${origen}] Submit error:`, err)
        setStatus('error')
        setErrorMsg(errorMessage)
      }
    },
    [organizationId, branchId, honeypot, errorMessage, fallar, origen],
  )

  const reiniciar = useCallback(() => {
    setStatus('idle')
    setReservationResult(null)
    setErrorMsg('')
    setSuggestedTimes([])
  }, [])

  return {
    honeypot,
    setHoneypot,
    status,
    setStatus,
    errorMsg,
    setErrorMsg,
    suggestedTimes,
    availableSlots,
    availabilityLoading,
    availabilityLoaded,
    reservationResult,
    fallar,
    checkAvailability,
    submit,
    reiniciar,
  }
}
