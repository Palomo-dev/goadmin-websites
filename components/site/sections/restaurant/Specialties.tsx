'use client'

import { ChefHat, Award, Clock, Users } from 'lucide-react'

interface SpecialtiesProps {
  primaryColor: string
  organizationName: string
}

export function Specialties({ primaryColor, organizationName }: SpecialtiesProps) {
  const specialties = [
    {
      emoji: '🥩',
      name: 'Carnes Premium',
      description: 'Cortes selectos madurados y preparados a la perfección'
    },
    {
      emoji: '🍝',
      name: 'Pastas Artesanales',
      description: 'Elaboradas frescas cada día con ingredientes importados'
    },
    {
      emoji: '🍣',
      name: 'Mariscos Frescos',
      description: 'Directamente del mar a tu mesa, siempre frescos'
    },
    {
      emoji: '🍰',
      name: 'Postres de Autor',
      description: 'Creaciones únicas de nuestro chef pastelero'
    },
  ]
  
  const stats = [
    { icon: ChefHat, value: '15+', label: 'Años de experiencia' },
    { icon: Award, value: '5', label: 'Premios gastronómicos' },
    { icon: Users, value: '50k+', label: 'Clientes satisfechos' },
    { icon: Clock, value: '30min', label: 'Tiempo promedio' },
  ]
  
  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left - Specialties */}
          <div>
            <span 
              className="inline-block px-4 py-2 rounded-full text-sm font-medium mb-6"
              style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
            >
              Nuestras Especialidades
            </span>
            
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Lo que nos hace únicos
            </h2>
            
            <p className="text-gray-600 mb-8">
              En {organizationName} nos especializamos en crear experiencias gastronómicas 
              memorables con los mejores ingredientes y técnicas culinarias.
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              {specialties.map((item, idx) => (
                <div 
                  key={idx}
                  className="bg-white rounded-xl p-4 hover:shadow-lg transition-shadow"
                >
                  <span className="text-4xl mb-3 block">{item.emoji}</span>
                  <h4 className="font-semibold text-gray-900 mb-1">{item.name}</h4>
                  <p className="text-sm text-gray-500">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
          
          {/* Right - Image + Stats */}
          <div className="relative">
            <div 
              className="aspect-square rounded-3xl flex items-center justify-center"
              style={{ backgroundColor: `${primaryColor}10` }}
            >
              <span className="text-[150px] opacity-70">👨‍🍳</span>
            </div>
            
            {/* Stats overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-2xl p-6 mx-4 shadow-xl -mb-6">
              <div className="grid grid-cols-4 gap-4">
                {stats.map((stat, idx) => (
                  <div key={idx} className="text-center">
                    <stat.icon 
                      className="w-6 h-6 mx-auto mb-2" 
                      style={{ color: primaryColor }} 
                    />
                    <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                    <p className="text-xs text-gray-500">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
