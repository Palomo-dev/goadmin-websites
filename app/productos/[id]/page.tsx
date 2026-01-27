import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getOrganizationByHost } from '@/lib/supabase/queries'
import { createPublicClient } from '@/lib/supabase/server'
import { getTemplate, getTemplateByBusinessType } from '@/lib/templates'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft, ShoppingCart, Package, Truck, Shield, Star } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getProduct(productId: string, organizationId: number): Promise<any | null> {
  const supabase = createPublicClient()
  
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      product_prices (*)
    `)
    .eq('id', productId)
    .eq('organization_id', organizationId)
    .single()
  
  if (error || !data) return null
  return data as any
}

interface Props {
  params: { id: string }
}

export default async function ProductoDetailPage({ params }: Props) {
  const headersList = await headers()
  const subdomain = headersList.get('x-subdomain')
  const customDomain = headersList.get('x-custom-domain')
  const identifier = customDomain || subdomain
  
  if (!identifier) return <NotFoundPage />
  
  const organization = await getOrganizationByHost(identifier)
  if (!organization) return <NotFoundPage subdomain={identifier} />
  
  const product = await getProduct(params.id, organization.id)
  if (!product) return notFound()
  
  const settings = organization.website_settings
  const primaryColor = settings?.primary_color || organization.primary_color || '#3B82F6'
  const price = product.product_prices?.[0]
  
  // Obtener template
  const template = settings?.template_id 
    ? getTemplate(settings.template_id) 
    : getTemplateByBusinessType(organization.type_id)
  
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader organization={organization} primaryColor={primaryColor} template={template} />
      
      <main className="container mx-auto px-4 py-12">
        {/* Breadcrumb */}
        <div className="mb-8">
          <Link 
            href="/productos"
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a productos
          </Link>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Imagen del producto */}
          <div className="space-y-4">
            <div 
              className="aspect-square rounded-2xl flex items-center justify-center"
              style={{ 
                background: `linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}05 100%)` 
              }}
            >
              <span className="text-8xl">📦</span>
            </div>
          </div>
          
          {/* Información del producto */}
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-500 mb-2">SKU: {product.sku || 'N/A'}</p>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.name}</h1>
              
              {price && (
                <div className="flex items-baseline gap-3">
                  <span 
                    className="text-4xl font-bold"
                    style={{ color: primaryColor }}
                  >
                    ${Number(price.price).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            
            {product.description && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Descripción</h3>
                <p className="text-gray-600 leading-relaxed">{product.description}</p>
              </div>
            )}
            
            {/* Acciones */}
            <div className="space-y-3 pt-4">
              <Button 
                size="lg"
                className="w-full text-lg py-6"
                style={{ backgroundColor: primaryColor }}
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                Agregar al carrito
              </Button>
              
              <Button 
                size="lg"
                variant="outline"
                className="w-full"
                style={{ borderColor: primaryColor, color: primaryColor }}
              >
                Comprar ahora
              </Button>
            </div>
            
            {/* Beneficios */}
            <div className="grid grid-cols-2 gap-4 pt-6 border-t">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Envío rápido</p>
                  <p className="text-xs text-gray-500">24-48 horas</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Garantía</p>
                  <p className="text-xs text-gray-500">30 días</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <Package className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Empaque seguro</p>
                  <p className="text-xs text-gray-500">Protección total</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                  <Star className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Calidad</p>
                  <p className="text-xs text-gray-500">100% original</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <SiteFooter organization={organization} settings={settings} primaryColor={primaryColor} template={template} />
    </div>
  )
}
