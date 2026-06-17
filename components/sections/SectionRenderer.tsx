import type { WebsitePageSection } from '@/types/database'
import type { OrganizationWithDetails } from '@/types/database'
import { SectionWrapper } from './SectionWrapper'

// Secciones universales — Hero
import { HeroFullscreen } from './hero/HeroFullscreen'
import { HeroMinimal } from './hero/HeroMinimal'
import { HeroSplit } from './hero/HeroSplit'
import { HeroVideo } from './hero/HeroVideo'
import { HeroSlider } from './hero/HeroSlider'
// Secciones universales — Testimonials
import { TestimonialsCarousel } from './testimonials/TestimonialsCarousel'
import { TestimonialsGrid } from './testimonials/TestimonialsGrid'
import { TestimonialsQuotes } from './testimonials/TestimonialsQuotes'
import { TestimonialsMinimal } from './testimonials/TestimonialsMinimal'
// Secciones universales — Stats
import { StatsCounters } from './stats/StatsCounters'
import { StatsCards } from './stats/StatsCards'
import { StatsInline } from './stats/StatsInline'
// Secciones universales — CTA
import { CtaCentered } from './cta/CtaCentered'
import { CtaBanner } from './cta/CtaBanner'
import { CtaSplit } from './cta/CtaSplit'
import { CtaWithImage } from './cta/CtaWithImage'
// Secciones universales — Gallery
import { GalleryMasonry } from './gallery/GalleryMasonry'
import { GalleryGrid } from './gallery/GalleryGrid'
import { GalleryCarousel } from './gallery/GalleryCarousel'
import { GalleryFullscreen } from './gallery/GalleryFullscreen'
// Secciones universales — Contact
import { ContactFormDefault } from './contact/ContactFormDefault'
import { ContactFormSplit } from './contact/ContactFormSplit'
import { ContactFormWithMap } from './contact/ContactFormWithMap'
// Secciones universales — Image + Text
import { ImageTextRight } from './image-text/ImageTextRight'
import { ImageTextLeft } from './image-text/ImageTextLeft'
import { ImageTextTop } from './image-text/ImageTextTop'
// Secciones universales — Team
import { TeamGrid } from './team/TeamGrid'
import { TeamCarousel } from './team/TeamCarousel'
import { TeamSimple } from './team/TeamSimple'
// Secciones universales — Map
import { MapDefault } from './map/MapDefault'
import { MapFullWidth } from './map/MapFullWidth'
import { MapEmbedded } from './map/MapEmbedded'
import { MapWithDirections } from './map/MapWithDirections'
// Secciones universales — Services
import { ServicesListCards } from './services/ServicesListCards'
import { ServicesListGrid } from './services/ServicesListGrid'
import { ServicesListList } from './services/ServicesListList'
import { ServicesListIconsRow } from './services/ServicesListIconsRow'
// Secciones universales — FAQ
import { FaqAccordion } from './faq/FaqAccordion'
import { FaqTwoColumns } from './faq/FaqTwoColumns'
import { FaqSimple } from './faq/FaqSimple'
// Secciones universales — Text Block
import { TextBlockCentered } from './text-block/TextBlockCentered'
import { TextBlockLeft } from './text-block/TextBlockLeft'
import { TextBlockTwoColumns } from './text-block/TextBlockTwoColumns'
// Secciones universales — Newsletter
import { NewsletterSimple } from './newsletter/NewsletterSimple'
import { NewsletterWithImage } from './newsletter/NewsletterWithImage'
import { NewsletterBanner } from './newsletter/NewsletterBanner'
// Secciones universales — Partners
import { PartnersLogos } from './partners/PartnersLogos'
import { PartnersCards } from './partners/PartnersCards'
import { PartnersCarousel } from './partners/PartnersCarousel'

// Secciones productos/retail
import { ProductsGrid } from './products/ProductsGrid'
import { ProductsCarousel } from './products/ProductsCarousel'
import { ProductsList } from './products/ProductsList'
import { CategoriesGrid } from './products/CategoriesGrid'
import { CategoriesHorizontal } from './products/CategoriesHorizontal'
import { CategoriesIcons } from './products/CategoriesIcons'
import { FeaturedProducts } from './products/FeaturedProducts'
import { FeaturedProductsCarousel } from './products/FeaturedProductsCarousel'
import { FeaturedProductsHero } from './products/FeaturedProductsHero'

// Secciones hotel (spaces)
import { SpacesCards } from './hotel/SpacesCards'
import { SpacesDetailed } from './hotel/SpacesDetailed'
import { AmenitiesIcons } from './amenities/AmenitiesIcons'
import { AmenitiesGrid } from './amenities/AmenitiesGrid'
import { BookingCtaBanner } from './hotel/BookingCtaBanner'
import { WhyChooseUsIcons } from './hotel/WhyChooseUsIcons'

// Secciones restaurant
import { MenuPreviewTabs } from './restaurant/MenuPreviewTabs'
import { SpecialtiesFeatured } from './restaurant/SpecialtiesFeatured'
import { ReservationCtaForm } from './restaurant/ReservationCtaForm'
import { DeliveryCtaBanner } from './restaurant/DeliveryCtaBanner'
import { ChefSectionProfile } from './restaurant/ChefSectionProfile'

// Secciones retail
import { PromoBannersGrid } from './retail/PromoBannersGrid'
import { BrandsLogos } from './retail/BrandsLogos'
import { OffersGrid } from './retail/OffersGrid'

// Secciones gym
import { MembershipPlansPricing } from './gym/MembershipPlansPricing'
import { ClassScheduleGrid } from './gym/ClassScheduleGrid'
import { TrainersGrid } from './gym/TrainersGrid'
import { GymFeaturesIcons } from './gym/GymFeaturesIcons'
import { TransformationBeforeAfter } from './gym/TransformationBeforeAfter'

// Secciones transport
import { RoutesCards } from './transport/RoutesCards'
import { FleetShowcaseGrid } from './transport/FleetShowcaseGrid'
import { TripSearchForm } from './transport/TripSearchForm'
import { BookingTransportBanner } from './transport/BookingTransportBanner'
import { CoverageMapStatic } from './transport/CoverageMapStatic'

// Secciones parking
import { ParkingZonesGrid } from './parking/ParkingZonesGrid'
import { ParkingPricingCards } from './parking/ParkingPricingCards'
import { ParkingPassPlansCards } from './parking/ParkingPassPlansCards'
import { ParkingFeaturesIcons } from './parking/ParkingFeaturesIcons'
import { ParkingAvailabilitySummary } from './parking/ParkingAvailabilitySummary'

// Secciones countdown
import { CountdownSection } from './countdown/CountdownSection'

// Secciones saas
import { PricingTableColumns } from './saas/PricingTableColumns'
import { FeaturesGridAlternating } from './saas/FeaturesGridAlternating'
import { IntegrationsLogos } from './saas/IntegrationsLogos'
import { HowItWorksSteps } from './saas/HowItWorksSteps'
import { DemoCtaForm } from './saas/DemoCtaForm'

// Mapa de sección: section_type → section_variant → Component
const SECTION_MAP: Record<string, Record<string, React.ComponentType<any>>> = {
  hero: {
    fullscreen: HeroFullscreen,
    minimal: HeroMinimal,
    split: HeroSplit,
    video: HeroVideo,
    slider: HeroSlider,
  },
  testimonials: {
    carousel: TestimonialsCarousel,
    grid: TestimonialsGrid,
    quotes: TestimonialsQuotes,
    minimal: TestimonialsMinimal,
  },
  stats: {
    counters: StatsCounters,
    cards: StatsCards,
    inline: StatsInline,
  },
  cta: {
    centered: CtaCentered,
    banner: CtaBanner,
    split: CtaSplit,
    with_image: CtaWithImage,
  },
  gallery: {
    masonry: GalleryMasonry,
    grid: GalleryGrid,
    carousel: GalleryCarousel,
    fullscreen: GalleryFullscreen,
  },
  contact_form: {
    default: ContactFormDefault,
    simple: ContactFormDefault,
    split: ContactFormSplit,
    with_map: ContactFormWithMap,
  },
  image_text: {
    image_right: ImageTextRight,
    image_left: ImageTextLeft,
    image_top: ImageTextTop,
  },
  team: {
    grid: TeamGrid,
    carousel: TeamCarousel,
    simple: TeamSimple,
  },
  map: {
    default: MapDefault,
    full_width: MapFullWidth,
    embedded: MapEmbedded,
    with_directions: MapWithDirections,
  },
  services_list: {
    cards: ServicesListCards,
    grid: ServicesListGrid,
    list: ServicesListList,
    icons_row: ServicesListIconsRow,
  },
  faq: {
    accordion: FaqAccordion,
    two_columns: FaqTwoColumns,
    simple: FaqSimple,
  },
  text_block: {
    centered: TextBlockCentered,
    left: TextBlockLeft,
    two_columns: TextBlockTwoColumns,
  },
  newsletter: {
    simple: NewsletterSimple,
    with_image: NewsletterWithImage,
    banner: NewsletterBanner,
  },
  partners: {
    logos: PartnersLogos,
    cards: PartnersCards,
    carousel: PartnersCarousel,
  },
  room_types: {
    cards: SpacesCards,
    detailed: SpacesDetailed,
  },
  amenities: {
    icons: AmenitiesIcons,
    grid: AmenitiesGrid,
  },
  products_grid: {
    default: ProductsGrid,
    grid: ProductsGrid,
    carousel: ProductsCarousel,
    list: ProductsList,
  },
  categories_grid: {
    default: CategoriesGrid,
    grid: CategoriesGrid,
    horizontal: CategoriesGrid,
    icons: CategoriesGrid,
  },
  featured_products: {
    grid: FeaturedProducts,
    carousel: FeaturedProductsCarousel,
    hero_product: FeaturedProductsHero,
  },
  // Hotel
  booking_cta: {
    inline_form: BookingCtaBanner,
    banner: BookingCtaBanner,
  },
  why_choose_us: {
    icons: WhyChooseUsIcons,
  },
  // Restaurant
  menu_preview: {
    tabs: MenuPreviewTabs,
  },
  specialties: {
    featured: SpecialtiesFeatured,
  },
  reservation_cta: {
    with_form: ReservationCtaForm,
    simple: ReservationCtaForm,
  },
  delivery_cta: {
    banner: DeliveryCtaBanner,
  },
  chef_section: {
    profile: ChefSectionProfile,
  },
  // Retail
  promo_banners: {
    grid: PromoBannersGrid,
  },
  brands: {
    logos: BrandsLogos,
  },
  offers: {
    grid: OffersGrid,
  },
  // Gym
  membership_plans: {
    pricing_table: MembershipPlansPricing,
  },
  class_schedule: {
    grid: ClassScheduleGrid,
  },
  trainers: {
    grid: TrainersGrid,
  },
  gym_features: {
    icons: GymFeaturesIcons,
  },
  transformation: {
    before_after: TransformationBeforeAfter,
  },
  // Transport
  routes: {
    cards: RoutesCards,
  },
  fleet_showcase: {
    grid: FleetShowcaseGrid,
  },
  trip_search: {
    form: TripSearchForm,
  },
  booking_transport: {
    form: BookingTransportBanner,
    banner: BookingTransportBanner,
  },
  coverage_map: {
    static: CoverageMapStatic,
  },
  // Parking
  parking_zones: {
    grid: ParkingZonesGrid,
  },
  parking_pricing: {
    cards: ParkingPricingCards,
  },
  parking_pass_plans: {
    cards: ParkingPassPlansCards,
  },
  parking_features: {
    icons: ParkingFeaturesIcons,
  },
  parking_availability: {
    summary: ParkingAvailabilitySummary,
  },
  // SaaS
  pricing_table: {
    three_columns: PricingTableColumns,
  },
  features_grid: {
    alternating: FeaturesGridAlternating,
  },
  integrations: {
    logos: IntegrationsLogos,
  },
  how_it_works: {
    steps: HowItWorksSteps,
  },
  demo_cta: {
    form: DemoCtaForm,
  },
  // Countdown
  countdown: {
    banner: CountdownSection,
    inline: CountdownSection,
    compact: CountdownSection,
  },
}

interface SectionRendererProps {
  section: WebsitePageSection
  organization: OrganizationWithDetails
  primaryColor?: string
  data?: Record<string, any>
}

export function SectionRenderer({ section, organization, primaryColor, data }: SectionRendererProps) {
  const typeMap = SECTION_MAP[section.section_type]
  const Component = typeMap?.[section.section_variant]

  if (!Component) {
    if (process.env.NODE_ENV === 'development') {
      return (
        <div className="border-2 border-dashed border-yellow-400 bg-yellow-50 p-8 text-center rounded-lg my-4">
          <p className="text-yellow-700 font-medium">
            Sección no implementada: <code>{section.section_type}:{section.section_variant}</code>
          </p>
        </div>
      )
    }
    return null
  }

  const settings = (section.settings || {}) as Record<string, any>
  const content = (section.content || {}) as Record<string, any>

  return (
    <SectionWrapper settings={settings} content={content} primaryColor={primaryColor}>
      <Component
        content={content}
        organization={organization}
        primaryColor={primaryColor}
        data={data}
        sectionVariant={section.section_variant}
      />
    </SectionWrapper>
  )
}
