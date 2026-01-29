import { headers } from 'next/headers'
import { getOrganizationByHost, getOrganizationSpaceTypes } from '@/lib/supabase/queries'
import { getBusinessTypeConfig } from '@/types/organization'
import { getTemplate, getTemplateByBusinessType } from '@/lib/templates'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, Users, Bed, Car, Calendar } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function EspaciosPage() {
  const headersList = await headers()
  const subdomain = headersList.get('x-subdomain')
  const customDomain = headersList.get('x-custom-domain')
  const identifier = customDomain || subdomain
  
  if (!identifier) return <NotFoundPage />
  
  const organization = await getOrganizationByHost(identifier)
  if (!organization) return <NotFoundPage subdomain={identifier} />
  
  const spaceTypes = await getOrganizationSpaceTypes(organization.id)
  const settings = organization.website_settings
  const businessType = getBusinessTypeConfig(organization.type_id)
  const primaryColor = settings?.primary_color || organization.primary_color || '#3B82F6'
  
  const template = settings?.template_id 
    ? getTemplate(settings.template_id) 
    : getTemplateByBusinessType(organization.type_id)
  
  const pageConfig = {
    restaurant: { title: 'Nuestras Mesas', icon: '🍽️', subtitle: 'Reserva tu mesa' },
    hotel: { title: 'Habitaciones', icon: '🛏️', subtitle: 'Encuentra tu espacio ideal' },
    gym: { title: 'Espacios', icon: '💪', subtitle: 'Reserva tu clase o espacio' },
    transport: { title: 'Rutas', icon: '🚌', subtitle: 'Consulta disponibilidad' },
    parking: { title: 'Espacios de Parqueo', icon: '🚗', subtitle: 'Reserva tu espacio' },
    retail: { title: 'Espacios', icon: '📦', subtitle: 'Espacios disponibles' },
    saas: { title: 'Espacios', icon: '💼', subtitle: 'Espacios disponibles' }
  }[businessType.type] || { title: 'Espacios', icon: '🏠', subtitle: 'Espacios disponibles' }
  
  const getIcon = (categoryCode: string) => {
    switch (categoryCode) {
      case 'room': return <Bed className="h-6 w-6" />
      case 'suite': return <Bed className="h-6 w-6" />
      case 'parking': return <Car className="h-6 w-6" />
      default: return <Calendar className="h-6 w-6" />
    }
  }
  
  return (
    <OrganizationLayout
      organization={organization}
      template={template}
      primaryColor={primaryColor}
    >
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <Link 
            href="/"
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al inicio
          </Link>
        </div>
        
        <div className="text-center mb-12">
          <span className="text-5xl mb-4 block">{pageConfig.icon}</span>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{pageConfig.title}</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">{pageConfig.subtitle}</p>
        </div>
        
        {spaceTypes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {spaceTypes.map((spaceType: any) => (
              <Card key={spaceType.id} className="overflow-hidden hover:shadow-lg transition-all">
                <div 
                  className="h-48 flex items-center justify-center"
                  style={{ 
                    background: `linear-gradient(135deg, ${primaryColor}20 0%, ${primaryColor}10 100%)` 
                  }}
                >
                  <div 
                    className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${primaryColor}30` }}
                  >
                    {getIcon(spaceType.category_code)}
                  </div>
                </div>
                
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {spaceType.name}
                  </h3>
                  
                  <div className="flex items-center text-gray-600 mb-4">
                    <Users className="h-4 w-4 mr-2" />
                    <span>Capacidad: {spaceType.capacity} personas</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-gray-500">Desde</span>
                      <p 
                        className="text-2xl font-bold"
                        style={{ color: primaryColor }}
                      >
                        ${Number(spaceType.base_rate).toLocaleString()}
                      </p>
                      <span className="text-xs text-gray-500">por noche</span>
                    </div>
                    
                    <Link href={`/espacios/${spaceType.id}`}>
                      <Button 
                        style={{ backgroundColor: primaryColor }}
                        className="text-white"
                      >
                        Reservar
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">No hay espacios disponibles en este momento.</p>
            <Link href="/contacto">
              <Button className="mt-4" variant="outline">
                Contáctanos
              </Button>
            </Link>
          </div>
        )}
      </div>
    </OrganizationLayout>
  )
}
