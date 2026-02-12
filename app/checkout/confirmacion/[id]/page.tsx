import { getOrgContext } from '@/lib/get-org-context'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Confirmación' }
  return {
    title: `Pedido Confirmado | ${ctx.organization.name}`,
  }
}

export default async function ConfirmacionPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { id } = await params
  const { organization, primaryColor, template, headerNav, footerNav } = ctx

  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav}>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-lg mx-auto text-center">
          <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
            <CheckCircle className="w-10 h-10" style={{ color: primaryColor }} />
          </div>

          <h1 className="text-3xl font-bold mb-2">¡Pedido Confirmado!</h1>
          <p className="text-gray-500 mb-6">Tu pedido ha sido recibido exitosamente</p>

          <div className="bg-white rounded-xl border p-6 mb-8 text-left">
            <div className="flex items-center justify-between mb-4 pb-4 border-b">
              <span className="text-gray-500">Número de orden</span>
              <span className="font-bold" style={{ color: primaryColor }}>#{id}</span>
            </div>
            <div className="flex items-center justify-between mb-4 pb-4 border-b">
              <span className="text-gray-500">Estado</span>
              <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                <CheckCircle className="w-4 h-4" /> Confirmado
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Fecha</span>
              <span className="font-medium">{new Date().toLocaleDateString('es')}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/mi-cuenta/pedidos"
              className="px-6 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
              style={{ backgroundColor: primaryColor }}
            >
              Ver mis pedidos
            </Link>
            <Link
              href="/"
              className="px-6 py-3 rounded-lg font-medium border hover:bg-gray-50 transition-colors"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </OrganizationLayout>
  )
}
