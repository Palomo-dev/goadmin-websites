import { getOrgContext } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import { ProfileForm } from './ProfileForm'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Mi Perfil' }
  return {
    title: `Mi Perfil | ${ctx.organization.name}`,
    description: `Edita tu perfil en ${ctx.organization.name}`
  }
}

export default async function PerfilPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { organization, primaryColor } = ctx
  const customer = await getAuthCustomer(organization.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mi Perfil</h1>
        <p className="text-gray-500">Actualiza tus datos personales</p>
      </div>

      {!customer ? (
        <div className="bg-white rounded-xl border p-8 text-center">
          <p className="text-4xl mb-3">👤</p>
          <h3 className="font-semibold text-lg mb-1">Inicia sesión</h3>
          <p className="text-gray-500">Debes iniciar sesión para ver tu perfil</p>
        </div>
      ) : (
        <ProfileForm customer={customer} primaryColor={primaryColor} organizationId={organization.id} />
      )}
    </div>
  )
}
