'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, Star, Zap, Clock } from 'lucide-react'
import { getCartKey } from '@/lib/utils'

interface MembershipPlan {
  id: number
  name: string
  description?: string | null
  /**
   * Precio vigente del PRODUCTO del plan (`product_prices`). Null = el plan no se vende en
   * línea (sin producto activo o sin precio vigente).
   */
  price: number | null
  /** Producto que se agrega al carrito. La membresía se compra como un pedido web normal. */
  product_id?: number | null
  duration_days: number
  duration_unit?: string | null
  duration_value?: number | null
  frequency?: string | null
  access_rules?: {
    features?: string[]
    classes_included?: boolean
    branches?: string[]
    max_freezes?: number
    [key: string]: any
  } | null
}

interface MembershipPlansProps {
  plans?: MembershipPlan[]
  primaryColor: string
  organizationSubdomain?: string
  branchId?: number | null
}

// Planes de ejemplo para sitios sin planes configurados. No se venden: su botón lleva a contacto.
const defaultPlans: MembershipPlan[] = [
  { id: 1, name: 'Plan Básico', description: 'Ideal para comenzar', price: 49900, duration_days: 30, frequency: 'monthly', access_rules: { features: ['Acceso ilimitado al gimnasio', 'Equipos de última generación', 'Vestuarios con duchas', 'WiFi gratuito'] } },
  { id: 2, name: 'Plan Premium', description: 'El más popular', price: 89900, duration_days: 30, frequency: 'monthly', access_rules: { features: ['Acceso ilimitado al gimnasio', 'Equipos de última generación', 'Vestuarios con duchas', 'WiFi gratuito', 'Clases grupales incluidas', 'Entrenador personal (2 sesiones/mes)'], classes_included: true } },
  { id: 3, name: 'Plan VIP', description: 'Experiencia completa', price: 149900, duration_days: 30, frequency: 'monthly', access_rules: { features: ['Acceso ilimitado al gimnasio', 'Equipos de última generación', 'Vestuarios con duchas', 'WiFi gratuito', 'Clases grupales incluidas', 'Entrenador personal (2 sesiones/mes)', 'Acceso a spa y sauna', 'Estacionamiento gratuito'], classes_included: true } },
]

const UNIDADES: Record<string, [string, string]> = {
  day: ['día', 'días'],
  week: ['semana', 'semanas'],
  month: ['mes', 'meses'],
  year: ['año', 'años'],
}

/** Sufijo del precio a partir de la duración del plan (`duration_unit`/`duration_value`). */
function formatPeriodo(plan: MembershipPlan): string {
  const unidad = plan.duration_unit ? UNIDADES[plan.duration_unit] : undefined
  const valor = plan.duration_value ?? null
  if (unidad && valor && valor > 0) {
    return valor === 1 ? `/${unidad[0]}` : `/${valor} ${unidad[1]}`
  }
  return formatFrequency(plan.frequency ?? undefined)
}

function formatFrequency(frequency?: string): string {
  switch (frequency) {
    case 'monthly': return '/mes'
    case 'quarterly': return '/trimestre'
    case 'semiannual': return '/semestre'
    case 'biannual': return '/semestre'
    case 'annual': return '/año'
    case 'daily': return '/día'
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

function formatDuracionPlan(plan: MembershipPlan): string {
  const unidad = plan.duration_unit ? UNIDADES[plan.duration_unit] : undefined
  const valor = plan.duration_value ?? null
  if (unidad && valor && valor > 0) return `${valor} ${valor === 1 ? unidad[0] : unidad[1]}`
  return formatDuration(plan.duration_days)
}

export function MembershipPlans({ plans: propPlans, primaryColor, organizationSubdomain, branchId }: MembershipPlansProps) {
  const router = useRouter()
  const esDemo = !(propPlans && propPlans.length > 0)
  const plans = esDemo ? defaultPlans : (propPlans as MembershipPlan[])

  /**
   * La membresía se compra como su producto: se agrega al carrito y sigue el checkout normal
   * (pedido web). Al confirmarse el pago, el ERP activa la membresía con
   * `fn_membresias_activar_venta` — este sitio ya no crea filas en `memberships`.
   * Misma forma de línea que AddToCartButton; CartEventTracker dispara el pixel.
   */
  const comprar = (plan: MembershipPlan) => {
    if (!plan.product_id || plan.price === null) return
    try {
      const subdomain = organizationSubdomain || window.location.hostname.split('.')[0]
      const cartKey = getCartKey(subdomain, branchId)
      const cart = JSON.parse(localStorage.getItem(cartKey) || '[]')
      const idx = cart.findIndex((item: any) => item.id === plan.product_id)
      // Una membresía por plan en el carrito: la cantidad N compra N períodos seguidos
      // (así lo interpreta la base); se deja en 1 y el cliente la cambia en el carrito si quiere.
      if (idx < 0) {
        cart.push({ id: plan.product_id, name: plan.name, price: Number(plan.price), quantity: 1 })
        localStorage.setItem(cartKey, JSON.stringify(cart))
        window.dispatchEvent(new CustomEvent('cart-updated'))
      }
    } catch (err) {
      console.error('Error agregando la membresía al carrito:', err)
      return
    }
    router.push('/checkout')
  }
  
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
                    {plan.price !== null ? (
                      <>
                        <span
                          className="text-5xl font-black"
                          style={{ color: primaryColor }}
                        >
                          ${Number(plan.price).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                        </span>
                        <span className="text-gray-500 text-sm">{formatPeriodo(plan)}</span>
                      </>
                    ) : (
                      <span className="text-2xl font-bold text-gray-500">Precio a consultar</span>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-1 text-xs text-gray-400 mb-6">
                    <Clock className="w-3 h-3" />
                    <span>Duración: {formatDuracionPlan(plan)}</span>
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
                  
                  {!esDemo && plan.product_id && plan.price !== null ? (
                    <Button 
                      className="w-full font-semibold"
                      variant={isPremium ? 'default' : 'outline'}
                      style={isPremium ? { backgroundColor: primaryColor } : { borderColor: primaryColor, color: primaryColor }}
                      onClick={() => comprar(plan)}
                    >
                      {isPremium && <Zap className="w-4 h-4 mr-2" />}
                      Comenzar Ahora
                    </Button>
                  ) : (
                    <Link href="/contacto">
                      <Button
                        className="w-full font-semibold"
                        variant={isPremium ? 'default' : 'outline'}
                        style={isPremium ? { backgroundColor: primaryColor } : { borderColor: primaryColor, color: primaryColor }}
                      >
                        Consultar
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
