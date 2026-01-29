'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Users, ArrowLeft, Check, Bed, Wifi, Coffee, Car } from 'lucide-react'
import Link from 'next/link'

export default function EspacioDetallePage() {
  const params = useParams()
  const spaceTypeId = params.id as string
  
  const [organization, setOrganization] = useState<any>(null)
  const [spaceType, setSpaceType] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    checkin: '',
    checkout: '',
    guests: 1,
    name: '',
    email: '',
    phone: '',
    notes: ''
  })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  useEffect(() => {
    const loadData = async () => {
      try {
        const host = window.location.hostname
        const subdomain = host.split('.')[0]
        
        const [orgRes, spaceRes] = await Promise.all([
          fetch(`/api/organization?subdomain=${subdomain}`),
          fetch(`/api/space-types/${spaceTypeId}`)
        ])
        
        const orgData = await orgRes.json()
        const spaceData = await spaceRes.json()
        
        if (orgData.data) setOrganization(orgData.data)
        if (spaceData.data) setSpaceType(spaceData.data)
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [spaceTypeId])
  
  const calculateNights = () => {
    if (!formData.checkin || !formData.checkout) return 0
    const start = new Date(formData.checkin)
    const end = new Date(formData.checkout)
    const diff = end.getTime() - start.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }
  
  const calculateTotal = () => {
    const nights = calculateNights()
    const rate = spaceType?.base_rate || 0
    return nights * Number(rate)
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: organization.id,
          spaceTypeId,
          checkin: formData.checkin,
          checkout: formData.checkout,
          occupantCount: formData.guests,
          totalEstimated: calculateTotal(),
          customerName: formData.name,
          customerEmail: formData.email,
          customerPhone: formData.phone,
          notes: formData.notes
        })
      })
      
      if (res.ok) {
        setSubmitted(true)
      }
    } catch (error) {
      console.error('Error creating reservation:', error)
    } finally {
      setSubmitting(false)
    }
  }
  
  const primaryColor = organization?.website_settings?.primary_color || organization?.primary_color || '#3B82F6'
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: primaryColor }}></div>
      </div>
    )
  }
  
  if (!organization || !spaceType) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Espacio no encontrado</p>
          <Link href="/espacios">
            <Button variant="outline">Ver todos los espacios</Button>
          </Link>
        </div>
      </div>
    )
  }
  
  const amenityIcons: Record<string, any> = {
    wifi: <Wifi className="h-4 w-4" />,
    coffee: <Coffee className="h-4 w-4" />,
    parking: <Car className="h-4 w-4" />,
    bed: <Bed className="h-4 w-4" />
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader organization={organization} primaryColor={primaryColor} />
      
      <main className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <Link 
            href="/espacios"
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a espacios
          </Link>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Información del espacio */}
          <div>
            <div 
              className="h-64 rounded-xl flex items-center justify-center mb-6"
              style={{ 
                background: `linear-gradient(135deg, ${primaryColor}30 0%, ${primaryColor}10 100%)` 
              }}
            >
              <Bed className="h-24 w-24" style={{ color: primaryColor }} />
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{spaceType.name}</h1>
            
            <div className="flex items-center gap-4 text-gray-600 mb-6">
              <div className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                <span>Hasta {spaceType.capacity} personas</span>
              </div>
              {spaceType.area_sqm && (
                <div className="flex items-center">
                  <span>{spaceType.area_sqm} m²</span>
                </div>
              )}
            </div>
            
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Precio</h3>
              <p className="text-3xl font-bold" style={{ color: primaryColor }}>
                ${Number(spaceType.base_rate).toLocaleString()}
                <span className="text-base font-normal text-gray-500"> / noche</span>
              </p>
            </div>
            
            {spaceType.amenities && Object.keys(spaceType.amenities).length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Amenidades</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(spaceType.amenities as Record<string, boolean>).map(([key, value]) => (
                    value && (
                      <span 
                        key={key}
                        className="px-3 py-1 rounded-full text-sm flex items-center gap-2"
                        style={{ backgroundColor: `${primaryColor}10`, color: primaryColor }}
                      >
                        {amenityIcons[key] || null}
                        {key}
                      </span>
                    )
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Formulario de reserva */}
          <div>
            {submitted ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div 
                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: `${primaryColor}20` }}
                  >
                    <Check className="h-8 w-8" style={{ color: primaryColor }} />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Reserva Enviada!</h2>
                  <p className="text-gray-600 mb-6">
                    Hemos recibido tu solicitud de reserva para {spaceType.name} del {formData.checkin} al {formData.checkout}.
                    Te enviaremos la confirmación a {formData.email}.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Link href="/">
                      <Button variant="outline">Ir al inicio</Button>
                    </Link>
                    <Button
                      onClick={() => {
                        setSubmitted(false)
                        setStep(1)
                        setFormData({
                          checkin: '',
                          checkout: '',
                          guests: 1,
                          name: '',
                          email: '',
                          phone: '',
                          notes: ''
                        })
                      }}
                      style={{ backgroundColor: primaryColor }}
                    >
                      Nueva reserva
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Reservar {spaceType.short_name || spaceType.name}</CardTitle>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                    <div 
                      className="h-2 rounded-full transition-all"
                      style={{ 
                        backgroundColor: primaryColor,
                        width: step === 1 ? '50%' : '100%'
                      }}
                    />
                  </div>
                </CardHeader>
                
                <CardContent>
                  <form onSubmit={handleSubmit}>
                    {step === 1 && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                              <Calendar className="h-4 w-4 mr-2" />
                              Check-in
                            </label>
                            <Input
                              type="date"
                              required
                              min={new Date().toISOString().split('T')[0]}
                              value={formData.checkin}
                              onChange={(e) => setFormData({ ...formData, checkin: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                              <Calendar className="h-4 w-4 mr-2" />
                              Check-out
                            </label>
                            <Input
                              type="date"
                              required
                              min={formData.checkin || new Date().toISOString().split('T')[0]}
                              value={formData.checkout}
                              onChange={(e) => setFormData({ ...formData, checkout: e.target.value })}
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                            <Users className="h-4 w-4 mr-2" />
                            Huéspedes
                          </label>
                          <div className="flex items-center gap-4">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setFormData({ ...formData, guests: Math.max(1, formData.guests - 1) })}
                            >
                              -
                            </Button>
                            <span className="text-xl font-semibold w-12 text-center">{formData.guests}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setFormData({ ...formData, guests: Math.min(spaceType.capacity, formData.guests + 1) })}
                            >
                              +
                            </Button>
                            <span className="text-sm text-gray-500">máx. {spaceType.capacity}</span>
                          </div>
                        </div>
                        
                        {calculateNights() > 0 && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex justify-between text-sm text-gray-600 mb-2">
                              <span>${Number(spaceType.base_rate).toLocaleString()} x {calculateNights()} noches</span>
                              <span>${calculateTotal().toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between font-bold text-lg">
                              <span>Total</span>
                              <span style={{ color: primaryColor }}>${calculateTotal().toLocaleString()}</span>
                            </div>
                          </div>
                        )}
                        
                        <Button
                          type="button"
                          className="w-full"
                          style={{ backgroundColor: primaryColor }}
                          disabled={!formData.checkin || !formData.checkout || calculateNights() < 1}
                          onClick={() => setStep(2)}
                        >
                          Continuar
                        </Button>
                      </div>
                    )}
                    
                    {step === 2 && (
                      <div className="space-y-6">
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                          <h4 className="font-medium text-gray-900 mb-2">Resumen</h4>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p>📅 {formData.checkin} → {formData.checkout} ({calculateNights()} noches)</p>
                            <p>👥 {formData.guests} huésped(es)</p>
                            <p className="font-bold text-lg" style={{ color: primaryColor }}>
                              Total: ${calculateTotal().toLocaleString()}
                            </p>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nombre completo *
                          </label>
                          <Input
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Tu nombre"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Correo electrónico *
                          </label>
                          <Input
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="tu@email.com"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Teléfono *
                          </label>
                          <Input
                            type="tel"
                            required
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+57 300 123 4567"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notas adicionales
                          </label>
                          <Input
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Solicitudes especiales..."
                          />
                        </div>
                        
                        <div className="flex gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={() => setStep(1)}
                          >
                            Atrás
                          </Button>
                          <Button
                            type="submit"
                            className="flex-1"
                            style={{ backgroundColor: primaryColor }}
                            disabled={submitting}
                          >
                            {submitting ? 'Enviando...' : 'Confirmar Reserva'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
      
      <SiteFooter 
        organization={organization} 
        settings={organization.website_settings} 
        primaryColor={primaryColor} 
      />
    </div>
  )
}
