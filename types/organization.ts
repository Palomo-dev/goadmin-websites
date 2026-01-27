import type { Organization, WebsiteSettings, OrganizationType } from './database'

// Contexto de la organización para pasar a componentes
export interface OrganizationContext {
  organization: Organization
  settings: WebsiteSettings | null
  businessType: BusinessTypeConfig
}

// Configuración específica por tipo de negocio
export interface BusinessTypeConfig {
  type: string
  name: string
  icon: string
  features: string[]
  primaryAction: {
    label: string
    type: 'reservation' | 'order' | 'appointment' | 'membership' | 'ticket' | 'contact' | 'booking'
  }
  sections: string[]
}

// Configuraciones por tipo de negocio
export const BUSINESS_TYPE_CONFIGS: Record<string, BusinessTypeConfig> = {
  restaurant: {
    type: 'restaurant',
    name: 'Restaurante',
    icon: '🍽️',
    features: ['menu', 'reservations', 'delivery', 'takeout'],
    primaryAction: { label: 'Reservar Mesa', type: 'reservation' },
    sections: ['menu', 'gallery', 'testimonials', 'contact', 'hours']
  },
  hotel: {
    type: 'hotel',
    name: 'Hotel',
    icon: '🏨',
    features: ['rooms', 'reservations', 'amenities', 'services'],
    primaryAction: { label: 'Reservar Habitación', type: 'reservation' },
    sections: ['rooms', 'amenities', 'gallery', 'testimonials', 'contact']
  },
  retail: {
    type: 'retail',
    name: 'Tienda',
    icon: '🛍️',
    features: ['products', 'cart', 'checkout', 'categories'],
    primaryAction: { label: 'Ver Productos', type: 'order' },
    sections: ['products', 'categories', 'gallery', 'testimonials', 'contact']
  },
  saas: {
    type: 'saas',
    name: 'SaaS',
    icon: '💻',
    features: ['pricing', 'features', 'demo', 'contact'],
    primaryAction: { label: 'Solicitar Demo', type: 'contact' },
    sections: ['features', 'pricing', 'testimonials', 'faq', 'contact']
  },
  gym: {
    type: 'gym',
    name: 'Gimnasio',
    icon: '💪',
    features: ['memberships', 'classes', 'trainers', 'schedule'],
    primaryAction: { label: 'Inscribirse', type: 'membership' },
    sections: ['memberships', 'classes', 'trainers', 'gallery', 'contact']
  },
  transport: {
    type: 'transport',
    name: 'Transporte',
    icon: '🚌',
    features: ['routes', 'tickets', 'schedules', 'booking'],
    primaryAction: { label: 'Comprar Pasaje', type: 'ticket' },
    sections: ['routes', 'schedules', 'tickets', 'contact']
  },
  parking: {
    type: 'parking',
    name: 'Parqueadero',
    icon: '🅿️',
    features: ['spaces', 'rates', 'booking', 'monthly'],
    primaryAction: { label: 'Reservar Espacio', type: 'booking' },
    sections: ['rates', 'availability', 'location', 'contact']
  }
}

// Obtener configuración por tipo de negocio
export function getBusinessTypeConfig(typeId: number | null): BusinessTypeConfig {
  const typeMap: Record<number, string> = {
    1: 'restaurant',
    2: 'hotel',
    3: 'retail',
    4: 'saas',
    5: 'gym',
    6: 'transport',
    7: 'parking'
  }
  
  const typeName = typeId ? typeMap[typeId] : 'retail'
  return BUSINESS_TYPE_CONFIGS[typeName] || BUSINESS_TYPE_CONFIGS.retail
}

// Colores por defecto para cada tipo de negocio
export const DEFAULT_COLORS: Record<string, { primary: string; secondary: string }> = {
  restaurant: { primary: '#EF4444', secondary: '#F97316' },
  hotel: { primary: '#8B5CF6', secondary: '#6366F1' },
  retail: { primary: '#10B981', secondary: '#14B8A6' },
  saas: { primary: '#3B82F6', secondary: '#6366F1' },
  gym: { primary: '#F59E0B', secondary: '#EF4444' },
  transport: { primary: '#06B6D4', secondary: '#3B82F6' },
  parking: { primary: '#6366F1', secondary: '#8B5CF6' }
}
