'use client'

import { ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface SaasCTAProps {
  primaryColor: string
  organizationName: string
}

export function SaasCTA({ primaryColor, organizationName }: SaasCTAProps) {
  return (
    <section className="py-20 relative overflow-hidden">
      {/* Background */}
      <div 
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 100%)`
        }}
      />
      
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
            <Sparkles className="h-5 w-5 text-white" />
            <span className="text-white text-sm font-medium">
              Comienza hoy, es gratis
            </span>
          </div>
          
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            ¿Listo para transformar tu negocio?
          </h2>
          
          <p className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
            Únete a las miles de empresas que ya están creciendo con {organizationName}. 
            Sin tarjeta de crédito requerida.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/auth?tab=register">
              <Button 
                size="lg"
                className="bg-white hover:bg-gray-100 text-lg px-8 py-6 group"
                style={{ color: primaryColor }}
              >
                Comenzar Gratis
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/contacto">
              <Button 
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white/10 text-lg px-8 py-6"
              >
                Hablar con Ventas
              </Button>
            </Link>
          </div>
          
          <p className="text-white/70 text-sm mt-8">
            ✓ 14 días de prueba gratis &nbsp; ✓ Sin compromiso &nbsp; ✓ Cancela cuando quieras
          </p>
        </div>
      </div>
    </section>
  )
}
