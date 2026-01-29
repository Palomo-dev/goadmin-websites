'use client'

import { Car, Zap, Clock, Star } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface ParkingZone {
  id: string
  name: string
  description?: string
  base_rate: number
  available_spots?: number
}

interface ParkingZonesProps {
  zones: ParkingZone[]
  primaryColor: string
}

export function ParkingZones({ zones, primaryColor }: ParkingZonesProps) {
  const defaultZones = [
    { id: '1', name: 'Zona General', description: 'Estacionamiento cubierto estándar', base_rate: 3000, available_spots: 200 },
    { id: '2', name: 'Zona Preferencial', description: 'Cerca de la entrada principal', base_rate: 5000, available_spots: 50 },
    { id: '3', name: 'Zona VIP', description: 'Espacios amplios con servicio de lavado', base_rate: 10000, available_spots: 20 },
    { id: '4', name: 'Zona Eléctricos', description: 'Con estaciones de carga disponibles', base_rate: 4000, available_spots: 15 }
  ]
  
  const displayZones = zones.length > 0 ? zones : defaultZones
  
  const zoneIcons: Record<string, any> = {
    'general': Car,
    'preferencial': Star,
    'vip': Star,
    'eléctricos': Zap
  }
  
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Zonas de Estacionamiento
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Elige la zona que mejor se adapte a tus necesidades
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {displayZones.map((zone) => {
            const zoneKey = zone.name.toLowerCase().split(' ')[1] || 'general'
            const Icon = zoneIcons[zoneKey] || Car
            
            return (
              <Card 
                key={zone.id} 
                className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-current"
                style={{ '--hover-color': primaryColor } as any}
              >
                <CardContent className="p-6 text-center">
                  <div 
                    className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4"
                    style={{ backgroundColor: `${primaryColor}15` }}
                  >
                    <Icon className="h-8 w-8" style={{ color: primaryColor }} />
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {zone.name}
                  </h3>
                  
                  {zone.description && (
                    <p className="text-gray-600 text-sm mb-4">
                      {zone.description}
                    </p>
                  )}
                  
                  <div className="mb-4">
                    <span className="text-3xl font-bold" style={{ color: primaryColor }}>
                      ${zone.base_rate.toLocaleString()}
                    </span>
                    <span className="text-gray-500">/hora</span>
                  </div>
                  
                  {zone.available_spots !== undefined && (
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-4">
                      <Clock className="h-4 w-4" />
                      <span>{zone.available_spots} espacios disponibles</span>
                    </div>
                  )}
                  
                  <Link href={`/reservas?zone=${zone.id}`}>
                    <Button 
                      className="w-full"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Seleccionar
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
