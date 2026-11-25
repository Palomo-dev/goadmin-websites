import { Metadata } from 'next'
import { getMetaPixelId } from '@/lib/supabase/queries'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { getOrgContext } from '@/lib/get-org-context'
import { OrderTracker } from './OrderTracker'
import { INICIO } from '@/lib/navegacion/volver'
import { colorCabeceraDe } from '@/lib/navegacion/coloresVolver'
import { BarraVolverMovil } from '@/components/site/volver/BarraVolverMovil'
import { EncabezadoPagina } from '@/components/site/volver/EncabezadoPagina'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const ctx = await getOrgContext()
  const { id } = await params
  return {
    title: ctx ? `Pedido ${id} | ${ctx.organization.name}` : `Pedido ${id}`,
    robots: { index: false, follow: false },
  }
}

/**
 * Seguimiento del pedido. Usa `getOrgContext` como el resto de páginas: así la cabecera, el
 * logo, los colores, los menús y el menú inferior salen del sitio publicado (V2), no de la fila
 * vieja de la organización (antes se veía una cabecera genérica con las iniciales).
 */
export default async function TrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ t?: string | string[] }>
}) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { organization, primaryColor, template, headerNav, footerNav, frozenReason, branchId } = ctx

  const { id } = await params
  // Token de seguimiento del enlace (correo, checkout): la API lo valida contra el pedido.
  const { t } = await searchParams
  const token = typeof t === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(t) ? t : null

  const metaPixelId = await getMetaPixelId(organization.id)

  return (
    <OrganizationLayout
      organization={organization}
      template={template}
      primaryColor={primaryColor}
      headerNav={headerNav}
      footerNav={footerNav}
      metaPixelId={metaPixelId}
      frozenReason={frozenReason}
      branchId={branchId}
    >
      {/* «Volver» (Figma 2993:75202): a donde venía el cliente (p. ej. Mis pedidos); si entró por el
          enlace del correo o de WhatsApp, al inicio. Sin consultar la sesión: página pública. */}
      <BarraVolverMovil
        padre={INICIO}
        etiquetaActual={`Pedido ${id}`}
        primaryColor={primaryColor}
        colorCabecera={colorCabeceraDe(organization.website_settings)}
        acciones={{ buscar: true, carrito: { subdominio: organization.subdomain || '', branchId } }}
      />
      <div className="container mx-auto hidden max-w-xl px-4 pt-6 md:block lg:max-w-6xl">
        <EncabezadoPagina tipo="ficha" migas={[{ etiqueta: 'Inicio', href: '/' }, { etiqueta: `Pedido ${id}` }]} padre={INICIO} primaryColor={primaryColor} />
      </div>
      <OrderTracker
        orderIdentifier={id}
        primaryColor={primaryColor}
        token={token}
        rutaSeguirPidiendo={organization.type_id === 1 ? '/menu' : '/productos'}
        dosColumnas
      />
    </OrganizationLayout>
  )
}
