'use client'

import { Star, Quote } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface SaasTestimonialsProps {
  primaryColor: string
}

const testimonials = [
  {
    name: 'María García',
    role: 'CEO',
    company: 'TechStart',
    content: 'Implementamos la plataforma hace 6 meses y hemos triplicado nuestra productividad. El soporte es excepcional.',
    rating: 5
  },
  {
    name: 'Carlos Rodríguez',
    role: 'Director de Operaciones',
    company: 'LogiCorp',
    content: 'La mejor inversión que hemos hecho para nuestro negocio. Las automatizaciones nos ahorran horas cada día.',
    rating: 5
  },
  {
    name: 'Ana Martínez',
    role: 'Fundadora',
    company: 'CreativeHub',
    content: 'Probamos varias opciones antes y esta es sin duda la más completa. La recomiendo totalmente.',
    rating: 5
  }
]

export function SaasTestimonials({ primaryColor }: SaasTestimonialsProps) {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Lo que dicen nuestros clientes
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            Miles de empresas ya confían en nosotros para crecer
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="border-0 shadow-lg">
              <CardContent className="p-8">
                <Quote 
                  className="h-10 w-10 mb-4 opacity-20" 
                  style={{ color: primaryColor }} 
                />
                
                {/* Rating */}
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star 
                      key={i} 
                      className="h-5 w-5 fill-yellow-400 text-yellow-400" 
                    />
                  ))}
                </div>
                
                <p className="text-gray-700 mb-6 leading-relaxed">
                  "{testimonial.content}"
                </p>
                
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{testimonial.name}</p>
                    <p className="text-gray-500 text-sm">
                      {testimonial.role} en {testimonial.company}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
