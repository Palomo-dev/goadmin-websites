import { Suspense } from 'react'
import { getOrgContext } from '@/lib/get-org-context'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { INICIO } from '@/lib/navegacion/volver'
import { colorCabeceraDe } from '@/lib/navegacion/coloresVolver'
import { BarraVolverMovil } from '@/components/site/volver/BarraVolverMovil'
import { EncabezadoPagina } from '@/components/site/volver/EncabezadoPagina'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { Metadata } from 'next'
import { AuthForm } from './AuthForm'
import { googleEnAcceso } from '@/lib/cuenta/reglasCuenta'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Iniciar Sesión' }
  return { title: `Iniciar Sesión | ${ctx.organization.name}` }
}

export default async function AuthPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { organization, primaryColor, template, headerNav, footerNav, frozenReason, effectiveSettings } = ctx

  return (
    <OrganizationLayout
      organization={organization}
      template={template}
      primaryColor={primaryColor}
      headerNav={headerNav}
      footerNav={footerNav}
      frozenReason={frozenReason}
    >
      <BarraVolverMovil
        padre={INICIO}
        etiquetaActual="Ingresar"
        primaryColor={primaryColor}
        colorCabecera={colorCabeceraDe(organization.website_settings)}
      />
      <main className="container mx-auto px-4 py-12">
        {/* «Volver» (Figma 2992:74856): a donde venía el cliente o al inicio. */}
        <EncabezadoPagina tipo="ficha" className="mb-8" migas={[{ etiqueta: 'Inicio', href: '/' }, { etiqueta: 'Ingresar' }]} padre={INICIO} primaryColor={primaryColor} />

        <Suspense fallback={
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: primaryColor }} />
          </div>
        }>
          <AuthForm
            organizationId={organization.id}
            organizationName={organization.name}
            logoUrl={organization.logo_url}
            primaryColor={primaryColor}
            google={googleEnAcceso(effectiveSettings)}
          />
        </Suspense>
      </main>
    </OrganizationLayout>
  )
}
