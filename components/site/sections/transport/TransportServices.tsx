'use client'

import { Plane, Building2, MapPin, Calendar, Users, Package } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface TransportServicesProps {
  primaryColor: string
}

const services = [
  {
    icon: Plane,
    title: 'Traslados Aeropuerto',
    description: 'Servicio puntual de ida y vuelta al aeropuerto con seguimiento de vuelos.'
  },
  {
    icon: Building2,
    title: 'Transporte Corporativo',
    description: 'Soluciones de movilidad para empresas con tarifas preferenciales.'
  },
  {
    icon: MapPin,
    title: 'Tours y Excursiones',
    description: 'Recorridos turísticos personalizados por la ciudad y alrededores.'
  },
  {
    icon: Calendar,
    title: 'Eventos Especiales',
    description: 'Transporte para bodas, quinceañeros y eventos corporativos.'
  },
  {
    icon: Users,
    title: 'Transporte Escolar',
    description: 'Rutas seguras y confiables para instituciones educativas.'
  },
  {
    icon: Package,
    title: 'Mensajería Express',
    description: 'Envío rápido de paquetes y documentos en la ciudad.'
  }
]

export function TransportServices({ primaryColor }: TransportServicesProps) {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Nuestros Servicios
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Soluciones de transporte adaptadas a cada necesidad
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, index) => {
            const Icon = service.icon
            return (
              <Card key={index} className="group hover:shadow-lg transition-shadow border-0 shadow-md">
                <CardContent className="p-6">
                  <div 
                    className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${primaryColor}15` }}
                  >
                    <Icon className="h-7 w-7" style={{ color: primaryColor }} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {service.title}
                  </h3>
                  <p className="text-gray-600">
                    {service.description}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
