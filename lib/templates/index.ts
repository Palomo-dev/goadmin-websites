/**
 * Sistema de Templates/Temas Visuales para sitios de organizaciones
 * 
 * Cada template define:
 * - Estilos de layout (header, hero, secciones)
 * - Variantes de componentes
 * - Configuración de tipografía
 */

export interface TemplateConfig {
  id: string
  name: string
  description: string
  preview_image?: string
  
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

export const TEMPLATES: Record<string, TemplateConfig> = {
  modern: {
    id: 'modern',
    name: 'Moderno',
    description: 'Diseño limpio y minimalista con énfasis en imágenes',
    header: {
      style: 'transparent',
      position: 'fixed',
      logo_position: 'left'
    },
    hero: {
      style: 'full',
      overlay: true,
      text_align: 'center',
      height: 'large'
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
    header: {
      style: 'solid',
      position: 'sticky',
      logo_position: 'left'
    },
    hero: {
      style: 'split',
      overlay: false,
      text_align: 'left',
      height: 'medium'
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
    header: {
      style: 'gradient',
      position: 'fixed',
      logo_position: 'center'
    },
    hero: {
      style: 'full',
      overlay: true,
      text_align: 'center',
      height: 'full'
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
    header: {
      style: 'transparent',
      position: 'static',
      logo_position: 'left'
    },
    hero: {
      style: 'minimal',
      overlay: false,
      text_align: 'left',
      height: 'small'
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
  
  restaurant: {
    id: 'restaurant',
    name: 'Restaurante',
    description: 'Optimizado para menús y reservas de restaurantes',
    header: {
      style: 'transparent',
      position: 'fixed',
      logo_position: 'center'
    },
    hero: {
      style: 'video',
      overlay: true,
      text_align: 'center',
      height: 'full'
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
  
  ecommerce: {
    id: 'ecommerce',
    name: 'E-commerce',
    description: 'Diseñado para tiendas online con catálogo de productos',
    header: {
      style: 'solid',
      position: 'sticky',
      logo_position: 'left'
    },
    hero: {
      style: 'split',
      overlay: false,
      text_align: 'left',
      height: 'medium'
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
