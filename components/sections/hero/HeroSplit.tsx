'use client'
import { capaPersonalizada, estiloTitulo, OPACIDAD_CAPA_POR_DEFECTO } from '@/lib/website/capaHero'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { HeroBookingWidget } from './HeroBookingWidget'
import { HeroButtons, type HeroButtonItem } from './HeroButtons'
import { ajusteImagen, proporcionImagen, puntoFocal } from '@/lib/website/alturaHero'

function useMedida(url: string | null, ancho: unknown, alto: unknown, activo: boolean): string | null {
  const guardada = proporcionImagen(ancho, alto)
  const [medida, setMedida] = useState<string | null>(guardada)
  useEffect(() => {
    if (!activo) return
    if (guardada) return
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

interface HeroSplitProps {
  content: {
    title?: string
    subtitle?: string
    cta_text?: string
    cta_url?: string
    cta_secondary_text?: string
    cta_secondary_url?: string
    image_url?: string
    image_url_mobile?: string
    // F3.5 — campos nuevos
    content_position?: string
    buttons?: HeroButtonItem[]
  }
  primaryColor?: string
  organization?: any
}

/** Alineación vertical del contenido según content_position. */
function verticalAlignClass(pos: string): string {
  switch (pos) {
    case 'top-left':
    case 'top-center':
    case 'top-right':
      return 'self-start'
    case 'bottom-left':
    case 'bottom-center':
    case 'bottom-right':
      return 'self-end'
    default:
      return 'self-center'
  }
}

export function HeroSplit({ content, primaryColor, organization }: HeroSplitProps) {
  const imageUrl = content.image_url || null
  const imageUrlMobile = content.image_url_mobile || null
  const focal = puntoFocal((content as any).focal_point)
  const fitMovil = ajusteImagen((content as any).image_fit_mobile)
  const altura = (content as any).height
  const alturaMovil = (content as any).mobile_height as string | undefined
  const proporcion = useMedida(
    imageUrl || imageUrlMobile,
    (content as any).image_width,
    (content as any).image_height,
    altura === 'image' || alturaMovil === 'image',
  )
  const claseImagen = `w-full rounded-2xl shadow-lg${fitMovil ? ` object-${fitMovil} md:object-cover` : ''}`
  const estiloImagen: React.CSSProperties = {
    ...(focal ? { objectPosition: focal } : {}),
    ...(altura === 'image' && proporcion ? { aspectRatio: proporcion } : {}),
  }
  const claseCaja = alturaMovil === '60vh'
    ? 'max-md:min-h-[60vh]'
    : alturaMovil === '100vh'
      ? 'max-md:min-h-[100dvh]'
      : alturaMovil === 'auto'
        ? 'max-md:min-h-[50vh]'
        : ''
  const logo = !imageUrl && !imageUrlMobile ? organization?.logo_url : null
  const showTitle = (content as any).show_title !== false
  const showCta = (content as any).show_cta !== false
  const contentPosition = content.content_position || 'middle-center'
  const alignClass = verticalAlignClass(contentPosition)
  // QA 27-oct: con color guardado pero sin opacidad, la opacidad es la del editor (0 = sin capa).
  const capaBase = (content as any).show_overlay === false ? null : capaPersonalizada(content as any, OPACIDAD_CAPA_POR_DEFECTO.split)
  const capaSplit = capaBase && capaBase.opacity > 0 ? capaBase : null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-center py-8 md:py-0 md:min-h-[60vh]">
      <div className={alignClass}>
        {showTitle && content.title && (
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-4 dark:text-white" style={estiloTitulo(content as any)}>{content.title}</h1>
        )}
        {showTitle && content.subtitle && (
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8">{content.subtitle}</p>
        )}
        {((content as any).show_booking_widget ?? organization?.website_settings?.show_hero_booking ?? false) ? (
          <HeroBookingWidget primaryColor={primaryColor || '#3B82F6'} />
        ) : content.buttons && content.buttons.length > 0 ? (
          // F3.5 — repeater de botones
          <HeroButtons
            buttons={content.buttons}
            primaryColor={primaryColor || '#3B82F6'}
            showCta={showCta}
            className="flex-wrap"
          />
        ) : showCta ? (
          <div className="flex flex-wrap gap-4">
            {content.cta_text && content.cta_url && (
              <Link
                href={content.cta_url}
                className="px-8 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
                style={{ backgroundColor: primaryColor }}
              >
                {content.cta_text}
              </Link>
            )}
            {content.cta_secondary_text && content.cta_secondary_url && (
              <Link
                href={content.cta_secondary_url}
                className="px-8 py-3 rounded-lg font-medium border-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                style={{ borderColor: primaryColor, color: primaryColor }}
              >
                {content.cta_secondary_text}
              </Link>
            )}
          </div>
        ) : null}
      </div>
      <div className={`relative order-first md:order-last ${claseCaja}`}>
        {imageUrl || imageUrlMobile ? (
          imageUrlMobile && imageUrlMobile !== imageUrl ? (
            <picture>
              <source media="(max-width: 767px)" srcSet={imageUrlMobile} />
              <img src={imageUrl || imageUrlMobile} alt={content.title || ''} className={claseImagen} style={estiloImagen} loading="eager" />
            </picture>
          ) : (
            <img src={imageUrl || imageUrlMobile || ''} alt={content.title || ''} className={claseImagen} style={estiloImagen} loading="eager" />
          )
        ) : null}
        {(imageUrl || imageUrlMobile) && capaSplit && (
          // Paquete 5-nov D4: capa de color opcional sobre la foto (sin guardar, no hay capa).
          <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl" style={capaSplit} />
        )}
        {imageUrl || imageUrlMobile ? null : logo ? (
          <img src={logo} alt={content.title || ''} className="w-full rounded-2xl shadow-lg" loading="eager" />
        ) : (
          <div className="w-full aspect-square rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${primaryColor}10` }}>
            <span className="text-8xl opacity-30">🏢</span>
          </div>
        )}
      </div>
    </div>
  )
}
