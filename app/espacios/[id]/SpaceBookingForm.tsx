'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Users, Check, AlertCircle, CreditCard, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface Gateway {
  code: string
  name: string
}

interface OptionalExtra {
  id: number
  name: string
  chargeType: string
  chargeValue: number
  amount: number
  isTaxable: boolean
}

interface PricingData {
  nights: number
  priceBreakdown: { date: string; price: number; source: string }[]
  subtotal: number
  serviceCharges: { name: string; amount: number; isTaxable: boolean }[]
  chargesTotal: number
  optionalExtras: OptionalExtra[]
  selectedExtrasCharges: { id: number; name: string; amount: number; isTaxable: boolean }[]
  extrasTotal: number
  taxName: string
  taxRate: number
  taxAmount: number
  total: number
}

interface SpaceBookingFormProps {
  organizationId: number
  spaceId: string
  spaceTypeName: string
  capacity: number
  baseRate: number
  primaryColor: string
  gateways: Gateway[]
}

export function SpaceBookingForm({ organizationId, spaceId, spaceTypeName, capacity, baseRate, primaryColor, gateways }: SpaceBookingFormProps) {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    checkin: '',
    checkout: '',
    guests: 1,
    name: '',
    email: '',
    phone: '',
    notes: '',
    gateway: gateways[0]?.code || ''
  })

  // Estado de disponibilidad y pricing
  const [availability, setAvailability] = useState<{ available: boolean; spacesAvailable: number; errors: string[] } | null>(null)
  const [pricing, setPricing] = useState<PricingData | null>(null)
  const [loadingCheck, setLoadingCheck] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [reservationId, setReservationId] = useState<string | null>(null)
  const [selectedExtras, setSelectedExtras] = useState<number[]>([])

  // Verificar disponibilidad y pricing cuando cambian las fechas
  const checkAvailabilityAndPricing = useCallback(async (checkin: string, checkout: string) => {
    if (!checkin || !checkout) {
      setAvailability(null)
      setPricing(null)
      return
    }

    const checkinDate = new Date(checkin)
    const checkoutDate = new Date(checkout)
    if (checkinDate >= checkoutDate) {
      setAvailability(null)
      setPricing(null)
      return
    }

    setLoadingCheck(true)
    setError('')

    try {
      const [availRes, pricingRes] = await Promise.all([
        fetch('/api/reservations/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId, spaceId, checkin, checkout })
        }),
        fetch('/api/reservations/pricing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId, spaceId, checkin, checkout, occupantCount: formData.guests, selectedExtras })
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
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoadingCheck(false)
    }
  }, [organizationId, spaceId, formData.guests, selectedExtras])

  useEffect(() => {
    const timer = setTimeout(() => {
      checkAvailabilityAndPricing(formData.checkin, formData.checkout)
    }, 300)
    return () => clearTimeout(timer)
  }, [formData.checkin, formData.checkout, checkAvailabilityAndPricing])

  // Re-llamar pricing cuando cambian los extras seleccionados (sin re-check availability)
  useEffect(() => {
    if (!formData.checkin || !formData.checkout || !pricing) return
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/reservations/pricing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId, spaceId, checkin: formData.checkin, checkout: formData.checkout, occupantCount: formData.guests, selectedExtras })
        })
        if (res.ok) setPricing(await res.json())
      } catch { /* silently fail */ }
    }, 200)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExtras])

  const handleCreateReservation = async () => {
    setSubmitting(true)
    setError('')

    try {
      // 1. Crear reservación
      const nameParts = formData.name.trim().split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          spaceId,
          checkin: formData.checkin,
          checkout: formData.checkout,
          occupantCount: formData.guests,
          totalEstimated: pricing?.total || 0,
          firstName,
          lastName,
          email: formData.email,
          phone: formData.phone,
          notes: formData.notes,
          pricingData: pricing
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al crear la reservación')
        setSubmitting(false)
        return
      }

      const resId = data.data?.id
      setReservationId(resId)

      // 2. Si hay pasarela seleccionada y monto > 0, redirigir a pago
      if (formData.gateway && pricing && pricing.total > 0) {
        const checkoutRes = await fetch('/api/checkout/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'reservation',
            sourceId: resId,
            gateway: formData.gateway,
            returnUrl: `${window.location.origin}/reserva/${resId}`
          })
        })

        const checkoutData = await checkoutRes.json()

        if (checkoutRes.ok && checkoutData.checkoutUrl) {
          window.location.href = checkoutData.checkoutUrl
          return
        } else {
          // Reservación creada pero no se pudo generar pago — mostrar confirmación tentativa
          console.error('[SpaceBookingForm] Error checkout:', checkoutData)
        }
      }

      // Sin pasarela o monto 0 → mostrar confirmación directa
      setSubmitted(true)
    } catch {
      setError('Error de conexión. Tu reservación puede haberse creado. Verifica tu correo.')
    } finally {
      setSubmitting(false)
    }
  }

  const canContinueStep1 = availability?.available && pricing && !loadingCheck && !error
  const hasVariableRates = pricing?.priceBreakdown?.some(n => n.source === 'rate')

  if (submitted) {
    return (
      <Card className="bg-white dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${primaryColor}20` }}>
            <Check className="h-8 w-8" style={{ color: primaryColor }} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">¡Reserva Recibida!</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Tu reservación para {spaceTypeName} del {formData.checkin} al {formData.checkout} ha sido registrada.
            {gateways.length === 0 && ' Te contactaremos para confirmar el pago.'}
          </p>
          {reservationId && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">ID: {reservationId.substring(0, 8).toUpperCase()}</p>
          )}
          <div className="flex gap-3 justify-center">
            <Link href="/"><Button variant="outline">Ir al inicio</Button></Link>
            <Button onClick={() => {
              setSubmitted(false)
              setStep(1)
              setFormData({ checkin: '', checkout: '', guests: 1, name: '', email: '', phone: '', notes: '', gateway: gateways[0]?.code || '' })
              setAvailability(null)
              setPricing(null)
              setReservationId(null)
            }} style={{ backgroundColor: primaryColor }}>
              Nueva reserva
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const stepWidth = gateways.length > 0 ? `${(step / 3) * 100}%` : `${(step / 2) * 100}%`

  return (
    <Card className="bg-white dark:bg-gray-800 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="text-gray-900 dark:text-white">Reservar {spaceTypeName}</CardTitle>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-2">
          <span className={step >= 1 ? 'font-semibold' : ''} style={step >= 1 ? { color: primaryColor } : {}}>Fechas</span>
          <span>→</span>
          <span className={step >= 2 ? 'font-semibold' : ''} style={step >= 2 ? { color: primaryColor } : {}}>Datos</span>
          {gateways.length > 0 && (
            <>
              <span>→</span>
              <span className={step >= 3 ? 'font-semibold' : ''} style={step >= 3 ? { color: primaryColor } : {}}>Pago</span>
            </>
          )}
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
          <div className="h-2 rounded-full transition-all" style={{ backgroundColor: primaryColor, width: stepWidth }} />
        </div>
      </CardHeader>
      <CardContent>
        {/* ── PASO 1: Fechas + Disponibilidad + Pricing ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Calendar className="h-4 w-4 mr-2" />Check-in
                </label>
                <Input type="date" required min={new Date().toISOString().split('T')[0]} value={formData.checkin} onChange={(e) => setFormData({ ...formData, checkin: e.target.value })} className="dark:[color-scheme:dark]" />
              </div>
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Calendar className="h-4 w-4 mr-2" />Check-out
                </label>
                <Input type="date" required min={formData.checkin || new Date().toISOString().split('T')[0]} value={formData.checkout} onChange={(e) => setFormData({ ...formData, checkout: e.target.value })} className="dark:[color-scheme:dark]" />
              </div>
            </div>
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Users className="h-4 w-4 mr-2" />Huéspedes
              </label>
              <div className="flex items-center gap-4">
                <Button type="button" variant="outline" size="sm" onClick={() => setFormData({ ...formData, guests: Math.max(1, formData.guests - 1) })}>-</Button>
                <span className="text-xl font-semibold w-12 text-center">{formData.guests}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setFormData({ ...formData, guests: Math.min(capacity, formData.guests + 1) })}>+</Button>
                <span className="text-sm text-gray-500 dark:text-gray-400">máx. {capacity}</span>
              </div>
            </div>

            {/* Estado de carga */}
            {loadingCheck && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verificando disponibilidad y precios...
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Sin disponibilidad */}
            {availability && !availability.available && (
              <div className="flex items-start gap-2 text-sm text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Sin disponibilidad</p>
                  {availability.errors.map((e, i) => <p key={i}>{e}</p>)}
                  {availability.spacesAvailable === 0 && !availability.errors.length && <p>No hay habitaciones disponibles para estas fechas.</p>}
                </div>
              </div>
            )}

            {/* Disponible + Pricing */}
            {availability?.available && pricing && (
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-600 dark:text-green-400 font-medium">✓ {availability.spacesAvailable} disponible(s)</span>
                  <span className="text-gray-500 dark:text-gray-400">{pricing.nights} noche(s)</span>
                </div>

                {/* Desglose por noche si hay variación */}
                {hasVariableRates && (
                  <div className="border-t dark:border-gray-700 pt-2 space-y-1">
                    {pricing.priceBreakdown.map((n) => (
                      <div key={n.date} className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>{n.date}</span>
                        <span>${n.price.toLocaleString('es-CO')}{n.source === 'rate' ? ' *' : ''}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                  <span>Subtotal ({pricing.nights} noches)</span>
                  <span>${pricing.subtotal.toLocaleString('es-CO')}</span>
                </div>

                {pricing.serviceCharges.map((sc, i) => (
                  <div key={i} className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span>{sc.name}</span>
                    <span>${sc.amount.toLocaleString('es-CO')}</span>
                  </div>
                ))}

                {/* Extras opcionales */}
                {pricing.optionalExtras && pricing.optionalExtras.length > 0 && (
                  <div className="border-t dark:border-gray-700 pt-2 space-y-2">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Extras opcionales:</p>
                    {pricing.optionalExtras.map((extra) => (
                      <label key={extra.id} className="flex items-center justify-between cursor-pointer group">
                        <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                          <input
                            type="checkbox"
                            checked={selectedExtras.includes(extra.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedExtras([...selectedExtras, extra.id])
                              } else {
                                setSelectedExtras(selectedExtras.filter(id => id !== extra.id))
                              }
                            }}
                            className="rounded"
                            style={{ accentColor: primaryColor }}
                          />
                          {extra.name}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">+${extra.amount.toLocaleString('es-CO')}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Extras seleccionados desglose */}
                {pricing.selectedExtrasCharges && pricing.selectedExtrasCharges.length > 0 && (
                  pricing.selectedExtrasCharges.map((sc) => (
                    <div key={sc.id} className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                      <span>✓ {sc.name}</span>
                      <span>${sc.amount.toLocaleString('es-CO')}</span>
                    </div>
                  ))
                )}

                {pricing.taxAmount > 0 && (
                  <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span>{pricing.taxName} ({pricing.taxRate}%)</span>
                    <span>${pricing.taxAmount.toLocaleString('es-CO')}</span>
                  </div>
                )}

                <div className="flex justify-between font-bold text-lg border-t dark:border-gray-700 pt-2">
                  <span className="text-gray-900 dark:text-white">Total</span>
                  <span style={{ color: primaryColor }}>${pricing.total.toLocaleString('es-CO')}</span>
                </div>

                {hasVariableRates && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">* Tarifa por temporada</p>
                )}
              </div>
            )}

            <Button type="button" className="w-full" style={{ backgroundColor: primaryColor }} disabled={!canContinueStep1} onClick={() => setStep(2)}>
              Continuar
            </Button>
          </div>
        )}

        {/* ── PASO 2: Datos del Huésped ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <p>📅 {formData.checkin} → {formData.checkout} ({pricing?.nights} noches)</p>
                <p>👥 {formData.guests} huésped(es)</p>
                <p className="font-bold text-lg" style={{ color: primaryColor }}>Total: ${pricing?.total.toLocaleString('es-CO')}</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre completo *</label>
              <Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Tu nombre completo" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Correo electrónico *</label>
              <Input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="tu@email.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono *</label>
              <Input type="tel" required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+57 300 123 4567" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas adicionales</label>
              <Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Solicitudes especiales..." />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>Atrás</Button>
              {gateways.length > 0 ? (
                <Button type="button" className="flex-1" style={{ backgroundColor: primaryColor }}
                  disabled={!formData.name || !formData.email || !formData.phone}
                  onClick={() => setStep(3)}>
                  Ir al pago
                </Button>
              ) : (
                <Button type="button" className="flex-1" style={{ backgroundColor: primaryColor }}
                  disabled={!formData.name || !formData.email || !formData.phone || submitting}
                  onClick={handleCreateReservation}>
                  {submitting ? 'Procesando...' : 'Confirmar Reserva'}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── PASO 3: Selección de Pasarela + Pago ── */}
        {step === 3 && gateways.length > 0 && (
          <div className="space-y-5">
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <p>📅 {formData.checkin} → {formData.checkout}</p>
                <p>👤 {formData.name} • {formData.email}</p>
                <p className="font-bold text-lg" style={{ color: primaryColor }}>Total a pagar: ${pricing?.total.toLocaleString('es-CO')}</p>
              </div>
            </div>

            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                <CreditCard className="h-4 w-4 mr-2" />Método de pago
              </label>
              <div className="space-y-2">
                {gateways.map((gw) => (
                  <label key={gw.code} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.gateway === gw.code ? 'border-current' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`} style={formData.gateway === gw.code ? { borderColor: primaryColor } : {}}>
                    <input type="radio" name="gateway" value={gw.code} checked={formData.gateway === gw.code}
                      onChange={(e) => setFormData({ ...formData, gateway: e.target.value })} className="sr-only" />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.gateway === gw.code ? '' : 'border-gray-300 dark:border-gray-600'}`}
                      style={formData.gateway === gw.code ? { borderColor: primaryColor } : {}}>
                      {formData.gateway === gw.code && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />}
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{gw.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(2)}>Atrás</Button>
              <Button type="button" className="flex-1" style={{ backgroundColor: primaryColor }}
                disabled={!formData.gateway || submitting}
                onClick={handleCreateReservation}>
                {submitting ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Procesando...</span>
                ) : 'Pagar ahora'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
