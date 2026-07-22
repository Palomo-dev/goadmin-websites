import { getOrgContext } from '@/lib/get-org-context'
import { getOrgServiceCatalog } from '@/lib/supabase/queries'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { AppointmentForm } from './AppointmentForm'
import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Agendar Cita' }
  return { title: `Agendar Cita | ${ctx.organization.name}` }
}

export default async function AgendarPage({ searchParams }: { searchParams: Promise<{ servicio?: string }> }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { organization, primaryColor, template, headerNav, footerNav, frozenReason } = ctx
  const sp = await searchParams
  const preselectedServiceId = sp.servicio || ''

  // Obtener servicios para el selector
  const { services: catalog } = await getOrgServiceCatalog(organization.id)
  const serviceOptions = catalog.map((os: any) => ({
    id: os.id,
    name: os.custom_name || os.services?.name || 'Servicio',
  }))

  return (
    <OrganizationLayout
      organization={organization}
      primaryColor={primaryColor}
      template={template}
      headerNav={headerNav}
      footerNav={footerNav}
      frozenReason={frozenReason}
    >
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${primaryColor}15` }}>
            <span className="text-3xl">📅</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Agendar Cita</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Completa el formulario y nos pondremos en contacto para confirmar tu cita.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-6 md:p-8">
          <AppointmentForm
            organizationId={organization.id}
            services={serviceOptions}
            primaryColor={primaryColor}
            preselectedServiceId={preselectedServiceId}
          />
        </div>
      </div>
    </OrganizationLayout>
  )
}
