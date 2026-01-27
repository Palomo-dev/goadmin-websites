import { headers } from 'next/headers'
import { getOrganizationByHost, getOrganizationProducts } from '@/lib/supabase/queries'
import { getBusinessTypeConfig } from '@/types/organization'
import { getTemplate, getTemplateByBusinessType } from '@/lib/templates'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ShoppingCart, ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ProductosPage() {
  const headersList = await headers()
  const subdomain = headersList.get('x-subdomain')
  const customDomain = headersList.get('x-custom-domain')
  const identifier = customDomain || subdomain
  
  if (!identifier) return <NotFoundPage />
  
  const organization = await getOrganizationByHost(identifier)
  if (!organization) return <NotFoundPage subdomain={identifier} />
  
  const products = await getOrganizationProducts(organization.id, 50)
  const settings = organization.website_settings
  const businessType = getBusinessTypeConfig(organization.type_id)
  const primaryColor = settings?.primary_color || organization.primary_color || '#3B82F6'
  
  // Obtener template según configuración o tipo de negocio
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
            Explora nuestra selección completa de productos
          </p>
        </div>
        
        {/* Grid de productos */}
        {products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product: any) => {
              const price = product.product_prices?.[0]
              
              return (
                <Link key={product.id} href={`/productos/${product.id}`}>
                  <Card className="group overflow-hidden hover:shadow-lg transition-all h-full">
                    <div 
                      className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center"
                      style={{ 
                        background: `linear-gradient(135deg, ${primaryColor}10 0%, ${primaryColor}05 100%)` 
                      }}
                    >
                      <span className="text-5xl opacity-50">📦</span>
                    </div>
                    
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1 group-hover:text-blue-600 transition-colors">
                        {product.name}
                      </h3>
                      
                      {product.description && (
                        <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                          {product.description}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between">
                        {price && (
                          <span 
                            className="text-lg font-bold"
                            style={{ color: primaryColor }}
                          >
                            ${Number(price.price).toLocaleString()}
                          </span>
                        )}
                        
                        <Button 
                          size="sm"
                          variant="outline"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ borderColor: primaryColor, color: primaryColor }}
                        >
                          <ShoppingCart className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">No hay productos disponibles en este momento.</p>
          </div>
        )}
      </main>
      
      <SiteFooter organization={organization} settings={settings} primaryColor={primaryColor} />
    </div>
  )
}
