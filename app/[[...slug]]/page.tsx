import { headers } from 'next/headers'
import { Metadata } from 'next'
import { 
  getOrganizationByHost, 
  getOrganizationProducts, 
  getOrganizationCategories,
  getOrganizationSpaceTypes,
  getOrganizationServices,
  getWebsitePageBySlug,
  getWebsiteHeaderNav,
  getWebsiteFooterNav,
  getMetaPixelId,
  getMenuProducts,
  getOrganizationTags,
  getProductModifiers,
  getProductVariantRelations,
  getMembershipPlans,
  getGymClasses,
  getClassReservationCounts
} from '@/lib/supabase/queries'
import { ProductGrid } from '@/components/site/ProductGrid'
import { MenuView } from '@/components/site/MenuView'
import { ContactSection } from '@/components/site/sections/ContactSection'
import { getBusinessTypeConfig } from '@/types/organization'
import { getTemplate, getTemplateByBusinessType } from '@/lib/templates'
import { OrganizationSite } from '@/components/site/OrganizationSite'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { SectionRenderer } from '@/components/sections/SectionRenderer'
import { getAuthCustomer } from '@/lib/get-auth-customer'

export const dynamic = 'force-dynamic'
export const revalidate = 60

async function getOrganizationFromHeaders() {
  const headersList = await headers()
  const subdomain = headersList.get('x-subdomain')
  const customDomain = headersList.get('x-custom-domain')
  const identifier = customDomain || subdomain
  if (!identifier) return null
  return getOrganizationByHost(identifier)
}

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const organization = await getOrganizationFromHeaders()
  
  if (!organization) {
    return {
      title: 'Sitio no encontrado',
      description: 'El sitio que buscas no existe'
    }
  }
  
  const { slug } = await params
  const currentSlug = slug?.[0] || 'home'
  const settings = organization.website_settings

  // Intentar obtener metadatos de la página del builder
  const page = await getWebsitePageBySlug(organization.id, currentSlug)
  
  const pageTitle = page?.meta_title || page?.title
  const title = pageTitle 
    ? `${pageTitle} | ${organization.name}` 
    : settings?.meta_title || organization.name

  const description = page?.meta_description 
    || settings?.meta_description 
    || organization.description 
    || `Bienvenido a ${organization.name}`
  
  const baseUrl = organization.custom_domain 
    ? `https://${organization.custom_domain}` 
    : `https://${organization.subdomain?.toLowerCase()}.goadmin.io`
  
  return {
    title,
    description,
    keywords: settings?.meta_keywords || undefined,
    authors: [{ name: organization.name }],
    creator: organization.name,
    publisher: organization.name,
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: currentSlug === 'home' ? baseUrl : `${baseUrl}/${currentSlug}`
    },
    openGraph: {
      type: 'website',
      locale: 'es_CO',
      url: currentSlug === 'home' ? baseUrl : `${baseUrl}/${currentSlug}`,
      siteName: organization.name,
      title,
      description,
      images: page?.og_image_url 
        ? [{ url: page.og_image_url, width: 1200, height: 630 }]
        : (settings as any)?.og_image_url 
          ? [{ url: (settings as any).og_image_url, width: 1200, height: 630 }] 
          : organization.logo_url 
            ? [{ url: organization.logo_url }] 
            : []
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    icons: {
      icon: (settings as any)?.favicon_url || organization.logo_url || '/favicon.ico',
      apple: (settings as any)?.favicon_url || organization.logo_url || '/apple-touch-icon.png'
    },
    robots: {
      index: settings?.is_published !== false,
      follow: settings?.is_published !== false,
    },
    verification: (settings as any)?.google_site_verification ? {
      google: (settings as any).google_site_verification
    } : undefined
  }
}

export default async function CatchAllPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const headersList = await headers()
  const subdomain = headersList.get('x-subdomain')
  const customDomain = headersList.get('x-custom-domain')
  
  const identifier = customDomain || subdomain
  
  if (!identifier) {
    return <NotFoundPage />
  }
  
  const organization = await getOrganizationByHost(identifier)
  
  if (!organization) {
    return <NotFoundPage subdomain={identifier} />
  }

  const { slug } = await params
  const currentSlug = slug?.[0] || 'home'
  const primaryColor = organization.website_settings?.primary_color || organization.primary_color || '#8B6914'
  const templateId = organization.website_settings?.template_id || 'modern'
  const template = getTemplate(templateId) || getTemplateByBusinessType(organization.type_id)

  // Fetch navegación dinámica + Meta Pixel
  const [headerNav, footerNav, metaPixelId] = await Promise.all([
    getWebsiteHeaderNav(organization.id),
    getWebsiteFooterNav(organization.id),
    getMetaPixelId(organization.id)
  ])

  // 1. Intentar cargar página del Page Builder
  const page = await getWebsitePageBySlug(organization.id, currentSlug)

  if (page && page.website_page_sections.length > 0) {
    // Pre-fetch de datos para secciones data-driven
    const sectionTypes = page.website_page_sections.map(s => s.section_type)
    const data: Record<string, any> = {}

    if (sectionTypes.includes('room_types')) {
      data.spaceTypes = await getOrganizationSpaceTypes(organization.id)
    }
    if (sectionTypes.includes('products_grid') || sectionTypes.includes('featured_products')) {
      data.products = await getOrganizationProducts(organization.id, 20)
    }
    if (sectionTypes.includes('categories_grid')) {
      data.categories = await getOrganizationCategories(organization.id)
    }

    return (
      <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav} metaPixelId={metaPixelId}>
        {page.website_page_sections.map((section) => (
          <SectionRenderer
            key={section.id}
            section={section}
            organization={organization}
            primaryColor={primaryColor}
            data={data}
          />
        ))}
      </OrganizationLayout>
    )
  }

  // 2. Fallback: si es la home y no hay builder, usar el sistema antiguo
  if (currentSlug === 'home') {
    const businessType = getBusinessTypeConfig(organization.type_id)
    const isGym = businessType.type === 'gym'
    const [products, categories, spaceTypes, membershipPlans, gymClasses] = await Promise.all([
      getOrganizationProducts(organization.id, 20),
      getOrganizationCategories(organization.id),
      getOrganizationSpaceTypes(organization.id),
      isGym ? getMembershipPlans(organization.id) : Promise.resolve([]),
      isGym ? getGymClasses(organization.id) : Promise.resolve([])
    ])

    // Obtener conteos de reservas para calcular cupos disponibles
    const classIds = gymClasses.map((c: any) => c.id)
    const reservationCounts = isGym && classIds.length > 0
      ? await getClassReservationCounts(organization.id, classIds)
      : {}
    
    return (
      <OrganizationSite 
        organization={organization}
        businessType={businessType}
        products={products}
        categories={categories}
        spaceTypes={spaceTypes}
        membershipPlans={membershipPlans}
        gymClasses={gymClasses}
        reservationCounts={reservationCounts}
      />
    )
  }

  // 3. Fallbacks para slugs conocidos sin página en el builder
  const fallback = await renderSlugFallback(currentSlug, organization, primaryColor, template, headerNav, footerNav, metaPixelId)
  if (fallback) return fallback

  // 4. Página no encontrada
  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav} metaPixelId={metaPixelId}>
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">404</h1>
          <p className="text-gray-600 mb-6">Página no encontrada</p>
          <a href="/" className="text-white px-6 py-2 rounded-lg" style={{ backgroundColor: primaryColor }}>
            Volver al Inicio
          </a>
        </div>
      </div>
    </OrganizationLayout>
  )
}

/**
 * Fallbacks para slugs conocidos cuando no existe página en el Page Builder.
 * Renderiza contenido dinámico con datos reales de la organización.
 */
async function renderSlugFallback(
  slug: string,
  organization: any,
  primaryColor: string,
  template: any,
  headerNav: any[],
  footerNav: any[],
  metaPixelId?: string | null
): Promise<React.ReactElement | null> {
  const Layout = ({ children }: { children: React.ReactNode }) => (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav} metaPixelId={metaPixelId}>
      {children}
    </OrganizationLayout>
  )

  const businessType = getBusinessTypeConfig(organization.type_id)

  switch (slug) {
    case 'menu': {
      const [menuProducts, menuCategories, menuTags, menuModifiers, menuVariantRelations] = await Promise.all([
        getMenuProducts(organization.id, 200),
        getOrganizationCategories(organization.id),
        getOrganizationTags(organization.id),
        getProductModifiers(organization.id),
        getProductVariantRelations(organization.id)
      ])

      // Favoritos: obtener customer autenticado (si existe)
      let customerId: string | null = null
      let initialFavorites: number[] = []
      try {
        const customer = await getAuthCustomer(organization.id)
        if (customer) {
          customerId = customer.id
          initialFavorites = (customer as any).metadata?.favorites || []
        }
      } catch { /* no auth */ }

      return (
        <Layout>
          <MenuView
            products={menuProducts}
            categories={menuCategories}
            tags={menuTags}
            modifierTypes={menuModifiers}
            variantRelations={menuVariantRelations}
            primaryColor={primaryColor}
            organizationSubdomain={organization.subdomain || ''}
            organizationName={organization.name}
            customerId={customerId}
            organizationId={organization.id}
            initialFavorites={initialFavorites}
          />
        </Layout>
      )
    }

    case 'productos': {
      const sectionTitle = {
        restaurant: 'Nuestro Menú', retail: 'Nuestros Productos', hotel: 'Habitaciones',
        gym: 'Membresías', transport: 'Rutas Disponibles', parking: 'Tarifas', saas: 'Planes'
      }[businessType.type] || 'Productos'

      const [products, categories] = await Promise.all([
        getOrganizationProducts(organization.id, 50),
        getOrganizationCategories(organization.id)
      ])

      return (
        <Layout>
          <div className="container mx-auto px-4 py-12">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">{sectionTitle}</h1>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Explora nuestra selección completa
              </p>
            </div>
            <ProductGrid
              products={products}
              categories={categories}
              primaryColor={primaryColor}
              organizationSubdomain={organization.subdomain || ''}
              organizationId={organization.id}
            />
          </div>
        </Layout>
      )
    }

    case 'espacios': {
      const pageConfig = {
        restaurant: { title: 'Nuestras Mesas', subtitle: 'Reserva tu mesa' },
        hotel: { title: 'Habitaciones', subtitle: 'Encuentra tu espacio ideal' },
        gym: { title: 'Espacios', subtitle: 'Reserva tu clase o espacio' },
        parking: { title: 'Espacios de Parqueo', subtitle: 'Reserva tu espacio' },
      }[businessType.type as string] || { title: 'Espacios', subtitle: 'Espacios disponibles' }

      const spaceTypes = await getOrganizationSpaceTypes(organization.id)

      return (
        <Layout>
          <div className="container mx-auto px-4 py-12">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">{pageConfig.title}</h1>
              <p className="text-gray-600 max-w-2xl mx-auto">{pageConfig.subtitle}</p>
            </div>
            {spaceTypes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {spaceTypes.map((st: any) => (
                  <a key={st.id} href={`/espacios/${st.id}`} className="bg-white rounded-xl border overflow-hidden hover:shadow-lg transition-all">
                    <div className="h-48 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primaryColor}20 0%, ${primaryColor}10 100%)` }}>
                      <span className="text-5xl">🏠</span>
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{st.name}</h3>
                      <p className="text-gray-600 text-sm mb-4">Capacidad: {st.capacity} personas</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm text-gray-500">Desde</span>
                          <p className="text-2xl font-bold" style={{ color: primaryColor }}>${Number(st.base_rate).toLocaleString()}</p>
                        </div>
                        <span className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: primaryColor }}>Reservar</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <p className="text-gray-500 text-lg">No hay espacios disponibles en este momento.</p>
              </div>
            )}
          </div>
        </Layout>
      )
    }

    case 'servicios': {
      const sectionTitle = {
        restaurant: 'Nuestros Servicios', hotel: 'Servicios del Hotel',
        gym: 'Clases y Servicios', parking: 'Servicios Adicionales',
      }[businessType.type as string] || 'Servicios'

      const services = await getOrganizationServices(organization.id, 50)

      return (
        <Layout>
          <div className="container mx-auto px-4 py-12">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">{sectionTitle}</h1>
              <p className="text-gray-600 max-w-2xl mx-auto">Descubre todos los servicios que tenemos para ti</p>
            </div>
            {services.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {services.map((service: any) => {
                  const price = service.product_prices?.[0]
                  return (
                    <div key={service.id} className="bg-white rounded-xl border overflow-hidden hover:shadow-lg transition-all">
                      <div className="h-32 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primaryColor}20 0%, ${primaryColor}10 100%)` }}>
                        <span className="text-5xl">🛠️</span>
                      </div>
                      <div className="p-6">
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">{service.name}</h3>
                        {service.description && <p className="text-gray-500 mb-4 line-clamp-3">{service.description}</p>}
                        {price && (
                          <p className="text-lg font-bold" style={{ color: primaryColor }}>${Number(price.price).toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-20">
                <span className="text-4xl block mb-4">🛠️</span>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Próximamente</h3>
                <p className="text-gray-500">Estamos preparando nuestro catálogo de servicios.</p>
              </div>
            )}
          </div>
        </Layout>
      )
    }

    case 'contacto': {
      const settings = organization.website_settings
      return (
        <Layout>
          <section className="relative py-16 md:py-24" style={{ background: `linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}05 100%)` }}>
            <div className="container mx-auto px-4">
              <div className="max-w-3xl">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">Contáctanos</h1>
                <p className="text-xl text-gray-600">Estamos aquí para ayudarte. No dudes en comunicarte con nosotros.</p>
              </div>
            </div>
          </section>
          <ContactSection organization={organization} settings={settings} primaryColor={primaryColor} />
        </Layout>
      )
    }

    case 'nosotros': {
      return (
        <Layout>
          <section className="relative py-20 md:py-32" style={{ background: `linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}05 100%)` }}>
            <div className="container mx-auto px-4">
              <div className="max-w-3xl">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">Sobre Nosotros</h1>
                <p className="text-xl text-gray-600">
                  {organization.description || `Conoce más sobre ${organization.name} y nuestra historia.`}
                </p>
              </div>
            </div>
          </section>
          <section className="py-16 md:py-24">
            <div className="container mx-auto px-4">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">Nuestra Historia</h2>
                  <div className="space-y-4 text-gray-600">
                    <p>En <strong>{organization.name}</strong>, nos dedicamos a ofrecer lo mejor a nuestros clientes.</p>
                    <p>Nuestro compromiso con la calidad y la satisfacción del cliente nos ha permitido crecer y consolidarnos.</p>
                  </div>
                </div>
                <div className="aspect-video rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primaryColor}20 0%, ${primaryColor}10 100%)` }}>
                  <div className="text-center">
                    <span className="text-6xl">🏢</span>
                    <p className="text-gray-500 mt-4">Imagen de la empresa</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
          {(organization.address || organization.phone || organization.email) && (
            <section className="py-16 md:py-24 bg-gray-50">
              <div className="container mx-auto px-4 text-center">
                <h2 className="text-3xl font-bold text-gray-900 mb-8">Encuéntranos</h2>
                <div className="max-w-2xl mx-auto bg-white rounded-2xl p-8 space-y-4">
                  {organization.address && (
                    <div className="flex items-start text-left">
                      <span className="text-2xl mr-4">📍</span>
                      <div>
                        <p className="font-medium text-gray-900">Dirección</p>
                        <p className="text-gray-600">{organization.address}{organization.city && `, ${organization.city}`}</p>
                      </div>
                    </div>
                  )}
                  {organization.phone && (
                    <div className="flex items-start text-left">
                      <span className="text-2xl mr-4">📞</span>
                      <div>
                        <p className="font-medium text-gray-900">Teléfono</p>
                        <a href={`tel:${organization.phone}`} style={{ color: primaryColor }}>{organization.phone}</a>
                      </div>
                    </div>
                  )}
                  {organization.email && (
                    <div className="flex items-start text-left">
                      <span className="text-2xl mr-4">✉️</span>
                      <div>
                        <p className="font-medium text-gray-900">Email</p>
                        <a href={`mailto:${organization.email}`} style={{ color: primaryColor }}>{organization.email}</a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </Layout>
      )
    }

    default:
      return null
  }
}
