'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, MapPin, ArrowRight } from 'lucide-react'

interface Space {
  id: string
  label: string
  floor_zone?: string
  description?: string
  primaryImage?: string | null
  services?: { name: string; icon: string | null }[]
  space_types?: {
    name?: string
    base_rate?: number
    capacity?: number
    area_sqm?: number
  }
}

interface RoomTypesProps {
  spaces?: Space[]
  spaceTypes?: any[]
  primaryColor: string
}

export function RoomTypes({ spaces, spaceTypes, primaryColor }: RoomTypesProps) {
  const items = spaces && spaces.length > 0 ? spaces : (spaceTypes || [])
  if (items.length === 0) return null

  const isSpaces = spaces && spaces.length > 0

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Nuestras Habitaciones
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Diseñadas para su comodidad
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {items.map((item: any) => {
            const st = isSpaces ? item.space_types : null
            const label = isSpaces ? item.label : item.name
            const image = isSpaces ? item.primaryImage : null
            const capacity = isSpaces ? st?.capacity : item.capacity || item.max_occupancy
            const baseRate = isSpaces ? Number(st?.base_rate || 0) : Number(item.base_rate || 0)
            const floorZone = isSpaces ? item.floor_zone : null
            const typeName = isSpaces ? st?.name : null
            const services = isSpaces ? (item.services || []) : []

            return (
              <Card key={item.id} className="group overflow-hidden hover:shadow-xl transition-all duration-300 border-0 shadow-md">
                {/* Imagen */}
                <div className="relative aspect-[4/3] overflow-hidden">
                  {image ? (
                    <img
                      src={image}
                      alt={label}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${primaryColor}20 0%, ${primaryColor}08 100%)` }}
                    >
                      <span className="text-7xl opacity-60">🏠</span>
                    </div>
                  )}
                  {/* Badge tipo */}
                  {typeName && (
                    <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-semibold text-white backdrop-blur-sm" style={{ backgroundColor: `${primaryColor}cc` }}>
                      {typeName}
                    </span>
                  )}
                  {/* Badge disponible */}
                  <span className="absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium bg-green-500 text-white">
                    Disponible
                  </span>
                </div>

                <CardContent className="p-5">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{label}</h3>

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
                    {floorZone && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {floorZone}
                      </span>
                    )}
                    {capacity && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {capacity} personas
                      </span>
                    )}
                  </div>

                  {/* Servicios */}
                  {services.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {services.slice(0, 3).map((svc: any, i: number) => (
                        <span key={i} className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: `${primaryColor}10`, color: primaryColor }}>
                          {svc.name}
                        </span>
                      ))}
                      {services.length > 3 && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
                          +{services.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Precio + CTA */}
                  <div className="flex items-center justify-between pt-3 border-t">
                    <div>
                      <span className="text-xs text-gray-400">Desde</span>
                      <p className="text-xl font-bold" style={{ color: primaryColor }}>
                        ${baseRate.toLocaleString()}
                        <span className="text-xs font-normal text-gray-400"> /noche</span>
                      </p>
                    </div>
                    <Link href={`/espacios/${item.id}`}>
                      <Button size="sm" style={{ backgroundColor: primaryColor }}>
                        Ver detalle
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="text-center mt-10">
          <Link href="/espacios">
            <Button variant="outline" size="lg" style={{ borderColor: primaryColor, color: primaryColor }}>
              Ver todos los espacios
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
