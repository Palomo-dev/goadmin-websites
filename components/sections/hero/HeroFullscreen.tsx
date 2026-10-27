'use client'
import { estiloTitulo, OPACIDAD_CAPA_POR_DEFECTO } from '@/lib/website/capaHero'

import { useEffect, useId, useState } from 'react'
import { heroSolapa, RESPALDO_HEADER_PX } from '@/lib/website/espacioHeader'
import { HeroBookingWidget } from './HeroBookingWidget'
import { HeroButtons, type HeroButtonItem } from './HeroButtons'
import { ajusteImagen, cssAltura, planAlturaPortada, proporcionImagen, puntoFocal } from '@/lib/website/alturaHero'

function useMedida(url: string | null, ancho: unknown, alto: unknown, activo: boolean): string | null {
  const guardada = proporcionImagen(ancho, alto)
  const [medida, setMedida] = useState<string | null>(guardada)
  useEffect(() => {
    if (!activo) return
    if (guardada) {
      setMedida(guardada)
      return
    }
    if (!url) return
    let vivo = true
    const img = new window.Image()
    img.onload = () => {
      if (vivo && img.naturalWidth > 0 && img.naturalHeight > 0) setMedida(`${img.naturalWidth} / ${img.naturalHeight}`)
    }
    img.src = url
    return () => { vivo = false }
  }, [activo, guardada, url])
  return guardada || medida
}

interface HeroFullscreenProps {
  content: {
    title?: string
    subtitle?: string
    cta_text?: string
    cta_url?: string
    image_url?: string | null
    image_url_mobile?: string | null
    // F3.2 — campos nuevos del catálogo
    height?: string
    mobile_height?: string
    image_fit_mobile?: string
    focal_point?: string
    image_width?: number
    image_height?: number
    image_width_mobile?: number
    image_height_mobile?: number
    custom_height?: number
    overlay_opacity?: number
    overlay_color?: string
    content_position?: string
    text_align?: 'left' | 'center' | 'right'
    buttons?: HeroButtonItem[]
  }
  organization: any
  primaryColor?: string
}

// ============================================================
// Helpers de posición (F3.2)
// ============================================================

/** Convierte content_position (grilla 3×3) en clases de flex. */
function positionClasses(pos: string): string {
  switch (pos) {
    case 'top-left':
      return 'items-start justify-start'
    case 'top-center':
      return 'items-start justify-center'
    case 'top-right':
      return 'items-start justify-end'
    case 'middle-left':
      return 'items-center justify-start'
    case 'middle-right':
      return 'items-center justify-end'
    case 'bottom-left':
      return 'items-end justify-start'
    case 'bottom-center':
      return 'items-end justify-center'
    case 'bottom-right':
      return 'items-end justify-end'
    // middle-center (default)
    default:
      return 'items-center justify-center'
  }
}

/** Convierte text_align en clases. */
function textAlignClass(align?: string): string {
  switch (align) {
    case 'left':
      return 'text-left'
    case 'right':
      return 'text-right'
    default:
      return 'text-center'
  }
}

export function HeroFullscreen({ content, organization, primaryColor }: HeroFullscreenProps) {
  const title = content.title || organization.name
  const subtitle = content.subtitle || organization.description || ''
  const ctaText = content.cta_text || 'Contáctanos'
  const ctaUrl = content.cta_url || '/contacto'
  const imageUrl = content.image_url || null
  const imageUrlMobile = content.image_url_mobile || null
  const showBooking = (content as any).show_booking_widget ?? organization.website_settings?.show_hero_booking ?? false
  const showOverlay = (content as any).show_overlay !== false
  const showTitle = (content as any).show_title !== false
  const showCta = (content as any).show_cta !== false
  const overlapHeader = heroSolapa(organization?.website_settings, (content as any).overlap_header)

  // F3.2 — campos nuevos con defaults que preservan el aspecto actual
  const height = (content as any).height || 'auto'
  const mobileHeight = (content as any).mobile_height
  const customHeight = Number((content as any).custom_height) || 0
  const overlayOpacity = content.overlay_opacity != null ? content.overlay_opacity / 100 : null
  const overlayColor = content.overlay_color || primaryColor || '#1A1A2E'
  const contentPosition = content.content_position || 'middle-center'
  const textAlign = content.text_align || 'center'
  const buttons = content.buttons

  // El header transparente queda fijo encima. El hero no sube con margen negativo:
  // reserva el alto medido para que el texto no quede tapado.
  const overlapStyle: React.CSSProperties = overlapHeader
    ? { paddingTop: `var(--header-h, ${RESPALDO_HEADER_PX}px)` }
    : {}

  // Altura: si es custom, usar style; si no, clase. Sin claves nuevas, la clase es la de hoy.
  const heightStyle: React.CSSProperties =
    height === 'custom' && customHeight > 0 ? { minHeight: `${customHeight}px` } : {}
  const focal = puntoFocal((content as any).focal_point)
  const fitMovil = ajusteImagen((content as any).image_fit_mobile)
  const quiereMedida = height === 'image' || mobileHeight === 'image'
  const proporcionEsc = useMedida(
    imageUrl || imageUrlMobile,
    (content as any).image_width,
    (content as any).image_height,
    quiereMedida && height === 'image',
  )
  const proporcionMov = useMedida(
    imageUrlMobile || imageUrl,
    (content as any).image_width_mobile ?? (content as any).image_width,
    (content as any).image_height_mobile ?? (content as any).image_height,
    quiereMedida && mobileHeight === 'image',
  )
  const plan = planAlturaPortada(height, mobileHeight, showBooking, proporcionEsc, proporcionMov)
  const idAltura = `hero-h-${useId().replace(/:/g, '')}`
  const cssAlturaHero = cssAltura(idAltura, plan)
  const bookingHeightClass = plan.clase
  const claseFoto = fitMovil ? `h-full w-full object-${fitMovil} md:object-cover` : 'w-full h-full object-cover'
  const estiloFoto: React.CSSProperties = focal ? { objectPosition: focal } : {}

  const pos = positionClasses(contentPosition)
  const alignClass = textAlignClass(textAlign)
  return (
    <div
      className={`relative ${idAltura} ${bookingHeightClass} flex ${pos} text-white`}
      style={{ ...overlapStyle, ...heightStyle }}
    >
      {cssAlturaHero ? <style>{cssAlturaHero}</style> : null}
      {(imageUrl || imageUrlMobile) && (
        <>
          {imageUrlMobile && imageUrlMobile !== imageUrl ? (
            <picture className="absolute inset-0 w-full h-full">
              <source media="(max-width: 767px)" srcSet={imageUrlMobile} />
              <img src={imageUrl || imageUrlMobile} alt="" className={claseFoto} style={estiloFoto} />
            </picture>
          ) : fitMovil ? (
            <img
              src={imageUrl || imageUrlMobile || ''}
              alt=""
              className={`absolute inset-0 ${claseFoto}`}
              style={estiloFoto}
            />
          ) : (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${imageUrl || imageUrlMobile})`,
                ...(focal ? { backgroundPosition: focal } : {}),
              }}
            />
          )}
        </>
      )}
      {showOverlay && (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: overlayColor,
            // Si overlay_opacity está definido, usarlo; si no, preservar 0.7 con imagen / 1 sin imagen (heredado)
            opacity: overlayOpacity != null ? overlayOpacity : imageUrl || imageUrlMobile ? OPACIDAD_CAPA_POR_DEFECTO.fullscreen / 100 : 1,
          }}
        />
      )}
      <div className={`relative z-10 ${showBooking ? 'max-w-4xl' : 'max-w-3xl'} mx-auto px-4 sm:px-6 py-8 ${alignClass}`}>
        {showTitle && (
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight" style={estiloTitulo(content as any)}>
            {title}
          </h1>
        )}
        {showTitle && subtitle && (
          <p className="text-lg md:text-xl mb-8 opacity-90">
            {subtitle}
          </p>
        )}

        {showBooking ? (
          <HeroBookingWidget primaryColor={primaryColor || '#3B82F6'} />
        ) : (
          <HeroButtons
            buttons={buttons}
            ctaText={ctaText}
            ctaUrl={ctaUrl}
            primaryColor={primaryColor || '#8B6914'}
            showCta={showCta}
            layout={alignClass === 'text-center' ? 'row' : 'row'}
            className={alignClass === 'text-center' ? 'justify-center' : alignClass === 'text-left' ? 'justify-start' : 'justify-end'}
          />
        )}
      </div>
    </div>
  )
}
