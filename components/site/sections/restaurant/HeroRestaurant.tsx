'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Clock, MapPin, Phone, Star } from 'lucide-react'

interface HeroRestaurantProps {
  organizationName: string
  tagline?: string
  primaryColor: string
  backgroundImage?: string
  phone?: string
  address?: string
}

export function HeroRestaurant({ 
  organizationName, 
  tagline, 
  primaryColor, 
  backgroundImage,
  phone,
  address
}: HeroRestaurantProps) {
  return (
    <section 
      className="relative min-h-[650px] flex items-center"
      style={{
        background: backgroundImage 
          ? `linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 100%), url(${backgroundImage}) center/cover`
          : `linear-gradient(135deg, #1a1a2e 0%, ${primaryColor}99 100%)`
      }}
    >
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-2xl text-center mx-auto">
          {/* Badge */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="inline-flex items-center px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm text-white text-sm font-medium">
              🍽️ Restaurante
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-yellow-400/90 text-yellow-900 text-sm font-medium">
              <Star className="w-4 h-4 fill-current mr-1" />
              4.9
            </span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            {organizationName}
          </h1>
          
          <p className="text-xl text-white/90 mb-8">
            {tagline || 'Una experiencia gastronómica única que deleitará todos tus sentidos con los mejores sabores.'}
          </p>
          
          {/* Quick info */}
          <div className="flex flex-wrap justify-center gap-6 mb-10 text-white/80">
            <span className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Lun-Dom: 12:00 - 23:00
            </span>
            {address && (
              <span className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                {address}
              </span>
            )}
          </div>
          
          {/* CTAs */}
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/reservas">
              <Button 
                size="lg" 
                className="px-8 font-semibold"
                style={{ backgroundColor: primaryColor }}
              >
                Reservar Mesa
              </Button>
            </Link>
            <Link href="/productos">
              <Button 
                size="lg" 
                variant="outline"
                className="border-white text-white hover:bg-white/10 px-8"
              >
                Ver Menú
              </Button>
            </Link>
            {phone && (
              <a href={`tel:${phone}`}>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="border-white text-white hover:bg-white/10"
                >
                  <Phone className="w-5 h-5 mr-2" />
                  Llamar
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>
      
      {/* Decorative bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
    </section>
  )
}
