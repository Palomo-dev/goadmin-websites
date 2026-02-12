import { getOrgContext } from '@/lib/get-org-context'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Detalle de Viaje' }
  return { title: `Detalle de Viaje | ${ctx.organization.name}` }
}

export default async function ViajeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { id } = await params
  const { organization, primaryColor, template, headerNav, footerNav } = ctx

  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/viajes" className="inline-flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a búsqueda
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Info del viaje */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border p-6">
              <h1 className="text-2xl font-bold mb-4">Viaje #{id}</h1>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Origen</p>
                  <p className="font-medium">---</p>
                </div>
                <div>
                  <p className="text-gray-500">Destino</p>
                  <p className="font-medium">---</p>
                </div>
                <div>
                  <p className="text-gray-500">Fecha</p>
                  <p className="font-medium">---</p>
                </div>
                <div>
                  <p className="text-gray-500">Hora salida</p>
                  <p className="font-medium">---</p>
                </div>
              </div>
            </div>

            {/* Mapa de asientos placeholder */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="font-semibold text-lg mb-4">Selecciona tu asiento</h2>
              <div className="text-center text-gray-400 py-12 border-2 border-dashed rounded-lg">
                <p className="text-4xl mb-3">💺</p>
                <p>Mapa de asientos del vehículo</p>
              </div>
            </div>
          </div>

          {/* Resumen de compra */}
          <div>
            <div className="bg-white rounded-xl border p-6 sticky top-24">
              <h2 className="font-semibold text-lg mb-4">Resumen</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Pasaje</span>
                  <span>$---</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Asiento</span>
                  <span className="text-gray-400">No seleccionado</span>
                </div>
                <hr />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span style={{ color: primaryColor }}>$---</span>
                </div>
              </div>
              <button
                disabled
                className="w-full mt-6 px-6 py-3 rounded-lg text-white font-medium opacity-50 cursor-not-allowed"
                style={{ backgroundColor: primaryColor }}
              >
                Comprar Pasaje
              </button>
            </div>
          </div>
        </div>
      </div>
    </OrganizationLayout>
  )
}
