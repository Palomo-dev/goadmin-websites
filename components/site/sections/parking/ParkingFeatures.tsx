'use client'

import { 
  Shield, 
  Camera, 
  CreditCard, 
  Clock, 
  Car, 
  Droplets,
  Wifi,
  Zap
} from 'lucide-react'

interface ParkingFeaturesProps {
  primaryColor: string
}

const features = [
  {
    icon: Shield,
    title: 'Seguridad 24/7',
    description: 'Personal de seguridad las 24 horas del día'
  },
  {
    icon: Camera,
    title: 'CCTV',
    description: 'Sistema de cámaras de vigilancia en todo el recinto'
  },
  {
    icon: CreditCard,
    title: 'Pago Fácil',
    description: 'Múltiples métodos de pago: efectivo, tarjeta, app'
  },
  {
    icon: Clock,
    title: 'Abierto 24h',
    description: 'Acceso a tu vehículo en cualquier momento'
  },
  {
    icon: Car,
    title: 'Espacios Amplios',
    description: 'Estacionamientos cómodos para todo tipo de vehículo'
  },
  {
    icon: Droplets,
    title: 'Lavado de Autos',
    description: 'Servicio de lavado disponible bajo solicitud'
  },
  {
    icon: Wifi,
    title: 'WiFi Gratis',
    description: 'Conexión a internet en la zona de espera'
  },
  {
    icon: Zap,
    title: 'Carga Eléctrica',
    description: 'Estaciones de carga para vehículos eléctricos'
  }
]

export function ParkingFeatures({ primaryColor }: ParkingFeaturesProps) {
  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            ¿Por qué elegirnos?
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Ofrecemos los mejores servicios para que tu vehículo esté siempre seguro
          </p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div 
                key={index}
                className="text-center p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow"
              >
                <div 
                  className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                  <Icon className="h-7 w-7" style={{ color: primaryColor }} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm">
                  {feature.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
