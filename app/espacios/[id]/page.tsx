import { getOrgContext } from '@/lib/get-org-context'
import { createPublicClient } from '@/lib/supabase/server'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { ProductImageGallery } from '@/components/site/ProductImageGallery'
import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Users, Bed } from 'lucide-react'
import { SpaceBookingForm } from './SpaceBookingForm'
import { AvailabilityCalendar } from '@/components/site/AvailabilityCalendar'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

async function getSpaceType(spaceTypeId: string, organizationId: number): Promise<any | null> {
  const supabase = createPublicClient()
  const { data, error } = await (supabase as any)
    .from('space_types')
    .select('*')
    .eq('id', spaceTypeId)
    .eq('organization_id', organizationId)
    .single()
  if (error || !data) return null
  return data
}

async function getSpaceImages(spaceTypeId: string): Promise<string[]> {
  const supabase = createPublicClient()
  // Obtener spaces del tipo → luego sus imágenes
  const { data: spaces } = await (supabase as any)
    .from('spaces')
    .select('id')
    .eq('space_type_id', spaceTypeId)

  if (!spaces || spaces.length === 0) return []

  const spaceIds = spaces.map((s: any) => s.id)
  const { data: images } = await (supabase as any)
    .from('space_images')
    .select('image_url, storage_path, is_primary, display_order')
    .in('space_id', spaceIds)
    .order('is_primary', { ascending: false })
    .order('display_order', { ascending: true })

  if (!images || images.length === 0) return []

  // Deduplicar por storage_path y construir URLs
  const seen = new Set<string>()
  const urls: string[] = []
  for (const img of images) {
    const url = img.image_url || (img.storage_path ? `${SUPABASE_URL}/storage/v1/object/public/space-images/${img.storage_path}` : null)
    if (url && !seen.has(url)) {
      seen.add(url)
      urls.push(url)
    }
  }
  return urls
}

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

async function getSpaceServices(spaceTypeId: string, organizationId: number): Promise<{ name: string; icon: string | null; category: string | null }[]> {
  const supabase = createPublicClient()
  const { data: spaces } = await (supabase as any)
    .from('spaces')
    .select('id')
    .eq('space_type_id', spaceTypeId)

  if (!spaces || spaces.length === 0) return []

  const spaceIds = spaces.map((s: any) => s.id)
  const { data: services } = await (supabase as any)
    .from('space_services')
    .select('organization_service_id, organization_services(custom_name, custom_icon, custom_category)')
    .in('space_id', spaceIds)

  if (!services || services.length === 0) return []

  // Deduplicar por organization_service_id
  const seen = new Set<string>()
  const result: { name: string; icon: string | null; category: string | null }[] = []
  for (const svc of services) {
    if (seen.has(svc.organization_service_id)) continue
    seen.add(svc.organization_service_id)
    const os = svc.organization_services
    if (os) {
      result.push({
        name: os.custom_name || 'Servicio',
        icon: os.custom_icon || null,
        category: os.custom_category || null,
      })
    }
  }
  return result
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Espacio' }
  const { id } = await params
  const spaceType = await getSpaceType(id, ctx.organization.id)
  return {
    title: spaceType ? `${spaceType.name} | ${ctx.organization.name}` : `Espacio | ${ctx.organization.name}`,
  }
}

export default async function EspacioDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { id } = await params
  const { organization, primaryColor, template, headerNav, footerNav } = ctx

  const spaceType = await getSpaceType(id, organization.id)
  const [spaceImages, spaceServices, gateways] = spaceType
    ? await Promise.all([getSpaceImages(id), getSpaceServices(id, organization.id), getAvailableGateways(organization.id)])
    : [[], [], []]

  if (!spaceType) {
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

  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav}>
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <Link href="/espacios" className="inline-flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a espacios
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Info del espacio (SSR) */}
          <div>
            {spaceImages.length > 0 ? (
              <div className="mb-6">
                <ProductImageGallery images={spaceImages} productName={spaceType.name} primaryColor={primaryColor} />
              </div>
            ) : (
              <div className="h-64 rounded-xl flex items-center justify-center mb-6" style={{ background: `linear-gradient(135deg, ${primaryColor}30 0%, ${primaryColor}10 100%)` }}>
                <Bed className="h-24 w-24" style={{ color: primaryColor }} />
              </div>
            )}
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{spaceType.name}</h1>
            <div className="flex items-center gap-4 text-gray-600 mb-6">
              <div className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                <span>Hasta {spaceType.capacity} personas</span>
              </div>
              {spaceType.area_sqm && <span>{spaceType.area_sqm} m²</span>}
            </div>
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Precio desde</h3>
              <p className="text-3xl font-bold" style={{ color: primaryColor }}>
                ${Number(spaceType.base_rate).toLocaleString()}
                <span className="text-base font-normal text-gray-500"> / noche</span>
              </p>
            </div>
            {/* Servicios reales desde space_services → organization_services */}
            {spaceServices.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Servicios incluidos</h3>
                <div className="flex flex-wrap gap-2">
                  {spaceServices.map((svc, i) => (
                    <span key={i} className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: `${primaryColor}10`, color: primaryColor }}>
                      {svc.icon && <span className="mr-1">{svc.icon}</span>}
                      {svc.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {/* Amenidades del JSONB como fallback */}
            {spaceServices.length === 0 && spaceType.amenities && Object.keys(spaceType.amenities).length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Amenidades</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(spaceType.amenities as Record<string, boolean>).map(([key, value]) => (
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

          {/* Calendario de disponibilidad (client) */}
          <div className="lg:col-span-2 mb-4">
            <h3 className="font-semibold text-gray-900 mb-3">Disponibilidad y precios</h3>
            <AvailabilityCalendar
              organizationId={organization.id}
              spaceTypeId={spaceType.id}
              primaryColor={primaryColor}
            />
          </div>

          {/* Formulario de reserva (client) */}
          <SpaceBookingForm
            organizationId={organization.id}
            spaceTypeId={spaceType.id}
            spaceTypeName={spaceType.short_name || spaceType.name}
            capacity={spaceType.capacity}
            baseRate={Number(spaceType.base_rate)}
            primaryColor={primaryColor}
            gateways={gateways}
          />
        </div>
      </div>
    </OrganizationLayout>
  )
}
