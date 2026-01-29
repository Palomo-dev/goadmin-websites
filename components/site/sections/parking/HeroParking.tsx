'use client'

import { Car, Shield, Clock, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface HeroParkingProps {
  organizationName: string
  tagline?: string
  primaryColor: string
  backgroundImage?: string
  address?: string
}

export function HeroParking({ 
  organizationName, 
  tagline, 
  primaryColor, 
  backgroundImage,
  address
}: HeroParkingProps) {
  return (
    <section className="relative min-h-[550px] flex items-center">
      {/* Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: backgroundImage 
            ? `url(${backgroundImage})` 
            : `linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)`
        }}
      >
        <div className="absolute inset-0 bg-black/60" />
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl">
          <div 
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 mb-6"
            style={{ backgroundColor: primaryColor }}
          >
            <Car className="h-5 w-5 text-white" />
            <span className="text-white text-sm font-medium">Estacionamiento Seguro</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            {tagline || `Parquea tranquilo en ${organizationName}`}
          </h1>
          
          <p className="text-xl text-white/90 mb-8 max-w-2xl">
            Tu vehículo en las mejores manos. Seguridad 24/7, tarifas competitivas 
            y la mejor ubicación de la ciudad.
          </p>
          
          {address && (
            <div className="flex items-center gap-2 text-white/80 mb-6">
              <MapPin className="h-5 w-5" />
              <span>{address}</span>
            </div>
          )}
          
          {/* Quick Stats */}
          <div className="flex flex-wrap gap-6 mb-8">
            <div className="flex items-center gap-2 text-white">
              <Shield className="h-5 w-5" style={{ color: primaryColor }} />
              <span>Vigilancia 24/7</span>
            </div>
            <div className="flex items-center gap-2 text-white">
              <Clock className="h-5 w-5" style={{ color: primaryColor }} />
              <span>Abierto siempre</span>
            </div>
            <div className="flex items-center gap-2 text-white">
              <Car className="h-5 w-5" style={{ color: primaryColor }} />
              <span>+500 espacios</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <Link href="/reservas">
              <Button 
                size="lg"
                className="text-lg px-8 py-6"
                style={{ backgroundColor: primaryColor }}
              >
                Reservar Espacio
              </Button>
            </Link>
            <Link href="/tarifas">
              <Button 
                size="lg" 
                variant="outline"
                className="text-lg px-8 py-6 border-white text-white hover:bg-white/10"
              >
                Ver Tarifas
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
