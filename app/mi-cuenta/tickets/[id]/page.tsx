import { getOrgContext } from '@/lib/get-org-context'
import { isValidUUID } from '@/lib/utils'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Detalle de Ticket' }
  return { title: `Detalle de Ticket | ${ctx.organization.name}` }
}

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { id } = await params
  if (!isValidUUID(id)) return <NotFoundPage />
  const { primaryColor } = ctx

  return (
    <div className="space-y-6">
      <div>
        <Link href="/mi-cuenta/tickets" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a tickets
        </Link>
        <h1 className="text-2xl font-bold">Ticket #{id}</h1>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <div className="text-center py-8">
          <div className="w-48 h-48 mx-auto bg-gray-100 rounded-xl flex items-center justify-center mb-4">
            <span className="text-6xl">🎫</span>
          </div>
          <p className="text-gray-500">QR Code del ticket</p>
        </div>

        <div className="space-y-3 border-t pt-4">
          <div className="flex justify-between">
            <span className="text-gray-500">Número de ticket</span>
            <span className="font-bold" style={{ color: primaryColor }}>#{id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Estado</span>
            <span className="text-green-600 font-medium">Activo</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Ruta</span>
            <span className="font-medium">---</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Asiento</span>
            <span className="font-medium">---</span>
          </div>
        </div>
      </div>
    </div>
  )
}
