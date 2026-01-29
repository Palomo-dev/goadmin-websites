'use client'

import { 
  Zap, 
  Shield, 
  BarChart3, 
  Users, 
  Globe, 
  Puzzle,
  Clock,
  Headphones
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface SaasFeaturesProps {
  primaryColor: string
}

const features = [
  {
    icon: Zap,
    title: 'Ultra Rápido',
    description: 'Rendimiento optimizado para que trabajes sin interrupciones ni demoras.'
  },
  {
    icon: Shield,
    title: 'Seguridad Avanzada',
    description: 'Encriptación de grado bancario y cumplimiento con normativas internacionales.'
  },
  {
    icon: BarChart3,
    title: 'Analytics en Tiempo Real',
    description: 'Dashboards intuitivos con métricas que importan para tu negocio.'
  },
  {
    icon: Users,
    title: 'Colaboración',
    description: 'Trabaja en equipo sin fricciones con permisos y roles personalizables.'
  },
  {
    icon: Globe,
    title: 'Multi-idioma',
    description: 'Soporte para múltiples idiomas y zonas horarias globales.'
  },
  {
    icon: Puzzle,
    title: 'Integraciones',
    description: 'Conecta con +100 herramientas que ya usas en tu día a día.'
  },
  {
    icon: Clock,
    title: 'Automatizaciones',
    description: 'Flujos de trabajo automatizados para ahorrar tiempo valioso.'
  },
  {
    icon: Headphones,
    title: 'Soporte Premium',
    description: 'Equipo dedicado listo para ayudarte cuando lo necesites.'
  }
]

export function SaasFeatures({ primaryColor }: SaasFeaturesProps) {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Todo lo que necesitas en un solo lugar
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            Funcionalidades diseñadas para impulsar la productividad de tu equipo
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <Card 
                key={index} 
                className="group border-0 shadow-sm hover:shadow-xl transition-all duration-300"
              >
                <CardContent className="p-6">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all group-hover:scale-110"
                    style={{ backgroundColor: `${primaryColor}15` }}
                  >
                    <Icon className="h-6 w-6" style={{ color: primaryColor }} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
