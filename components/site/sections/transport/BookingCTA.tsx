'use client'

import { Phone, MessageCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface BookingCTAProps {
  primaryColor: string
  phone?: string
  whatsapp?: string
}

export function BookingCTA({ primaryColor, phone, whatsapp }: BookingCTAProps) {
  return (
    <section 
      className="py-16"
      style={{ backgroundColor: primaryColor }}
    >
      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              ¿Listo para tu próximo viaje?
            </h2>
            <p className="text-white/90 text-lg max-w-xl">
              Reserva ahora y disfruta de un servicio de transporte seguro, 
              puntual y cómodo. ¡Estamos disponibles 24/7!
            </p>
            
            <div className="flex items-center justify-center lg:justify-start gap-4 mt-4 text-white/80">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                <span>Respuesta inmediata</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/reservas">
              <Button 
                size="lg"
                className="bg-white hover:bg-gray-100 text-lg px-8 py-6"
                style={{ color: primaryColor }}
              >
                Reservar en Línea
              </Button>
            </Link>
            
            {phone && (
              <a href={`tel:${phone}`}>
                <Button 
                  size="lg"
                  variant="outline"
                  className="border-white text-white hover:bg-white/10 text-lg px-8 py-6"
                >
                  <Phone className="h-5 w-5 mr-2" />
                  Llamar
                </Button>
              </a>
            )}
            
            {whatsapp && (
              <a 
                href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button 
                  size="lg"
                  variant="outline"
                  className="border-white text-white hover:bg-white/10 text-lg px-8 py-6"
                >
                  <MessageCircle className="h-5 w-5 mr-2" />
                  WhatsApp
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
