import { headers } from 'next/headers'
import { Metadata } from 'next'
import { getOrganizationByHost, getOrganizationServices } from '@/lib/supabase/queries'
import { getBusinessTypeConfig } from '@/types/organization'
import { getTemplate, getTemplateByBusinessType } from '@/lib/templates'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, Clock, DollarSign } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getOrganizationFromHeaders() {
  const headersList = await headers()
  const subdomain = headersList.get('x-subdomain')
  const customDomain = headersList.get('x-custom-domain')
  const identifier = customDomain || subdomain
  if (!identifier) return null
  return getOrganizationByHost(identifier)
}

export async function generateMetadata(): Promise<Metadata> {
  const organization = await getOrganizationFromHeaders()
  
  if (!organization) {
    return { title: 'Servicios' }
  }
  
  return {
    title: `Servicios | ${organization.name}`,
    description: `Conoce nuestros servicios en ${organization.name}`
  }
}

export default async function ServiciosPage() {
  const headersList = await headers()
  const subdomain = headersList.get('x-subdomain')
  const customDomain = headersList.get('x-custom-domain')
  const identifier = customDomain || subdomain
  
  if (!identifier) return <NotFoundPage />
  
  const organization = await getOrganizationByHost(identifier)
  if (!organization) return <NotFoundPage subdomain={identifier} />
  
  const services = await getOrganizationServices(organization.id, 50)
  const settings = organization.website_settings
  const businessType = getBusinessTypeConfig(organization.type_id)
  const primaryColor = settings?.primary_color || organization.primary_color || '#3B82F6'
  
  const template = settings?.template_id 
    ? getTemplate(settings.template_id) 
    : getTemplateByBusinessType(organization.type_id)

  const sectionTitle = {
    restaurant: 'Nuestros Servicios',
    retail: 'Servicios',
    hotel: 'Servicios del Hotel',
    gym: 'Clases y Servicios',
    transport: 'Nuestros Servicios',
    parking: 'Servicios Adicionales',
    saas: 'Servicios'
  }[businessType.type] || 'Servicios'

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader organization={organization} primaryColor={primaryColor} template={template} />
      
      <main className="container mx-auto px-4 py-12">
        {/* Breadcrumb */}
        <div className="mb-8">
          <Link 
            href="/"
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al inicio
          </Link>
        </div>
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{sectionTitle}</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Descubre todos los servicios que tenemos para ti
          </p>
        </div>
        
        {/* Grid de servicios */}
        {services.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service: any) => {
              const price = service.product_prices?.[0]
              
              return (
                <Card key={service.id} className="group overflow-hidden hover:shadow-lg transition-all">
                  <div 
                    className="h-32 flex items-center justify-center"
                    style={{ 
                      background: `linear-gradient(135deg, ${primaryColor}20 0%, ${primaryColor}10 100%)` 
                    }}
                  >
                    <span className="text-5xl">🛠️</span>
                  </div>
                  
                  <CardContent className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {service.name}
                    </h3>
                    
                    {service.description && (
                      <p className="text-gray-500 mb-4 line-clamp-3">
                        {service.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      {price && (
                        <div className="flex items-center text-gray-700">
                          <DollarSign className="h-4 w-4 mr-1" />
                          <span 
                            className="text-lg font-bold"
                            style={{ color: primaryColor }}
                          >
                            ${Number(price.price).toLocaleString()}
                          </span>
                        </div>
                      )}
                      
                      <Button 
                        variant="outline"
                        size="sm"
                        style={{ borderColor: primaryColor, color: primaryColor }}
                      >
                        Solicitar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <div 
              className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center"
              style={{ backgroundColor: `${primaryColor}15` }}
            >
              <span className="text-4xl">🛠️</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Próximamente
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Estamos preparando nuestro catálogo de servicios. Contáctanos para más información.
            </p>
            <Link href="/contacto">
              <Button 
                className="mt-6"
                style={{ backgroundColor: primaryColor }}
              >
                Contáctanos
              </Button>
            </Link>
          </div>
        )}
      </main>
      
      <SiteFooter organization={organization} settings={settings} primaryColor={primaryColor} template={template} />
    </div>
  )
}
