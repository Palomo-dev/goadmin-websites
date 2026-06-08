'use client'

import { CountdownBanner } from '@/components/site/CountdownBanner'

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
}

export function CountdownSection({ content, primaryColor, organization }: CountdownSectionProps) {
  const settings = organization?.website_settings || {}
  
  // Usar config de la sección (content) con fallback a settings globales
  const config = {
    countdown_enabled: true,
    countdown_title: content.title || settings.countdown_title || '¡Oferta por tiempo limitado!',
    countdown_mode: content.mode || settings.countdown_mode || 'daily_reset',
    countdown_end_date: content.end_date || settings.countdown_end_date,
    countdown_timezone: content.timezone || settings.countdown_timezone || 'America/Bogota',
    countdown_reset_hour: content.reset_hour ?? settings.countdown_reset_hour ?? 0,
  }

  return (
    <CountdownBanner
      config={config}
      primaryColor={primaryColor || '#3B82F6'}
      variant={content.variant || 'banner'}
    />
  )
}
