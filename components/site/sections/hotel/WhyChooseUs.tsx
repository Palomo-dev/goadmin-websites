'use client'

import { Award, Heart, Clock, Shield } from 'lucide-react'

interface WhyChooseUsProps {
  primaryColor: string
  organizationName: string
}

export function WhyChooseUs({ primaryColor, organizationName }: WhyChooseUsProps) {
  const reasons = [
    {
      icon: Award,
      title: 'Excelencia Garantizada',
      description: 'Más de 10 años brindando experiencias únicas a nuestros huéspedes con los más altos estándares de calidad.'
    },
    {
      icon: Heart,
      title: 'Atención Personalizada',
      description: 'Nuestro equipo está dedicado a hacer de tu estadía una experiencia inolvidable con atención 24/7.'
    },
    {
      icon: Clock,
      title: 'Ubicación Privilegiada',
      description: 'Estratégicamente ubicados para que disfrutes de los mejores lugares de la ciudad a pocos pasos.'
    },
    {
      icon: Shield,
      title: 'Reserva Segura',
      description: 'Tu reserva está protegida. Cancela gratis hasta 24 horas antes sin cargos adicionales.'
    },
  ]
  
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div>
            <span 
              className="inline-block px-4 py-2 rounded-full text-sm font-medium mb-6"
              style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
            >
              ¿Por qué elegirnos?
            </span>
            
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              La mejor experiencia en {organizationName}
            </h2>
            
            <p className="text-gray-600 mb-8">
              Nos enorgullece ofrecer un servicio excepcional que combina confort, 
              elegancia y atención al detalle para hacer de tu estadía algo memorable.
            </p>
            
            <div className="space-y-6">
              {reasons.map((reason, idx) => (
                <div key={idx} className="flex gap-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${primaryColor}10` }}
                  >
                    <reason.icon className="w-6 h-6" style={{ color: primaryColor }} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">{reason.title}</h4>
                    <p className="text-sm text-gray-600">{reason.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Image/Stats */}
          <div className="relative">
            <div 
              className="aspect-square rounded-3xl flex items-center justify-center"
              style={{ backgroundColor: `${primaryColor}10` }}
            >
              <span className="text-9xl opacity-60">🏨</span>
            </div>
            
            {/* Stats cards */}
            <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl p-6 shadow-xl">
              <p className="text-4xl font-bold" style={{ color: primaryColor }}>10+</p>
              <p className="text-gray-600">Años de experiencia</p>
            </div>
            
            <div className="absolute -top-6 -right-6 bg-white rounded-2xl p-6 shadow-xl">
              <p className="text-4xl font-bold" style={{ color: primaryColor }}>98%</p>
              <p className="text-gray-600">Clientes satisfechos</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
