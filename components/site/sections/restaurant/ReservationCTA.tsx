'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Calendar, Phone, Clock } from 'lucide-react'

interface ReservationCTAProps {
  primaryColor: string
  phone?: string
}

export function ReservationCTA({ primaryColor, phone }: ReservationCTAProps) {
  return (
    <section 
      className="py-20"
      style={{ 
        background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)` 
      }}
    >
      <div className="container mx-auto px-4 text-center">
        <span className="text-6xl mb-6 block">🍷</span>
        
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          ¿Listo para una experiencia inolvidable?
        </h2>
        
        <p className="text-white/90 max-w-2xl mx-auto mb-8 text-lg">
          Reserva tu mesa ahora y disfruta de una velada especial con los tuyos. 
          Ambiente acogedor, servicio excepcional y sabores únicos te esperan.
        </p>
        
        <div className="flex flex-wrap justify-center gap-4 mb-8">
          <div className="flex items-center gap-2 text-white/80">
            <Clock className="w-5 h-5" />
            <span>Abierto todos los días</span>
          </div>
          <div className="flex items-center gap-2 text-white/80">
            <Calendar className="w-5 h-5" />
            <span>Reservas disponibles</span>
          </div>
        </div>
        
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/reservas">
            <Button 
              size="lg" 
              className="bg-white hover:bg-gray-100 text-gray-900 font-semibold px-8"
            >
              <Calendar className="w-5 h-5 mr-2" />
              Reservar Ahora
            </Button>
          </Link>
          {phone && (
            <a href={`tel:${phone}`}>
              <Button 
                size="lg" 
                variant="outline"
                className="border-white text-white hover:bg-white/10 px-8"
              >
                <Phone className="w-5 h-5 mr-2" />
                Llamar
              </Button>
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
