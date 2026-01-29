'use client'

import { Instagram, Award } from 'lucide-react'

interface TrainersProps {
  primaryColor: string
}

const trainers = [
  { 
    name: 'Carlos Rodríguez', 
    specialty: 'CrossFit & Funcional',
    experience: '8 años',
    certifications: ['CrossFit L2', 'NSCA'],
    emoji: '🏋️'
  },
  { 
    name: 'María García', 
    specialty: 'Spinning & Cardio',
    experience: '6 años',
    certifications: ['Schwinn', 'ACE'],
    emoji: '🚴'
  },
  { 
    name: 'Ana Martínez', 
    specialty: 'Yoga & Pilates',
    experience: '10 años',
    certifications: ['RYT 500', 'Stott Pilates'],
    emoji: '🧘'
  },
  { 
    name: 'Diego Sánchez', 
    specialty: 'Musculación',
    experience: '12 años',
    certifications: ['IFBB Pro', 'ISSA'],
    emoji: '💪'
  },
]

export function Trainers({ primaryColor }: TrainersProps) {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span 
            className="inline-block px-4 py-2 rounded-full text-sm font-medium mb-4"
            style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
          >
            Nuestro Equipo
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Entrenadores Certificados
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Profesionales apasionados listos para ayudarte a alcanzar tus metas
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {trainers.map((trainer, idx) => (
            <div 
              key={idx}
              className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all"
            >
              <div 
                className="aspect-square flex items-center justify-center relative"
                style={{ backgroundColor: `${primaryColor}10` }}
              >
                <span className="text-8xl group-hover:scale-110 transition-transform">
                  {trainer.emoji}
                </span>
                
                {/* Social overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:scale-110 transition-transform">
                    <Instagram className="w-5 h-5 text-pink-500" />
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <h4 className="font-bold text-gray-900 text-lg">{trainer.name}</h4>
                <p style={{ color: primaryColor }} className="font-medium text-sm mb-2">
                  {trainer.specialty}
                </p>
                
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                  <Award className="w-4 h-4" />
                  {trainer.experience} de experiencia
                </div>
                
                <div className="flex flex-wrap gap-1">
                  {trainer.certifications.map((cert, cidx) => (
                    <span 
                      key={cidx}
                      className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                    >
                      {cert}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
