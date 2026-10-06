import { Metadata } from 'next'
import { 
  getOrganizationProducts, 
  getOrganizationCategories,
  getOrganizationSpaceTypes,
  getOrganizationSpaces,
  getOrganizationServices,
  getWebsitePageBySlug,
  getMetaPixelId,
  getGoogleAdsConfig,
  getMenuProducts,
  getOrganizationTags,
  getProductModifiers,
  getProductVariantRelations,
  getProductModifierGroupsByOrg,
  getParkingRates,
  getParkingPassTypes,
  getParkingAvailability,
  getParkingZones,
  getOrgServiceCatalog,
  getOfferProducts,
  getDefaultTax,
  getOrganizationTestimonials,
  getProductsByCategoryIds,
  getProductsByIdsCatalog,
  getWebsitePagesByIds,
  getMenuCatalogProducts
} from '@/lib/supabase/queries'
import { horaSimuladaDeVistaPrevia } from '@/lib/menu/menuFull'
import { getOrgContext, type MegaMenuItem, type FrozenReason } from '@/lib/get-org-context'
import { getPixelesSitio } from '@/lib/seo/pixelesSitio'
import { getCartasPublicas } from '@/lib/menu/cartasPublicas.server'
import { getPaginaPublica } from '@/lib/website/v2/lectorPublico'
import { getSedesRestaurante } from '@/lib/restaurant/sedes'
import { getClasesDeSeccion, getFlotaDeSeccion, getPlanesDeSeccion, getRutasDeSeccion } from '@/lib/website/datosSecciones'
import { ProductGrid } from '@/components/site/ProductGrid'
import { MenuView } from '@/components/site/MenuView'
import { pedidoEnLineaApagado } from '@/lib/orders/disponibilidadPedido'
import { ContactSection } from '@/components/site/sections/ContactSection'
import { getBusinessTypeConfig } from '@/types/organization'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { PreviewableSections } from '@/components/sections/PreviewableSections'
import { JsonLd, buildOrganizationJsonLd, buildWebsiteJsonLd, buildBreadcrumbJsonLd } from '@/components/site/JsonLd'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { conPrefijo } from '@/lib/outlet/rutaSitio'
import { jsonLdSedes, metadataSede, urlPublicaSede } from '@/lib/seo/sede'

export const dynamic = 'force-dynamic'
export const revalidate = 60

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const { slug } = await params
  const ctx = await getOrgContext(slug?.[0])

  if (!ctx) {
    return {
      title: 'Sitio no encontrado',
      description: 'El sitio que buscas no existe'
    }
  }

  const { organization, branchId, outlet, effectiveSettings: settings, pathPrefixConsumed } = ctx
  const pathSegments = slug || []
  const effectivePath = pathPrefixConsumed ? pathSegments.slice(1) : pathSegments
  const currentSlug = effectivePath[0] || 'home'
  // «Ocultar de los buscadores» (SEO y redes del ERP). Sin la columna: false, como hoy.
  const { noindex } = await getPixelesSitio(organization.id)

  // Intentar obtener metadatos de la página del builder (V2 si el sitio lo adoptó)
  const page = await getPaginaPublica(organization.id, currentSlug, branchId,
    () => getWebsitePageBySlug(organization.id, currentSlug, branchId))

  const pageTitle = page?.meta_title || page?.title
  const title = pageTitle
    ? `${pageTitle} | ${organization.name}`
    : settings?.meta_title || organization.name

  const description = page?.meta_description
    || settings?.meta_description
    || organization.description
    || `Bienvenido a ${organization.name}`

  // SEO local por sede (lib/seo/sede.ts): canonical, Open Graph y base de la sede que se sirve
  // (`ctx.urlBase`). Sin sede, `urlBase` es la del principal y todo queda como antes.
  const seoSede = metadataSede({
    urlBase: ctx.urlBase,
    slugPagina: currentSlug,
    marca: organization.name,
    sede: outlet ? { branchName: outlet.branchName } : null,
    tituloPagina: pageTitle ?? null,
  })
  // En una sede, «Página · Sede | Marca»; en el sitio principal, el título de siempre.
  const tituloFinal: string = outlet && typeof seoSede.title === 'string' ? seoSede.title : title

  return {
    title: tituloFinal,
    description,
    keywords: settings?.meta_keywords || undefined,
    authors: [{ name: organization.name }],
    creator: organization.name,
    publisher: organization.name,
    metadataBase: seoSede.metadataBase,
    alternates: seoSede.alternates,
    openGraph: {
      type: 'website',
      locale: 'es_CO',
      url: seoSede.openGraph.url,
      siteName: organization.name,
      title: tituloFinal,
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
      title: tituloFinal,
      description,
    },
    icons: {
      icon: (settings as any)?.favicon_url || organization.logo_url ? '/api/favicon' : '/favicon.ico',
      apple: (settings as any)?.favicon_url || organization.logo_url ? '/api/favicon' : '/apple-touch-icon.png'
    },
    robots: {
      index: settings?.is_published !== false && !noindex,
      follow: settings?.is_published !== false && !noindex,
    },
    verification: (settings as any)?.google_site_verification ? {
      google: (settings as any).google_site_verification
    } : undefined
  }
}

export default async function CatchAllPage({ params, searchParams }: { params: Promise<{ slug?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params
  const ctx = await getOrgContext(slug?.[0])

  if (!ctx) {
    return <NotFoundPage />
  }

  const { organization, outlet, branchId, pathPrefixConsumed, effectiveSettings: settings, primaryColor, template, headerNav, headerNavTree, footerNav, footerNavTree, menuCategories, megaMenuItems, websiteMenus: footerMenus, frozenReason, showCurrencyCode, currencyPosition } = ctx

  const pathSegments = slug || []
  const effectivePath = pathPrefixConsumed ? pathSegments.slice(1) : pathSegments
  const currentSlug = effectivePath[0] || 'home'

  // Base pública del principal (Organization) y del sitio que se sirve (con la sede).
  const baseUrl = ctx.urlBasePrincipal
  const baseSitio = ctx.urlBase
  const prefijo = ctx.prefijoSede ?? ''

  // Meta Pixel + Google Ads + tax (no incluidos en getOrgContext)
  const [metaPixelId, googleAdsConfig, taxSettings] = await Promise.all([
    getMetaPixelId(organization.id),
    getGoogleAdsConfig(organization.id),
    getDefaultTax(organization.id)
  ])

  // 1. Intentar cargar página del Page Builder (con branchId F1). Sitio V2: de la revisión
  //    publicada; legacy: exactamente la misma consulta de antes.
  const page = await getPaginaPublica(organization.id, currentSlug, branchId,
    () => getWebsitePageBySlug(organization.id, currentSlug, branchId))

  // QR de mesa (?mesa= / ?table=) sobre una página /menu del constructor sin carta pedible: se
  // cae a la carta clásica (MenuView), que sí deja pedir. Con carta en la página, sin cambios.
  const sp = await searchParams
  const traeMesa = typeof sp?.mesa === 'string' || typeof sp?.table === 'string'
  const paginaSinCarta = !!page && !page.website_page_sections.some(
    (s) => s.section_type === 'menu_full' || s.section_type === 'menu_preview'
  )
  if (currentSlug === 'menu' && traeMesa && paginaSinCarta) {
    const fallbackMesa = await renderSlugFallback(currentSlug, organization, primaryColor, template, headerNav, headerNavTree, menuCategories, megaMenuItems, footerMenus, footerNav, footerNavTree, metaPixelId, googleAdsConfig, sp, taxSettings, frozenReason, branchId, settings, outlet, showCurrencyCode, currencyPosition)
    if (fallbackMesa) return fallbackMesa
  }

  if (page && page.website_page_sections.length > 0) {
    // Pre-fetch de datos para secciones data-driven
    const sectionTypes = page.website_page_sections.map(s => s.section_type)
    const data: Record<string, any> = {}
    // F5: exponer branchId a las secciones para separar carrito por outlet
    data.branchId = branchId
    // Prefijo de la sede servida por ruta (`''` sin sede): enlaces de las secciones de servidor.
    data.prefijoSede = prefijo

    // Vista previa del editor (?preview=1): se lee UNA vez. En ella se precargan
    // también los datos de secciones que aún no están en la página guardada
    // (una sección recién añadida no llegaría a `sectionTypes`).
    const esVistaPrevia = (await searchParams)?.preview === '1'

    // Sedes (hours_location / reservation / estado del restaurant_hero): una
    // consulta cacheada por organización.
    // La carta también la usa: horario de la sede («Cerrado ahora»), su nombre y si acepta reservas.
    // reservation_cta (límites de personas de la sede) y private_events (selector de sede del
    // lead) leen lo mismo: sin la precarga caían a los límites de la base y sin selector.
    if (esVistaPrevia || sectionTypes.some((t) => t === 'hours_location' || t === 'reservation' || t === 'reservation_cta' || t === 'private_events' || t === 'restaurant_hero' || t === 'menu_full' || t === 'menu_preview')) {
      data.sedesRestaurante = await getSedesRestaurante(organization.id)
    }

    if (sectionTypes.includes('room_types')) {
      data.spaceTypes = await getOrganizationSpaceTypes(organization.id)
      data.spaces = await getOrganizationSpaces(organization.id, branchId)
    }
    // `signature_dishes` elige platos de la misma lista que la carta. En la
    // vista previa también se precargan (ver `esVistaPrevia`).
    // La carta (`menu_full`, y `menu_preview` en /menu) no usa `data.products`: lee
    // `data.menuProducts` (abajo). Cargar también los 500 duplicaba el catálogo en /menu.
    // `menu_preview` fuera de /menu es un avance y sí sigue con `data.products`.
    const needsProducts = esVistaPrevia || sectionTypes.some(t =>
      ['products_grid', 'featured_products', 'specialties', 'signature_dishes'].includes(t) ||
      (t === 'menu_preview' && currentSlug !== 'menu')
    )
    const needsCategories = needsProducts || sectionTypes.some((t) => t === 'menu_full' || t === 'menu_preview')
    if (needsProducts) {
      data.products = await getOrganizationProducts(organization.id, 500, branchId)
    }
    // Carta completa: sin el corte de 500 del listado general (cartas de cientos de platos).
    // Solo en páginas con carta; las demás secciones siguen con `data.products`. Si alguna
    // sección de carta no limita categorías, se carga todo; si todas limitan, solo su unión.
    // `menu_preview` solo es la carta en la página /menu; en la home es un avance y sigue con
    // `data.products` (no se carga el catálogo completo en la portada: incidente 2026-09-14).
    data.pageSlug = currentSlug
    const seccionesCarta = page.website_page_sections.filter(
      (s) => s.section_type === 'menu_full' || (s.section_type === 'menu_preview' && currentSlug === 'menu')
    )
    if (seccionesCarta.length > 0) {
      const union = new Set<number>()
      let todas = false
      for (const s of seccionesCarta) {
        const ids = (s.content as { selected_category_ids?: unknown } | null)?.selected_category_ids
        const lista = Array.isArray(ids) ? ids.map(Number).filter((n) => Number.isInteger(n) && n > 0) : []
        if (lista.length === 0) todas = true
        else lista.forEach((n) => union.add(n))
      }
      // Cartas por horario del ERP (get_public_menu, cacheada). Sin la RPC o sin cartas: null y
      // la sección sigue con su contenido (vía actual). Con cartas, ellas eligen las categorías:
      // se carga el catálogo completo, como cuando la sección no limita categorías.
      const cartasPublicas = await getCartasPublicas(organization.id, branchId ?? null)
      if (cartasPublicas) {
        data.cartasPublicas = cartasPublicas
        todas = true
      } else {
        // Sin cartas del ERP: igual que antes.
      }
      const [menuProducts, etiquetas] = await Promise.all([
        getMenuCatalogProducts(organization.id, branchId, todas ? null : Array.from(union).sort((a, b) => a - b)),
        getOrganizationTags(organization.id),
      ])
      data.menuProducts = menuProducts
      data.productTags = etiquetas
      // «Reservar mesa» de la hoja del plato: la sección `reservation` de esta página o la de
      // la página de reservas de las plantillas (`reservas-mesa`). Sin ninguna, no se ofrece.
      const ancla = (sec: { section_type: string; content: unknown }) => {
        const a = (sec.content as { anchor_id?: unknown } | null)?.anchor_id
        return typeof a === 'string' && /^[a-z0-9][a-z0-9_-]*$/i.test(a) ? a : 'reservar'
      }
      const reservaAqui = page.website_page_sections.find((s) => s.section_type === 'reservation')
      if (reservaAqui) {
        data.reservarUrl = `#${ancla(reservaAqui)}`
      } else {
        const paginaReservas = currentSlug === 'reservas-mesa' ? null : await getPaginaPublica(organization.id, 'reservas-mesa', branchId,
          () => getWebsitePageBySlug(organization.id, 'reservas-mesa', branchId))
        const seccion = paginaReservas?.website_page_sections.find((s) => s.section_type === 'reservation')
        if (seccion) data.reservarUrl = conPrefijo(`/reservas-mesa#${ancla(seccion)}`, prefijo)
      }
    }
    // Avance de la carta fuera de /menu (`menu_preview` en la home): respeta la carta del ERP
    // (platos ocultos, orden). Misma lectura cacheada por organización y sede (60 s), una por
    // página: nunca por plato. Sin la RPC, `null` y el avance sigue como siempre.
    if (seccionesCarta.length === 0 && sectionTypes.includes('menu_preview')) {
      const cartasAvance = await getCartasPublicas(organization.id, branchId ?? null)
      if (cartasAvance) data.cartasPublicas = cartasAvance
    }
    // «Ver como» del editor: hora simulada solo en la vista previa (?preview=1&hora=HH:MM).
    const horaSimulada = esVistaPrevia ? horaSimuladaDeVistaPrevia((await searchParams)?.hora) : null
    if (horaSimulada !== null) data.horaSimulada = horaSimulada
    // Platos estrella que no vinieron entre los 500 precargados (cartas
    // grandes): se piden por id, con la caché del catálogo. Van aparte para no
    // alterar lo que muestran las demás secciones de productos.
    if (sectionTypes.includes('signature_dishes')) {
      const loaded = new Set(((data.products || []) as { id: number }[]).map((p) => p.id))
      const wanted = new Set<number>()
      for (const s of page.website_page_sections) {
        if (s.section_type !== 'signature_dishes') continue
        const dishes = (s.content as { dishes?: unknown } | null)?.dishes
        if (!Array.isArray(dishes)) continue
        for (const d of dishes) {
          const id = Number((d as { product_id?: unknown } | null)?.product_id)
          if (Number.isInteger(id) && id > 0 && !loaded.has(id)) wanted.add(id)
        }
      }
      if (wanted.size > 0) {
        data.signatureProducts = await getProductsByIdsCatalog(
          Array.from(wanted).sort((a, b) => a - b).slice(0, 24),
          organization.id,
          branchId,
        )
      }
    }
    if (sectionTypes.includes('categories_grid') || sectionTypes.includes('categories') || needsCategories) {
      data.categories = await getOrganizationCategories(organization.id, branchId)
    }
    if (sectionTypes.includes('offers')) {
      data.offerProducts = await getOfferProducts(organization.id, 500, branchId)
    }
    // F7: Banners promocionales conectados al catálogo.
    // Resuelve enlaces tipados (categoría/producto/página) y pre-carga el
    // preview de productos cuando show_category_products=true.
    if (sectionTypes.includes('promo_banners')) {
      // Asegurar categorías y productos para resolver href de categoría/producto.
      if (!data.categories) {
        data.categories = await getOrganizationCategories(organization.id, branchId)
      }
      if (!data.products) {
        data.products = await getOrganizationProducts(organization.id, 500, branchId)
      }

      const bannerSections = page.website_page_sections.filter(
        (s) => s.section_type === 'promo_banners'
      )
      const previewCategoryIds = new Set<number>()
      const pageIds = new Set<string>()
      bannerSections.forEach((s) => {
        const banners = ((s.content as any)?.banners || []) as any[]
        banners.forEach((b) => {
          if (b.link_type === 'category' && b.show_category_products && b.link_category_id) {
            previewCategoryIds.add(b.link_category_id)
          }
          if (b.link_type === 'page' && b.link_page_id) {
            pageIds.add(b.link_page_id)
          }
        })
      })

      if (previewCategoryIds.size > 0) {
        data.bannerCategoryProducts = await getProductsByCategoryIds(
          organization.id,
          Array.from(previewCategoryIds),
          12,
          branchId,
        )
      }
      if (pageIds.size > 0) {
        data.bannerPages = await getWebsitePagesByIds(
          organization.id,
          Array.from(pageIds),
        )
      }
    }
    // FASE 6: pre-fetch de testimonios desde la BD cuando alguna sección
    // testimonials usa data_source 'database' o 'featured' (o no tiene items manuales).
    if (sectionTypes.includes('testimonials')) {
      const testimonialSections = page.website_page_sections.filter(
        (s) => s.section_type === 'testimonials'
      )
      const needsDb = testimonialSections.some((s) => {
        const c = (s.content || {}) as Record<string, any>
        const ds = c.data_source
        // 'database' o 'featured' requieren BD; sin items manuales también cae a BD.
        if (ds === 'database' || ds === 'featured') return true
        if (ds === 'manual') return false
        // ds indefinido: si no hay items manuales, usar BD.
        return !Array.isArray(c.items) || (c.items as any[]).length === 0
      })
      if (needsDb) {
        data.testimonials = await getOrganizationTestimonials(organization.id, { limit: 200 })
      }
    }
    // Gym y transporte: secciones que antes salían siempre vacías porque nadie
    // cargaba su `data`. Una consulta cacheada cada una (lib/website/datosSecciones.ts)
    // y solo si la página tiene la sección (o en la vista previa del editor).
    const sedeDeLaPagina = typeof branchId === 'number' ? branchId : null
    const tiene = (tipo: string) => esVistaPrevia || sectionTypes.includes(tipo)
    const [clases, rutas, flota, planes] = await Promise.all([
      tiene('class_schedule') ? getClasesDeSeccion(organization.id, sedeDeLaPagina) : null,
      tiene('routes') ? getRutasDeSeccion(organization.id) : null,
      tiene('fleet_showcase') ? getFlotaDeSeccion(organization.id, sedeDeLaPagina) : null,
      tiene('membership_plans') ? getPlanesDeSeccion(organization.id) : null,
    ])
    if (clases) data.classes = clases
    if (rutas) data.routes = rutas
    if (flota) data.vehicles = flota
    if (planes) data.membershipPlans = planes

    if (sectionTypes.includes('parking_pricing') || sectionTypes.includes('parking_pass_plans') || sectionTypes.includes('parking_availability') || sectionTypes.includes('parking_zones')) {
      const [rates, passTypes, availability, zones] = await Promise.all([
        sectionTypes.includes('parking_pricing') ? getParkingRates(organization.id) : Promise.resolve([]),
        sectionTypes.includes('parking_pass_plans') ? getParkingPassTypes(organization.id) : Promise.resolve([]),
        sectionTypes.includes('parking_availability') ? getParkingAvailability(organization.id) : Promise.resolve([]),
        sectionTypes.includes('parking_zones') ? getParkingZones(organization.id) : Promise.resolve([]),
      ])
      data.rates = rates
      data.passTypes = passTypes
      data.zones = availability.length > 0 ? availability : zones
    }

    // Restaurant/LocalBusiness por sede (lib/seo/sede.ts): en la portada de una sede, la suya; en
    // el sitio principal, una por sede cuando la página pinta «Horario y sedes». Sin datos de
    // sedes (la página no los cargó), nada: las demás páginas no cambian.
    const datosSedes = data.sedesRestaurante as import('@/lib/restaurant/sedes-modelo').SedesRestaurante | null | undefined
    let jsonLdDeSedes: Record<string, unknown>[] = []
    if (datosSedes && datosSedes.sedes.length > 0) {
      const sedesLd = outlet
        ? (currentSlug === 'home' ? datosSedes.sedes.filter((s) => s.id === outlet.branchId) : [])
        : (sectionTypes.includes('hours_location') ? datosSedes.sedes : [])
      if (sedesLd.length > 0) {
        jsonLdDeSedes = jsonLdSedes({
          sedes: sedesLd,
          datos: datosSedes,
          urlDe: (sede) => (outlet && sede.id === outlet.branchId
            ? baseSitio
            : (sede.publicada ? urlPublicaSede(organization, { slug: sede.slug }) : null) ?? baseUrl),
          marca: organization.name,
          esRestaurante: organization.type_id === 1,
          logo: organization.logo_url ?? null,
        })
      }
    }

    return (
      <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} headerNavTree={headerNavTree} menuCategories={menuCategories} megaMenuItems={megaMenuItems ?? undefined} footerNav={footerNav} footerNavTree={footerNavTree} menus={footerMenus.length > 0 ? footerMenus : undefined} metaPixelId={metaPixelId} googleAdsConfig={googleAdsConfig} taxSettings={taxSettings} frozenReason={frozenReason} effectiveSettings={settings} outlet={outlet} branchId={branchId} showCurrencyCode={showCurrencyCode} currencyPosition={currencyPosition}>
        <JsonLd data={[
          buildOrganizationJsonLd({
            name: organization.name,
            description: organization.description,
            logo_url: organization.logo_url,
            email: organization.email,
            phone: organization.phone,
            address: organization.address,
            city: organization.city,
            country: organization.country,
          }, baseUrl),
          currentSlug === 'home'
            ? buildWebsiteJsonLd({ name: organization.name }, baseSitio)
            : buildBreadcrumbJsonLd({ slug: currentSlug, title: page.title, meta_title: page.meta_title, meta_description: page.meta_description }, organization.name, baseSitio),
          ...jsonLdDeSedes,
        ]} />
        <PreviewableSections
          sections={page.website_page_sections}
          organization={organization}
          primaryColor={primaryColor}
          data={data}
        />
      </OrganizationLayout>
    )
  }

  // 2. Fallbacks para slugs conocidos sin página en el builder
  const resolvedSearchParams = await searchParams
  const fallback = await renderSlugFallback(currentSlug, organization, primaryColor, template, headerNav, headerNavTree, menuCategories, megaMenuItems, footerMenus, footerNav, footerNavTree, metaPixelId, googleAdsConfig, resolvedSearchParams, taxSettings, frozenReason, branchId, settings, outlet, showCurrencyCode, currencyPosition)
  if (fallback) return fallback

  // 4. Página no encontrada
  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} headerNavTree={headerNavTree} menuCategories={menuCategories} megaMenuItems={megaMenuItems ?? undefined} footerNav={footerNav} footerNavTree={footerNavTree} menus={footerMenus.length > 0 ? footerMenus : undefined} metaPixelId={metaPixelId} googleAdsConfig={googleAdsConfig} taxSettings={taxSettings} frozenReason={frozenReason} effectiveSettings={settings} outlet={outlet} branchId={branchId} showCurrencyCode={showCurrencyCode} currencyPosition={currencyPosition}>
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
  headerNavTree: any[],
  menuCategories: any[],
  megaMenuItems: MegaMenuItem[] | null,
  footerMenus: any[],
  footerNav: any[],
  footerNavTree: any[],
  metaPixelId?: string | null,
  googleAdsConfig?: { conversionId: string; conversionLabel?: string } | null,
  searchParams?: Record<string, string | string[] | undefined>,
  taxSettings?: { name: string; rate: number; taxIncluded: boolean } | null,
  frozenReason?: FrozenReason,
  branchId?: number | null,
  effectiveSettings?: any,
  outlet?: any,
  showCurrencyCode?: boolean,
  currencyPosition?: 'left' | 'right',
): Promise<React.ReactElement | null> {
  const Layout = ({ children }: { children: React.ReactNode }) => (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} headerNavTree={headerNavTree} menuCategories={menuCategories} megaMenuItems={megaMenuItems ?? undefined} footerNav={footerNav} footerNavTree={footerNavTree} menus={footerMenus && footerMenus.length > 0 ? footerMenus : undefined} metaPixelId={metaPixelId} googleAdsConfig={googleAdsConfig} taxSettings={taxSettings} frozenReason={frozenReason} effectiveSettings={effectiveSettings} outlet={outlet} branchId={branchId} showCurrencyCode={showCurrencyCode} currencyPosition={currencyPosition}>
      {children}
    </OrganizationLayout>
  )

  const businessType = getBusinessTypeConfig(organization.type_id)

  switch (slug) {
    case 'menu': {
      const [menuProducts, menuCategories, menuTags, menuModifiers, menuVariantRelations, menuModifierGroups] = await Promise.all([
        getMenuProducts(organization.id, 200, branchId),
        getOrganizationCategories(organization.id, branchId),
        getOrganizationTags(organization.id),
        getProductModifiers(organization.id),
        getProductVariantRelations(organization.id),
        getProductModifierGroupsByOrg(organization.id)
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
            modifierGroupsMap={menuModifierGroups}
            primaryColor={primaryColor}
            organizationSubdomain={organization.subdomain || ''}
            organizationName={organization.name}
            customerId={customerId}
            organizationId={organization.id}
            initialFavorites={initialFavorites}
            branchId={branchId}
            timeZone={organization.timezone ?? null}
            // Misma regla que el 403 de /api/orders, sobre los ajustes efectivos de la sede.
            canOrder={!pedidoEnLineaApagado(organization.type_id === 1, (organization.website_settings as any)?.enable_online_ordering)}
          />
        </Layout>
      )
    }

    case 'productos': {
      const sectionTitle = {
        restaurant: 'Nuestro Menú', retail: 'Nuestros Productos', hotel: 'Habitaciones',
        gym: 'Membresías', transport: 'Rutas Disponibles', parking: 'Tarifas', services: 'Planes'
      }[businessType.type] || 'Productos'

      const [products, categories] = await Promise.all([
        getOrganizationProducts(organization.id, 500, branchId),
        getOrganizationCategories(organization.id, branchId)
      ])

      return (
        <Layout>
          <div className="container mx-auto px-4 py-12">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">{sectionTitle}</h1>
              <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                Explora nuestra selección completa
              </p>
            </div>
            <ProductGrid
              products={products}
              categories={categories}
              primaryColor={primaryColor}
              organizationSubdomain={organization.subdomain || ''}
              organizationId={organization.id}
              showBuyNow={organization.website_settings?.show_buy_now_button !== false}
              branchId={branchId}
            />
          </div>
        </Layout>
      )
    }

    case 'espacios': {
      const pageConfig = {
        restaurant: { title: 'Nuestras Mesas', subtitle: 'Reserva tu mesa' },
        hotel: { title: 'Habitaciones', subtitle: 'Diseñadas para su comodidad' },
        gym: { title: 'Espacios', subtitle: 'Reserva tu clase o espacio' },
        parking: { title: 'Espacios de Parqueo', subtitle: 'Reserva tu espacio' },
      }[businessType.type as string] || { title: 'Espacios', subtitle: 'Espacios disponibles' }

      const allSpaces = await getOrganizationSpaces(organization.id, branchId)

      // --- Booking search params del HeroBooking ---
      const bkCheckin = typeof searchParams?.checkin === 'string' ? searchParams.checkin : ''
      const bkCheckout = typeof searchParams?.checkout === 'string' ? searchParams.checkout : ''
      const bkGuests = parseInt(typeof searchParams?.guests === 'string' ? searchParams.guests : '0', 10)
      const bkAdults = typeof searchParams?.adults === 'string' ? searchParams.adults : ''
      const bkChildren = typeof searchParams?.children === 'string' ? searchParams.children : ''
      const hasBookingFilter = !!(bkCheckin && bkCheckout && bkGuests > 0)

      // Filtrar por capacidad si hay búsqueda de booking
      const spaces = hasBookingFilter
        ? allSpaces.filter((sp: any) => {
            const capacity = sp.space_types?.capacity || sp.space_types?.max_occupancy || 99
            return capacity >= bkGuests
          })
        : allSpaces

      // Construir query string para preservar params en links
      const bookingQs = hasBookingFilter
        ? `?checkin=${bkCheckin}&checkout=${bkCheckout}&guests=${bkGuests}${bkAdults ? `&adults=${bkAdults}` : ''}${bkChildren ? `&children=${bkChildren}` : ''}`
        : ''

      // Calcular noches
      const bkNights = hasBookingFilter
        ? Math.round((new Date(bkCheckout + 'T12:00:00').getTime() - new Date(bkCheckin + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24))
        : 0

      const fmtBookingDate = (d: string) => {
        if (!d) return ''
        return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
      }

      return (
        <Layout>
          <div className="container mx-auto px-4 py-12">
            {/* Booking search summary */}
            {hasBookingFilter && (
              <div className="mb-8 p-4 rounded-2xl border dark:border-gray-700" style={{ backgroundColor: `${primaryColor}08`, borderColor: `${primaryColor}30` }}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-6 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Llegada</span>
                      <p className="font-semibold text-gray-900 dark:text-white">{fmtBookingDate(bkCheckin)}</p>
                    </div>
                    <div className="text-gray-300 dark:text-gray-600">→</div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Salida</span>
                      <p className="font-semibold text-gray-900 dark:text-white">{fmtBookingDate(bkCheckout)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Estancia</span>
                      <p className="font-semibold text-gray-900 dark:text-white">{bkNights} {bkNights === 1 ? 'noche' : 'noches'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Huéspedes</span>
                      <p className="font-semibold text-gray-900 dark:text-white">{bkGuests}</p>
                    </div>
                  </div>
                  <a href="/" className="text-sm font-medium hover:underline" style={{ color: primaryColor }}>
                    Modificar búsqueda
                  </a>
                </div>
                {spaces.length !== allSpaces.length && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Mostrando {spaces.length} de {allSpaces.length} habitaciones con capacidad para {bkGuests}+ huéspedes
                  </p>
                )}
              </div>
            )}

            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                {hasBookingFilter ? `${spaces.length} ${spaces.length === 1 ? 'habitación disponible' : 'habitaciones disponibles'}` : pageConfig.title}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">{pageConfig.subtitle}</p>
            </div>
            {spaces.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {spaces.map((sp: any) => {
                  const st = sp.space_types
                  const nightlyRate = Number(st?.base_rate || 0)
                  return (
                    <a key={sp.id} href={`/espacios/${sp.id}${bookingQs}`} className="group bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 overflow-hidden hover:shadow-xl transition-all duration-300">
                      {/* Imagen */}
                      <div className="relative h-56 overflow-hidden">
                        {sp.primaryImage ? (
                          <img
                            src={sp.primaryImage}
                            alt={sp.label}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primaryColor}20 0%, ${primaryColor}08 100%)` }}>
                            <span className="text-5xl">🏠</span>
                          </div>
                        )}
                        {/* Badge tipo */}
                        {st?.name && (
                          <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-semibold text-white backdrop-blur-sm" style={{ backgroundColor: `${primaryColor}cc` }}>
                            {st.name}
                          </span>
                        )}
                        {/* Badge capacidad */}
                        {st?.capacity && (
                          <span className="absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium bg-white/90 dark:bg-gray-900/80 text-gray-700 dark:text-gray-300 backdrop-blur-sm">
                            👤 {st.capacity} máx
                          </span>
                        )}
                      </div>
                      {/* Info */}
                      <div className="p-5">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{sp.label}</h3>
                        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mb-3">
                          {sp.floor_zone && <span>📍 {sp.floor_zone}</span>}
                          {st?.capacity && <span>👤 {st.capacity} personas</span>}
                          {st?.area_sqm && <span>📐 {st.area_sqm} m²</span>}
                        </div>
                        {/* Servicios (máximo 4) */}
                        {sp.services?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {sp.services.slice(0, 4).map((svc: any, i: number) => (
                              <span key={i} className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: `${primaryColor}10`, color: primaryColor }}>
                                {svc.name}
                              </span>
                            ))}
                            {sp.services.length > 4 && (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                +{sp.services.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                        {/* Precio + CTA */}
                        <div className="flex items-center justify-between pt-3 border-t dark:border-gray-700">
                          <div>
                            {hasBookingFilter && bkNights > 0 ? (
                              <>
                                <span className="text-xs text-gray-400">{bkNights} {bkNights === 1 ? 'noche' : 'noches'}</span>
                                <p className="text-xl font-bold" style={{ color: primaryColor }}>
                                  ${(nightlyRate * bkNights).toLocaleString('es-CO')}
                                </p>
                                <span className="text-xs text-gray-400">${nightlyRate.toLocaleString('es-CO')} /noche</span>
                              </>
                            ) : (
                              <>
                                <span className="text-xs text-gray-400">Desde</span>
                                <p className="text-xl font-bold" style={{ color: primaryColor }}>
                                  ${nightlyRate.toLocaleString('es-CO')}
                                  <span className="text-xs font-normal text-gray-400"> /noche</span>
                                </p>
                              </>
                            )}
                          </div>
                          <span className="px-4 py-2 rounded-xl text-white text-sm font-medium group-hover:opacity-90 transition-opacity" style={{ backgroundColor: primaryColor }}>
                            {hasBookingFilter ? 'Reservar' : 'Ver detalle'}
                          </span>
                        </div>
                      </div>
                    </a>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-20">
                {hasBookingFilter ? (
                  <>
                    <p className="text-4xl mb-4">😕</p>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Sin habitaciones disponibles</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">No encontramos habitaciones con capacidad para {bkGuests} huéspedes en las fechas seleccionadas.</p>
                    <a href="/" className="inline-flex px-6 py-2 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: primaryColor }}>
                      Modificar búsqueda
                    </a>
                  </>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-lg">No hay espacios disponibles en este momento.</p>
                )}
              </div>
            )}
          </div>
        </Layout>
      )
    }

    case 'servicios': {
      // Orgs type_id=4 usan catálogo dedicado (organization_services + service_charges)
      const isServiceOrg = organization.type_id === 4
      if (isServiceOrg) {
        const { services: catalog, charges } = await getOrgServiceCatalog(organization.id)
        return (
          <Layout>
            <div className="container mx-auto px-4 py-12">
              <div className="text-center mb-12">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Nuestros Servicios</h1>
                <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">Conoce nuestra oferta de servicios profesionales</p>
              </div>

              {/* Botones de acción rápida */}
              <div className="flex flex-wrap justify-center gap-4 mb-12">
                <a href="/agendar" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium transition-all hover:opacity-90" style={{ backgroundColor: primaryColor }}>
                  <span>📅</span> Agendar Cita
                </a>
                <a href="/cotizar" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium border-2 transition-all hover:opacity-80" style={{ borderColor: primaryColor, color: primaryColor }}>
                  <span>📋</span> Solicitar Cotización
                </a>
              </div>

              {catalog.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {catalog.map((os: any) => {
                    const svc = os.services || {}
                    const icon = os.custom_icon || svc.icon || '🛠️'
                    const name = os.custom_name || svc.name || 'Servicio'
                    const desc = os.custom_description || svc.description || ''
                    // Tarifas asociadas al servicio
                    const svcCharges = charges.filter((c: any) => c.service_id === os.service_id || c.applies_to === 'all')
                    return (
                      <a key={os.id} href={`/servicios/${os.id}`} className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all group">
                        <div className="h-32 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primaryColor}20 0%, ${primaryColor}10 100%)` }}>
                          <span className="text-5xl group-hover:scale-110 transition-transform">{icon}</span>
                        </div>
                        <div className="p-6">
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{name}</h3>
                          {desc && <p className="text-gray-500 dark:text-gray-400 mb-4 line-clamp-3">{desc}</p>}
                          {svcCharges.length > 0 && (
                            <div className="space-y-1">
                              {svcCharges.slice(0, 2).map((ch: any) => (
                                <p key={ch.id} className="text-sm">
                                  <span className="text-gray-500 dark:text-gray-400">{ch.name}: </span>
                                  <span className="font-bold" style={{ color: primaryColor }}>
                                    {ch.charge_type === 'percentage' ? `${ch.charge_value}%` : `$${Number(ch.charge_value || 0).toLocaleString('es-CO')}`}
                                  </span>
                                </p>
                              ))}
                            </div>
                          )}
                          <div className="mt-4 text-sm font-medium flex items-center gap-1" style={{ color: primaryColor }}>
                            Ver detalle <span className="group-hover:translate-x-1 transition-transform">→</span>
                          </div>
                        </div>
                      </a>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-20">
                  <span className="text-4xl block mb-4">🛠️</span>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Próximamente</h3>
                  <p className="text-gray-500 dark:text-gray-400">Estamos preparando nuestro catálogo de servicios.</p>
                </div>
              )}
            </div>
          </Layout>
        )
      }

      // Otros tipos de org: fallback con products (unit_code='SV')
      const sectionTitle = {
        restaurant: 'Nuestros Servicios', hotel: 'Servicios del Hotel',
        gym: 'Clases y Servicios', parking: 'Servicios Adicionales',
      }[businessType.type as string] || 'Servicios'

      const services = await getOrganizationServices(organization.id, 50, branchId)

      return (
        <Layout>
          <div className="container mx-auto px-4 py-12">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">{sectionTitle}</h1>
              <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">Descubre todos los servicios que tenemos para ti</p>
            </div>
            {services.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {services.map((service: any) => {
                  const price = service.product_prices?.[0]
                  return (
                    <div key={service.id} className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all">
                      <div className="h-32 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primaryColor}20 0%, ${primaryColor}10 100%)` }}>
                        <span className="text-5xl">🛠️</span>
                      </div>
                      <div className="p-6">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{service.name}</h3>
                        {service.description && <p className="text-gray-500 dark:text-gray-400 mb-4 line-clamp-3">{service.description}</p>}
                        {price && (
                          <p className="text-lg font-bold" style={{ color: primaryColor }}>${Number(price.price).toLocaleString('es-CO')}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-20">
                <span className="text-4xl block mb-4">🛠️</span>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Próximamente</h3>
                <p className="text-gray-500 dark:text-gray-400">Estamos preparando nuestro catálogo de servicios.</p>
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
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">Contáctanos</h1>
                <p className="text-xl text-gray-600 dark:text-gray-400">Estamos aquí para ayudarte. No dudes en comunicarte con nosotros.</p>
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
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">Sobre Nosotros</h1>
                <p className="text-xl text-gray-600 dark:text-gray-400">
                  {organization.description || `Conoce más sobre ${organization.name} y nuestra historia.`}
                </p>
              </div>
            </div>
          </section>
          <section className="py-16 md:py-24">
            <div className="container mx-auto px-4">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Nuestra Historia</h2>
                  <div className="space-y-4 text-gray-600 dark:text-gray-400">
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
            <section className="py-16 md:py-24 bg-gray-50 dark:bg-gray-900/50">
              <div className="container mx-auto px-4 text-center">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Encuéntranos</h2>
                <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-2xl p-8 space-y-4">
                  {organization.address && (
                    <div className="flex items-start text-left">
                      <span className="text-2xl mr-4">📍</span>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Dirección</p>
                        <p className="text-gray-600 dark:text-gray-400">{organization.address}{organization.city && `, ${organization.city}`}</p>
                      </div>
                    </div>
                  )}
                  {organization.phone && (
                    <div className="flex items-start text-left">
                      <span className="text-2xl mr-4">📞</span>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Teléfono</p>
                        <a href={`tel:${organization.phone}`} style={{ color: primaryColor }}>{organization.phone}</a>
                      </div>
                    </div>
                  )}
                  {organization.email && (
                    <div className="flex items-start text-left">
                      <span className="text-2xl mr-4">✉️</span>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Email</p>
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
