/**
 * Sistema de Templates/Temas Visuales para sitios de organizaciones
 * 
 * Cada template define:
 * - Estilos de layout (header, hero, secciones)
 * - Variantes de componentes
 * - Configuración de tipografía
 * - Menú de navegación específico por tipo de negocio
 */

export interface NavItem {
  name: string
  href: string
  icon?: string
}

export interface TemplateConfig {
  id: string
  name: string
  description: string
  preview_image?: string
  businessType?: string
  
  // Navegación específica del tipo de negocio
  navigation: NavItem[]
  
  // Layout
  header: {
    style: 'transparent' | 'solid' | 'gradient'
    position: 'fixed' | 'sticky' | 'static'
    logo_position: 'left' | 'center'
  }
  
  hero: {
    style: 'full' | 'split' | 'minimal' | 'video'
    overlay: boolean
    text_align: 'left' | 'center' | 'right'
    height: 'full' | 'large' | 'medium' | 'small'
    defaultTitle?: string
    defaultSubtitle?: string
    ctaText?: string
  }
  
  sections: {
    style: 'cards' | 'list' | 'grid' | 'masonry'
    spacing: 'compact' | 'normal' | 'spacious'
    background: 'white' | 'gray' | 'alternate'
  }
  
  footer: {
    style: 'simple' | 'detailed' | 'minimal'
    columns: number
  }
  
  // Tipografía
  fonts: {
    heading: string
    body: string
  }
  
  // Bordes y sombras
  borderRadius: 'none' | 'small' | 'medium' | 'large' | 'full'
  shadows: 'none' | 'subtle' | 'medium' | 'strong'
}

// Navegación por defecto
const defaultNavigation: NavItem[] = [
  { name: 'Inicio', href: '/' },
  { name: 'Productos', href: '/productos' },
  { name: 'Servicios', href: '/servicios' },
  { name: 'Nosotros', href: '/nosotros' },
  { name: 'Contacto', href: '/contacto' },
]

export const TEMPLATES: Record<string, TemplateConfig> = {
  // ==========================================
  // TEMPLATES GENÉRICOS
  // ==========================================
  modern: {
    id: 'modern',
    name: 'Moderno',
    description: 'Diseño limpio y minimalista con énfasis en imágenes',
    navigation: defaultNavigation,
    header: {
      style: 'transparent',
      position: 'fixed',
      logo_position: 'left'
    },
    hero: {
      style: 'full',
      overlay: true,
      text_align: 'center',
      height: 'large',
      defaultTitle: 'Bienvenido a nuestro sitio',
      defaultSubtitle: 'Descubre todo lo que tenemos para ti',
      ctaText: 'Conocer más'
    },
    sections: {
      style: 'cards',
      spacing: 'spacious',
      background: 'alternate'
    },
    footer: {
      style: 'detailed',
      columns: 4
    },
    fonts: {
      heading: 'Inter',
      body: 'Inter'
    },
    borderRadius: 'medium',
    shadows: 'subtle'
  },
  
  classic: {
    id: 'classic',
    name: 'Clásico',
    description: 'Elegante y profesional, ideal para negocios tradicionales',
    navigation: defaultNavigation,
    header: {
      style: 'solid',
      position: 'sticky',
      logo_position: 'left'
    },
    hero: {
      style: 'split',
      overlay: false,
      text_align: 'left',
      height: 'medium',
      defaultTitle: 'Experiencia y calidad',
      defaultSubtitle: 'Comprometidos con la excelencia',
      ctaText: 'Contactar'
    },
    sections: {
      style: 'list',
      spacing: 'normal',
      background: 'white'
    },
    footer: {
      style: 'simple',
      columns: 3
    },
    fonts: {
      heading: 'Playfair Display',
      body: 'Lato'
    },
    borderRadius: 'small',
    shadows: 'medium'
  },
  
  bold: {
    id: 'bold',
    name: 'Audaz',
    description: 'Colores vibrantes y tipografía impactante',
    navigation: defaultNavigation,
    header: {
      style: 'gradient',
      position: 'fixed',
      logo_position: 'center'
    },
    hero: {
      style: 'full',
      overlay: true,
      text_align: 'center',
      height: 'full',
      defaultTitle: 'Innovación sin límites',
      defaultSubtitle: 'El futuro comienza aquí',
      ctaText: 'Empezar'
    },
    sections: {
      style: 'grid',
      spacing: 'compact',
      background: 'gray'
    },
    footer: {
      style: 'minimal',
      columns: 2
    },
    fonts: {
      heading: 'Montserrat',
      body: 'Open Sans'
    },
    borderRadius: 'large',
    shadows: 'strong'
  },
  
  minimal: {
    id: 'minimal',
    name: 'Minimalista',
    description: 'Simplicidad extrema, enfoque en contenido',
    navigation: defaultNavigation,
    header: {
      style: 'transparent',
      position: 'static',
      logo_position: 'left'
    },
    hero: {
      style: 'minimal',
      overlay: false,
      text_align: 'left',
      height: 'small',
      defaultTitle: 'Simple y efectivo',
      defaultSubtitle: 'Lo esencial, nada más',
      ctaText: 'Ver más'
    },
    sections: {
      style: 'list',
      spacing: 'spacious',
      background: 'white'
    },
    footer: {
      style: 'minimal',
      columns: 2
    },
    fonts: {
      heading: 'DM Sans',
      body: 'DM Sans'
    },
    borderRadius: 'none',
    shadows: 'none'
  },

  // ==========================================
  // TEMPLATES POR TIPO DE ORGANIZACIÓN
  // ==========================================
  
  // Template para RESTAURANTES (type_id: 1)
  restaurant: {
    id: 'restaurant',
    name: 'Restaurante',
    description: 'Optimizado para menús y reservas de restaurantes',
    businessType: 'restaurant',
    navigation: [
      { name: 'Inicio', href: '/' },
      { name: 'Menú', href: '/productos' },
      { name: 'Reservar', href: '/reservas' },
      { name: 'Galería', href: '/#galeria' },
      { name: 'Nosotros', href: '/nosotros' },
      { name: 'Contacto', href: '/contacto' },
    ],
    header: {
      style: 'transparent',
      position: 'fixed',
      logo_position: 'center'
    },
    hero: {
      style: 'video',
      overlay: true,
      text_align: 'center',
      height: 'full',
      defaultTitle: 'Una experiencia gastronómica única',
      defaultSubtitle: 'Sabores que conquistan, momentos que perduran',
      ctaText: 'Reservar Mesa'
    },
    sections: {
      style: 'masonry',
      spacing: 'normal',
      background: 'alternate'
    },
    footer: {
      style: 'detailed',
      columns: 3
    },
    fonts: {
      heading: 'Cormorant Garamond',
      body: 'Poppins'
    },
    borderRadius: 'small',
    shadows: 'subtle'
  },
  
  // Template para HOTELES (type_id: 2)
  hotel: {
    id: 'hotel',
    name: 'Hotel',
    description: 'Diseñado para hoteles y alojamientos',
    businessType: 'hotel',
    navigation: [
      { name: 'Inicio', href: '/' },
      { name: 'Habitaciones', href: '/productos' },
      { name: 'Reservar', href: '/reservas' },
      { name: 'Servicios', href: '/servicios' },
      { name: 'Galería', href: '/#galeria' },
      { name: 'Contacto', href: '/contacto' },
    ],
    header: {
      style: 'transparent',
      position: 'fixed',
      logo_position: 'left'
    },
    hero: {
      style: 'full',
      overlay: true,
      text_align: 'center',
      height: 'full',
      defaultTitle: 'Tu hogar lejos de casa',
      defaultSubtitle: 'Confort, elegancia y servicio excepcional',
      ctaText: 'Reservar Ahora'
    },
    sections: {
      style: 'cards',
      spacing: 'spacious',
      background: 'white'
    },
    footer: {
      style: 'detailed',
      columns: 4
    },
    fonts: {
      heading: 'Playfair Display',
      body: 'Lato'
    },
    borderRadius: 'medium',
    shadows: 'medium'
  },
  
  // Template para RETAIL/TIENDAS (type_id: 3)
  retail: {
    id: 'retail',
    name: 'Tienda',
    description: 'Diseñado para tiendas y comercios',
    businessType: 'retail',
    navigation: [
      { name: 'Inicio', href: '/' },
      { name: 'Productos', href: '/productos' },
      { name: 'Categorías', href: '/#categorias' },
      { name: 'Ofertas', href: '/#ofertas' },
      { name: 'Nosotros', href: '/nosotros' },
      { name: 'Contacto', href: '/contacto' },
    ],
    header: {
      style: 'solid',
      position: 'sticky',
      logo_position: 'left'
    },
    hero: {
      style: 'split',
      overlay: false,
      text_align: 'left',
      height: 'medium',
      defaultTitle: 'Descubre nuestra colección',
      defaultSubtitle: 'Los mejores productos al mejor precio',
      ctaText: 'Ver Productos'
    },
    sections: {
      style: 'grid',
      spacing: 'compact',
      background: 'white'
    },
    footer: {
      style: 'detailed',
      columns: 4
    },
    fonts: {
      heading: 'Rubik',
      body: 'Rubik'
    },
    borderRadius: 'medium',
    shadows: 'medium'
  },
  
  // Template para SAAS (type_id: 4)
  saas: {
    id: 'saas',
    name: 'SaaS',
    description: 'Diseñado para empresas de software',
    businessType: 'saas',
    navigation: [
      { name: 'Inicio', href: '/' },
      { name: 'Funcionalidades', href: '/#funcionalidades' },
      { name: 'Planes', href: '/productos' },
      { name: 'Nosotros', href: '/nosotros' },
      { name: 'Blog', href: '/blog' },
      { name: 'Contacto', href: '/contacto' },
    ],
    header: {
      style: 'solid',
      position: 'sticky',
      logo_position: 'left'
    },
    hero: {
      style: 'split',
      overlay: false,
      text_align: 'left',
      height: 'large',
      defaultTitle: 'Potencia tu negocio',
      defaultSubtitle: 'La solución que tu empresa necesita',
      ctaText: 'Probar Gratis'
    },
    sections: {
      style: 'cards',
      spacing: 'spacious',
      background: 'alternate'
    },
    footer: {
      style: 'detailed',
      columns: 4
    },
    fonts: {
      heading: 'Inter',
      body: 'Inter'
    },
    borderRadius: 'large',
    shadows: 'subtle'
  },
  
  // Template para GIMNASIOS (type_id: 5)
  gym: {
    id: 'gym',
    name: 'Gimnasio',
    description: 'Diseñado para gimnasios y centros deportivos',
    businessType: 'gym',
    navigation: [
      { name: 'Inicio', href: '/' },
      { name: 'Membresías', href: '/productos' },
      { name: 'Clases', href: '/servicios' },
      { name: 'Horarios', href: '/#horarios' },
      { name: 'Entrenadores', href: '/#entrenadores' },
      { name: 'Contacto', href: '/contacto' },
    ],
    header: {
      style: 'gradient',
      position: 'fixed',
      logo_position: 'left'
    },
    hero: {
      style: 'full',
      overlay: true,
      text_align: 'center',
      height: 'full',
      defaultTitle: 'Transforma tu vida',
      defaultSubtitle: 'Alcanza tus metas con nosotros',
      ctaText: 'Inscribirme'
    },
    sections: {
      style: 'cards',
      spacing: 'normal',
      background: 'gray'
    },
    footer: {
      style: 'detailed',
      columns: 3
    },
    fonts: {
      heading: 'Montserrat',
      body: 'Open Sans'
    },
    borderRadius: 'large',
    shadows: 'strong'
  },
  
  // Template para TRANSPORTE (type_id: 6)
  transport: {
    id: 'transport',
    name: 'Transporte',
    description: 'Diseñado para empresas de transporte',
    businessType: 'transport',
    navigation: [
      { name: 'Inicio', href: '/' },
      { name: 'Rutas', href: '/productos' },
      { name: 'Horarios', href: '/#horarios' },
      { name: 'Tarifas', href: '/#tarifas' },
      { name: 'Reservar', href: '/reservas' },
      { name: 'Contacto', href: '/contacto' },
    ],
    header: {
      style: 'solid',
      position: 'sticky',
      logo_position: 'left'
    },
    hero: {
      style: 'split',
      overlay: false,
      text_align: 'left',
      height: 'medium',
      defaultTitle: 'Viaja con nosotros',
      defaultSubtitle: 'Seguridad, comodidad y puntualidad',
      ctaText: 'Comprar Pasaje'
    },
    sections: {
      style: 'list',
      spacing: 'normal',
      background: 'white'
    },
    footer: {
      style: 'detailed',
      columns: 3
    },
    fonts: {
      heading: 'Rubik',
      body: 'Open Sans'
    },
    borderRadius: 'medium',
    shadows: 'medium'
  },
  
  // Template para PARQUEADEROS (type_id: 7)
  parking: {
    id: 'parking',
    name: 'Parqueadero',
    description: 'Diseñado para estacionamientos y parqueaderos',
    businessType: 'parking',
    navigation: [
      { name: 'Inicio', href: '/' },
      { name: 'Tarifas', href: '/productos' },
      { name: 'Ubicación', href: '/#ubicacion' },
      { name: 'Servicios', href: '/servicios' },
      { name: 'Reservar', href: '/reservas' },
      { name: 'Contacto', href: '/contacto' },
    ],
    header: {
      style: 'solid',
      position: 'sticky',
      logo_position: 'left'
    },
    hero: {
      style: 'minimal',
      overlay: false,
      text_align: 'left',
      height: 'medium',
      defaultTitle: 'Estacionamiento seguro',
      defaultSubtitle: 'Tu vehículo en las mejores manos',
      ctaText: 'Reservar Espacio'
    },
    sections: {
      style: 'cards',
      spacing: 'normal',
      background: 'white'
    },
    footer: {
      style: 'simple',
      columns: 3
    },
    fonts: {
      heading: 'Inter',
      body: 'Inter'
    },
    borderRadius: 'medium',
    shadows: 'subtle'
  },

  // Template legacy para e-commerce (alias de retail)
  ecommerce: {
    id: 'ecommerce',
    name: 'E-commerce',
    description: 'Diseñado para tiendas online con catálogo de productos',
    businessType: 'retail',
    navigation: [
      { name: 'Inicio', href: '/' },
      { name: 'Tienda', href: '/productos' },
      { name: 'Categorías', href: '/#categorias' },
      { name: 'Ofertas', href: '/#ofertas' },
      { name: 'Nosotros', href: '/nosotros' },
      { name: 'Contacto', href: '/contacto' },
    ],
    header: {
      style: 'solid',
      position: 'sticky',
      logo_position: 'left'
    },
    hero: {
      style: 'split',
      overlay: false,
      text_align: 'left',
      height: 'medium',
      defaultTitle: 'Compra online fácil',
      defaultSubtitle: 'Envío a todo el país',
      ctaText: 'Comprar Ahora'
    },
    sections: {
      style: 'grid',
      spacing: 'compact',
      background: 'white'
    },
    footer: {
      style: 'detailed',
      columns: 4
    },
    fonts: {
      heading: 'Rubik',
      body: 'Rubik'
    },
    borderRadius: 'medium',
    shadows: 'medium'
  }
}

export function getTemplate(templateId: string): TemplateConfig {
  return TEMPLATES[templateId] || TEMPLATES.modern
}

export function getAllTemplates(): TemplateConfig[] {
  return Object.values(TEMPLATES)
}

/**
 * Obtiene el template recomendado según el tipo de organización
 * @param typeId ID del tipo de organización (de la tabla organization_types)
 * @returns Template configurado para ese tipo de negocio
 */
export function getTemplateByBusinessType(typeId: number | null): TemplateConfig {
  const typeMap: Record<number, string> = {
    1: 'restaurant',
    2: 'hotel',
    3: 'retail',
    4: 'saas',
    5: 'gym',
    6: 'transport',
    7: 'parking'
  }
  
  const templateId = typeId ? typeMap[typeId] : 'modern'
  return TEMPLATES[templateId] || TEMPLATES.modern
}

/**
 * Obtiene la navegación apropiada según el tipo de organización o template
 * @param organization Organización con sus settings
 * @returns Array de items de navegación
 */
export function getNavigationForOrganization(
  typeId: number | null,
  templateId?: string
): NavItem[] {
  // Si hay un template específico configurado, usarlo
  if (templateId && TEMPLATES[templateId]) {
    return TEMPLATES[templateId].navigation
  }
  
  // Si no, usar el template según el tipo de organización
  const template = getTemplateByBusinessType(typeId)
  return template.navigation
}
