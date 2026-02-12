import { getOrgContext } from '@/lib/get-org-context'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Viajes' }
  return {
    title: `Buscar Viajes | ${ctx.organization.name}`,
    description: `Busca y compra pasajes en ${ctx.organization.name}`
  }
}

export default async function ViajesPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { organization, primaryColor, template, headerNav, footerNav } = ctx

  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav}>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-8">Buscar Viajes</h1>

        {/* Formulario de búsqueda */}
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-6 md:p-8 mb-12">
          <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Origen</label>
              <select className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none">
                <option value="">Selecciona origen</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destino</label>
              <select className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none">
                <option value="">Selecciona destino</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input type="date" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pasajeros</label>
              <select className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none">
                {[1,2,3,4,5].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </form>
          <div className="mt-6 text-center">
            <button
              type="button"
              className="px-8 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
              style={{ backgroundColor: primaryColor }}
            >
              Buscar Viajes
            </button>
          </div>
        </div>

        {/* Resultados placeholder */}
        <div className="text-center text-gray-400 py-16 border-2 border-dashed rounded-lg">
          <p className="text-4xl mb-3">🔍</p>
          <p>Selecciona origen, destino y fecha para buscar viajes disponibles</p>
        </div>
      </div>
    </OrganizationLayout>
  )
}
