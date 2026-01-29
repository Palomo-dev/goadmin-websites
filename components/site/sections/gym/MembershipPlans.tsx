'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, Star, Zap } from 'lucide-react'

interface Product {
  id: number
  name: string
  description?: string
  product_prices?: { price: number }[]
}

interface MembershipPlansProps {
  products: Product[]
  primaryColor: string
}

const defaultFeatures = [
  'Acceso ilimitado al gimnasio',
  'Equipos de última generación',
  'Vestuarios con duchas',
  'WiFi gratuito',
]

const premiumFeatures = [
  ...defaultFeatures,
  'Clases grupales incluidas',
  'Entrenador personal (2 sesiones/mes)',
  'Acceso a spa y sauna',
  'Estacionamiento gratuito',
]

export function MembershipPlans({ products, primaryColor }: MembershipPlansProps) {
  // Si no hay productos, mostrar planes por defecto
  const plans = products.length > 0 ? products : [
    { id: 1, name: 'Plan Básico', description: 'Ideal para comenzar', product_prices: [{ price: 49900 }] },
    { id: 2, name: 'Plan Premium', description: 'El más popular', product_prices: [{ price: 89900 }] },
    { id: 3, name: 'Plan VIP', description: 'Experiencia completa', product_prices: [{ price: 149900 }] },
  ]
  
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span 
            className="inline-block px-4 py-2 rounded-full text-sm font-medium mb-4"
            style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
          >
            Membresías
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Elige Tu Plan Ideal
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Tenemos el plan perfecto para ti. Todos incluyen acceso completo a nuestras instalaciones.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.slice(0, 3).map((plan, idx) => {
            const price = plan.product_prices?.[0]
            const isPremium = idx === 1
            
            return (
              <Card 
                key={plan.id} 
                className={`relative overflow-hidden transition-all hover:shadow-xl ${
                  isPremium ? 'scale-105 border-2' : ''
                }`}
                style={isPremium ? { borderColor: primaryColor } : {}}
              >
                {isPremium && (
                  <div 
                    className="absolute top-0 right-0 px-4 py-1 text-white text-sm font-medium rounded-bl-lg flex items-center"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Star className="w-4 h-4 mr-1 fill-current" />
                    Popular
                  </div>
                )}
                
                <CardContent className="p-8">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                    {plan.description && (
                      <p className="text-gray-500 text-sm">{plan.description}</p>
                    )}
                  </div>
                  
                  <div className="text-center mb-6">
                    {price && (
                      <>
                        <span 
                          className="text-5xl font-black"
                          style={{ color: primaryColor }}
                        >
                          ${Math.floor(Number(price.price) / 1000)}
                        </span>
                        <span className="text-gray-500">.{String(Number(price.price) % 1000).padStart(3, '0')}</span>
                        <p className="text-gray-500 text-sm mt-1">/mes</p>
                      </>
                    )}
                  </div>
                  
                  <ul className="space-y-3 mb-8">
                    {(isPremium || idx === 2 ? premiumFeatures : defaultFeatures).slice(0, idx === 0 ? 4 : idx === 1 ? 6 : 8).map((feature, fidx) => (
                      <li key={fidx} className="flex items-center text-sm text-gray-600">
                        <Check 
                          className="w-5 h-5 mr-2 flex-shrink-0" 
                          style={{ color: primaryColor }} 
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  <Link href={`/productos/${plan.id}`}>
                    <Button 
                      className="w-full font-semibold"
                      variant={isPremium ? 'default' : 'outline'}
                      style={isPremium ? { backgroundColor: primaryColor } : { borderColor: primaryColor, color: primaryColor }}
                    >
                      {isPremium && <Zap className="w-4 h-4 mr-2" />}
                      Comenzar Ahora
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
