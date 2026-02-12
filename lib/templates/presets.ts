/**
 * Template Presets para el Page Builder
 * 
 * Cada preset define la configuración completa de un template:
 * - Colores y fuentes para website_settings
 * - Header/footer style
 * - Páginas y secciones por defecto (website_pages + website_page_sections)
 * 
 * Se usa cuando una organización selecciona un template desde el admin.
 * El sistema crea/actualiza las tablas correspondientes.
 */

export interface SectionPreset {
  section_type: string
  section_variant: string
  content?: Record<string, any>
  settings?: Record<string, any>
}

export interface PagePreset {
  slug: string
  title: string
  show_in_header: boolean
  show_in_footer: boolean
  header_order: number
  footer_order: number
  sections: SectionPreset[]
}

export interface TemplatePreset {
  id: string
  name: string
  description: string
  business_type: string
  is_default: boolean
  preview_image?: string

  // website_settings
  theme: {
    primary_color: string
    secondary_color: string
    accent_color?: string
    background_color?: string
    text_color?: string
    theme_mode: 'light' | 'dark'
  }
  fonts: {
    heading: string
    body: string
  }
  header_style: string
  footer_style: string
  header_cta_text?: string
  header_cta_url?: string
  show_topbar?: boolean
  logo_position?: 'left' | 'center'

  // Páginas y secciones
  pages: PagePreset[]
}

// ============================================================
// HELPER: Páginas comunes (Nosotros + Contacto)
// ============================================================

function nosotrosPage(heroVariant: string, textVariant: string, extraSections: SectionPreset[] = []): PagePreset {
  return {
    slug: 'nosotros',
    title: 'Nosotros',
    show_in_header: true,
    show_in_footer: true,
    header_order: 5,
    footer_order: 3,
    sections: [
      { section_type: 'hero', section_variant: heroVariant },
      { section_type: 'text_block', section_variant: textVariant },
      { section_type: 'stats', section_variant: 'counters' },
      { section_type: 'team', section_variant: 'grid' },
      ...extraSections,
    ],
  }
}

function contactoPage(heroVariant: string, formVariant: string, mapVariant: string): PagePreset {
  return {
    slug: 'contacto',
    title: 'Contacto',
    show_in_header: true,
    show_in_footer: true,
    header_order: 6,
    footer_order: 4,
    sections: [
      { section_type: 'hero', section_variant: heroVariant },
      { section_type: 'contact_form', section_variant: formVariant },
      { section_type: 'map', section_variant: mapVariant },
    ],
  }
}

function galeriaPage(variant: string): PagePreset {
  return {
    slug: 'galeria',
    title: 'Galería',
    show_in_header: false,
    show_in_footer: true,
    header_order: 7,
    footer_order: 5,
    sections: [
      { section_type: 'gallery', section_variant: variant },
    ],
  }
}

// ============================================================
// RETAIL TEMPLATES
// ============================================================

const retail_modern: TemplatePreset = {
  id: 'retail_modern',
  name: 'Retail Moderno',
  description: 'Limpio, minimalista, bordes redondeados',
  business_type: 'retail',
  is_default: true,
  theme: {
    primary_color: '#3B82F6',
    secondary_color: '#1E293B',
    theme_mode: 'light',
  },
  fonts: { heading: 'Inter', body: 'Inter' },
  header_style: 'default',
  footer_style: 'three_columns',
  header_cta_text: 'Ver Tienda',
  header_cta_url: '/productos',
  logo_position: 'left',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'slider' },
        { section_type: 'categories_grid', section_variant: 'horizontal' },
        { section_type: 'featured_products', section_variant: 'grid' },
        { section_type: 'promo_banners', section_variant: 'grid' },
        { section_type: 'products_grid', section_variant: 'grid' },
        { section_type: 'testimonials', section_variant: 'carousel' },
        { section_type: 'newsletter', section_variant: 'simple' },
        { section_type: 'brands', section_variant: 'logos' },
      ],
    },
    {
      slug: 'productos', title: 'Productos', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'products_grid', section_variant: 'grid' },
      ],
    },
    {
      slug: 'categorias', title: 'Categorías', show_in_header: true, show_in_footer: true, header_order: 2, footer_order: 2,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'categories_grid', section_variant: 'grid' },
      ],
    },
    {
      slug: 'ofertas', title: 'Ofertas', show_in_header: true, show_in_footer: true, header_order: 3, footer_order: 3,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'promo_banners', section_variant: 'grid' },
        { section_type: 'featured_products', section_variant: 'carousel' },
        { section_type: 'cta', section_variant: 'banner' },
      ],
    },
    nosotrosPage('split', 'two_columns', [{ section_type: 'partners', section_variant: 'logos' }]),
    contactoPage('minimal', 'split', 'full_width'),
  ],
}

const retail_classic: TemplatePreset = {
  id: 'retail_classic',
  name: 'Retail Clásico',
  description: 'Tradicional, elegante, serif headings',
  business_type: 'retail',
  is_default: false,
  theme: {
    primary_color: '#8B4513',
    secondary_color: '#2C1810',
    theme_mode: 'light',
  },
  fonts: { heading: 'Playfair Display', body: 'Lora' },
  header_style: 'centered',
  footer_style: 'default',
  logo_position: 'center',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'fullscreen' },
        { section_type: 'categories_grid', section_variant: 'grid' },
        { section_type: 'featured_products', section_variant: 'hero_product' },
        { section_type: 'image_text', section_variant: 'image_right' },
        { section_type: 'products_grid', section_variant: 'list' },
        { section_type: 'testimonials', section_variant: 'quotes' },
        { section_type: 'newsletter', section_variant: 'with_image' },
      ],
    },
    {
      slug: 'productos', title: 'Productos', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'products_grid', section_variant: 'list' },
      ],
    },
    nosotrosPage('split', 'centered'),
    contactoPage('minimal', 'default', 'embedded'),
  ],
}

const retail_bold: TemplatePreset = {
  id: 'retail_bold',
  name: 'Retail Bold',
  description: 'Vibrante, colorido, bordes duros, sombras marcadas',
  business_type: 'retail',
  is_default: false,
  theme: {
    primary_color: '#FF6B35',
    secondary_color: '#1A1A2E',
    theme_mode: 'light',
  },
  fonts: { heading: 'Poppins', body: 'Nunito' },
  header_style: 'default',
  footer_style: 'minimal',
  show_topbar: true,
  logo_position: 'left',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'slider' },
        { section_type: 'categories_grid', section_variant: 'icons' },
        { section_type: 'featured_products', section_variant: 'hero_product' },
        { section_type: 'products_grid', section_variant: 'carousel' },
        { section_type: 'cta', section_variant: 'with_image' },
        { section_type: 'testimonials', section_variant: 'grid' },
        { section_type: 'brands', section_variant: 'logos' },
        { section_type: 'newsletter', section_variant: 'banner' },
      ],
    },
    {
      slug: 'productos', title: 'Productos', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'products_grid', section_variant: 'grid' },
      ],
    },
    nosotrosPage('split', 'left'),
    contactoPage('minimal', 'with_map', 'default'),
  ],
}

const retail_elegant: TemplatePreset = {
  id: 'retail_elegant',
  name: 'Retail Elegante',
  description: 'Lujo, premium, blanco y negro con gold',
  business_type: 'retail',
  is_default: false,
  theme: {
    primary_color: '#C9A96E',
    secondary_color: '#1A1A1A',
    theme_mode: 'light',
  },
  fonts: { heading: 'Cormorant Garamond', body: 'Montserrat' },
  header_style: 'transparent',
  footer_style: 'centered',
  logo_position: 'center',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'video' },
        { section_type: 'text_block', section_variant: 'centered' },
        { section_type: 'featured_products', section_variant: 'hero_product' },
        { section_type: 'image_text', section_variant: 'image_left' },
        { section_type: 'products_grid', section_variant: 'grid' },
        { section_type: 'testimonials', section_variant: 'minimal' },
        { section_type: 'newsletter', section_variant: 'simple' },
      ],
    },
    {
      slug: 'productos', title: 'Productos', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'products_grid', section_variant: 'grid' },
      ],
    },
    nosotrosPage('fullscreen', 'centered'),
    contactoPage('minimal', 'split', 'embedded'),
  ],
}

// ============================================================
// RESTAURANT TEMPLATES
// ============================================================

const restaurant_modern: TemplatePreset = {
  id: 'restaurant_modern',
  name: 'Restaurante Moderno',
  description: 'Limpio, fotografía prominente, bistró moderno',
  business_type: 'restaurant',
  is_default: true,
  theme: {
    primary_color: '#E63946',
    secondary_color: '#1D3557',
    theme_mode: 'light',
  },
  fonts: { heading: 'DM Sans', body: 'DM Sans' },
  header_style: 'default',
  footer_style: 'three_columns',
  header_cta_text: 'Reservar Mesa',
  header_cta_url: '/reservas',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'fullscreen' },
        { section_type: 'specialties', section_variant: 'featured' },
        { section_type: 'menu_preview', section_variant: 'tabs' },
        { section_type: 'delivery_cta', section_variant: 'banner' },
        { section_type: 'gallery', section_variant: 'grid' },
        { section_type: 'testimonials', section_variant: 'carousel' },
        { section_type: 'reservation_cta', section_variant: 'with_form' },
        { section_type: 'map', section_variant: 'embedded' },
      ],
    },
    {
      slug: 'menu', title: 'Menú', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'menu_preview', section_variant: 'tabs' },
        { section_type: 'cta', section_variant: 'centered' },
      ],
    },
    {
      slug: 'domicilios', title: 'Pedir Online', show_in_header: true, show_in_footer: true, header_order: 2, footer_order: 2,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'products_grid', section_variant: 'grid' },
      ],
    },
    {
      slug: 'reservas-mesa', title: 'Reservar Mesa', show_in_header: true, show_in_footer: true, header_order: 3, footer_order: 3,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'reservation_cta', section_variant: 'with_form' },
        { section_type: 'faq', section_variant: 'accordion' },
      ],
    },
    nosotrosPage('split', 'two_columns'),
    contactoPage('minimal', 'split', 'embedded'),
    galeriaPage('masonry'),
  ],
}

const restaurant_elegant: TemplatePreset = {
  id: 'restaurant_elegant',
  name: 'Restaurante Elegante',
  description: 'Fine dining, oscuro, dorado, fotografía artística',
  business_type: 'restaurant',
  is_default: false,
  theme: {
    primary_color: '#D4AF37',
    secondary_color: '#0D0D0D',
    theme_mode: 'dark',
  },
  fonts: { heading: 'Playfair Display', body: 'Lato' },
  header_style: 'transparent',
  footer_style: 'centered',
  header_cta_text: 'Reservar',
  header_cta_url: '/reservas',
  logo_position: 'center',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'video' },
        { section_type: 'chef_section', section_variant: 'profile' },
        { section_type: 'specialties', section_variant: 'featured' },
        { section_type: 'menu_preview', section_variant: 'tabs' },
        { section_type: 'gallery', section_variant: 'fullscreen' },
        { section_type: 'testimonials', section_variant: 'quotes' },
        { section_type: 'reservation_cta', section_variant: 'simple' },
      ],
    },
    {
      slug: 'menu', title: 'Menú', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'menu_preview', section_variant: 'tabs' },
      ],
    },
    nosotrosPage('fullscreen', 'centered'),
    contactoPage('minimal', 'split', 'with_directions'),
    galeriaPage('fullscreen'),
  ],
}

const restaurant_casual: TemplatePreset = {
  id: 'restaurant_casual',
  name: 'Restaurante Casual',
  description: 'Divertido, colorido, comida callejera / fast casual',
  business_type: 'restaurant',
  is_default: false,
  theme: {
    primary_color: '#FF6B35',
    secondary_color: '#004E64',
    theme_mode: 'light',
  },
  fonts: { heading: 'Fredoka', body: 'Nunito' },
  header_style: 'default',
  footer_style: 'minimal',
  show_topbar: true,
  header_cta_text: 'Pedir Ahora',
  header_cta_url: '/domicilios',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'split' },
        { section_type: 'delivery_cta', section_variant: 'banner' },
        { section_type: 'menu_preview', section_variant: 'tabs' },
        { section_type: 'promo_banners', section_variant: 'grid' },
        { section_type: 'testimonials', section_variant: 'grid' },
        { section_type: 'faq', section_variant: 'simple' },
        { section_type: 'newsletter', section_variant: 'banner' },
      ],
    },
    {
      slug: 'menu', title: 'Menú', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'products_grid', section_variant: 'grid' },
      ],
    },
    {
      slug: 'domicilios', title: 'Pedir Online', show_in_header: true, show_in_footer: true, header_order: 2, footer_order: 2,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'products_grid', section_variant: 'grid' },
      ],
    },
    nosotrosPage('split', 'left'),
    contactoPage('minimal', 'with_map', 'default'),
  ],
}

const restaurant_rustic: TemplatePreset = {
  id: 'restaurant_rustic',
  name: 'Restaurante Rústico',
  description: 'Orgánico, rústico, texturas naturales, farm-to-table',
  business_type: 'restaurant',
  is_default: false,
  theme: {
    primary_color: '#5C4033',
    secondary_color: '#2D5016',
    theme_mode: 'light',
  },
  fonts: { heading: 'Merriweather', body: 'Source Sans Pro' },
  header_style: 'centered',
  footer_style: 'three_columns',
  logo_position: 'center',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'fullscreen' },
        { section_type: 'image_text', section_variant: 'image_right' },
        { section_type: 'specialties', section_variant: 'featured' },
        { section_type: 'menu_preview', section_variant: 'tabs' },
        { section_type: 'gallery', section_variant: 'masonry' },
        { section_type: 'stats', section_variant: 'counters' },
        { section_type: 'testimonials', section_variant: 'minimal' },
        { section_type: 'reservation_cta', section_variant: 'simple' },
      ],
    },
    {
      slug: 'menu', title: 'Menú', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'menu_preview', section_variant: 'tabs' },
      ],
    },
    nosotrosPage('fullscreen', 'two_columns'),
    contactoPage('minimal', 'split', 'with_directions'),
    galeriaPage('masonry'),
  ],
}

// ============================================================
// HOTEL TEMPLATES
// ============================================================

const hotel_luxury: TemplatePreset = {
  id: 'hotel_luxury',
  name: 'Hotel Luxury',
  description: 'Premium, elegante, dorado, fotografía de alta calidad',
  business_type: 'hotel',
  is_default: true,
  theme: {
    primary_color: '#8B6914',
    secondary_color: '#1A1A2E',
    theme_mode: 'light',
  },
  fonts: { heading: 'Playfair Display', body: 'Lato' },
  header_style: 'transparent',
  footer_style: 'three_columns',
  header_cta_text: 'Reservar Ahora',
  header_cta_url: '/reservas',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'fullscreen' },
        { section_type: 'booking_cta', section_variant: 'inline_form' },
        { section_type: 'room_types', section_variant: 'cards' },
        { section_type: 'why_choose_us', section_variant: 'icons' },
        { section_type: 'amenities', section_variant: 'icons' },
        { section_type: 'gallery', section_variant: 'masonry' },
        { section_type: 'testimonials', section_variant: 'carousel' },
        { section_type: 'stats', section_variant: 'counters' },
        { section_type: 'map', section_variant: 'embedded' },
      ],
    },
    {
      slug: 'espacios', title: 'Habitaciones', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'room_types', section_variant: 'detailed' },
        { section_type: 'booking_cta', section_variant: 'banner' },
      ],
    },
    {
      slug: 'servicios', title: 'Servicios', show_in_header: true, show_in_footer: true, header_order: 2, footer_order: 2,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'amenities', section_variant: 'grid' },
        { section_type: 'services_list', section_variant: 'cards' },
      ],
    },
    galeriaPage('masonry'),
    nosotrosPage('split', 'centered'),
    contactoPage('minimal', 'split', 'embedded'),
  ],
}

const hotel_boutique: TemplatePreset = {
  id: 'hotel_boutique',
  name: 'Hotel Boutique',
  description: 'Artístico, personalidad única, colores tierra',
  business_type: 'hotel',
  is_default: false,
  theme: {
    primary_color: '#A0522D',
    secondary_color: '#2F4F4F',
    theme_mode: 'light',
  },
  fonts: { heading: 'Cormorant', body: 'Karla' },
  header_style: 'centered',
  footer_style: 'centered',
  logo_position: 'center',
  header_cta_text: 'Reservar',
  header_cta_url: '/reservas',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'slider' },
        { section_type: 'text_block', section_variant: 'centered' },
        { section_type: 'room_types', section_variant: 'cards' },
        { section_type: 'image_text', section_variant: 'image_right' },
        { section_type: 'gallery', section_variant: 'fullscreen' },
        { section_type: 'testimonials', section_variant: 'quotes' },
        { section_type: 'booking_cta', section_variant: 'banner' },
      ],
    },
    {
      slug: 'espacios', title: 'Habitaciones', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'room_types', section_variant: 'detailed' },
      ],
    },
    galeriaPage('fullscreen'),
    nosotrosPage('fullscreen', 'two_columns'),
    contactoPage('minimal', 'split', 'with_directions'),
  ],
}

const hotel_minimal: TemplatePreset = {
  id: 'hotel_minimal',
  name: 'Hotel Minimal',
  description: 'Escandinavo, limpio, mucho blanco, tipografía delgada',
  business_type: 'hotel',
  is_default: false,
  theme: {
    primary_color: '#4A5568',
    secondary_color: '#F7FAFC',
    theme_mode: 'light',
  },
  fonts: { heading: 'Outfit', body: 'Inter' },
  header_style: 'minimal',
  footer_style: 'minimal',
  logo_position: 'left',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'split' },
        { section_type: 'room_types', section_variant: 'cards' },
        { section_type: 'amenities', section_variant: 'icons' },
        { section_type: 'gallery', section_variant: 'grid' },
        { section_type: 'booking_cta', section_variant: 'banner' },
      ],
    },
    {
      slug: 'espacios', title: 'Habitaciones', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'room_types', section_variant: 'detailed' },
      ],
    },
    galeriaPage('grid'),
    nosotrosPage('minimal', 'left'),
    contactoPage('minimal', 'default', 'default'),
  ],
}

const hotel_resort: TemplatePreset = {
  id: 'hotel_resort',
  name: 'Hotel Resort',
  description: 'Tropical, vibrante, vacacional, fotos grandes',
  business_type: 'hotel',
  is_default: false,
  theme: {
    primary_color: '#00897B',
    secondary_color: '#FF7043',
    theme_mode: 'light',
  },
  fonts: { heading: 'Montserrat', body: 'Open Sans' },
  header_style: 'transparent',
  footer_style: 'three_columns',
  header_cta_text: 'Reservar',
  header_cta_url: '/reservas',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'video' },
        { section_type: 'booking_cta', section_variant: 'banner' },
        { section_type: 'room_types', section_variant: 'cards' },
        { section_type: 'amenities', section_variant: 'grid' },
        { section_type: 'gallery', section_variant: 'carousel' },
        { section_type: 'testimonials', section_variant: 'grid' },
        { section_type: 'stats', section_variant: 'cards' },
        { section_type: 'newsletter', section_variant: 'with_image' },
      ],
    },
    {
      slug: 'espacios', title: 'Habitaciones', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'room_types', section_variant: 'detailed' },
      ],
    },
    galeriaPage('carousel'),
    nosotrosPage('split', 'two_columns'),
    contactoPage('minimal', 'with_map', 'full_width'),
  ],
}

// ============================================================
// GYM TEMPLATES
// ============================================================

const gym_power: TemplatePreset = {
  id: 'gym_power',
  name: 'Gym Power',
  description: 'Oscuro, energético, bold, motivacional',
  business_type: 'gym',
  is_default: true,
  theme: {
    primary_color: '#FF4444',
    secondary_color: '#1A1A1A',
    theme_mode: 'dark',
  },
  fonts: { heading: 'Oswald', body: 'Roboto' },
  header_style: 'default',
  footer_style: 'default',
  header_cta_text: 'Únete Ahora',
  header_cta_url: '/productos',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'video' },
        { section_type: 'membership_plans', section_variant: 'pricing_table' },
        { section_type: 'gym_features', section_variant: 'icons' },
        { section_type: 'class_schedule', section_variant: 'grid' },
        { section_type: 'trainers', section_variant: 'grid' },
        { section_type: 'transformation', section_variant: 'before_after' },
        { section_type: 'testimonials', section_variant: 'carousel' },
        { section_type: 'cta', section_variant: 'with_image' },
        { section_type: 'gallery', section_variant: 'grid' },
      ],
    },
    {
      slug: 'membresias', title: 'Membresías', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'membership_plans', section_variant: 'pricing_table' },
        { section_type: 'faq', section_variant: 'accordion' },
        { section_type: 'cta', section_variant: 'centered' },
      ],
    },
    {
      slug: 'clases', title: 'Clases', show_in_header: true, show_in_footer: true, header_order: 2, footer_order: 2,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'class_schedule', section_variant: 'grid' },
        { section_type: 'trainers', section_variant: 'grid' },
      ],
    },
    {
      slug: 'entrenadores', title: 'Entrenadores', show_in_header: true, show_in_footer: true, header_order: 3, footer_order: 3,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'trainers', section_variant: 'grid' },
      ],
    },
    nosotrosPage('fullscreen', 'centered'),
    contactoPage('minimal', 'split', 'full_width'),
  ],
}

const gym_wellness: TemplatePreset = {
  id: 'gym_wellness',
  name: 'Gym Wellness',
  description: 'Claro, zen, yoga/pilates, tonos suaves',
  business_type: 'gym',
  is_default: false,
  theme: {
    primary_color: '#7C9A92',
    secondary_color: '#F5F0EB',
    theme_mode: 'light',
  },
  fonts: { heading: 'Quicksand', body: 'Nunito' },
  header_style: 'minimal',
  footer_style: 'centered',
  header_cta_text: 'Reservar Clase',
  header_cta_url: '/servicios',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'split' },
        { section_type: 'text_block', section_variant: 'centered' },
        { section_type: 'class_schedule', section_variant: 'grid' },
        { section_type: 'trainers', section_variant: 'carousel' },
        { section_type: 'gallery', section_variant: 'masonry' },
        { section_type: 'testimonials', section_variant: 'quotes' },
        { section_type: 'membership_plans', section_variant: 'pricing_table' },
        { section_type: 'newsletter', section_variant: 'simple' },
      ],
    },
    {
      slug: 'membresias', title: 'Membresías', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'membership_plans', section_variant: 'pricing_table' },
        { section_type: 'faq', section_variant: 'simple' },
      ],
    },
    {
      slug: 'clases', title: 'Clases', show_in_header: true, show_in_footer: true, header_order: 2, footer_order: 2,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'class_schedule', section_variant: 'grid' },
      ],
    },
    nosotrosPage('split', 'centered'),
    contactoPage('minimal', 'default', 'embedded'),
  ],
}

const gym_urban: TemplatePreset = {
  id: 'gym_urban',
  name: 'Gym Urban',
  description: 'Callejero, grafiti, crossfit, raw',
  business_type: 'gym',
  is_default: false,
  theme: {
    primary_color: '#FFD600',
    secondary_color: '#212121',
    theme_mode: 'dark',
  },
  fonts: { heading: 'Bebas Neue', body: 'Barlow' },
  header_style: 'default',
  footer_style: 'minimal',
  header_cta_text: 'Unirme',
  header_cta_url: '/productos',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'fullscreen' },
        { section_type: 'gym_features', section_variant: 'icons' },
        { section_type: 'membership_plans', section_variant: 'pricing_table' },
        { section_type: 'transformation', section_variant: 'before_after' },
        { section_type: 'class_schedule', section_variant: 'grid' },
        { section_type: 'gallery', section_variant: 'grid' },
        { section_type: 'testimonials', section_variant: 'grid' },
        { section_type: 'cta', section_variant: 'banner' },
      ],
    },
    {
      slug: 'membresias', title: 'Membresías', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'membership_plans', section_variant: 'pricing_table' },
        { section_type: 'faq', section_variant: 'two_columns' },
      ],
    },
    nosotrosPage('fullscreen', 'left'),
    contactoPage('minimal', 'with_map', 'default'),
  ],
}

const gym_premium: TemplatePreset = {
  id: 'gym_premium',
  name: 'Gym Premium',
  description: 'Boutique fitness, premium, elegante',
  business_type: 'gym',
  is_default: false,
  theme: {
    primary_color: '#B8860B',
    secondary_color: '#1C1C1C',
    theme_mode: 'dark',
  },
  fonts: { heading: 'Cormorant Garamond', body: 'Montserrat' },
  header_style: 'transparent',
  footer_style: 'three_columns',
  header_cta_text: 'Membresía VIP',
  header_cta_url: '/productos',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'video' },
        { section_type: 'text_block', section_variant: 'centered' },
        { section_type: 'membership_plans', section_variant: 'pricing_table' },
        { section_type: 'trainers', section_variant: 'carousel' },
        { section_type: 'gallery', section_variant: 'fullscreen' },
        { section_type: 'testimonials', section_variant: 'minimal' },
        { section_type: 'stats', section_variant: 'inline' },
        { section_type: 'cta', section_variant: 'with_image' },
      ],
    },
    {
      slug: 'membresias', title: 'Membresías', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'membership_plans', section_variant: 'pricing_table' },
        { section_type: 'faq', section_variant: 'accordion' },
      ],
    },
    nosotrosPage('video', 'centered'),
    contactoPage('minimal', 'split', 'embedded'),
  ],
}

// ============================================================
// TRANSPORT TEMPLATES
// ============================================================

const transport_corporate: TemplatePreset = {
  id: 'transport_corporate',
  name: 'Transporte Corporativo',
  description: 'Profesional, confiable, corporativo',
  business_type: 'transport',
  is_default: true,
  theme: {
    primary_color: '#1565C0',
    secondary_color: '#263238',
    theme_mode: 'light',
  },
  fonts: { heading: 'Roboto', body: 'Roboto' },
  header_style: 'default',
  footer_style: 'three_columns',
  show_topbar: true,
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'split' },
        { section_type: 'trip_search', section_variant: 'form' },
        { section_type: 'routes', section_variant: 'cards' },
        { section_type: 'stats', section_variant: 'counters' },
        { section_type: 'fleet_showcase', section_variant: 'grid' },
        { section_type: 'why_choose_us', section_variant: 'icons' },
        { section_type: 'testimonials', section_variant: 'carousel' },
        { section_type: 'partners', section_variant: 'logos' },
        { section_type: 'cta', section_variant: 'banner' },
        { section_type: 'contact_form', section_variant: 'split' },
      ],
    },
    {
      slug: 'servicios', title: 'Servicios', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'services_list', section_variant: 'cards' },
        { section_type: 'cta', section_variant: 'centered' },
      ],
    },
    {
      slug: 'rutas', title: 'Rutas', show_in_header: true, show_in_footer: true, header_order: 2, footer_order: 2,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'routes', section_variant: 'cards' },
        { section_type: 'coverage_map', section_variant: 'static' },
      ],
    },
    {
      slug: 'flota', title: 'Nuestra Flota', show_in_header: true, show_in_footer: true, header_order: 3, footer_order: 3,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'fleet_showcase', section_variant: 'grid' },
      ],
    },
    nosotrosPage('split', 'two_columns'),
    contactoPage('minimal', 'split', 'full_width'),
  ],
}

const transport_dynamic: TemplatePreset = {
  id: 'transport_dynamic',
  name: 'Transporte Dinámico',
  description: 'Moderno, tech-forward, animaciones',
  business_type: 'transport',
  is_default: false,
  theme: {
    primary_color: '#00BCD4',
    secondary_color: '#1A237E',
    theme_mode: 'light',
  },
  fonts: { heading: 'Poppins', body: 'Inter' },
  header_style: 'default',
  footer_style: 'minimal',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'fullscreen' },
        { section_type: 'trip_search', section_variant: 'form' },
        { section_type: 'stats', section_variant: 'inline' },
        { section_type: 'routes', section_variant: 'cards' },
        { section_type: 'fleet_showcase', section_variant: 'grid' },
        { section_type: 'testimonials', section_variant: 'grid' },
        { section_type: 'cta', section_variant: 'with_image' },
      ],
    },
    {
      slug: 'rutas', title: 'Rutas', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'routes', section_variant: 'cards' },
      ],
    },
    nosotrosPage('split', 'left'),
    contactoPage('minimal', 'with_map', 'default'),
  ],
}

const transport_classic: TemplatePreset = {
  id: 'transport_classic',
  name: 'Transporte Clásico',
  description: 'Tradicional, establecido, confiable',
  business_type: 'transport',
  is_default: false,
  theme: {
    primary_color: '#D32F2F',
    secondary_color: '#1B5E20',
    theme_mode: 'light',
  },
  fonts: { heading: 'Merriweather', body: 'Open Sans' },
  header_style: 'centered',
  footer_style: 'default',
  logo_position: 'center',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'slider' },
        { section_type: 'routes', section_variant: 'cards' },
        { section_type: 'fleet_showcase', section_variant: 'grid' },
        { section_type: 'stats', section_variant: 'counters' },
        { section_type: 'testimonials', section_variant: 'quotes' },
        { section_type: 'partners', section_variant: 'logos' },
        { section_type: 'map', section_variant: 'full_width' },
      ],
    },
    {
      slug: 'rutas', title: 'Rutas', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'routes', section_variant: 'cards' },
      ],
    },
    nosotrosPage('fullscreen', 'two_columns'),
    contactoPage('minimal', 'split', 'with_directions'),
  ],
}

const transport_eco: TemplatePreset = {
  id: 'transport_eco',
  name: 'Transporte Eco',
  description: 'Ecológico, verde, sostenible',
  business_type: 'transport',
  is_default: false,
  theme: {
    primary_color: '#43A047',
    secondary_color: '#1B5E20',
    theme_mode: 'light',
  },
  fonts: { heading: 'Nunito', body: 'Nunito' },
  header_style: 'default',
  footer_style: 'three_columns',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'split' },
        { section_type: 'stats', section_variant: 'cards' },
        { section_type: 'routes', section_variant: 'cards' },
        { section_type: 'image_text', section_variant: 'image_right' },
        { section_type: 'fleet_showcase', section_variant: 'grid' },
        { section_type: 'testimonials', section_variant: 'minimal' },
        { section_type: 'newsletter', section_variant: 'simple' },
      ],
    },
    {
      slug: 'rutas', title: 'Rutas', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'routes', section_variant: 'cards' },
      ],
    },
    nosotrosPage('split', 'centered'),
    contactoPage('minimal', 'default', 'embedded'),
  ],
}

// ============================================================
// PARKING TEMPLATES
// ============================================================

const parking_modern: TemplatePreset = {
  id: 'parking_modern',
  name: 'Parking Moderno',
  description: 'Limpio, funcional, orientado a conversión',
  business_type: 'parking',
  is_default: true,
  theme: {
    primary_color: '#2196F3',
    secondary_color: '#37474F',
    theme_mode: 'light',
  },
  fonts: { heading: 'Inter', body: 'Inter' },
  header_style: 'default',
  footer_style: 'default',
  header_cta_text: 'Reservar Espacio',
  header_cta_url: '/reservas',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'split' },
        { section_type: 'parking_zones', section_variant: 'grid' },
        { section_type: 'parking_pricing', section_variant: 'cards' },
        { section_type: 'parking_features', section_variant: 'icons' },
        { section_type: 'stats', section_variant: 'counters' },
        { section_type: 'testimonials', section_variant: 'carousel' },
        { section_type: 'faq', section_variant: 'accordion' },
        { section_type: 'map', section_variant: 'full_width' },
      ],
    },
    {
      slug: 'zonas', title: 'Zonas', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'parking_zones', section_variant: 'grid' },
        { section_type: 'parking_availability', section_variant: 'summary' },
      ],
    },
    {
      slug: 'tarifas', title: 'Tarifas', show_in_header: true, show_in_footer: true, header_order: 2, footer_order: 2,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'parking_pricing', section_variant: 'cards' },
        { section_type: 'parking_pass_plans', section_variant: 'cards' },
        { section_type: 'faq', section_variant: 'accordion' },
        { section_type: 'cta', section_variant: 'centered' },
      ],
    },
    {
      slug: 'servicios', title: 'Servicios', show_in_header: true, show_in_footer: true, header_order: 3, footer_order: 3,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'parking_features', section_variant: 'icons' },
        { section_type: 'services_list', section_variant: 'grid' },
      ],
    },
    nosotrosPage('minimal', 'left'),
    contactoPage('minimal', 'split', 'full_width'),
  ],
}

const parking_tech: TemplatePreset = {
  id: 'parking_tech',
  name: 'Parking Tech',
  description: 'Smart parking, futurista, high-tech',
  business_type: 'parking',
  is_default: false,
  theme: {
    primary_color: '#00E676',
    secondary_color: '#121212',
    theme_mode: 'dark',
  },
  fonts: { heading: 'Space Grotesk', body: 'Inter' },
  header_style: 'default',
  footer_style: 'minimal',
  header_cta_text: 'Reservar',
  header_cta_url: '/reservas',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'fullscreen' },
        { section_type: 'parking_features', section_variant: 'icons' },
        { section_type: 'parking_zones', section_variant: 'grid' },
        { section_type: 'stats', section_variant: 'inline' },
        { section_type: 'parking_pricing', section_variant: 'cards' },
        { section_type: 'testimonials', section_variant: 'minimal' },
        { section_type: 'faq', section_variant: 'two_columns' },
      ],
    },
    {
      slug: 'tarifas', title: 'Tarifas', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'parking_pricing', section_variant: 'cards' },
        { section_type: 'parking_pass_plans', section_variant: 'cards' },
      ],
    },
    nosotrosPage('minimal', 'left'),
    contactoPage('minimal', 'default', 'embedded'),
  ],
}

const parking_urban: TemplatePreset = {
  id: 'parking_urban',
  name: 'Parking Urbano',
  description: 'Urbano, integrado a la ciudad',
  business_type: 'parking',
  is_default: false,
  theme: {
    primary_color: '#FF9800',
    secondary_color: '#424242',
    theme_mode: 'light',
  },
  fonts: { heading: 'Poppins', body: 'Roboto' },
  header_style: 'default',
  footer_style: 'default',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'split' },
        { section_type: 'parking_zones', section_variant: 'grid' },
        { section_type: 'parking_pricing', section_variant: 'cards' },
        { section_type: 'stats', section_variant: 'cards' },
        { section_type: 'testimonials', section_variant: 'grid' },
        { section_type: 'map', section_variant: 'with_directions' },
      ],
    },
    {
      slug: 'tarifas', title: 'Tarifas', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'parking_pricing', section_variant: 'cards' },
        { section_type: 'faq', section_variant: 'simple' },
      ],
    },
    nosotrosPage('split', 'left'),
    contactoPage('minimal', 'with_map', 'default'),
  ],
}

const parking_premium: TemplatePreset = {
  id: 'parking_premium',
  name: 'Parking Premium',
  description: 'VIP, exclusivo, servicios premium',
  business_type: 'parking',
  is_default: false,
  theme: {
    primary_color: '#9C7C38',
    secondary_color: '#1A1A1A',
    theme_mode: 'dark',
  },
  fonts: { heading: 'Playfair Display', body: 'Lato' },
  header_style: 'transparent',
  footer_style: 'centered',
  logo_position: 'center',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'video' },
        { section_type: 'parking_features', section_variant: 'icons' },
        { section_type: 'parking_zones', section_variant: 'grid' },
        { section_type: 'parking_pricing', section_variant: 'cards' },
        { section_type: 'testimonials', section_variant: 'quotes' },
        { section_type: 'stats', section_variant: 'counters' },
        { section_type: 'cta', section_variant: 'with_image' },
      ],
    },
    {
      slug: 'tarifas', title: 'Tarifas', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'parking_pricing', section_variant: 'cards' },
        { section_type: 'parking_pass_plans', section_variant: 'cards' },
        { section_type: 'faq', section_variant: 'accordion' },
      ],
    },
    nosotrosPage('fullscreen', 'centered'),
    contactoPage('minimal', 'split', 'embedded'),
  ],
}

// ============================================================
// SAAS TEMPLATES
// ============================================================

const saas_modern: TemplatePreset = {
  id: 'saas_modern',
  name: 'SaaS Moderno',
  description: 'Clean tech startup, gradientes suaves, ilustraciones',
  business_type: 'saas',
  is_default: true,
  theme: {
    primary_color: '#6366F1',
    secondary_color: '#0F172A',
    theme_mode: 'light',
  },
  fonts: { heading: 'Inter', body: 'Inter' },
  header_style: 'default',
  footer_style: 'three_columns',
  header_cta_text: 'Empezar Gratis',
  header_cta_url: '/auth',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'split' },
        { section_type: 'partners', section_variant: 'logos' },
        { section_type: 'features_grid', section_variant: 'alternating' },
        { section_type: 'stats', section_variant: 'counters' },
        { section_type: 'how_it_works', section_variant: 'steps' },
        { section_type: 'pricing_table', section_variant: 'three_columns' },
        { section_type: 'testimonials', section_variant: 'carousel' },
        { section_type: 'integrations', section_variant: 'logos' },
        { section_type: 'faq', section_variant: 'accordion' },
        { section_type: 'demo_cta', section_variant: 'form' },
      ],
    },
    {
      slug: 'features', title: 'Características', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'features_grid', section_variant: 'alternating' },
        { section_type: 'image_text', section_variant: 'image_right' },
        { section_type: 'image_text', section_variant: 'image_left' },
        { section_type: 'cta', section_variant: 'centered' },
      ],
    },
    {
      slug: 'precios', title: 'Precios', show_in_header: true, show_in_footer: true, header_order: 2, footer_order: 2,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'pricing_table', section_variant: 'three_columns' },
        { section_type: 'faq', section_variant: 'two_columns' },
        { section_type: 'cta', section_variant: 'banner' },
      ],
    },
    {
      slug: 'integraciones', title: 'Integraciones', show_in_header: true, show_in_footer: true, header_order: 3, footer_order: 3,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'integrations', section_variant: 'logos' },
        { section_type: 'cta', section_variant: 'centered' },
      ],
    },
    nosotrosPage('split', 'two_columns'),
    contactoPage('minimal', 'split', 'default'),
  ],
}

const saas_corporate: TemplatePreset = {
  id: 'saas_corporate',
  name: 'SaaS Corporativo',
  description: 'Enterprise, profesional, confiable',
  business_type: 'saas',
  is_default: false,
  theme: {
    primary_color: '#1976D2',
    secondary_color: '#1A237E',
    theme_mode: 'light',
  },
  fonts: { heading: 'Roboto', body: 'Roboto' },
  header_style: 'default',
  footer_style: 'three_columns',
  show_topbar: true,
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'split' },
        { section_type: 'partners', section_variant: 'logos' },
        { section_type: 'features_grid', section_variant: 'alternating' },
        { section_type: 'stats', section_variant: 'cards' },
        { section_type: 'testimonials', section_variant: 'grid' },
        { section_type: 'pricing_table', section_variant: 'three_columns' },
        { section_type: 'faq', section_variant: 'accordion' },
        { section_type: 'demo_cta', section_variant: 'form' },
      ],
    },
    {
      slug: 'features', title: 'Características', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'features_grid', section_variant: 'alternating' },
        { section_type: 'cta', section_variant: 'banner' },
      ],
    },
    {
      slug: 'precios', title: 'Precios', show_in_header: true, show_in_footer: true, header_order: 2, footer_order: 2,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'pricing_table', section_variant: 'three_columns' },
        { section_type: 'faq', section_variant: 'two_columns' },
      ],
    },
    nosotrosPage('split', 'two_columns'),
    contactoPage('minimal', 'split', 'embedded'),
  ],
}

const saas_creative: TemplatePreset = {
  id: 'saas_creative',
  name: 'SaaS Creativo',
  description: 'Creativo, playful, gradientes coloridos',
  business_type: 'saas',
  is_default: false,
  theme: {
    primary_color: '#FF6B6B',
    secondary_color: '#4ECDC4',
    theme_mode: 'light',
  },
  fonts: { heading: 'Poppins', body: 'Nunito' },
  header_style: 'default',
  footer_style: 'minimal',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'fullscreen' },
        { section_type: 'how_it_works', section_variant: 'steps' },
        { section_type: 'features_grid', section_variant: 'alternating' },
        { section_type: 'testimonials', section_variant: 'quotes' },
        { section_type: 'pricing_table', section_variant: 'three_columns' },
        { section_type: 'partners', section_variant: 'carousel' },
        { section_type: 'cta', section_variant: 'with_image' },
      ],
    },
    {
      slug: 'features', title: 'Características', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'features_grid', section_variant: 'alternating' },
      ],
    },
    {
      slug: 'precios', title: 'Precios', show_in_header: true, show_in_footer: true, header_order: 2, footer_order: 2,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'pricing_table', section_variant: 'three_columns' },
        { section_type: 'faq', section_variant: 'simple' },
      ],
    },
    nosotrosPage('split', 'left'),
    contactoPage('minimal', 'default', 'default'),
  ],
}

const saas_minimal: TemplatePreset = {
  id: 'saas_minimal',
  name: 'SaaS Minimal',
  description: 'Ultra minimalista, mucho espacio, elegante',
  business_type: 'saas',
  is_default: false,
  theme: {
    primary_color: '#000000',
    secondary_color: '#FFFFFF',
    theme_mode: 'light',
  },
  fonts: { heading: 'Outfit', body: 'Inter' },
  header_style: 'minimal',
  footer_style: 'centered',
  pages: [
    {
      slug: 'home', title: 'Inicio', show_in_header: true, show_in_footer: false, header_order: 0, footer_order: 0,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'features_grid', section_variant: 'alternating' },
        { section_type: 'image_text', section_variant: 'image_right' },
        { section_type: 'pricing_table', section_variant: 'three_columns' },
        { section_type: 'testimonials', section_variant: 'minimal' },
        { section_type: 'demo_cta', section_variant: 'form' },
      ],
    },
    {
      slug: 'features', title: 'Características', show_in_header: true, show_in_footer: true, header_order: 1, footer_order: 1,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'features_grid', section_variant: 'alternating' },
      ],
    },
    {
      slug: 'precios', title: 'Precios', show_in_header: true, show_in_footer: true, header_order: 2, footer_order: 2,
      sections: [
        { section_type: 'hero', section_variant: 'minimal' },
        { section_type: 'pricing_table', section_variant: 'three_columns' },
        { section_type: 'faq', section_variant: 'simple' },
      ],
    },
    nosotrosPage('minimal', 'centered'),
    contactoPage('minimal', 'default', 'default'),
  ],
}

// ============================================================
// EXPORTS
// ============================================================

export const TEMPLATE_PRESETS: Record<string, TemplatePreset> = {
  // Retail
  retail_modern,
  retail_classic,
  retail_bold,
  retail_elegant,
  // Restaurant
  restaurant_modern,
  restaurant_elegant,
  restaurant_casual,
  restaurant_rustic,
  // Hotel
  hotel_luxury,
  hotel_boutique,
  hotel_minimal,
  hotel_resort,
  // Gym
  gym_power,
  gym_wellness,
  gym_urban,
  gym_premium,
  // Transport
  transport_corporate,
  transport_dynamic,
  transport_classic,
  transport_eco,
  // Parking
  parking_modern,
  parking_tech,
  parking_urban,
  parking_premium,
  // SaaS
  saas_modern,
  saas_corporate,
  saas_creative,
  saas_minimal,
}

/** Obtener un preset por su ID */
export function getTemplatePreset(presetId: string): TemplatePreset | null {
  return TEMPLATE_PRESETS[presetId] || null
}

/** Obtener todos los presets para un tipo de negocio */
export function getPresetsForBusinessType(businessType: string): TemplatePreset[] {
  return Object.values(TEMPLATE_PRESETS).filter(p => p.business_type === businessType)
}

/** Obtener el preset default para un tipo de negocio */
export function getDefaultPreset(businessType: string): TemplatePreset | null {
  return Object.values(TEMPLATE_PRESETS).find(p => p.business_type === businessType && p.is_default) || null
}

/** Obtener preset default por type_id de organización */
export function getDefaultPresetByTypeId(typeId: number): TemplatePreset | null {
  const typeMap: Record<number, string> = {
    1: 'restaurant',
    2: 'hotel',
    3: 'retail',
    4: 'saas',
    5: 'gym',
    6: 'transport',
    7: 'parking',
  }
  const businessType = typeMap[typeId]
  return businessType ? getDefaultPreset(businessType) : null
}
