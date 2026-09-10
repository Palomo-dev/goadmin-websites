'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { MapPin, Phone, Mail, Clock, Send } from 'lucide-react'
import type { OrganizationWithDetails, WebsiteSettings } from '@/types/database'
import {
  useContactForm,
  CONTACT_MAX_LENGTHS,
  HONEYPOT_FIELD_PROPS,
} from '@/components/sections/contact/useContactForm'

interface ContactSectionProps {
  organization: OrganizationWithDetails
  settings: WebsiteSettings | null
  primaryColor: string
}

export function ContactSection({ organization, settings, primaryColor }: ContactSectionProps) {
  // Este formulario FINGIA el envio: un `setTimeout` de un segundo y un tic
  // verde, sin llamar nunca al servidor. Cada mensaje escrito aqui se perdia, y
  // el visitante se iba creyendo que habia contactado. Es el mismo agujero que se
  // cerro en los cuatro formularios de `components/sections/contact/`, pero este
  // vive en la pagina publica (`app/[[...slug]]/page.tsx`) y se quedo fuera.
  // Ahora usa el MISMO enganche que aquellos, para no repetir la logica de envio,
  // validacion, honeypot y mensajes de error.
  const form = useContactForm({
    organizationId: organization?.id,
    sourceForm: 'contact_section_site',
  })
  const { values, setField, status, errorMessage, successMessage, submit, isSubmitting, reset } = form
  const submitted = status === 'success'
  
  return (
    <section id="contacto" className="py-20 bg-gray-50 dark:bg-gray-900/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Contáctanos
          </h2>
          <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Estamos aquí para ayudarte. Envíanos un mensaje y te responderemos a la brevedad.
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
          {/* Información de contacto */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Información de Contacto
            </h3>
            
            <div className="space-y-6">
              {organization.address && (
                <div className="flex items-start">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${primaryColor}15` }}
                  >
                    <MapPin className="h-5 w-5" style={{ color: primaryColor }} />
                  </div>
                  <div className="ml-4">
                    <h4 className="font-medium text-gray-900 dark:text-white">Dirección</h4>
                    <p className="text-gray-600 dark:text-gray-300">
                      {organization.address}
                      {organization.city && <>, {organization.city}</>}
                      {organization.state && <>, {organization.state}</>}
                    </p>
                  </div>
                </div>
              )}
              
              {organization.phone && (
                <div className="flex items-start">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${primaryColor}15` }}
                  >
                    <Phone className="h-5 w-5" style={{ color: primaryColor }} />
                  </div>
                  <div className="ml-4">
                    <h4 className="font-medium text-gray-900 dark:text-white">Teléfono</h4>
                    <a 
                      href={`tel:${organization.phone}`}
                      className="text-gray-600 dark:text-gray-300 hover:underline"
                    >
                      {organization.phone}
                    </a>
                  </div>
                </div>
              )}
              
              {organization.email && (
                <div className="flex items-start">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${primaryColor}15` }}
                  >
                    <Mail className="h-5 w-5" style={{ color: primaryColor }} />
                  </div>
                  <div className="ml-4">
                    <h4 className="font-medium text-gray-900 dark:text-white">Email</h4>
                    <a 
                      href={`mailto:${organization.email}`}
                      className="text-gray-600 dark:text-gray-300 hover:underline"
                    >
                      {organization.email}
                    </a>
                  </div>
                </div>
              )}
            </div>
            
            {/* Mapa placeholder */}
            {settings?.show_map !== false && organization.address && (
              <div className="mt-8">
                <div className="aspect-video bg-gray-200 dark:bg-gray-800 rounded-xl flex items-center justify-center">
                  <span className="text-gray-400 dark:text-gray-500">📍 Mapa</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Formulario de contacto */}
          <Card className="bg-white dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-6">
              {submitted ? (
                <div className="text-center py-8">
                  <div 
                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: `${primaryColor}15` }}
                  >
                    <span className="text-3xl">✓</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    ¡Mensaje Enviado!
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    {successMessage || 'Gracias por contactarnos. Te responderemos pronto.'}
                  </p>
                  <Button
                    className="mt-4"
                    variant="outline"
                    onClick={reset}
                  >
                    Enviar otro mensaje
                  </Button>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-4" noValidate>
                  {/* Campo trampa: invisible para personas, tentador para robots. */}
                  <input {...HONEYPOT_FIELD_PROPS} value={values.website} onChange={(e) => setField('website', e.target.value)} />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nombre
                    </label>
                    <Input
                      required
                      value={values.name}
                      onChange={(e) => setField('name', e.target.value)}
                      maxLength={CONTACT_MAX_LENGTHS.name}
                      placeholder="Tu nombre"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email
                    </label>
                    <Input
                      type="email"
                      required
                      value={values.email}
                      onChange={(e) => setField('email', e.target.value)}
                      maxLength={CONTACT_MAX_LENGTHS.email}
                      placeholder="tu@email.com"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Teléfono (opcional)
                    </label>
                    <Input
                      type="tel"
                      value={values.phone}
                      onChange={(e) => setField('phone', e.target.value)}
                      maxLength={CONTACT_MAX_LENGTHS.phone}
                      placeholder="+57 300 123 4567"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Mensaje
                    </label>
                    <Textarea
                      required
                      rows={4}
                      value={values.message}
                      onChange={(e) => setField('message', e.target.value)}
                      maxLength={CONTACT_MAX_LENGTHS.message}
                      placeholder="¿En qué podemos ayudarte?"
                    />
                  </div>
                  
                  {status === 'error' && errorMessage && (
                    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                      {errorMessage}
                    </p>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                    style={{ backgroundColor: primaryColor }}
                  >
                    {isSubmitting ? (
                      'Enviando...'
                    ) : (
                      <>
                        Enviar Mensaje
                        <Send className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
