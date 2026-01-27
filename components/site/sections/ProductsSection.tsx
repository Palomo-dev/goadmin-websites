import { getOrganizationProducts } from '@/lib/supabase/queries'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShoppingCart } from 'lucide-react'
import type { BusinessTypeConfig } from '@/types/organization'

interface ProductsSectionProps {
  organizationId: number
  businessType: BusinessTypeConfig
  primaryColor: string
}

export async function ProductsSection({ organizationId, businessType, primaryColor }: ProductsSectionProps) {
  const products = await getOrganizationProducts(organizationId, 8)
  
  if (!products || products.length === 0) {
    return null
  }
  
  // Título según tipo de negocio
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
    <section id="productos" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {sectionTitle}
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Descubre lo mejor que tenemos para ofrecerte
          </p>
        </div>
        
        {/* Grid de productos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product: any) => {
            const price = product.product_prices?.[0]
            
            return (
              <Card key={product.id} className="group overflow-hidden hover:shadow-lg transition-shadow">
                {/* Imagen placeholder */}
                <div 
                  className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center"
                  style={{ 
                    background: `linear-gradient(135deg, ${primaryColor}10 0%, ${primaryColor}05 100%)` 
                  }}
                >
                  <span className="text-4xl opacity-50">📦</span>
                </div>
                
                <CardContent className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">
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
                        ${price.price?.toLocaleString()}
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
            )
          })}
        </div>
        
        {/* Ver más */}
        <div className="text-center mt-10">
          <Button 
            size="lg"
            variant="outline"
            style={{ borderColor: primaryColor, color: primaryColor }}
          >
            Ver todos los {sectionTitle.toLowerCase()}
          </Button>
        </div>
      </div>
    </section>
  )
}
