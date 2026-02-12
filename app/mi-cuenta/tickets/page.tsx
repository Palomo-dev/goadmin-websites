import { getOrgContext } from '@/lib/get-org-context'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Mis Tickets' }
  return { title: `Mis Tickets | ${ctx.organization.name}` }
}

export default async function TicketsPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mis Tickets</h1>
        <p className="text-gray-500">Pasajes y tickets de viaje</p>
      </div>
      <div className="bg-white rounded-xl border p-8 text-center">
        <p className="text-4xl mb-3">🎫</p>
        <h3 className="font-semibold text-lg mb-1">No tienes tickets</h3>
        <p className="text-gray-500">Compra un pasaje para ver tus tickets aquí</p>
      </div>
    </div>
  )
}
