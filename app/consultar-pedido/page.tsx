import { getOrgContext } from '@/lib/get-org-context'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import { OrderLookupClient } from './OrderLookupClient'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Consultar Pedido' }
  return { title: `Consultar Pedido | ${ctx.organization.name}` }
}

export default async function ConsultarPedidoPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { organization, primaryColor, template, headerNav, footerNav, frozenReason } = ctx

  return (
    <OrganizationLayout
      organization={organization}
      template={template}
      primaryColor={primaryColor}
      headerNav={headerNav}
      footerNav={footerNav}
      frozenReason={frozenReason}
    >
      <OrderLookupClient primaryColor={primaryColor} />
    </OrganizationLayout>
  )
}
