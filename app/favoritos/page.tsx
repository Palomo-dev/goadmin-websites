import { Metadata } from 'next'
import { getOrgContext } from '@/lib/get-org-context'
import { getGoogleAdsConfig, getMetaPixelId } from '@/lib/supabase/queries'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { FavoritosPagina } from '@/components/site/favoritos/FavoritosPagina'
import { leerListaCompartida } from '@/lib/favoritos/servidor'
import { MAX_LISTA_COMPARTIDA, idsDeConsulta } from '@/lib/favoritos/logica'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  // Página personal: no se indexa.
  return { title: ctx ? `Favoritos | ${ctx.organization.name}` : 'Favoritos', robots: { index: false, follow: true } }
}

/**
 * /favoritos (Figma «16 Sitio web» 2764:61164, aprobado 2026-11-22): pública, con o sin sesión.
 * Sin sesión los favoritos vienen del dispositivo; con sesión, de la cuenta (el navegador los
 * carga: lib/favoritos/almacen.ts). `?lista=<token>` muestra una lista compartida (de ESTA
 * organización y vigente) y `?ids=1,2` la de respaldo cuando la tabla aún no existe.
 */
export default async function FavoritosPage({ searchParams }: { searchParams: { lista?: string; ids?: string } }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { organization, primaryColor, template, headerNav, footerNav, frozenReason, branchId } = ctx
  const params = searchParams ?? {}
  const [metaPixelId, googleAdsConfig, lista] = await Promise.all([
    getMetaPixelId(organization.id),
    getGoogleAdsConfig(organization.id),
    params.lista ? leerListaCompartida(organization.id, params.lista) : Promise.resolve(null),
  ])
  const desdeIds = params.ids ? idsDeConsulta(params.ids, MAX_LISTA_COMPARTIDA) : []
  const compartidos = lista ?? (desdeIds.length > 0 ? desdeIds : null)

  return (
    <OrganizationLayout
      organization={organization}
      template={template}
      primaryColor={primaryColor}
      headerNav={headerNav}
      footerNav={footerNav}
      metaPixelId={metaPixelId}
      googleAdsConfig={googleAdsConfig}
      frozenReason={frozenReason}
      branchId={branchId}
    >
      <FavoritosPagina
        primaryColor={primaryColor}
        organizationSubdomain={organization.subdomain || ''}
        branchId={branchId ?? null}
        compartidos={compartidos}
        listaNoDisponible={!!params.lista && lista === null}
      />
    </OrganizationLayout>
  )
}
