/**
 * Thin wrapper sobre presets.ts
 * 
 * Provee TemplateConfig (navigation + fonts) derivado de los presets default.
 * Los consumidores (SiteHeader, SiteFooter, OrganizationLayout, get-org-context)
 * importan desde aquí para obtener navegación fallback y fuentes por tipo.
 */

import {
  getDefaultPresetByTypeId,
  getTemplatePreset,
  TEMPLATE_PRESETS,
  type NavItem,
  type TemplatePreset,
} from './presets'

// Re-export NavItem para consumidores existentes
export type { NavItem }

export interface TemplateConfig {
  id: string
  name: string
  description: string
  businessType?: string
  navigation: NavItem[]
  fonts: {
    heading: string
    body: string
  }
}

/** Convierte un TemplatePreset a TemplateConfig (subset ligero) */
function presetToConfig(preset: TemplatePreset): TemplateConfig {
  return {
    id: preset.id,
    name: preset.name,
    description: preset.description,
    businessType: preset.business_type,
    navigation: preset.navigation,
    fonts: preset.fonts,
  }
}

// Config default (fallback genérico)
const defaultConfig: TemplateConfig = {
  id: 'modern',
  name: 'Moderno',
  description: 'Diseño limpio y minimalista',
  navigation: [
    { name: 'Inicio', href: '/' },
    { name: 'Productos', href: '/productos' },
    { name: 'Servicios', href: '/servicios' },
    { name: 'Nosotros', href: '/nosotros' },
    { name: 'Contacto', href: '/contacto' },
  ],
  fonts: { heading: 'Inter', body: 'Inter' },
}

/**
 * Obtiene TemplateConfig por ID de preset (ej: 'retail_modern', 'hotel_luxury')
 * o por tipo genérico (ej: 'restaurant', 'hotel').
 * Fallback: config default.
 */
export function getTemplate(templateId: string): TemplateConfig {
  // Buscar preset directo por ID
  const preset = getTemplatePreset(templateId)
  if (preset) return presetToConfig(preset)

  // Buscar preset default por business_type
  const byType = Object.values(TEMPLATE_PRESETS).find(
    p => p.business_type === templateId && p.is_default
  )
  if (byType) return presetToConfig(byType)

  return defaultConfig
}

/** Obtiene TemplateConfig por type_id de organización */
export function getTemplateByBusinessType(typeId: number | null): TemplateConfig {
  if (!typeId) return defaultConfig
  const preset = getDefaultPresetByTypeId(typeId)
  return preset ? presetToConfig(preset) : defaultConfig
}
