'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Truck, Shield, CreditCard, Headphones } from 'lucide-react'

interface PromoBannersProps {
  primaryColor: string
}

export function PromoBanners({ primaryColor }: PromoBannersProps) {
  return (
    <section className="py-12 bg-white">
      <div className="container mx-auto px-4">
        {/* Features bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          {[
            { icon: Truck, title: 'Envío Gratis', desc: 'En compras +$50.000' },
            { icon: Shield, title: 'Compra Segura', desc: 'Transacciones protegidas' },
            { icon: CreditCard, title: 'Pago Flexible', desc: 'Múltiples métodos' },
            { icon: Headphones, title: 'Soporte 24/7', desc: 'Siempre disponibles' },
          ].map((feature, idx) => (
            <div key={idx} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${primaryColor}15` }}
              >
                <feature.icon className="w-6 h-6" style={{ color: primaryColor }} />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">{feature.title}</h4>
                <p className="text-sm text-gray-500">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
        
        {/* Promo banners grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Banner 1 - Large */}
          <div 
            className="relative rounded-2xl overflow-hidden h-80 flex items-center"
            style={{ 
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 100%)` 
            }}
          >
            <div className="p-8 text-white max-w-md">
              <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-sm font-medium mb-4">
                Oferta Especial
              </span>
              <h3 className="text-3xl font-bold mb-3">
                Hasta 50% de Descuento
              </h3>
              <p className="text-white/80 mb-6">
                En productos seleccionados. ¡No te lo pierdas!
              </p>
              <Link href="/ofertas">
                <Button className="bg-white text-gray-900 hover:bg-gray-100">
                  Comprar Ahora
                </Button>
              </Link>
            </div>
            <div className="absolute right-4 bottom-4 text-9xl opacity-20">
              🛍️
            </div>
          </div>
          
          {/* Banner 2 - Stacked */}
          <div className="flex flex-col gap-6">
            <div className="relative rounded-2xl overflow-hidden h-36 flex items-center bg-gradient-to-r from-orange-500 to-orange-400">
              <div className="p-6 text-white">
                <h4 className="text-xl font-bold mb-1">Nuevos Llegados</h4>
                <p className="text-white/80 text-sm">Descubre lo último</p>
              </div>
              <div className="absolute right-6 text-6xl opacity-30">✨</div>
            </div>
            
            <div className="relative rounded-2xl overflow-hidden h-36 flex items-center bg-gradient-to-r from-purple-600 to-purple-500">
              <div className="p-6 text-white">
                <h4 className="text-xl font-bold mb-1">Colección Exclusiva</h4>
                <p className="text-white/80 text-sm">Edición limitada</p>
              </div>
              <div className="absolute right-6 text-6xl opacity-30">💎</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
