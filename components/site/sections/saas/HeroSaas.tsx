'use client'

import { Play, ArrowRight, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface HeroSaasProps {
  organizationName: string
  tagline?: string
  primaryColor: string
  backgroundImage?: string
}

export function HeroSaas({ 
  organizationName, 
  tagline, 
  primaryColor, 
  backgroundImage
}: HeroSaasProps) {
  const benefits = [
    'Configuración en minutos',
    'Sin tarjeta de crédito',
    'Soporte 24/7'
  ]
  
  return (
    <section className="relative py-20 lg:py-32 overflow-hidden">
      {/* Background gradient */}
      <div 
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}08 0%, ${primaryColor}15 50%, ${primaryColor}05 100%)`
        }}
      />
      
      {/* Decorative circles */}
      <div 
        className="absolute top-20 right-20 w-72 h-72 rounded-full blur-3xl opacity-20"
        style={{ backgroundColor: primaryColor }}
      />
      <div 
        className="absolute bottom-20 left-20 w-96 h-96 rounded-full blur-3xl opacity-10"
        style={{ backgroundColor: primaryColor }}
      />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div 
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 mb-6 text-sm font-medium"
            style={{ 
              backgroundColor: `${primaryColor}15`,
              color: primaryColor
            }}
          >
            ✨ La plataforma #1 en su categoría
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
            {tagline || `Potencia tu negocio con ${organizationName}`}
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            La solución todo-en-uno que necesitas para escalar tu empresa. 
            Automatiza, analiza y crece sin límites.
          </p>
          
          {/* Benefits */}
          <div className="flex flex-wrap justify-center gap-6 mb-10">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-2 text-gray-600">
                <CheckCircle className="h-5 w-5" style={{ color: primaryColor }} />
                <span>{benefit}</span>
              </div>
            ))}
          </div>
          
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/auth?tab=register">
              <Button 
                size="lg"
                className="text-lg px-8 py-6 group"
                style={{ backgroundColor: primaryColor }}
              >
                Comenzar Gratis
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Button 
              size="lg" 
              variant="outline"
              className="text-lg px-8 py-6"
            >
              <Play className="h-5 w-5 mr-2" />
              Ver Demo
            </Button>
          </div>
          
          {/* Trust badges */}
          <div className="mt-12 pt-12 border-t border-gray-200">
            <p className="text-gray-500 text-sm mb-4">
              Más de 10,000 empresas confían en nosotros
            </p>
            <div className="flex justify-center gap-8 opacity-50">
              {/* Placeholder for company logos */}
              {[1, 2, 3, 4, 5].map((i) => (
                <div 
                  key={i}
                  className="w-24 h-8 bg-gray-300 rounded"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
