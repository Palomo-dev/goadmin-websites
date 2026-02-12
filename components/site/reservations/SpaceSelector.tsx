'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Users, Maximize, Check } from 'lucide-react'

interface SpaceType {
  id: string
  name: string
  short_name?: string
  base_rate: number
  capacity: number
  area_sqm?: number
  amenities?: string[]
}

interface SpaceSelectorProps {
  spaceTypes: SpaceType[]
  selectedSpaceType: SpaceType | null
  onSelect: (spaceType: SpaceType) => void
  primaryColor: string
}

export function SpaceSelector({ 
  spaceTypes, 
  selectedSpaceType, 
  onSelect, 
  primaryColor 
}: SpaceSelectorProps) {
  if (spaceTypes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No hay espacios disponibles en este momento.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Selecciona un tipo de espacio</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {spaceTypes.map((spaceType) => {
          const isSelected = selectedSpaceType?.id === spaceType.id
          const amenities = Array.isArray(spaceType.amenities) ? spaceType.amenities : []
          
          return (
            <Card 
              key={spaceType.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected ? 'ring-2' : 'hover:border-gray-300'
              }`}
              style={isSelected ? { borderColor: primaryColor } : {}}
              onClick={() => onSelect(spaceType)}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">{spaceType.name}</h4>
                    {spaceType.short_name && (
                      <p className="text-sm text-gray-500">{spaceType.short_name}</p>
                    )}
                  </div>
                  {isSelected && (
                    <div 
                      className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    Hasta {spaceType.capacity} personas
                  </span>
                  {spaceType.area_sqm && (
                    <span className="flex items-center gap-1">
                      <Maximize className="h-4 w-4" />
                      {spaceType.area_sqm} m²
                    </span>
                  )}
                </div>
                
                {amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {amenities.slice(0, 4).map((amenity, idx) => (
                      <span 
                        key={idx}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full"
                      >
                        {amenity}
                      </span>
                    ))}
                    {amenities.length > 4 && (
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                        +{amenities.length - 4} más
                      </span>
                    )}
                  </div>
                )}
                
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm text-gray-500">Desde</span>
                  <span 
                    className="text-xl font-bold"
                    style={{ color: primaryColor }}
                  >
                    ${Number(spaceType.base_rate).toLocaleString()}
                    <span className="text-sm font-normal text-gray-500">/noche</span>
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
