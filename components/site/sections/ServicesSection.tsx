import { getOrganizationServices } from '@/lib/supabase/queries'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Clock, ArrowRight } from 'lucide-react'
import type { BusinessTypeConfig } from '@/types/organization'

interface ServicesSectionProps {
  organizationId: number
  businessType: BusinessTypeConfig
  primaryColor: string
}

export async function ServicesSection({ organizationId, businessType, primaryColor }: ServicesSectionProps) {
  const services = await getOrganizationServices(organizationId, 6)
  
  if (!services || services.length === 0) {
    return null
  }
  
  return (
    <section id="servicios" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Nuestros Servicios
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Servicios diseñados para satisfacer tus necesidades
          </p>
        </div>
        
        {/* Grid de servicios */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service: any) => (
            <Card key={service.id} className="group hover:shadow-lg transition-all duration-300 border-2 border-transparent hover:border-opacity-50" style={{ '--hover-border': primaryColor } as any}>
              <CardContent className="p-6">
                {/* Icono */}
                <div 
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                  <span className="text-2xl">✨</span>
                </div>
                
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {service.name}
                </h3>
                
                {service.description && (
                  <p className="text-gray-600 mb-4 line-clamp-3">
                    {service.description}
                  </p>
                )}
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm text-gray-500">
                    {service.duration_minutes && (
                      <>
                        <Clock className="h-4 w-4 mr-1" />
                        {service.duration_minutes} min
                      </>
                    )}
                  </div>
                  
                  {service.price && (
                    <span 
                      className="text-lg font-bold"
                      style={{ color: primaryColor }}
                    >
                      ${service.price.toLocaleString()}
                    </span>
                  )}
                </div>
                
                <Button 
                  className="w-full mt-4 group-hover:opacity-100 transition-opacity"
                  variant="outline"
                  style={{ borderColor: primaryColor, color: primaryColor }}
                >
                  Reservar
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
