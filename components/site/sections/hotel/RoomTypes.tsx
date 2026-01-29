'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Maximize, Wifi, Coffee, Bath, ArrowRight } from 'lucide-react'

interface SpaceType {
  id: string
  name: string
  description?: string
  base_rate: number
  max_occupancy: number
  amenities?: Record<string, boolean>
}

interface RoomTypesProps {
  spaceTypes: SpaceType[]
  primaryColor: string
}

const amenityIcons: Record<string, any> = {
  wifi: Wifi,
  breakfast: Coffee,
  bathroom: Bath,
}

export function RoomTypes({ spaceTypes, primaryColor }: RoomTypesProps) {
  if (spaceTypes.length === 0) return null
  
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Nuestras Habitaciones
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Descubre el confort y la elegancia de nuestras habitaciones, diseñadas para tu descanso perfecto
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {spaceTypes.map((room) => (
            <Card key={room.id} className="group overflow-hidden hover:shadow-xl transition-all duration-300">
              <div 
                className="aspect-[4/3] flex items-center justify-center relative"
                style={{ 
                  background: `linear-gradient(135deg, ${primaryColor}20 0%, ${primaryColor}10 100%)` 
                }}
              >
                <span className="text-7xl opacity-60">🛏️</span>
                
                {/* Price badge */}
                <div className="absolute top-4 right-4 bg-white rounded-lg px-3 py-2 shadow-lg">
                  <span className="text-sm text-gray-500">Desde</span>
                  <p className="text-xl font-bold" style={{ color: primaryColor }}>
                    ${Number(room.base_rate).toLocaleString()}
                  </p>
                  <span className="text-xs text-gray-500">/noche</span>
                </div>
              </div>
              
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {room.name}
                </h3>
                
                {room.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {room.description}
                  </p>
                )}
                
                {/* Room features */}
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {room.max_occupancy} personas
                  </span>
                  <span className="flex items-center gap-1">
                    <Maximize className="w-4 h-4" />
                    25 m²
                  </span>
                </div>
                
                {/* Amenities */}
                {room.amenities && (
                  <div className="flex gap-2 mb-4">
                    {Object.entries(room.amenities).filter(([_, v]) => v).slice(0, 4).map(([key]) => {
                      const Icon = amenityIcons[key] || Wifi
                      return (
                        <div 
                          key={key}
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${primaryColor}10` }}
                          title={key}
                        >
                          <Icon className="w-4 h-4" style={{ color: primaryColor }} />
                        </div>
                      )
                    })}
                  </div>
                )}
                
                <Link href={`/espacios/${room.id}`}>
                  <Button 
                    className="w-full"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Ver Disponibilidad
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="text-center mt-10">
          <Link href="/espacios">
            <Button variant="outline" size="lg" style={{ borderColor: primaryColor, color: primaryColor }}>
              Ver todas las habitaciones
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
