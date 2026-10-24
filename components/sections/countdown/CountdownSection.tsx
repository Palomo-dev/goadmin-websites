'use client'

import { CountdownBanner } from '@/components/site/CountdownBanner'
import { ContadoresDe } from '@/components/site/ContadorPublico'
import { contadoresEn, type ConversionSitio } from '@/lib/website/conversion'

interface CountdownSectionProps {
  content: {
    title?: string
    mode?: 'daily_reset' | 'custom'
    end_date?: string
    timezone?: string
    reset_hour?: number
    variant?: 'banner' | 'inline' | 'compact'
  }
  primaryColor?: string
  organization?: any
  sectionVariant?: string
}

export function CountdownSection({ content, primaryColor, organization, sectionVariant }: CountdownSectionProps) {
  const settings = organization?.website_settings || {}
  if (contadoresEn((settings as { conversion?: ConversionSitio }).conversion, 'seccion')?.length && !content.mode && !content.end_date && !content.title) {
    return <ContadoresDe settings={settings} ubicacion="seccion" primaryColor={primaryColor || '#3B82F6'} variante="banner" />
  }
  
  // Usar config de la sección (content) con fallback a settings globales
  const config = {
    countdown_enabled: true,
    countdown_title: content.title || settings.countdown_title || '¡Oferta por tiempo limitado!',
    countdown_mode: content.mode || settings.countdown_mode || 'daily_reset',
    countdown_end_date: content.end_date || settings.countdown_end_date,
    countdown_timezone: content.timezone || settings.countdown_timezone || 'America/Bogota',
    countdown_reset_hour: content.reset_hour ?? settings.countdown_reset_hour ?? 0,
  }

  // sectionVariant viene del page builder (section.section_variant)
  // "banner" en sección de página = "full" (grande y llamativo)
  // "banner" en header = barra delgada (se usa directo desde OrganizationLayout)
  const variantMap: Record<string, 'full' | 'banner' | 'inline' | 'compact'> = {
    banner: 'full',
    inline: 'inline',
    compact: 'compact',
  }
  const variant = variantMap[sectionVariant || ''] || content.variant || 'full'

  return (
    <CountdownBanner
      config={config}
      primaryColor={primaryColor || '#3B82F6'}
      variant={variant}
    />
  )
}
