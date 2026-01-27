'use client'

import { useState, useEffect } from 'react'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Clock, Users, ArrowLeft, Check } from 'lucide-react'
import Link from 'next/link'

// Este componente será client-side para manejar el estado del formulario
export default function ReservasPage() {
  const [organization, setOrganization] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    guests: 2,
    name: '',
    email: '',
    phone: '',
    notes: ''
  })
  const [submitted, setSubmitted] = useState(false)
  
  useEffect(() => {
    // Cargar datos de la organización
    const loadOrganization = async () => {
      try {
        const host = window.location.hostname
        const subdomain = host.split('.')[0]
        const res = await fetch(`/api/organization?subdomain=${subdomain}`)
        const data = await res.json()
        if (data.data) {
          setOrganization(data.data)
        }
      } catch (error) {
        console.error('Error loading organization:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadOrganization()
  }, [])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Aquí iría la lógica para enviar la reserva a la API
    // Por ahora simulamos el envío
    await new Promise(resolve => setTimeout(resolve, 1000))
    setSubmitted(true)
  }
  
  const primaryColor = organization?.website_settings?.primary_color || organization?.primary_color || '#3B82F6'
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }
  
  if (!organization) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Organización no encontrada</p>
      </div>
    )
  }
  
  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
    '18:00', '18:30', '19:00', '19:30', '20:00', '20:30'
  ]
  
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader organization={organization} primaryColor={primaryColor} />
      
      <main className="container mx-auto px-4 py-12">
        {/* Breadcrumb */}
        <div className="mb-8">
          <Link 
            href="/"
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al inicio
          </Link>
        </div>
        
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Hacer una Reserva</h1>
            <p className="text-gray-600">Reserva tu espacio en {organization.name}</p>
          </div>
          
          {submitted ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: `${primaryColor}20` }}
                >
                  <Check className="h-8 w-8" style={{ color: primaryColor }} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Reserva Confirmada!</h2>
                <p className="text-gray-600 mb-6">
                  Hemos recibido tu solicitud de reserva para el {formData.date} a las {formData.time}.
                  Te enviaremos un correo de confirmación a {formData.email}.
                </p>
                <Button
                  onClick={() => {
                    setSubmitted(false)
                    setStep(1)
                    setFormData({
                      date: '',
                      time: '',
                      guests: 2,
                      name: '',
                      email: '',
                      phone: '',
                      notes: ''
                    })
                  }}
                  variant="outline"
                >
                  Hacer otra reserva
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Detalles de la Reserva</CardTitle>
                  <span className="text-sm text-gray-500">Paso {step} de 2</span>
                </div>
                {/* Progress bar */}
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
                      {/* Fecha */}
                      <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                          <Calendar className="h-4 w-4 mr-2" />
                          Fecha
                        </label>
                        <Input
                          type="date"
                          required
                          min={new Date().toISOString().split('T')[0]}
                          value={formData.date}
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        />
                      </div>
                      
                      {/* Hora */}
                      <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                          <Clock className="h-4 w-4 mr-2" />
                          Hora
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {timeSlots.map((time) => (
                            <button
                              key={time}
                              type="button"
                              onClick={() => setFormData({ ...formData, time })}
                              className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                                formData.time === time
                                  ? 'text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                              style={formData.time === time ? { backgroundColor: primaryColor } : {}}
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Número de personas */}
                      <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                          <Users className="h-4 w-4 mr-2" />
                          Número de personas
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
                            onClick={() => setFormData({ ...formData, guests: Math.min(20, formData.guests + 1) })}
                          >
                            +
                          </Button>
                        </div>
                      </div>
                      
                      <Button
                        type="button"
                        className="w-full"
                        style={{ backgroundColor: primaryColor }}
                        disabled={!formData.date || !formData.time}
                        onClick={() => setStep(2)}
                      >
                        Continuar
                      </Button>
                    </div>
                  )}
                  
                  {step === 2 && (
                    <div className="space-y-6">
                      {/* Resumen */}
                      <div className="bg-gray-50 rounded-lg p-4 mb-6">
                        <h4 className="font-medium text-gray-900 mb-2">Resumen de tu reserva</h4>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>📅 Fecha: {formData.date}</p>
                          <p>🕐 Hora: {formData.time}</p>
                          <p>👥 Personas: {formData.guests}</p>
                        </div>
                      </div>
                      
                      {/* Datos de contacto */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nombre completo
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
                          Correo electrónico
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
                          Teléfono
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
                          Notas adicionales (opcional)
                        </label>
                        <Input
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          placeholder="Alguna solicitud especial..."
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
                        >
                          Confirmar Reserva
                        </Button>
                      </div>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          )}
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
