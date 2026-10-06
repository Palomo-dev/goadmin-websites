'use client'

import { useState, useEffect, useCallback } from 'react'
import { trackMetaSchedule } from '@/components/site/MetaPixelEvents'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Users, Check, AlertCircle, CreditCard, Loader2, Bed } from 'lucide-react'
import Link from 'next/link'
import { TelefonoPais } from '@/components/site/TelefonoPais'

interface SpaceType {
  id: string
  name: string
  short_name?: string
  base_rate: number
  capacity: number
  area_sqm?: number
  amenities?: Record<string, boolean>
}

interface PricingData {
  nights: number
  priceBreakdown: { date: string; price: number; source: string }[]
  subtotal: number
  serviceCharges: { name: string; amount: number; isTaxable: boolean }[]
  chargesTotal: number
  taxName: string
  taxRate: number
  taxAmount: number
  total: number
}

interface MultiPricingData {
  nights: number
  rooms: { spaceTypeId: string; name: string; quantity: number; baseRate: number; nightlyBreakdown: { date: string; price: number; source: string }[]; subtotal: number }[]
  totalSubtotal: number
  serviceCharges: { name: string; amount: number; isTaxable: boolean }[]
  chargesTotal: number
  optionalExtras: any[]
  selectedExtrasCharges: any[]
  extrasTotal: number
  taxName: string
  taxRate: number
  taxAmount: number
  grandTotal: number
}

interface ReservationWizardProps {
  organizationId: number
  organizationName: string
  spaceTypes: SpaceType[]
  primaryColor: string
  gateways: { code: string; name: string }[]
}

const STEPS = [
  { id: 1, name: 'Espacio' },
  { id: 2, name: 'Fechas' },
  { id: 3, name: 'Datos' },
  { id: 4, name: 'Pago' },
]

export function ReservationWizard({ organizationId, organizationName, spaceTypes, primaryColor, gateways }: ReservationWizardProps) {
  const [step, setStep] = useState(1)
  const [selectedSpaceType, setSelectedSpaceType] = useState<SpaceType | null>(null)
  const [roomSelections, setRoomSelections] = useState<Record<string, number>>({})
  const [checkin, setCheckin] = useState('')
  const [checkout, setCheckout] = useState('')
  const [guests, setGuests] = useState(1)
  const [guestData, setGuestData] = useState({ name: '', email: '', phone: '', notes: '' })
  const [gateway, setGateway] = useState(gateways[0]?.code || '')

  // Multi-room helpers
  const selectedRooms = Object.entries(roomSelections).filter(([, qty]) => qty > 0).map(([id, qty]) => ({ spaceTypeId: id, quantity: qty }))
  const totalRooms = selectedRooms.reduce((sum, r) => sum + r.quantity, 0)
  const isMultiRoom = totalRooms > 1 || selectedRooms.length > 1

  // Availability + Pricing
  const [availability, setAvailability] = useState<{ available: boolean; spacesAvailable: number; errors: string[] } | null>(null)
  const [pricing, setPricing] = useState<PricingData | null>(null)
  const [multiPricing, setMultiPricing] = useState<MultiPricingData | null>(null)
  const [loadingCheck, setLoadingCheck] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [reservationId, setReservationId] = useState<string | null>(null)
  const checkAvailabilityAndPricing = useCallback(async () => {
    const hasSelection = isMultiRoom ? selectedRooms.length > 0 : !!selectedSpaceType
    if (!hasSelection || !checkin || !checkout) {
      setAvailability(null)
      setPricing(null)
      setMultiPricing(null)
      return
    }

    if (new Date(checkin) >= new Date(checkout)) {
      setAvailability(null)
      setPricing(null)
      setMultiPricing(null)
      return
    }

    setLoadingCheck(true)
    setError('')

    try {
      if (isMultiRoom) {
        // Multi-room: usar pricing/multi
        const pricingRes = await fetch('/api/reservations/pricing/multi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId, checkin, checkout, rooms: selectedRooms, occupantCount: guests })
        })
        const pricingData = await pricingRes.json()
        if (pricingRes.ok) {
          setMultiPricing(pricingData)
          setPricing(null)
          setAvailability({ available: true, spacesAvailable: totalRooms, errors: [] })
        } else {
          setError(pricingData.error || 'Error calculando precios')
        }
      } else {
        // Single-room: flujo original
        const stId = selectedSpaceType?.id || selectedRooms[0]?.spaceTypeId
        const [availRes, pricingRes] = await Promise.all([
          fetch('/api/reservations/availability', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ organizationId, spaceTypeId: stId, checkin, checkout })
          }),
          fetch('/api/reservations/pricing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ organizationId, spaceTypeId: stId, checkin, checkout, occupantCount: guests })
          })
        ])

        const availData = await availRes.json()
        const pricingData = await pricingRes.json()

        if (!availRes.ok) {
          setError(availData.error || 'Error verificando disponibilidad')
          setAvailability(null)
        } else {
          setAvailability(availData)
        }

        if (pricingRes.ok) {
          setPricing(pricingData)
          setMultiPricing(null)
        }
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoadingCheck(false)
    }
  }, [organizationId, selectedSpaceType, checkin, checkout, guests, isMultiRoom, selectedRooms, totalRooms])

  useEffect(() => {
    if (step !== 2) return
    const timer = setTimeout(() => {
      checkAvailabilityAndPricing()
    }, 300)
    return () => clearTimeout(timer)
  }, [checkin, checkout, guests, checkAvailabilityAndPricing, step])

  const handleCreateReservation = async () => {
    const hasSelection = isMultiRoom ? selectedRooms.length > 0 : !!selectedSpaceType
    if (!hasSelection) return
    setSubmitting(true)
    setError('')

    try {
      const nameParts = guestData.name.trim().split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      const finalTotal = isMultiRoom ? (multiPricing?.grandTotal || 0) : (pricing?.total || 0)
      const finalPricingData = isMultiRoom ? multiPricing : pricing

      const reservationBody: any = {
        organizationId,
        checkin, checkout,
        occupantCount: guests,
        totalEstimated: finalTotal,
        firstName, lastName,
        email: guestData.email,
        phone: guestData.phone,
        notes: guestData.notes,
        pricingData: finalPricingData
      }

      if (isMultiRoom) {
        reservationBody.rooms = selectedRooms
        reservationBody.spaceTypeId = selectedRooms[0]?.spaceTypeId
      } else {
        reservationBody.spaceTypeId = selectedSpaceType?.id || selectedRooms[0]?.spaceTypeId
      }

      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reservationBody)
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al crear la reservación')
        setSubmitting(false)
        return
      }

      const resId = data.data?.id
      setReservationId(resId)

      // Meta Pixel: Schedule
      trackMetaSchedule(finalTotal || 0)

      // Si hay gateway y monto > 0, redirigir a pago
      if (gateway && finalTotal > 0) {
        const checkoutRes = await fetch('/api/checkout/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'reservation',
            sourceId: resId,
            gateway,
            returnUrl: `${window.location.origin}/reserva/${resId}`
          })
        })
        const checkoutData = await checkoutRes.json()
        if (checkoutRes.ok && checkoutData.checkoutUrl) {
          window.location.href = checkoutData.checkoutUrl
          return
        }
      }

      setSubmitted(true)
    } catch {
      setError('Error de conexión.')
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setStep(1)
    setSelectedSpaceType(null)
    setRoomSelections({})
    setCheckin('')
    setCheckout('')
    setGuests(1)
    setGuestData({ name: '', email: '', phone: '', notes: '' })
    setAvailability(null)
    setPricing(null)
    setMultiPricing(null)
    setSubmitted(false)
    setReservationId(null)
    setError('')
  }

  const canContinueStep2 = availability?.available && (pricing || multiPricing) && !loadingCheck && !error
  const hasVariableRates = pricing?.priceBreakdown?.some(n => n.source === 'rate')
  const displayTotal = isMultiRoom ? (multiPricing?.grandTotal || 0) : (pricing?.total || 0)
  const displayNights = isMultiRoom ? (multiPricing?.nights || 0) : (pricing?.nights || 0)

  // Helper para obtener nombre de room selection
  const getRoomSummary = () => {
    if (!isMultiRoom && selectedSpaceType) return selectedSpaceType.name
    return selectedRooms.map(r => {
      const st = spaceTypes.find(s => s.id === r.spaceTypeId)
      return `${r.quantity}x ${st?.name || 'Habitación'}`
    }).join(', ')
  }
  const today = new Date().toISOString().split('T')[0]

  // ── Confirmación ──
  if (submitted) {
    return (
      <div className="max-w-lg mx-auto">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${primaryColor}20` }}>
              <Check className="h-8 w-8" style={{ color: primaryColor }} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Reserva Recibida!</h2>
            <p className="text-gray-600 mb-2">
              {getRoomSummary()} • {checkin} → {checkout}
            </p>
            <p className="text-gray-500 text-sm mb-6">
              Te enviaremos la confirmación a {guestData.email}
            </p>
            {reservationId && (
              <Link href={`/reserva/${reservationId}`} className="text-sm font-medium underline mb-6 block" style={{ color: primaryColor }}>
                Ver mi reservación
              </Link>
            )}
            <div className="flex gap-3 justify-center">
              <Link href="/"><Button variant="outline">Ir al inicio</Button></Link>
              <Button onClick={resetForm} style={{ backgroundColor: primaryColor }}>Nueva reserva</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Reservar Espacio</h1>
        <p className="text-gray-600">Completa los pasos para realizar tu reserva en {organizationName}</p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((s, idx) => (
            <div key={s.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    step >= s.id ? 'text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                  style={step >= s.id ? { backgroundColor: primaryColor } : {}}
                >
                  {s.id}
                </div>
                <span className="text-xs mt-1 text-gray-600 hidden sm:block">{s.name}</span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`w-12 sm:w-20 h-1 mx-2 rounded transition-colors ${step > s.id ? '' : 'bg-gray-200'}`}
                  style={step > s.id ? { backgroundColor: primaryColor } : {}}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {step === 1 && 'Selecciona tu espacio'}
            {step === 2 && 'Elige las fechas'}
            {step === 3 && 'Tus datos'}
            {step === 4 && 'Confirmar y pagar'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* ── PASO 1: Seleccionar habitaciones ── */}
          {step === 1 && (
            <div className="space-y-3">
              {spaceTypes.length === 0 && (
                <p className="text-center text-gray-500 py-8">No hay espacios disponibles en este momento.</p>
              )}
              <p className="text-sm text-gray-500">Selecciona la cantidad de habitaciones por tipo:</p>
              {spaceTypes.map((st) => {
                const qty = roomSelections[st.id] || 0
                const isSelected = qty > 0
                return (
                  <div
                    key={st.id}
                    className={`p-4 rounded-xl border-2 transition-all ${isSelected ? '' : 'border-gray-200'}`}
                    style={isSelected ? { borderColor: primaryColor, backgroundColor: `${primaryColor}08` } : {}}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
                          <Bed className="h-6 w-6" style={{ color: primaryColor }} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{st.name}</h3>
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            <span><Users className="h-3 w-3 inline mr-1" />{st.capacity} pers.</span>
                            {st.area_sqm && <span>{st.area_sqm} m²</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right mr-3">
                          <p className="font-bold text-lg" style={{ color: primaryColor }}>${st.base_rate.toLocaleString('es-CO')}</p>
                          <p className="text-xs text-gray-400">/ noche</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const newQty = Math.max(0, qty - 1)
                              setRoomSelections({ ...roomSelections, [st.id]: newQty })
                              if (newQty === 0 && selectedSpaceType?.id === st.id) setSelectedSpaceType(null)
                            }}
                            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
                          >−</button>
                          <span className="w-6 text-center font-semibold">{qty}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const newQty = qty + 1
                              setRoomSelections({ ...roomSelections, [st.id]: newQty })
                              if (newQty === 1 && !selectedSpaceType) setSelectedSpaceType(st)
                            }}
                            className="w-8 h-8 rounded-full border flex items-center justify-center text-white transition-colors"
                            style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
                          >+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}

              {totalRooms > 0 && (
                <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                  <span className="font-medium">{totalRooms} habitación(es) seleccionada(s)</span>
                  {isMultiRoom && <span className="text-xs text-gray-400 ml-2">(reserva multi-habitación)</span>}
                </div>
              )}

              <Button type="button" className="w-full mt-4" style={{ backgroundColor: primaryColor }}
                disabled={totalRooms < 1} onClick={() => setStep(2)}>
                Continuar
              </Button>
            </div>
          )}

          {/* ── PASO 2: Fechas + Disponibilidad + Pricing ── */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Resumen de selección */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg text-sm">
                <Bed className="h-4 w-4" style={{ color: primaryColor }} />
                <span className="font-medium">{getRoomSummary()}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="h-4 w-4 mr-2" />Check-in
                  </label>
                  <Input type="date" min={today} value={checkin} onChange={(e) => setCheckin(e.target.value)} />
                </div>
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="h-4 w-4 mr-2" />Check-out
                  </label>
                  <Input type="date" min={checkin || today} value={checkout} onChange={(e) => setCheckout(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <Users className="h-4 w-4 mr-2" />Huéspedes
                </label>
                <div className="flex items-center gap-4">
                  <Button type="button" variant="outline" size="sm" onClick={() => setGuests(Math.max(1, guests - 1))}>-</Button>
                  <span className="text-xl font-semibold w-12 text-center">{guests}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => setGuests(guests + 1)}>+</Button>
                </div>
              </div>

              {loadingCheck && (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />Verificando disponibilidad y precios...
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /><span>{error}</span>
                </div>
              )}

              {availability && !availability.available && (
                <div className="flex items-start gap-2 text-sm text-orange-700 bg-orange-50 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Sin disponibilidad</p>
                    {availability.errors.map((e, i) => <p key={i}>{e}</p>)}
                    {availability.spacesAvailable === 0 && !availability.errors.length && <p>No hay habitaciones disponibles para estas fechas.</p>}
                  </div>
                </div>
              )}

              {/* Pricing single-room */}
              {availability?.available && pricing && !isMultiRoom && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-600 font-medium">✓ {availability.spacesAvailable} disponible(s)</span>
                    <span className="text-gray-500">{pricing.nights} noche(s)</span>
                  </div>

                  {hasVariableRates && (
                    <div className="border-t pt-2 space-y-1">
                      {pricing.priceBreakdown.map((n) => (
                        <div key={n.date} className="flex justify-between text-xs text-gray-500">
                          <span>{n.date}</span>
                          <span>${n.price.toLocaleString('es-CO')}{n.source === 'rate' ? ' *' : ''}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal ({pricing.nights} noches)</span>
                    <span>${pricing.subtotal.toLocaleString('es-CO')}</span>
                  </div>

                  {pricing.serviceCharges.map((sc, i) => (
                    <div key={i} className="flex justify-between text-sm text-gray-500">
                      <span>{sc.name}</span><span>${sc.amount.toLocaleString('es-CO')}</span>
                    </div>
                  ))}

                  {pricing.taxAmount > 0 && (
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>{pricing.taxName} ({pricing.taxRate}%)</span>
                      <span>${pricing.taxAmount.toLocaleString('es-CO')}</span>
                    </div>
                  )}

                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total</span>
                    <span style={{ color: primaryColor }}>${pricing.total.toLocaleString('es-CO')}</span>
                  </div>

                  {hasVariableRates && <p className="text-xs text-gray-400">* Tarifa por temporada</p>}
                </div>
              )}

              {/* Pricing multi-room */}
              {availability?.available && multiPricing && isMultiRoom && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-600 font-medium">✓ Disponible</span>
                    <span className="text-gray-500">{multiPricing.nights} noche(s) • {totalRooms} habitación(es)</span>
                  </div>

                  {multiPricing.rooms.map((room) => (
                    <div key={room.spaceTypeId} className="border-t pt-2">
                      <div className="flex justify-between text-sm text-gray-700">
                        <span className="font-medium">{room.quantity}x {room.name}</span>
                        <span>${room.subtotal.toLocaleString('es-CO')}</span>
                      </div>
                      <p className="text-xs text-gray-400">${room.baseRate.toLocaleString('es-CO')}/noche × {multiPricing.nights} noches × {room.quantity}</p>
                    </div>
                  ))}

                  <div className="flex justify-between text-sm text-gray-600 border-t pt-2">
                    <span>Subtotal</span>
                    <span>${multiPricing.totalSubtotal.toLocaleString('es-CO')}</span>
                  </div>

                  {multiPricing.serviceCharges.map((sc, i) => (
                    <div key={i} className="flex justify-between text-sm text-gray-500">
                      <span>{sc.name}</span><span>${sc.amount.toLocaleString('es-CO')}</span>
                    </div>
                  ))}

                  {multiPricing.taxAmount > 0 && (
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>{multiPricing.taxName} ({multiPricing.taxRate}%)</span>
                      <span>${multiPricing.taxAmount.toLocaleString('es-CO')}</span>
                    </div>
                  )}

                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total</span>
                    <span style={{ color: primaryColor }}>${multiPricing.grandTotal.toLocaleString('es-CO')}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>Atrás</Button>
                <Button type="button" className="flex-1" style={{ backgroundColor: primaryColor }}
                  disabled={!canContinueStep2} onClick={() => setStep(3)}>
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {/* ── PASO 3: Datos del Huésped ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-1">
                <p>🏨 {getRoomSummary()}</p>
                <p>📅 {checkin} → {checkout} ({displayNights} noches)</p>
                <p className="font-bold text-lg" style={{ color: primaryColor }}>Total: ${displayTotal.toLocaleString('es-CO')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                <Input required value={guestData.name} onChange={(e) => setGuestData({ ...guestData, name: e.target.value })} placeholder="Tu nombre completo" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico *</label>
                <Input type="email" required value={guestData.email} onChange={(e) => setGuestData({ ...guestData, email: e.target.value })} placeholder="tu@email.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono *</label>
                <TelefonoPais required className="rounded-md border border-input bg-background text-sm [&_input]:h-9" value={guestData.phone} onChange={(v) => setGuestData({ ...guestData, phone: v })} aria-label="Teléfono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas adicionales</label>
                <Input value={guestData.notes} onChange={(e) => setGuestData({ ...guestData, notes: e.target.value })} placeholder="Solicitudes especiales..." />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(2)}>Atrás</Button>
                <Button type="button" className="flex-1" style={{ backgroundColor: primaryColor }}
                  disabled={!guestData.name || !guestData.email || !guestData.phone}
                  onClick={() => setStep(4)}>
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {/* ── PASO 4: Resumen + Pago ── */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-1">
                <p>🏨 {getRoomSummary()}</p>
                <p>📅 {checkin} → {checkout} ({displayNights} noches) • 👥 {guests}</p>
                <p>👤 {guestData.name} • {guestData.email}</p>
                <p className="font-bold text-lg" style={{ color: primaryColor }}>Total: ${displayTotal.toLocaleString('es-CO')}</p>
              </div>

              {gateways.length > 0 && (
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 mb-3">
                    <CreditCard className="h-4 w-4 mr-2" />Método de pago
                  </label>
                  <div className="space-y-2">
                    {gateways.map((gw) => (
                      <label key={gw.code} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        gateway === gw.code ? '' : 'border-gray-200 hover:border-gray-300'
                      }`} style={gateway === gw.code ? { borderColor: primaryColor } : {}}>
                        <input type="radio" name="gateway" value={gw.code} checked={gateway === gw.code}
                          onChange={(e) => setGateway(e.target.value)} className="sr-only" />
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${gateway === gw.code ? '' : 'border-gray-300'}`}
                          style={gateway === gw.code ? { borderColor: primaryColor } : {}}>
                          {gateway === gw.code && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />}
                        </div>
                        <span className="text-sm font-medium">{gw.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /><span>{error}</span>
                </div>
              )}

              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(3)}>Atrás</Button>
                <Button type="button" className="flex-1" style={{ backgroundColor: primaryColor }}
                  disabled={submitting}
                  onClick={handleCreateReservation}>
                  {submitting ? (
                    <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Procesando...</span>
                  ) : gateways.length > 0 && gateway ? 'Pagar ahora' : 'Confirmar Reserva'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
