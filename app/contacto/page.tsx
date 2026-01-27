import { headers } from 'next/headers'
import { Metadata } from 'next'
import { getOrganizationByHost } from '@/lib/supabase/queries'
import { getBusinessTypeConfig } from '@/types/organization'
import { getTemplate, getTemplateByBusinessType } from '@/lib/templates'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { ContactSection } from '@/components/site/sections/ContactSection'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

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
    return { title: 'Contacto' }
  }
  
  return {
    title: `Contacto | ${organization.name}`,
    description: `Ponte en contacto con ${organization.name}. Estamos aquí para ayudarte.`
  }
}

export default async function ContactoPage() {
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

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader organization={organization} primaryColor={primaryColor} template={template} />
      
      <main>
        {/* Hero Section */}
        <section 
          className="relative py-16 md:py-24"
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
                Contáctanos
              </h1>
              <p className="text-xl text-gray-600">
                Estamos aquí para ayudarte. No dudes en comunicarte con nosotros.
              </p>
            </div>
          </div>
        </section>

        {/* Sección de contacto completa */}
        <ContactSection 
          organization={organization}
          settings={settings}
          primaryColor={primaryColor}
        />
      </main>
      
      <SiteFooter organization={organization} settings={settings} primaryColor={primaryColor} template={template} />
    </div>
  )
}
