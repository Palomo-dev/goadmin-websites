import { headers } from 'next/headers'
import { getOrganizationByHost, getOrganizationProducts, getOrganizationCategories } from '@/lib/supabase/queries'
import { getBusinessTypeConfig } from '@/types/organization'
import { getTemplate, getTemplateByBusinessType } from '@/lib/templates'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { ProductGrid } from '@/components/site/ProductGrid'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ProductosPage() {
  const headersList = await headers()
  const subdomain = headersList.get('x-subdomain')
  const customDomain = headersList.get('x-custom-domain')
  const identifier = customDomain || subdomain
  
  if (!identifier) return <NotFoundPage />
  
  const organization = await getOrganizationByHost(identifier)
  if (!organization) return <NotFoundPage subdomain={identifier} />
  
  const [products, categories] = await Promise.all([
    getOrganizationProducts(organization.id, 50),
    getOrganizationCategories(organization.id)
  ])
  
  const settings = organization.website_settings
  const businessType = getBusinessTypeConfig(organization.type_id)
  const primaryColor = settings?.primary_color || organization.primary_color || '#3B82F6'
  
  const template = settings?.template_id 
    ? getTemplate(settings.template_id) 
    : getTemplateByBusinessType(organization.type_id)
  
  const sectionTitle = {
    restaurant: 'Nuestro Menú',
    retail: 'Nuestros Productos',
    hotel: 'Habitaciones',
    gym: 'Membresías',
    transport: 'Rutas Disponibles',
    parking: 'Tarifas',
    saas: 'Planes'
  }[businessType.type] || 'Productos'
  
  return (
    <OrganizationLayout
      organization={organization}
      template={template}
      primaryColor={primaryColor}
    >
      <div className="container mx-auto px-4 py-12">
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
            Explora nuestra selección completa de productos
          </p>
        </div>
        
        {/* Grid de productos con categorías */}
        <ProductGrid 
          products={products}
          categories={categories}
          primaryColor={primaryColor}
          organizationSubdomain={organization.subdomain || identifier}
        />
      </div>
    </OrganizationLayout>
  )
}
