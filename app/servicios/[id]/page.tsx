import { getOrgContext } from '@/lib/get-org-context'
import { getServiceById } from '@/lib/supabase/queries'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Servicio' }
  const { id } = await params
  const result = await getServiceById(id, ctx.organization.id)
  const name = result?.service?.custom_name || result?.service?.services?.name || 'Servicio'
  return { title: `${name} | ${ctx.organization.name}` }
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { id } = await params
  const { organization, primaryColor, template, headerNav, footerNav, frozenReason } = ctx

  const result = await getServiceById(id, organization.id)
  if (!result) return <NotFoundPage />

  const { service: os, charges } = result
  const svc = os.services || {}
  const icon = os.custom_icon || svc.icon || '🛠️'
  const name = os.custom_name || svc.name || 'Servicio'
  const desc = os.custom_description || svc.description || ''
  const category = svc.category || ''

  // Tarifas del servicio
  const svcCharges = charges.filter((c: any) => c.service_id === os.service_id || c.applies_to === 'all')

  return (
    <OrganizationLayout
      organization={organization}
      primaryColor={primaryColor}
      template={template}
      headerNav={headerNav}
      footerNav={footerNav}
      frozenReason={frozenReason}
    >
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Breadcrumb */}
        <nav className="mb-8">
          <Link href="/servicios" className="text-sm text-gray-500 dark:text-gray-400 hover:underline flex items-center gap-1">
            ← Volver a servicios
          </Link>
        </nav>

        {/* Header */}
        <div className="flex items-start gap-6 mb-8">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl shrink-0" style={{ background: `linear-gradient(135deg, ${primaryColor}20 0%, ${primaryColor}10 100%)` }}>
            {icon}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{name}</h1>
            {category && (
              <span className="inline-block text-xs font-medium px-3 py-1 rounded-full" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                {category}
              </span>
            )}
          </div>
        </div>

        {/* Descripción */}
        {desc && (
          <div className="mb-10">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Descripción</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">{desc}</p>
          </div>
        )}

        {/* Tarifas */}
        {svcCharges.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tarifas</h2>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border dark:border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">Concepto</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">Valor</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">Mínimo</th>
                  </tr>
                </thead>
                <tbody>
                  {svcCharges.map((ch: any) => (
                    <tr key={ch.id} className="border-b dark:border-gray-700 last:border-0">
                      <td className="px-6 py-4 text-gray-900 dark:text-white">{ch.name}</td>
                      <td className="px-6 py-4 text-right font-semibold" style={{ color: primaryColor }}>
                        {ch.charge_type === 'percentage'
                          ? `${ch.charge_value}%`
                          : `$${Number(ch.charge_value || 0).toLocaleString()}`
                        }
                      </td>
                      <td className="px-6 py-4 text-right text-gray-500 dark:text-gray-400">
                        {ch.min_amount ? `$${Number(ch.min_amount).toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-wrap gap-4">
          <Link
            href={`/agendar?servicio=${os.id}`}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-lg text-white font-medium transition-all hover:opacity-90"
            style={{ backgroundColor: primaryColor }}
          >
            📅 Agendar Cita
          </Link>
          <Link
            href={`/cotizar?servicio=${os.id}`}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-lg font-medium border-2 transition-all hover:opacity-80"
            style={{ borderColor: primaryColor, color: primaryColor }}
          >
            📋 Solicitar Cotización
          </Link>
        </div>
      </div>
    </OrganizationLayout>
  )
}
