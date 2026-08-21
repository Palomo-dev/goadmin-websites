'use client'

import Link from 'next/link'
import { Car, Shield, Clock, Check, Droplets, Star, MapPin } from 'lucide-react'

interface PasesClientProps {
  organizationName: string
  primaryColor: string
  passTypes: any[]
  rates: any[]
  zones: any[]
}

export function PasesClient({ organizationName, primaryColor, passTypes, rates, zones }: PasesClientProps) {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <HeroSection organizationName={organizationName} primaryColor={primaryColor} />

      {/* Planes de Pases */}
      {passTypes.length > 0 && (
        <PassPlansSection passTypes={passTypes} primaryColor={primaryColor} />
      )}

      {/* Tarifas por hora */}
      {rates.length > 0 && (
        <RatesSection rates={rates} primaryColor={primaryColor} />
      )}

      {/* Disponibilidad */}
      {zones.length > 0 && (
        <AvailabilitySection zones={zones} primaryColor={primaryColor} />
      )}

      {/* Beneficios */}
      <BenefitsSection primaryColor={primaryColor} />

      {/* FAQ */}
      <FaqSection />

      {/* CTA Final */}
      <CtaSection primaryColor={primaryColor} />
    </div>
  )
}

/* ──────────────────────────────────────────────
   Sección: Hero
   ────────────────────────────────────────────── */

function HeroSection({ organizationName, primaryColor }: { organizationName: string; primaryColor: string }) {
  return (
    <section
      className="relative py-20 md:py-28 text-center text-white overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${primaryColor}, ${adjustColor(primaryColor, -30)})` }}
    >
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-32 h-32 border-2 border-white rounded-full" />
        <div className="absolute bottom-10 right-10 w-48 h-48 border-2 border-white rounded-full" />
        <div className="absolute top-1/2 left-1/3 w-20 h-20 border border-white rounded-full" />
      </div>
      <div className="container mx-auto px-4 relative z-10">
        <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 mb-6 bg-white/20 backdrop-blur-sm">
          <Car className="h-5 w-5" />
          <span className="text-sm font-medium">Estacionamiento Seguro</span>
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 max-w-3xl mx-auto leading-tight">
          Pases de Estacionamiento
        </h1>
        <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto mb-8">
          Ahorra con nuestros planes mensuales. Acceso garantizado, beneficios exclusivos y la tranquilidad de siempre tener tu espacio en {organizationName}.
        </p>
        <div className="flex flex-wrap justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" /> Vigilancia 24/7
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" /> Acceso ilimitado
          </div>
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4" /> Espacio garantizado
          </div>
        </div>
      </div>
    </section>
  )
}

/* ──────────────────────────────────────────────
   Sección: Planes de Pases
   ────────────────────────────────────────────── */

function PassPlansSection({ passTypes, primaryColor }: { passTypes: any[]; primaryColor: string }) {
  return (
    <section className="py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Nuestros Planes</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">Elige el plan que mejor se adapte a tu necesidad y compra tu pase 100% online</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {passTypes.map((plan: any, i: number) => {
            const isPopular = i === 1 || passTypes.length === 1
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border-2 p-6 transition-all hover:shadow-xl ${isPopular ? 'scale-[1.03] shadow-lg' : ''}`}
                style={{ borderColor: isPopular ? primaryColor : '#E5E7EB' }}
              >
                {isPopular && (
                  <span
                    className="absolute -top-3 left-1/2 -translate-x-1/2 inline-block px-4 py-1 rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    RECOMENDADO
                  </span>
                )}

                <div className="text-center pt-2">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                  {plan.description && (
                    <p className="text-gray-500 text-sm mb-4">{plan.description}</p>
                  )}
                  {plan.duration_days && (
                    <p className="text-gray-400 text-xs mb-4">{plan.duration_days} días de vigencia</p>
                  )}

                  <div className="mb-6">
                    <span className="text-4xl font-bold" style={{ color: primaryColor }}>
                      ${plan.price != null ? Number(plan.price).toLocaleString('es-CO') : '---'}
                    </span>
                  </div>

                  {/* Beneficios */}
                  <div className="space-y-2 text-sm text-left mb-6">
                    {plan.includes_car_wash && (
                      <p className="flex items-center gap-2">
                        <Droplets className="h-4 w-4 flex-shrink-0" style={{ color: primaryColor }} />
                        Lavado incluido
                      </p>
                    )}
                    {plan.includes_valet && (
                      <p className="flex items-center gap-2">
                        <Star className="h-4 w-4 flex-shrink-0" style={{ color: primaryColor }} />
                        Valet parking
                      </p>
                    )}
                    {plan.max_entries_per_day && (
                      <p className="flex items-center gap-2">
                        <Check className="h-4 w-4 flex-shrink-0" style={{ color: primaryColor }} />
                        {plan.max_entries_per_day} entradas/día
                      </p>
                    )}
                    {plan.allowed_vehicle_types && plan.allowed_vehicle_types.length > 0 && (
                      <p className="flex items-center gap-2">
                        <Car className="h-4 w-4 flex-shrink-0" style={{ color: primaryColor }} />
                        {plan.allowed_vehicle_types.join(', ')}
                      </p>
                    )}
                  </div>

                  <Link
                    href={`/pases/${plan.id}`}
                    className="block w-full px-6 py-3 rounded-lg font-medium text-center transition-opacity hover:opacity-90"
                    style={{
                      backgroundColor: isPopular ? primaryColor : 'transparent',
                      color: isPopular ? 'white' : primaryColor,
                      border: `2px solid ${primaryColor}`,
                    }}
                  >
                    Comprar Pase
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ──────────────────────────────────────────────
   Sección: Tarifas por hora
   ────────────────────────────────────────────── */

function RatesSection({ rates, primaryColor }: { rates: any[]; primaryColor: string }) {
  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Tarifas</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">Si prefieres pagar por uso, estas son nuestras tarifas</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {rates.map((rate: any, i: number) => (
            <div key={rate.id || i} className="bg-white rounded-xl border p-6 text-center hover:shadow-md transition-shadow">
              <div className="text-3xl mb-3">
                {rate.vehicle_type === 'car' ? '🚗' : rate.vehicle_type === 'motorcycle' ? '🏍️' : rate.vehicle_type === 'truck' ? '🚛' : rate.vehicle_type === 'bicycle' ? '🚲' : '🚗'}
              </div>
              <h3 className="font-bold text-lg mb-1 capitalize">{rate.rate_name || rate.vehicle_type}</h3>
              <div className="mb-3">
                <span className="text-3xl font-bold" style={{ color: primaryColor }}>
                  ${rate.price != null ? Number(rate.price).toLocaleString('es-CO') : '---'}
                </span>
                <span className="text-gray-500 text-sm">/{rate.unit || 'hora'}</span>
              </div>
              {rate.grace_period_min != null && rate.grace_period_min > 0 && (
                <p className="text-xs text-gray-500">{rate.grace_period_min} min de gracia</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ──────────────────────────────────────────────
   Sección: Disponibilidad por zona
   ────────────────────────────────────────────── */

function AvailabilitySection({ zones, primaryColor }: { zones: any[]; primaryColor: string }) {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Disponibilidad</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">Espacios disponibles en tiempo real por zona</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {zones.map((zone: any, i: number) => {
            const total = zone.capacity || 0
            const available = zone.available_spaces ?? total
            const pct = total > 0 ? Math.round((available / total) * 100) : 0
            const barColor = pct > 50 ? '#22C55E' : pct > 20 ? '#F59E0B' : '#EF4444'

            return (
              <div key={zone.id || i} className="border rounded-xl p-5 bg-white hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-900">{zone.name}</h3>
                  {zone.is_vip && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: primaryColor }}>VIP</span>
                  )}
                  {zone.is_covered && !zone.is_vip && (
                    <span className="text-xs text-gray-500 border px-2 py-0.5 rounded-full">Cubierto</span>
                  )}
                </div>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-3xl font-bold" style={{ color: barColor }}>{available}</span>
                  <span className="text-gray-500 text-sm">/ {total} espacios</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                </div>
                <p className="text-xs text-gray-500 mt-1">{pct}% disponible</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ──────────────────────────────────────────────
   Sección: Beneficios
   ────────────────────────────────────────────── */

function BenefitsSection({ primaryColor }: { primaryColor: string }) {
  const benefits = [
    { icon: Shield, title: 'Seguridad 24/7', desc: 'Cámaras y personal las 24 horas' },
    { icon: Clock, title: 'Acceso ilimitado', desc: 'Entra y sal las veces que necesites' },
    { icon: Droplets, title: 'Lavado disponible', desc: 'Servicio de lavado según tu plan' },
    { icon: MapPin, title: 'Ubicación céntrica', desc: 'Cerca de todo, fácil acceso' },
  ]

  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">¿Por qué un pase?</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">Ventajas de tener tu pase de estacionamiento</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {benefits.map((b, i) => {
            const Icon = b.icon
            return (
              <div key={i} className="text-center p-5 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-3" style={{ backgroundColor: `${primaryColor}15` }}>
                  <Icon className="h-6 w-6" style={{ color: primaryColor }} />
                </div>
                <h3 className="font-bold text-gray-900 text-sm mb-1">{b.title}</h3>
                <p className="text-gray-500 text-xs">{b.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ──────────────────────────────────────────────
   Sección: FAQ
   ────────────────────────────────────────────── */

function FaqSection() {
  const faqs = [
    { q: '¿Cómo funciona el pase?', a: 'Al comprarlo, registras tu placa. El sistema reconoce tu vehículo automáticamente al ingresar.' },
    { q: '¿Puedo cambiar de plan?', a: 'Sí, al vencer tu pase actual puedes elegir un plan diferente.' },
    { q: '¿Qué pasa si pierdo el pase?', a: 'El pase es digital y está vinculado a tu placa. No hay nada físico que perder.' },
    { q: '¿Puedo registrar más de un vehículo?', a: 'Depende del plan. Algunos permiten vincular múltiples placas.' },
  ]

  return (
    <section className="py-16">
      <div className="container mx-auto px-4 max-w-3xl">
        <h2 className="text-2xl font-bold text-center mb-8">Preguntas Frecuentes</h2>
        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <details key={idx} className="bg-white rounded-lg border p-4 group">
              <summary className="font-medium cursor-pointer list-none flex justify-between items-center">
                {faq.q}
                <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="text-gray-600 mt-3 text-sm">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ──────────────────────────────────────────────
   Sección: CTA Final
   ────────────────────────────────────────────── */

function CtaSection({ primaryColor }: { primaryColor: string }) {
  return (
    <section className="py-16 text-center">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl font-bold mb-4">¿Necesitas ayuda?</h2>
        <p className="text-gray-600 mb-6">Contáctanos y te asesoramos en la elección de tu plan</p>
        <Link
          href="/contacto"
          className="inline-block px-8 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: primaryColor }}
        >
          Contáctanos
        </Link>
      </div>
    </section>
  )
}

/* ──────────────────────────────────────────────
   Utilidad: ajustar color hex
   ────────────────────────────────────────────── */

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + amount))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount))
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount))
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`
}
