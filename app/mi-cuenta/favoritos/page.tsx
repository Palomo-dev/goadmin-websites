import { getOrgContext } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { getProductsByIds } from '@/lib/supabase/queries'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import Link from 'next/link'
import { FavoriteProductCard } from './FavoriteProductCard'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Favoritos' }
  return { title: `Mis Favoritos | ${ctx.organization.name}` }
}

export default async function FavoritosPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { organization, primaryColor, branchId } = ctx
  const customer = await getAuthCustomer(organization.id)

  if (!customer) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Mis Favoritos</h1>
        <div className="bg-white rounded-xl border p-8 text-center">
          <p className="text-4xl mb-3">🔒</p>
          <h3 className="font-semibold text-lg mb-1">Inicia sesión para ver tus favoritos</h3>
          <Link href="/auth" className="text-sm mt-2 inline-block font-medium" style={{ color: primaryColor }}>
            Iniciar sesión →
          </Link>
        </div>
      </div>
    )
  }

  // Obtener IDs favoritos del metadata del customer
  const metadata = (customer as any).metadata || {}
  const favoriteIds: number[] = metadata.favorites || []

  // Obtener productos
  const products = favoriteIds.length > 0
    ? await getProductsByIds(favoriteIds, organization.id, branchId)
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mis Favoritos</h1>
        <p className="text-gray-500">{products.length} producto{products.length !== 1 ? 's' : ''} guardado{products.length !== 1 ? 's' : ''}</p>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center">
          <p className="text-4xl mb-3">❤️</p>
          <h3 className="font-semibold text-lg mb-1">Aún no tienes favoritos</h3>
          <p className="text-gray-500 text-sm mb-4">Marca productos como favoritos desde el menú para verlos aquí</p>
          <Link
            href="/menu"
            className="inline-block px-5 py-2 rounded-lg text-white text-sm font-medium"
            style={{ backgroundColor: primaryColor }}
          >
            Ver menú
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {products.map((product: any) => {
            const price = product.product_prices?.[0]
            const image = product.product_images?.find((img: any) => img.is_primary) || product.product_images?.[0]
            const imagePath = image?.storage_path || image?.shared_images?.storage_path

            return (
              <FavoriteProductCard
                key={product.id}
                productId={product.id}
                name={product.name}
                description={product.description}
                price={price?.price}
                imagePath={imagePath}
                customerId={customer.id}
                organizationId={organization.id}
                primaryColor={primaryColor}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
