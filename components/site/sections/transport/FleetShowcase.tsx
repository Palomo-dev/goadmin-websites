'use client'

import { Users, Briefcase, Truck, Car } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface Vehicle {
  id: string
  name: string
  description?: string
  capacity?: number
  base_rate?: number
}

interface FleetShowcaseProps {
  vehicles: Vehicle[]
  primaryColor: string
}

const vehicleIcons: Record<string, any> = {
  sedan: Car,
  suv: Car,
  van: Users,
  bus: Users,
  truck: Truck,
  executive: Briefcase
}

export function FleetShowcase({ vehicles, primaryColor }: FleetShowcaseProps) {
  const defaultFleet = [
    { id: '1', name: 'Sedán Ejecutivo', description: 'Ideal para viajes de negocios', capacity: 3, base_rate: 50000 },
    { id: '2', name: 'SUV Premium', description: 'Comodidad y espacio para familias', capacity: 6, base_rate: 80000 },
    { id: '3', name: 'Van de Pasajeros', description: 'Perfecto para grupos medianos', capacity: 12, base_rate: 120000 },
    { id: '4', name: 'Bus Turístico', description: 'Para grupos grandes y tours', capacity: 40, base_rate: 300000 }
  ]
  
  const displayVehicles = vehicles.length > 0 ? vehicles : defaultFleet
  
  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Nuestra Flota
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Vehículos modernos y bien mantenidos para garantizar tu comodidad y seguridad
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {displayVehicles.map((vehicle) => {
            const IconComponent = vehicleIcons[vehicle.name.toLowerCase()] || Car
            
            return (
              <Card key={vehicle.id} className="group hover:shadow-xl transition-all duration-300 overflow-hidden">
                <div 
                  className="h-48 flex items-center justify-center"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                  <IconComponent 
                    className="h-24 w-24 transition-transform group-hover:scale-110"
                    style={{ color: primaryColor }}
                  />
                </div>
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {vehicle.name}
                  </h3>
                  {vehicle.description && (
                    <p className="text-gray-600 text-sm mb-4">
                      {vehicle.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between mb-4">
                    {vehicle.capacity && (
                      <div className="flex items-center gap-1 text-gray-500">
                        <Users className="h-4 w-4" />
                        <span className="text-sm">{vehicle.capacity} pasajeros</span>
                      </div>
                    )}
                    {vehicle.base_rate && (
                      <span className="font-bold" style={{ color: primaryColor }}>
                        ${vehicle.base_rate.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <Link href={`/reservas?vehicle=${vehicle.id}`}>
                    <Button 
                      className="w-full"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Reservar
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
