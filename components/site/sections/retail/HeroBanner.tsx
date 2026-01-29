'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ShoppingBag, ArrowRight } from 'lucide-react'

interface HeroBannerProps {
  organizationName: string
  tagline?: string
  primaryColor: string
  backgroundImage?: string
}

export function HeroBanner({ organizationName, tagline, primaryColor, backgroundImage }: HeroBannerProps) {
  return (
    <section 
      className="relative min-h-[600px] flex items-center"
      style={{
        background: backgroundImage 
          ? `linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 100%), url(${backgroundImage}) center/cover`
          : `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 50%, ${primaryColor}aa 100%)`
      }}
    >
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-2xl text-white">
          <span className="inline-flex items-center px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm text-sm font-medium mb-6">
            <ShoppingBag className="w-4 h-4 mr-2" />
            Tienda Online
          </span>
          
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Bienvenido a<br />{organizationName}
          </h1>
          
          <p className="text-xl text-white/90 mb-8">
            {tagline || 'Descubre nuestra colección exclusiva de productos con la mejor calidad y precios increíbles.'}
          </p>
          
          <div className="flex flex-wrap gap-4">
            <Link href="/productos">
              <Button 
                size="lg" 
                className="bg-white hover:bg-gray-100 text-gray-900 font-semibold px-8"
              >
                Ver Productos
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/ofertas">
              <Button 
                size="lg" 
                variant="outline"
                className="border-white text-white hover:bg-white/10 px-8"
              >
                Ver Ofertas
              </Button>
            </Link>
          </div>
        </div>
      </div>
      
      {/* Decorative elements */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
    </section>
  )
}
