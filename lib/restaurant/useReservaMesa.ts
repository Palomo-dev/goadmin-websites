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

import { useCallback, useEffect, useState } from 'react'
import { parseCotizacion, parseDepositoCreado, SIN_DEPOSITO, type CotizacionDeposito, type DepositoCreado } from './deposito-modelo'

export type EstadoReserva = 'idle' | 'checking' | 'submitting' | 'paying' | 'success' | 'error' | 'no_availability'

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
  /** Ruta de gestión por token (`/reserva/mesa/<token>`), si la base ya emite tokens (migración D2). */
  manageUrl?: string
  /** Depósito por pagar (migración D7): la reserva queda «pendiente de pago». */
  deposito?: DepositoCreado | null
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

/**
 * ¿La sede pide depósito? Una consulta por sede (la ruta resuelve la
 * organización por el host). Mientras carga, o si falla, sin depósito: la
 * base vuelve a decidir al crear la reserva.
 */
export function useCotizacionDeposito(organizationId: number | null | undefined, branchId: number | null): CotizacionDeposito {
  const [cotizacion, setCotizacion] = useState<CotizacionDeposito>(SIN_DEPOSITO)
  useEffect(() => {
    if (!organizationId) return
    let vivo = true
    const params = new URLSearchParams({ organizationId: String(organizationId), partySize: '1' })
    if (branchId) params.set('branchId', String(branchId))
    fetch(`/api/restaurant-reservations/deposito?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => vivo && setCotizacion(parseCotizacion(d)))
      .catch(() => vivo && setCotizacion(SIN_DEPOSITO))
    return () => {
      vivo = false
    }
  }, [organizationId, branchId])
  return cotizacion
}

/**
 * Cobro del depósito con la pasarela de la organización: el MISMO
 * `/api/checkout/init` de los pedidos (fuente `restaurant_reservation`). Al
 * volver de la pasarela, el cliente llega a la página de su reserva, que dice
 * si el pago ya se confirmó.
 */
async function urlDePagoDeposito(reserva: ReservaCreada, pago: { source: string; sourceId: string; gateway: string }): Promise<string> {
  const retorno = reserva.manageUrl ? `${window.location.origin}${reserva.manageUrl}` : window.location.href.split('?')[0]
  const res = await fetch('/api/checkout/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gateway: pago.gateway, returnUrl: retorno, source: pago.source, sourceId: pago.sourceId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || typeof data.checkoutUrl !== 'string') {
    throw new Error(typeof data.error === 'string' ? data.error : 'No se pudo abrir el pago.')
  }
  return data.checkoutUrl
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
        // La sede fija «hoy» en su zona horaria y, con la RPC por sede, sus
        // horas y sus mesas: las mismas con las que luego se valida la reserva.
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

        const creada: ReservaCreada | null = esReservaCreada(data.data)
          ? { ...data.data, deposito: parseDepositoCreado(data.data.deposito) }
          : null
        setReservationResult(creada)
        const pago = data.data?.pago
        if (creada?.deposito && pago && typeof pago.sourceId === 'string' && typeof pago.gateway === 'string') {
          // Con depósito: directo a la pasarela. Si no abre, la reserva queda
          // pendiente de pago (se libera sola) y se ofrece reintentar.
          setStatus('paying')
          try {
            window.location.assign(await urlDePagoDeposito(creada, pago))
          } catch (e) {
            setStatus('success')
            setErrorMsg(e instanceof Error ? e.message : 'No se pudo abrir el pago.')
          }
          return
        } else {
          setStatus('success')
        }
      } catch (err) {
        console.error(`[${origen}] Submit error:`, err)
        setStatus('error')
        setErrorMsg(errorMessage)
      }
    },
    [organizationId, branchId, honeypot, errorMessage, fallar, origen],
  )

  /** Reintentar el pago del depósito de la reserva ya creada. */
  const pagarDeposito = useCallback(async () => {
    const r = reservationResult
    if (!r?.deposito) return
    setStatus('paying')
    setErrorMsg('')
    try {
      window.location.assign(
        await urlDePagoDeposito(r, { source: 'restaurant_reservation', sourceId: r.id, gateway: r.deposito.pasarela }),
      )
    } catch (e) {
      setStatus('success')
      setErrorMsg(e instanceof Error ? e.message : 'No se pudo abrir el pago.')
    }
  }, [reservationResult])

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
    pagarDeposito,
    reiniciar,
  }
}
