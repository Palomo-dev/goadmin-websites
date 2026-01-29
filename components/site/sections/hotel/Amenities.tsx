'use client'

import { 
  Wifi, Car, Utensils, Dumbbell, Waves, Coffee, 
  Tv, Wind, ShieldCheck, Clock, Sparkles, MapPin 
} from 'lucide-react'

interface AmenitiesProps {
  primaryColor: string
}

const amenities = [
  { icon: Wifi, name: 'WiFi Gratis', desc: 'Alta velocidad en todo el hotel' },
  { icon: Car, name: 'Estacionamiento', desc: 'Parqueadero privado incluido' },
  { icon: Utensils, name: 'Restaurante', desc: 'Cocina gourmet internacional' },
  { icon: Dumbbell, name: 'Gimnasio', desc: 'Equipos de última generación' },
  { icon: Waves, name: 'Piscina', desc: 'Piscina climatizada y spa' },
  { icon: Coffee, name: 'Desayuno', desc: 'Buffet incluido cada mañana' },
  { icon: Tv, name: 'Smart TV', desc: 'Netflix y streaming incluido' },
  { icon: Wind, name: 'Aire Acondicionado', desc: 'Control de clima individual' },
  { icon: ShieldCheck, name: 'Seguridad 24/7', desc: 'Vigilancia permanente' },
  { icon: Clock, name: 'Recepción 24h', desc: 'Siempre a tu servicio' },
  { icon: Sparkles, name: 'Limpieza Diaria', desc: 'Servicio de housekeeping' },
  { icon: MapPin, name: 'Ubicación Prime', desc: 'Centro de la ciudad' },
]

export function Amenities({ primaryColor }: AmenitiesProps) {
  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Servicios y Comodidades
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Todo lo que necesitas para una estadía perfecta, con los más altos estándares de calidad
          </p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {amenities.map((amenity, idx) => (
            <div 
              key={idx}
              className="bg-white rounded-xl p-6 text-center hover:shadow-lg transition-shadow"
            >
              <div 
                className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: `${primaryColor}10` }}
              >
                <amenity.icon className="w-7 h-7" style={{ color: primaryColor }} />
              </div>
              <h4 className="font-semibold text-gray-900 mb-1">{amenity.name}</h4>
              <p className="text-sm text-gray-500">{amenity.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
