'use client'

import { Check, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface Product {
  id: number
  name: string
  description?: string
  product_prices?: { price: number }[]
}

interface SaasPricingProps {
  products: Product[]
  primaryColor: string
}

const defaultPlans = [
  {
    name: 'Starter',
    price: 0,
    period: '/mes',
    description: 'Perfecto para comenzar',
    features: [
      { name: 'Hasta 3 usuarios', included: true },
      { name: '1 GB de almacenamiento', included: true },
      { name: 'Soporte por email', included: true },
      { name: 'Integraciones básicas', included: true },
      { name: 'API Access', included: false },
      { name: 'Soporte prioritario', included: false }
    ],
    cta: 'Comenzar Gratis',
    popular: false
  },
  {
    name: 'Professional',
    price: 49,
    period: '/mes',
    description: 'Para equipos en crecimiento',
    features: [
      { name: 'Hasta 25 usuarios', included: true },
      { name: '50 GB de almacenamiento', included: true },
      { name: 'Soporte prioritario', included: true },
      { name: 'Todas las integraciones', included: true },
      { name: 'API Access', included: true },
      { name: 'Reportes avanzados', included: true }
    ],
    cta: 'Iniciar Prueba',
    popular: true
  },
  {
    name: 'Enterprise',
    price: 199,
    period: '/mes',
    description: 'Para grandes empresas',
    features: [
      { name: 'Usuarios ilimitados', included: true },
      { name: 'Almacenamiento ilimitado', included: true },
      { name: 'Soporte 24/7 dedicado', included: true },
      { name: 'Integraciones personalizadas', included: true },
      { name: 'SLA garantizado', included: true },
      { name: 'Onboarding personalizado', included: true }
    ],
    cta: 'Contactar Ventas',
    popular: false
  }
]

export function SaasPricing({ products, primaryColor }: SaasPricingProps) {
  const displayPlans = products.length > 0 
    ? products.map((p, i) => ({
        name: p.name,
        price: p.product_prices?.[0]?.price || 0,
        period: '/mes',
        description: p.description || '',
        features: defaultPlans[i]?.features || defaultPlans[0].features,
        cta: i === 0 ? 'Comenzar Gratis' : 'Iniciar Prueba',
        popular: i === 1
      }))
    : defaultPlans
  
  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Planes para cada etapa
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            Elige el plan que mejor se adapte a las necesidades de tu negocio
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {displayPlans.map((plan, index) => (
            <Card 
              key={index}
              className={`relative overflow-hidden transition-all hover:shadow-xl ${
                plan.popular ? 'border-2 scale-105 z-10' : 'border'
              }`}
              style={plan.popular ? { borderColor: primaryColor } : undefined}
            >
              {plan.popular && (
                <div 
                  className="absolute top-0 left-0 right-0 text-white text-center text-sm font-bold py-1"
                  style={{ backgroundColor: primaryColor }}
                >
                  MÁS POPULAR
                </div>
              )}
              
              <CardHeader className={`text-center ${plan.popular ? 'pt-10' : 'pt-6'}`}>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <p className="text-gray-500 text-sm">{plan.description}</p>
              </CardHeader>
              
              <CardContent className="text-center">
                <div className="mb-6">
                  <span className="text-5xl font-bold text-gray-900">
                    ${plan.price.toLocaleString()}
                  </span>
                  <span className="text-gray-500">{plan.period}</span>
                </div>
                
                <ul className="space-y-3 mb-8 text-left">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-center gap-3">
                      {feature.included ? (
                        <Check className="h-5 w-5 flex-shrink-0" style={{ color: primaryColor }} />
                      ) : (
                        <X className="h-5 w-5 flex-shrink-0 text-gray-300" />
                      )}
                      <span className={feature.included ? 'text-gray-700' : 'text-gray-400'}>
                        {feature.name}
                      </span>
                    </li>
                  ))}
                </ul>
                
                <Link href="/auth?tab=register">
                  <Button 
                    className="w-full"
                    size="lg"
                    variant={plan.popular ? 'default' : 'outline'}
                    style={plan.popular 
                      ? { backgroundColor: primaryColor } 
                      : { borderColor: primaryColor, color: primaryColor }
                    }
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <p className="text-center text-gray-500 mt-8">
          Todos los planes incluyen 14 días de prueba gratis. Sin compromiso.
        </p>
      </div>
    </section>
  )
}
