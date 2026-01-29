'use client'

import { Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface ParkingPricingProps {
  primaryColor: string
}

const pricingPlans = [
  {
    name: 'Por Hora',
    price: '$3.000',
    period: '/hora',
    description: 'Ideal para visitas cortas',
    features: [
      'Acceso zona general',
      'Vigilancia 24/7',
      'Sin reserva previa'
    ],
    popular: false
  },
  {
    name: 'Día Completo',
    price: '$25.000',
    period: '/día',
    description: 'Perfecto para jornada laboral',
    features: [
      'Hasta 12 horas',
      'Zona preferencial',
      'Vigilancia 24/7',
      'WiFi gratis'
    ],
    popular: true
  },
  {
    name: 'Mensual',
    price: '$350.000',
    period: '/mes',
    description: 'La mejor tarifa para frecuentes',
    features: [
      'Acceso ilimitado',
      'Espacio reservado',
      'Vigilancia 24/7',
      'WiFi gratis',
      '2 lavados gratis/mes',
      'Descuento en servicios'
    ],
    popular: false
  }
]

export function ParkingPricing({ primaryColor }: ParkingPricingProps) {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Tarifas
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Planes flexibles que se adaptan a tu necesidad
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {pricingPlans.map((plan, index) => (
            <Card 
              key={index}
              className={`relative overflow-hidden transition-all hover:shadow-xl ${
                plan.popular ? 'border-2 scale-105' : 'border'
              }`}
              style={plan.popular ? { borderColor: primaryColor } : undefined}
            >
              {plan.popular && (
                <div 
                  className="absolute top-0 right-0 text-white text-xs font-bold px-3 py-1 rounded-bl-lg"
                  style={{ backgroundColor: primaryColor }}
                >
                  POPULAR
                </div>
              )}
              
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <p className="text-gray-500 text-sm">{plan.description}</p>
              </CardHeader>
              
              <CardContent className="text-center">
                <div className="mb-6">
                  <span 
                    className="text-4xl font-bold"
                    style={{ color: primaryColor }}
                  >
                    {plan.price}
                  </span>
                  <span className="text-gray-500">{plan.period}</span>
                </div>
                
                <ul className="space-y-3 mb-6 text-left">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-center gap-2">
                      <Check 
                        className="h-5 w-5 flex-shrink-0" 
                        style={{ color: primaryColor }} 
                      />
                      <span className="text-gray-600 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Link href="/reservas">
                  <Button 
                    className="w-full"
                    variant={plan.popular ? 'default' : 'outline'}
                    style={plan.popular ? { backgroundColor: primaryColor } : { borderColor: primaryColor, color: primaryColor }}
                  >
                    Seleccionar Plan
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
