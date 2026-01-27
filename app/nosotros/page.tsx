import { headers } from 'next/headers'
import { Metadata } from 'next'
import { getOrganizationByHost } from '@/lib/supabase/queries'
import { getBusinessTypeConfig } from '@/types/organization'
import { getTemplate, getTemplateByBusinessType } from '@/lib/templates'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import Link from 'next/link'
import { ArrowLeft, Users, Target, Award, Heart } from 'lucide-react'

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
    return { title: 'Nosotros' }
  }
  
  return {
    title: `Nosotros | ${organization.name}`,
    description: organization.description || `Conoce más sobre ${organization.name}`
  }
}

export default async function NosotrosPage() {
  const headersList = await headers()
  const subdomain = headersList.get('x-subdomain')
  const customDomain = headersList.get('x-custom-domain')
  const identifier = customDomain || subdomain
  
  if (!identifier) return <NotFoundPage />
  
  const organization = await getOrganizationByHost(identifier)
  if (!organization) return <NotFoundPage subdomain={identifier} />
  
  const settings = organization.website_settings
  const businessType = getBusinessTypeConfig(organization.type_id)
  const primaryColor = settings?.primary_color || organization.primary_color || '#3B82F6'
  
  const template = settings?.template_id 
    ? getTemplate(settings.template_id) 
    : getTemplateByBusinessType(organization.type_id)

  const values = [
    {
      icon: Target,
      title: 'Misión',
      description: 'Ofrecer productos y servicios de la más alta calidad, superando las expectativas de nuestros clientes.'
    },
    {
      icon: Award,
      title: 'Visión',
      description: 'Ser reconocidos como líderes en nuestro sector, innovando constantemente para brindar las mejores soluciones.'
    },
    {
      icon: Heart,
      title: 'Valores',
      description: 'Compromiso, integridad, excelencia y pasión por lo que hacemos son los pilares de nuestra organización.'
    },
    {
      icon: Users,
      title: 'Equipo',
      description: 'Contamos con un equipo de profesionales altamente capacitados y comprometidos con tu satisfacción.'
    }
  ]

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader organization={organization} primaryColor={primaryColor} template={template} />
      
      <main>
        {/* Hero Section */}
        <section 
          className="relative py-20 md:py-32"
          style={{ 
            background: `linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}05 100%)` 
          }}
        >
          <div className="container mx-auto px-4">
            <div className="mb-6">
              <Link 
                href="/"
                className="inline-flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al inicio
              </Link>
            </div>
            
            <div className="max-w-3xl">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Sobre Nosotros
              </h1>
              <p className="text-xl text-gray-600">
                {organization.description || `Conoce más sobre ${organization.name} y nuestra historia de compromiso con la excelencia.`}
              </p>
            </div>
          </div>
        </section>

        {/* Historia / Descripción */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-6">
                  Nuestra Historia
                </h2>
                <div className="space-y-4 text-gray-600">
                  <p>
                    En <strong>{organization.name}</strong>, nos dedicamos a ofrecer lo mejor a nuestros clientes. 
                    Desde nuestros inicios, hemos trabajado incansablemente para convertirnos en referentes en nuestro sector.
                  </p>
                  <p>
                    Nuestro compromiso con la calidad y la satisfacción del cliente nos ha permitido crecer 
                    y consolidarnos como una opción confiable para quienes buscan excelencia.
                  </p>
                  <p>
                    Día a día, continuamos innovando y mejorando para superar tus expectativas.
                  </p>
                </div>
              </div>
              
              <div 
                className="aspect-video rounded-2xl flex items-center justify-center"
                style={{ 
                  background: `linear-gradient(135deg, ${primaryColor}20 0%, ${primaryColor}10 100%)` 
                }}
              >
                <div className="text-center">
                  <span className="text-6xl">🏢</span>
                  <p className="text-gray-500 mt-4">Imagen de la empresa</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Valores */}
        <section className="py-16 md:py-24 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Nuestros Valores
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Los principios que guían cada una de nuestras acciones
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {values.map((value, index) => (
                <div 
                  key={index}
                  className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                    style={{ backgroundColor: `${primaryColor}15` }}
                  >
                    <value.icon 
                      className="h-6 w-6" 
                      style={{ color: primaryColor }}
                    />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {value.title}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {value.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Información de contacto rápida */}
        {(organization.address || organization.phone || organization.email) && (
          <section className="py-16 md:py-24">
            <div className="container mx-auto px-4">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Encuéntranos
                </h2>
              </div>
              
              <div className="max-w-2xl mx-auto bg-gray-50 rounded-2xl p-8">
                <div className="space-y-4">
                  {organization.address && (
                    <div className="flex items-start">
                      <span className="text-2xl mr-4">📍</span>
                      <div>
                        <p className="font-medium text-gray-900">Dirección</p>
                        <p className="text-gray-600">
                          {organization.address}
                          {organization.city && `, ${organization.city}`}
                          {organization.state && `, ${organization.state}`}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {organization.phone && (
                    <div className="flex items-start">
                      <span className="text-2xl mr-4">📞</span>
                      <div>
                        <p className="font-medium text-gray-900">Teléfono</p>
                        <a 
                          href={`tel:${organization.phone}`}
                          className="text-gray-600 hover:underline"
                          style={{ color: primaryColor }}
                        >
                          {organization.phone}
                        </a>
                      </div>
                    </div>
                  )}
                  
                  {organization.email && (
                    <div className="flex items-start">
                      <span className="text-2xl mr-4">✉️</span>
                      <div>
                        <p className="font-medium text-gray-900">Email</p>
                        <a 
                          href={`mailto:${organization.email}`}
                          className="text-gray-600 hover:underline"
                          style={{ color: primaryColor }}
                        >
                          {organization.email}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
      
      <SiteFooter organization={organization} settings={settings} primaryColor={primaryColor} template={template} />
    </div>
  )
}
