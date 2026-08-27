import Link from 'next/link'
import { HeroBookingWidget } from './HeroBookingWidget'
import { HeroButtons, type HeroButtonItem } from './HeroButtons'

interface HeroVideoProps {
  content: {
    title?: string
    subtitle?: string
    cta_text?: string
    cta_url?: string
    video_url?: string
    image_url?: string
    overlay_opacity?: number
    // F3.5 — campos nuevos
    overlay_color?: string
    buttons?: HeroButtonItem[]
  }
  organization?: any
  primaryColor?: string
}

export function HeroVideo({ content, organization, primaryColor }: HeroVideoProps) {
  // overlay_opacity: si viene del catálogo (0-100) se normaliza; si es heredado (0-1) se respeta
  const rawOpacity = content.overlay_opacity
  const overlayOpacity = rawOpacity != null ? (rawOpacity > 1 ? rawOpacity / 100 : rawOpacity) : 0.6
  const overlayColor = content.overlay_color || '#000000'
  const showCta = (content as any).show_cta !== false

  return (
    <div className="relative min-h-[60vh] md:min-h-[80vh] flex items-center justify-center overflow-hidden">
      {content.video_url ? (
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          poster={content.image_url || undefined}
        >
          <source src={content.video_url} type="video/mp4" />
        </video>
      ) : content.image_url ? (
        <img src={content.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gray-900" />
      )}
      <div className="absolute inset-0" style={{ backgroundColor: overlayColor, opacity: overlayOpacity }} />
      <div className="relative z-10 text-center text-white max-w-4xl mx-auto px-4 sm:px-6">
        {content.title && (
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold leading-tight mb-4">{content.title}</h1>
        )}
        {content.subtitle && (
          <p className="text-lg md:text-xl opacity-90 mb-8 max-w-2xl mx-auto">{content.subtitle}</p>
        )}
        {((content as any).show_booking_widget ?? organization?.website_settings?.show_hero_booking ?? false) ? (
          <div className="mt-6"><HeroBookingWidget primaryColor={primaryColor || '#3B82F6'} /></div>
        ) : content.buttons && content.buttons.length > 0 ? (
          // F3.5 — repeater de botones
          <HeroButtons
            buttons={content.buttons}
            primaryColor={primaryColor || '#3B82F6'}
            showCta={showCta}
            className="justify-center"
          />
        ) : content.cta_text && content.cta_url ? (
          <Link
            href={content.cta_url}
            className="inline-block px-8 py-4 rounded-lg text-white font-medium text-lg hover:opacity-90 transition-opacity"
            style={{ backgroundColor: primaryColor }}
          >
            {content.cta_text}
          </Link>
        ) : null}
      </div>
    </div>
  )
}
