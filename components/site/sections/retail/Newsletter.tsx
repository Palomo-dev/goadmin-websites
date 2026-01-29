'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Mail, Gift, Check } from 'lucide-react'

interface NewsletterProps {
  primaryColor: string
  organizationName: string
}

export function Newsletter({ primaryColor, organizationName }: NewsletterProps) {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) {
      setSubscribed(true)
      setEmail('')
    }
  }
  
  return (
    <section 
      className="py-16"
      style={{ backgroundColor: `${primaryColor}08` }}
    >
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div 
            className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ backgroundColor: `${primaryColor}15` }}
          >
            <Gift className="w-8 h-8" style={{ color: primaryColor }} />
          </div>
          
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Únete a Nuestra Newsletter
          </h2>
          <p className="text-gray-600 mb-8">
            Suscríbete y recibe un <strong>10% de descuento</strong> en tu primera compra, 
            además de ofertas exclusivas y novedades de {organizationName}.
          </p>
          
          {subscribed ? (
            <div className="flex items-center justify-center gap-3 p-4 bg-green-50 rounded-xl text-green-700">
              <Check className="w-6 h-6" />
              <span className="font-medium">¡Gracias por suscribirte! Revisa tu correo.</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="email"
                  placeholder="Tu correo electrónico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12"
                  required
                />
              </div>
              <Button 
                type="submit"
                className="h-12 px-8"
                style={{ backgroundColor: primaryColor }}
              >
                Suscribirme
              </Button>
            </form>
          )}
          
          <p className="text-xs text-gray-500 mt-4">
            Al suscribirte aceptas recibir comunicaciones de marketing. Puedes cancelar en cualquier momento.
          </p>
        </div>
      </div>
    </section>
  )
}
