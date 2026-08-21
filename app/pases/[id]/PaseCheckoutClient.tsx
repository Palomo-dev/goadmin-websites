'use client'

import { useState } from 'react'
import { Car, User, CreditCard, Check, Droplets, Star, Loader2, AlertCircle } from 'lucide-react'

interface Gateway { code: string; name: string }

interface PaseCheckoutClientProps {
  passType: any
  gateways: Gateway[]
  primaryColor: string
  organizationId: number
  organizationName: string
}

type Step = 'info' | 'payment' | 'processing' | 'success' | 'error'

const GATEWAY_LABELS: Record<string, string> = {
  wompi_co: 'Wompi',
  mp_checkout: 'MercadoPago',
  payu_co: 'PayU',
  stripe_payments: 'Tarjeta (Stripe)',
  paypal_checkout: 'PayPal',
}

const GATEWAY_ICONS: Record<string, string> = {
  wompi_co: '💳',
  mp_checkout: '🔵',
  payu_co: '💚',
  stripe_payments: '💜',
  paypal_checkout: '🟡',
}

export function PaseCheckoutClient({
  passType,
  gateways,
  primaryColor,
  organizationId,
  organizationName,
}: PaseCheckoutClientProps) {
  const [step, setStep] = useState<Step>('info')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Form fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [docType, setDocType] = useState('CC')
  const [docNumber, setDocNumber] = useState('')
  const [plate, setPlate] = useState('')
  const [vehicleBrand, setVehicleBrand] = useState('')
  const [vehicleModel, setVehicleModel] = useState('')
  const [vehicleColor, setVehicleColor] = useState('')
  const [vehicleType, setVehicleType] = useState('car')
  const [selectedGateway, setSelectedGateway] = useState(gateways[0]?.code || '')

  const price = Number(passType.price || 0)

  async function handleSubmit() {
    setError('')

    // Validaciones
    if (!name.trim()) return setError('Ingresa tu nombre completo')
    if (!email.trim() || !email.includes('@')) return setError('Ingresa un email válido')
    if (!plate.trim()) return setError('Ingresa la placa del vehículo')
    if (!selectedGateway) return setError('Selecciona un método de pago')

    setLoading(true)
    setStep('processing')

    try {
      // 1. Crear el pase
      const passRes = await fetch('/api/parking/passes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          passTypeId: passType.id,
          customerEmail: email.trim(),
          customerName: name.trim(),
          customerPhone: phone.trim() || undefined,
          customerDocType: docType,
          customerDocNumber: docNumber.trim() || undefined,
          vehiclePlate: plate.trim(),
          vehicleBrand: vehicleBrand.trim() || undefined,
          vehicleModel: vehicleModel.trim() || undefined,
          vehicleColor: vehicleColor.trim() || undefined,
          vehicleType,
        }),
      })

      const passData = await passRes.json()

      if (!passRes.ok) {
        setError(passData.error || 'Error al crear el pase')
        setStep('info')
        setLoading(false)
        return
      }

      // 2. Iniciar checkout
      const checkoutRes = await fetch('/api/checkout/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'parking_pass',
          sourceId: passData.passId,
          gateway: selectedGateway,
          returnUrl: `${window.location.origin}/pases?status=success&ref=${passData.passReference}`,
        }),
      })

      const checkoutData = await checkoutRes.json()

      if (!checkoutRes.ok || !checkoutData.checkoutUrl) {
        setError(checkoutData.error || 'Error al generar el enlace de pago')
        setStep('info')
        setLoading(false)
        return
      }

      // 3. Redirigir a la pasarela
      window.location.href = checkoutData.checkoutUrl
    } catch (err: any) {
      setError('Error de conexión. Intenta de nuevo.')
      setStep('info')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Columna izquierda: Formulario */}
        <div className="lg:col-span-3 space-y-6">
          {/* Stepper */}
          <StepIndicator current={step} primaryColor={primaryColor} />

          {step === 'processing' && (
            <div className="bg-white rounded-xl border p-12 text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" style={{ color: primaryColor }} />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Procesando tu pase...</h3>
              <p className="text-gray-500 text-sm">Te redirigiremos a la pasarela de pago en un momento</p>
            </div>
          )}

          {(step === 'info' || step === 'payment') && (
            <>
              {/* Datos personales */}
              <div className="bg-white rounded-xl border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-5 w-5" style={{ color: primaryColor }} />
                  <h3 className="font-bold text-gray-900">Datos Personales</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 mb-1">Nombre completo *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Ej: Juan Pérez"
                      className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
                      style={{ '--tw-ring-color': primaryColor } as any}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Email *</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
                      style={{ '--tw-ring-color': primaryColor } as any}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Teléfono</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="300 123 4567"
                      className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
                      style={{ '--tw-ring-color': primaryColor } as any}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Tipo documento</label>
                    <select
                      value={docType}
                      onChange={e => setDocType(e.target.value)}
                      className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 bg-white"
                      style={{ '--tw-ring-color': primaryColor } as any}
                    >
                      <option value="CC">C.C.</option>
                      <option value="CE">C.E.</option>
                      <option value="NIT">NIT</option>
                      <option value="PP">Pasaporte</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Número documento</label>
                    <input
                      type="text"
                      value={docNumber}
                      onChange={e => setDocNumber(e.target.value)}
                      placeholder="1.234.567.890"
                      className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
                      style={{ '--tw-ring-color': primaryColor } as any}
                    />
                  </div>
                </div>
              </div>

              {/* Datos del vehículo */}
              <div className="bg-white rounded-xl border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Car className="h-5 w-5" style={{ color: primaryColor }} />
                  <h3 className="font-bold text-gray-900">Datos del Vehículo</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Placa *</label>
                    <input
                      type="text"
                      value={plate}
                      onChange={e => setPlate(e.target.value.toUpperCase())}
                      placeholder="ABC 123"
                      maxLength={10}
                      className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 uppercase font-mono"
                      style={{ '--tw-ring-color': primaryColor } as any}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Tipo de vehículo</label>
                    <select
                      value={vehicleType}
                      onChange={e => setVehicleType(e.target.value)}
                      className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 bg-white"
                      style={{ '--tw-ring-color': primaryColor } as any}
                    >
                      <option value="car">Automóvil</option>
                      <option value="motorcycle">Motocicleta</option>
                      <option value="truck">Camioneta</option>
                      <option value="bicycle">Bicicleta</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Marca</label>
                    <input
                      type="text"
                      value={vehicleBrand}
                      onChange={e => setVehicleBrand(e.target.value)}
                      placeholder="Ej: Chevrolet"
                      className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
                      style={{ '--tw-ring-color': primaryColor } as any}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Modelo</label>
                    <input
                      type="text"
                      value={vehicleModel}
                      onChange={e => setVehicleModel(e.target.value)}
                      placeholder="Ej: Spark GT"
                      className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
                      style={{ '--tw-ring-color': primaryColor } as any}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Color</label>
                    <input
                      type="text"
                      value={vehicleColor}
                      onChange={e => setVehicleColor(e.target.value)}
                      placeholder="Ej: Blanco"
                      className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
                      style={{ '--tw-ring-color': primaryColor } as any}
                    />
                  </div>
                </div>
              </div>

              {/* Método de pago */}
              <div className="bg-white rounded-xl border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="h-5 w-5" style={{ color: primaryColor }} />
                  <h3 className="font-bold text-gray-900">Método de Pago</h3>
                </div>
                {gateways.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {gateways.map(gw => (
                      <button
                        key={gw.code}
                        type="button"
                        onClick={() => setSelectedGateway(gw.code)}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                          selectedGateway === gw.code ? 'shadow-sm' : 'border-gray-200 hover:border-gray-300'
                        }`}
                        style={selectedGateway === gw.code ? { borderColor: primaryColor, backgroundColor: `${primaryColor}08` } : undefined}
                      >
                        <span className="text-xl">{GATEWAY_ICONS[gw.code] || '💳'}</span>
                        <span className="text-sm font-medium text-gray-900">{GATEWAY_LABELS[gw.code] || gw.name}</span>
                        {selectedGateway === gw.code && (
                          <Check className="h-4 w-4 ml-auto" style={{ color: primaryColor }} />
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No hay pasarelas de pago configuradas. Contacta al establecimiento.</p>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Botón pagar */}
              <button
                onClick={handleSubmit}
                disabled={loading || gateways.length === 0}
                className="w-full py-3.5 rounded-lg text-white font-medium text-lg transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: primaryColor }}
              >
                {loading ? 'Procesando...' : `Pagar $${price.toLocaleString('es-CO')}`}
              </button>
            </>
          )}
        </div>

        {/* Columna derecha: Resumen */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border p-6 sticky top-24">
            <h3 className="font-bold text-gray-900 mb-4">Resumen del Pase</h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Plan</span>
                <span className="font-medium text-gray-900">{passType.name}</span>
              </div>
              {passType.description && (
                <p className="text-gray-500 text-xs">{passType.description}</p>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Duración</span>
                <span className="font-medium text-gray-900">{passType.duration_days} días</span>
              </div>

              {/* Beneficios */}
              <div className="border-t pt-3 space-y-2">
                {passType.includes_car_wash && (
                  <div className="flex items-center gap-2 text-xs">
                    <Droplets className="h-3.5 w-3.5" style={{ color: primaryColor }} />
                    <span className="text-gray-600">Lavado incluido</span>
                  </div>
                )}
                {passType.includes_valet && (
                  <div className="flex items-center gap-2 text-xs">
                    <Star className="h-3.5 w-3.5" style={{ color: primaryColor }} />
                    <span className="text-gray-600">Valet parking</span>
                  </div>
                )}
                {passType.max_entries_per_day && (
                  <div className="flex items-center gap-2 text-xs">
                    <Check className="h-3.5 w-3.5" style={{ color: primaryColor }} />
                    <span className="text-gray-600">{passType.max_entries_per_day} entradas/día</span>
                  </div>
                )}
              </div>

              {/* Vehículo ingresado */}
              {plate && (
                <div className="border-t pt-3">
                  <div className="flex items-center gap-2">
                    <Car className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-gray-500">Vehículo:</span>
                    <span className="font-mono font-bold text-gray-900">{plate.toUpperCase()}</span>
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="border-t pt-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="text-2xl font-bold" style={{ color: primaryColor }}>
                    ${price.toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="mt-4 bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 leading-relaxed">
                Al completar la compra, tu pase se activará automáticamente y recibirás un email de confirmación.
                Tu vehículo será reconocido por placa al ingresar al estacionamiento.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────
   Componente: Step Indicator
   ────────────────────────────────────────────── */

function StepIndicator({ current, primaryColor }: { current: Step; primaryColor: string }) {
  const steps = [
    { key: 'info', label: 'Información' },
    { key: 'payment', label: 'Pago' },
    { key: 'success', label: 'Confirmación' },
  ]

  const currentIndex = current === 'processing' ? 1 : steps.findIndex(s => s.key === current)

  return (
    <div className="flex items-center justify-between mb-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center flex-1">
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                i <= currentIndex ? 'text-white' : 'bg-gray-200 text-gray-500'
              }`}
              style={i <= currentIndex ? { backgroundColor: primaryColor } : undefined}
            >
              {i < currentIndex ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:inline ${i <= currentIndex ? 'text-gray-900' : 'text-gray-400'}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="flex-1 mx-3 h-px" style={{ backgroundColor: i < currentIndex ? primaryColor : '#E5E7EB' }} />
          )}
        </div>
      ))}
    </div>
  )
}
