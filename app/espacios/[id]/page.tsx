import { getOrgContext } from '@/lib/get-org-context'
import { createPublicClient } from '@/lib/supabase/server'
import { getSpaceById } from '@/lib/supabase/queries'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { ProductImageGallery } from '@/components/site/ProductImageGallery'
import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Users, Bed, MapPin, Maximize2 } from 'lucide-react'
import { SpaceBookingForm } from './SpaceBookingForm'
import { AvailabilityCalendar } from '@/components/site/AvailabilityCalendar'

export const dynamic = 'force-dynamic'

async function getAvailableGateways(organizationId: number) {
  const supabase = createPublicClient()
  const { data, error } = await (supabase as any)
    .from('integration_connections')
    .select(`id, environment, status, connector_id, integration_connectors!inner (code, name)`)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .in('integration_connectors.code', ['wompi_co', 'mp_checkout', 'payu_co', 'stripe_payments', 'paypal_checkout'])

  if (error || !data) return []
  return data.map((conn: any) => ({
    code: conn.integration_connectors.code,
    name: conn.integration_connectors.name,
  }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Espacio' }
  const { id } = await params
  const space = await getSpaceById(id, ctx.organization.id)
  const title = space ? `${space.label} — ${space.space_types?.name || 'Espacio'}` : 'Espacio'
  return { title: `${title} | ${ctx.organization.name}` }
}

export default async function EspacioDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { id } = await params
  const { organization, primaryColor, template, headerNav, footerNav } = ctx

  const [space, gateways] = await Promise.all([
    getSpaceById(id, organization.id),
    getAvailableGateways(organization.id),
  ])

  if (!space) {
    return (
      <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav}>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <p className="text-4xl mb-3">🏠</p>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Espacio no encontrado</h1>
            <Link href="/espacios" className="text-sm hover:underline" style={{ color: primaryColor }}>Ver todos los espacios</Link>
          </div>
        </div>
      </OrganizationLayout>
    )
  }

  const st = space.space_types as any

  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav}>
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <Link href="/espacios" className="inline-flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a espacios
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Columna izquierda: Galería + Info */}
          <div>
            {space.images.length > 0 ? (
              <div className="mb-6">
                <ProductImageGallery images={space.images} productName={space.label} primaryColor={primaryColor} />
              </div>
            ) : (
              <div className="h-72 rounded-2xl flex items-center justify-center mb-6" style={{ background: `linear-gradient(135deg, ${primaryColor}30 0%, ${primaryColor}10 100%)` }}>
                <Bed className="h-24 w-24" style={{ color: primaryColor }} />
              </div>
            )}

            {/* Título + tipo */}
            <div className="mb-4">
              {st?.name && (
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-2 text-white" style={{ backgroundColor: primaryColor }}>
                  {st.name}
                </span>
              )}
              <h1 className="text-3xl font-bold text-gray-900">{space.label}</h1>
            </div>

            {/* Meta: zona, capacidad, área */}
            <div className="flex flex-wrap items-center gap-4 text-gray-600 mb-6">
              {space.floor_zone && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  <span>{space.floor_zone}</span>
                </div>
              )}
              {st?.capacity && (
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  <span>Hasta {st.capacity} personas</span>
                </div>
              )}
              {st?.area_sqm && (
                <div className="flex items-center gap-1.5">
                  <Maximize2 className="h-4 w-4" />
                  <span>{st.area_sqm} m²</span>
                </div>
              )}
            </div>

            {/* Descripción */}
            {space.description && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">Descripción</h3>
                <p className="text-gray-600 leading-relaxed">{space.description}</p>
              </div>
            )}

            {/* Precio */}
            {st?.base_rate && (
              <div className="mb-6 p-4 rounded-xl" style={{ backgroundColor: `${primaryColor}08` }}>
                <span className="text-sm text-gray-500">Precio desde</span>
                <p className="text-3xl font-bold" style={{ color: primaryColor }}>
                  ${Number(st.base_rate).toLocaleString()}
                  <span className="text-base font-normal text-gray-500"> / noche</span>
                </p>
              </div>
            )}

            {/* Servicios */}
            {space.services.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Servicios incluidos</h3>
                <div className="grid grid-cols-2 gap-2">
                  {space.services.map((svc: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: `${primaryColor}06` }}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: primaryColor }} />
                      <span className="text-sm text-gray-700">{svc.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Amenidades JSONB fallback */}
            {space.services.length === 0 && st?.amenities && Object.keys(st.amenities).length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Amenidades</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(st.amenities as Record<string, boolean>).map(([key, value]) => (
                    value && (
                      <span key={key} className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: `${primaryColor}10`, color: primaryColor }}>
                        {key}
                      </span>
                    )
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Columna derecha: Calendario + Formulario de reserva */}
          <div>
            {/* Calendario */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Disponibilidad y precios</h3>
              <AvailabilityCalendar
                organizationId={organization.id}
                spaceTypeId={st?.id || space.space_type_id}
                primaryColor={primaryColor}
              />
            </div>

            {/* Formulario de reserva */}
            <SpaceBookingForm
              organizationId={organization.id}
              spaceTypeId={st?.id || space.space_type_id}
              spaceTypeName={st?.short_name || st?.name || space.label}
              capacity={st?.capacity || 2}
              baseRate={Number(st?.base_rate || 0)}
              primaryColor={primaryColor}
              gateways={gateways}
            />
          </div>
        </div>
      </div>
    </OrganizationLayout>
  )
}
