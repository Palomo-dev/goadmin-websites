'use client'

import { MapPin, Clock, Shield, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface HeroTransportProps {
  organizationName: string
  tagline?: string
  primaryColor: string
  backgroundImage?: string
  phone?: string
}

export function HeroTransport({ 
  organizationName, 
  tagline, 
  primaryColor, 
  backgroundImage,
  phone
}: HeroTransportProps) {
  return (
    <section className="relative min-h-[600px] flex items-center">
      {/* Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: backgroundImage 
            ? `url(${backgroundImage})` 
            : `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)`
        }}
      >
        <div className="absolute inset-0 bg-black/50" />
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
            <Shield className="h-5 w-5 text-white" />
            <span className="text-white text-sm font-medium">Transporte Seguro y Confiable</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            {tagline || `Tu viaje comienza con ${organizationName}`}
          </h1>
          
          <p className="text-xl text-white/90 mb-8 max-w-2xl">
            Servicio de transporte profesional para todas tus necesidades. 
            Puntualidad, comodidad y seguridad garantizada.
          </p>
          
          {/* Quick Stats */}
          <div className="flex flex-wrap gap-6 mb-8">
            <div className="flex items-center gap-2 text-white">
              <Clock className="h-5 w-5" />
              <span>24/7 Disponible</span>
            </div>
            <div className="flex items-center gap-2 text-white">
              <MapPin className="h-5 w-5" />
              <span>Cobertura Nacional</span>
            </div>
            <div className="flex items-center gap-2 text-white">
              <Shield className="h-5 w-5" />
              <span>100% Asegurado</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <Link href="/reservas">
              <Button 
                size="lg"
                className="text-lg px-8 py-6"
                style={{ backgroundColor: primaryColor }}
              >
                Reservar Ahora
              </Button>
            </Link>
            {phone && (
              <a href={`tel:${phone}`}>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="text-lg px-8 py-6 border-white text-white hover:bg-white/10"
                >
                  <Phone className="h-5 w-5 mr-2" />
                  Llamar
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
