import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getOrganizationByHost, getOrganizationProducts } from '@/lib/supabase/queries'
import { createPublicClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/get-org-context'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getCategory(categoryId: string, organizationId: number) {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', categoryId)
    .eq('organization_id', organizationId)
    .single()
  if (error || !data) return null
  return data as any
}

async function getProductsByCategory(categoryId: string, organizationId: number) {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('products')
    .select(`*, product_prices (*)`)
    .eq('organization_id', organizationId)
    .eq('category_id', categoryId)
    .eq('status', 'active')
    .limit(50)
  if (error) return []
  return data || []
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Categoría' }
  const { id } = await params
  const category = await getCategory(id, ctx.organization.id)
  return {
    title: `${category?.name || 'Categoría'} | ${ctx.organization.name}`,
    description: category?.description || `Productos de ${category?.name}`
  }
}

export default async function CategoriaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { id } = await params
  const { organization, primaryColor, template, headerNav, footerNav } = ctx

  const category = await getCategory(id, organization.id)
  if (!category) return notFound()

  const products = await getProductsByCategory(id, organization.id)

  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/categorias" className="inline-flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Todas las categorías
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold">{category.name}</h1>
          {category.description && <p className="text-gray-600 mt-2">{category.description}</p>}
          <p className="text-sm text-gray-400 mt-1">{products.length} productos</p>
        </div>

        {products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product: any) => {
              const price = product.product_prices?.[0]
              return (
                <Link
                  key={product.id}
                  href={`/productos/${product.uuid}`}
                  className="group bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="aspect-square bg-gray-100 overflow-hidden">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-5xl">📦</div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{product.name}</h3>
                    {product.description && <p className="text-gray-500 text-sm mb-2 line-clamp-2">{product.description}</p>}
                    {price && (
                      <span className="font-bold text-lg" style={{ color: primaryColor }}>
                        ${Number(price.price).toLocaleString()}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="text-center text-gray-400 py-16 border-2 border-dashed rounded-lg">
            <p className="text-4xl mb-3">📦</p>
            <p>No hay productos en esta categoría</p>
          </div>
        )}
      </div>
    </OrganizationLayout>
  )
}
