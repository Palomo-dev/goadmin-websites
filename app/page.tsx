import { headers } from 'next/headers'
import { Metadata } from 'next'
import { getOrganizationByHost } from '@/lib/supabase/queries'
import { getBusinessTypeConfig } from '@/types/organization'
import { OrganizationSite } from '@/components/site/OrganizationSite'
import { NotFoundPage } from '@/components/site/NotFoundPage'

export const dynamic = 'force-dynamic'
export const revalidate = 60

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
    return {
      title: 'Sitio no encontrado',
      description: 'El sitio que buscas no existe'
    }
  }
  
  const settings = organization.website_settings
  const baseUrl = organization.custom_domain 
    ? `https://${organization.custom_domain}` 
    : `https://${organization.subdomain?.toLowerCase()}.goadmin.io`
  
  return {
    title: settings?.meta_title || organization.name,
    description: settings?.meta_description || organization.description || `Bienvenido a ${organization.name}`,
    keywords: settings?.meta_keywords || undefined,
    authors: [{ name: organization.name }],
    creator: organization.name,
    publisher: organization.name,
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: baseUrl
    },
    openGraph: {
      type: 'website',
      locale: 'es_CO',
      url: baseUrl,
      siteName: organization.name,
      title: settings?.meta_title || organization.name,
      description: settings?.meta_description || organization.description || `Bienvenido a ${organization.name}`,
      images: (settings as any)?.og_image_url ? [{ url: (settings as any).og_image_url, width: 1200, height: 630 }] : organization.logo_url ? [{ url: organization.logo_url }] : []
    },
    twitter: {
      card: 'summary_large_image',
      title: settings?.meta_title || organization.name,
      description: settings?.meta_description || organization.description || `Bienvenido a ${organization.name}`,
      images: (settings as any)?.og_image_url ? [(settings as any).og_image_url] : organization.logo_url ? [organization.logo_url] : []
    },
    icons: {
      icon: (settings as any)?.favicon_url || organization.logo_url || '/favicon.ico',
      apple: (settings as any)?.favicon_url || organization.logo_url || '/apple-touch-icon.png'
    },
    robots: {
      index: settings?.is_published !== false,
      follow: settings?.is_published !== false,
      googleBot: {
        index: settings?.is_published !== false,
        follow: settings?.is_published !== false
      }
    },
    verification: (settings as any)?.google_site_verification ? {
      google: (settings as any).google_site_verification
    } : undefined
  }
}

export default async function HomePage() {
  const headersList = await headers()
  const host = headersList.get('host') || ''
  const subdomain = headersList.get('x-subdomain')
  const customDomain = headersList.get('x-custom-domain')
  
  // Determinar el identificador del tenant
  const identifier = customDomain || subdomain
  
  // Si no hay identificador, mostrar página de error/landing
  if (!identifier) {
    return <NotFoundPage />
  }
  
  // Obtener la organización
  const organization = await getOrganizationByHost(identifier)
  
  if (!organization) {
    return <NotFoundPage subdomain={identifier} />
  }
  
  // Obtener configuración del tipo de negocio
  const businessType = getBusinessTypeConfig(organization.type_id)
  
  // Renderizar el sitio de la organización
  return (
    <OrganizationSite 
      organization={organization}
      businessType={businessType}
    />
  )
}
