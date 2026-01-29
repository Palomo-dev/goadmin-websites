'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Dumbbell, Play, Users, Trophy } from 'lucide-react'

interface HeroGymProps {
  organizationName: string
  tagline?: string
  primaryColor: string
  backgroundImage?: string
}

export function HeroGym({ organizationName, tagline, primaryColor, backgroundImage }: HeroGymProps) {
  return (
    <section 
      className="relative min-h-[700px] flex items-center"
      style={{
        background: backgroundImage 
          ? `linear-gradient(135deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.5) 100%), url(${backgroundImage}) center/cover`
          : `linear-gradient(135deg, #0f0f0f 0%, ${primaryColor}99 100%)`
      }}
    >
      <div className="container mx-auto px-4 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-white">
            {/* Badge */}
            <span className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-sm font-medium mb-6">
              <Dumbbell className="w-4 h-4 mr-2" />
              Centro Fitness
            </span>
            
            <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight uppercase">
              Transforma<br />
              <span style={{ color: primaryColor }}>Tu Cuerpo</span>
            </h1>
            
            <p className="text-xl text-white/80 mb-8 max-w-lg">
              {tagline || 'Únete a la mejor comunidad fitness. Equipos de última generación, entrenadores certificados y programas personalizados.'}
            </p>
            
            {/* Stats */}
            <div className="flex gap-8 mb-10">
              <div>
                <p className="text-4xl font-bold" style={{ color: primaryColor }}>500+</p>
                <p className="text-white/60">Miembros activos</p>
              </div>
              <div>
                <p className="text-4xl font-bold" style={{ color: primaryColor }}>20+</p>
                <p className="text-white/60">Entrenadores</p>
              </div>
              <div>
                <p className="text-4xl font-bold" style={{ color: primaryColor }}>50+</p>
                <p className="text-white/60">Clases semanales</p>
              </div>
            </div>
            
            {/* CTAs */}
            <div className="flex flex-wrap gap-4">
              <Link href="/productos">
                <Button 
                  size="lg" 
                  className="px-8 font-bold uppercase"
                  style={{ backgroundColor: primaryColor }}
                >
                  Ver Membresías
                </Button>
              </Link>
              <Button 
                size="lg" 
                variant="outline"
                className="border-white text-white hover:bg-white/10 px-8"
              >
                <Play className="w-5 h-5 mr-2 fill-current" />
                Ver Tour Virtual
              </Button>
            </div>
          </div>
          
          {/* Right side - decorative */}
          <div className="hidden lg:flex justify-center">
            <div className="relative">
              <div 
                className="w-80 h-80 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${primaryColor}20` }}
              >
                <span className="text-[150px]">💪</span>
              </div>
              
              {/* Floating cards */}
              <div className="absolute -top-4 -right-4 bg-white rounded-xl p-4 shadow-xl">
                <Users className="w-8 h-8 mb-2" style={{ color: primaryColor }} />
                <p className="font-bold text-gray-900">Comunidad</p>
                <p className="text-sm text-gray-500">Activa y motivada</p>
              </div>
              
              <div className="absolute -bottom-4 -left-4 bg-white rounded-xl p-4 shadow-xl">
                <Trophy className="w-8 h-8 mb-2" style={{ color: primaryColor }} />
                <p className="font-bold text-gray-900">Resultados</p>
                <p className="text-sm text-gray-500">Garantizados</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Bottom gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
    </section>
  )
}
