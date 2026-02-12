'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, Star, Zap, Clock } from 'lucide-react'

interface MembershipPlan {
  id: number
  name: string
  description?: string
  price: number
  duration_days: number
  frequency?: string
  access_rules?: {
    features?: string[]
    classes_included?: boolean
    branches?: string[]
    max_freezes?: number
    [key: string]: any
  }
}

interface MembershipPlansProps {
  plans?: MembershipPlan[]
  primaryColor: string
}

const defaultPlans: MembershipPlan[] = [
  { id: 1, name: 'Plan Básico', description: 'Ideal para comenzar', price: 49900, duration_days: 30, frequency: 'monthly', access_rules: { features: ['Acceso ilimitado al gimnasio', 'Equipos de última generación', 'Vestuarios con duchas', 'WiFi gratuito'] } },
  { id: 2, name: 'Plan Premium', description: 'El más popular', price: 89900, duration_days: 30, frequency: 'monthly', access_rules: { features: ['Acceso ilimitado al gimnasio', 'Equipos de última generación', 'Vestuarios con duchas', 'WiFi gratuito', 'Clases grupales incluidas', 'Entrenador personal (2 sesiones/mes)'], classes_included: true } },
  { id: 3, name: 'Plan VIP', description: 'Experiencia completa', price: 149900, duration_days: 30, frequency: 'monthly', access_rules: { features: ['Acceso ilimitado al gimnasio', 'Equipos de última generación', 'Vestuarios con duchas', 'WiFi gratuito', 'Clases grupales incluidas', 'Entrenador personal (2 sesiones/mes)', 'Acceso a spa y sauna', 'Estacionamiento gratuito'], classes_included: true } },
]

function formatFrequency(frequency?: string): string {
  switch (frequency) {
    case 'monthly': return '/mes'
    case 'quarterly': return '/trimestre'
    case 'semiannual': return '/semestre'
    case 'annual': return '/año'
    case 'weekly': return '/semana'
    default: return '/mes'
  }
}

function formatDuration(days: number): string {
  if (days === 1) return '1 día'
  if (days === 7) return '1 semana'
  if (days === 30 || days === 31) return '1 mes'
  if (days === 90) return '3 meses'
  if (days === 180) return '6 meses'
  if (days === 365 || days === 366) return '1 año'
  return `${days} días`
}

export function MembershipPlans({ plans: propPlans, primaryColor }: MembershipPlansProps) {
  const plans = propPlans && propPlans.length > 0 ? propPlans : defaultPlans
  
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
        
        <div className={`grid grid-cols-1 gap-8 max-w-5xl mx-auto ${
          plans.length === 1 ? 'md:grid-cols-1 max-w-md' :
          plans.length === 2 ? 'md:grid-cols-2 max-w-3xl' :
          'md:grid-cols-3'
        }`}>
          {plans.slice(0, 4).map((plan, idx) => {
            const isPremium = plans.length >= 3 ? idx === 1 : idx === plans.length - 1
            const features = plan.access_rules?.features || []
            
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
                  
                  <div className="text-center mb-4">
                    <span 
                      className="text-5xl font-black"
                      style={{ color: primaryColor }}
                    >
                      ${Number(plan.price).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-gray-500 text-sm">{formatFrequency(plan.frequency)}</span>
                  </div>

                  <div className="flex items-center justify-center gap-1 text-xs text-gray-400 mb-6">
                    <Clock className="w-3 h-3" />
                    <span>Duración: {formatDuration(plan.duration_days)}</span>
                  </div>
                  
                  {features.length > 0 && (
                    <ul className="space-y-3 mb-8">
                      {features.map((feature, fidx) => (
                        <li key={fidx} className="flex items-center text-sm text-gray-600">
                          <Check 
                            className="w-5 h-5 mr-2 flex-shrink-0" 
                            style={{ color: primaryColor }} 
                          />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  )}
                  
                  <Link href={`/checkout?plan=${plan.id}`}>
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
