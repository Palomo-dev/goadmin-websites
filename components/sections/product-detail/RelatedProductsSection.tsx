'use client'

import { RelatedProducts } from '@/components/site/RelatedProducts'
import { CLAVE_LAYOUT_RELACIONADOS } from '@/lib/defaultProductDetailSections'

export const CONTENT_KEYS = ['source', 'max_items', 'title'] as const

interface RelatedProductsSectionProps {
  content: Record<string, any>
  primaryColor?: string
  data?: {
    relatedProducts?: any[]
    product?: any
    organizationSubdomain?: string
    branchId?: number | null
  }
}

export function RelatedProductsSection({ content, primaryColor = '#3B82F6', data }: RelatedProductsSectionProps) {
  const products = data?.relatedProducts || []
  const product = data?.product

  if (products.length === 0) return null

  // `related_products_layout` es de la ficha (carrusel o grilla), no del estilo de tarjeta: no
  // viaja en `cardStyle` ni en `layoutConfig`. Sin más claves, ninguno de los dos (como el layout
  // monolítico, que no los pasaba).
  const { [CLAVE_LAYOUT_RELACIONADOS]: layout, ...resto } = content
  const conResto = Object.keys(resto).length > 0

  return (
    <RelatedProducts
      products={products}
      primaryColor={primaryColor}
      currentProductId={product?.id}
      organizationSubdomain={data?.organizationSubdomain || ''}
      title={content.title || 'Productos relacionados'}
      maxItems={content.max_items || 8}
      cardStyle={conResto ? resto : undefined}
      layoutConfig={conResto ? resto : undefined}
      layout={layout === 'grid' || layout === 'carousel' ? layout : undefined}
      branchId={data?.branchId ?? null}
    />
  )
}
