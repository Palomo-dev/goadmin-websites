'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HeroBookingWidget } from './HeroBookingWidget'

interface HeroMinimalProps {
  content: {
    title?: string
    subtitle?: string
    cta_text?: string
    cta_url?: string
  }
  organization?: any
  primaryColor?: string
}

function getTitleFromPath(path: string, contentTitle?: string): string {
  // Si hay un título personalizado que no es genérico, usarlo
  if (contentTitle && contentTitle !== 'Productos' && contentTitle !== 'Título') {
    return contentTitle
  }

  // Extraer el slug de la ruta
  const slug = path.split('/')[1] || 'home'

  const titles: Record<string, string> = {
    'productos': 'Nuestros Productos',
    'categorias': 'Categorías',
    'ofertas': 'Ofertas Especiales',
    'contacto': 'Contáctanos',
    'carrito': 'Carrito de Compras',
    'checkout': 'Finalizar Compra',
    'mi-cuenta': 'Mi Cuenta',
    'pedido': 'Detalle del Pedido',
    'servicios': 'Nuestros Servicios',
    'espacios': 'Nuestros Espacios',
    'reservas': 'Reservas',
    'agendar': 'Agendar Cita',
    'cotizar': 'Solicitar Cotización',
    'membresias': 'Membresías',
    'tickets': 'Tickets',
    'pases': 'Pases de Estacionamiento',
    'viajes': 'Viajes Disponibles',
  }

  return titles[slug] || contentTitle || 'Bienvenido'
}

function getSubtitleFromPath(path: string, contentSubtitle?: string): string {
  if (contentSubtitle && contentSubtitle !== 'Explora nuestro catálogo completo') {
    return contentSubtitle
  }

  const slug = path.split('/')[1] || 'home'

  const subtitles: Record<string, string> = {
    'productos': 'Descubre todo lo que tenemos para ti',
    'categorias': 'Explora nuestras categorías de productos',
    'ofertas': 'Aprovecha nuestros mejores descuentos',
    'contacto': 'Estamos aquí para ayudarte',
    'carrito': 'Revisa los productos en tu carrito',
    'checkout': 'Completa tu compra de forma segura',
    'servicios': 'Conoce todos nuestros servicios',
    'espacios': 'Descubre nuestros espacios disponibles',
    'reservas': 'Reserva tu espacio ahora',
    'agendar': 'Programa tu cita con nosotros',
    'cotizar': 'Solicita una cotización personalizada',
    'membresias': 'Elige el plan perfecto para ti',
    'tickets': 'Adquiere tus tickets',
    'pases': 'Obtén tu pase de estacionamiento',
    'viajes': 'Encuentra tu próximo destino',
  }

  return subtitles[slug] || contentSubtitle || ''
}

export function HeroMinimal({ content, organization, primaryColor }: HeroMinimalProps) {
  const pathname = usePathname()
  const showBooking = (content as any).show_booking_widget ?? organization?.website_settings?.show_hero_booking ?? false
  const showTitle = (content as any).show_title !== false
  const showCta = (content as any).show_cta !== false

  const title = getTitleFromPath(pathname, content.title)
  const subtitle = getSubtitleFromPath(pathname, content.subtitle)

  return (
    <div className="text-center py-4 px-4 sm:px-0">
      {showTitle && (
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3" style={{ color: primaryColor }}>
          {title}
        </h1>
      )}
      {showTitle && subtitle && (
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-6">
          {subtitle}
        </p>
      )}
      {showBooking ? (
        <div className="mt-6 max-w-4xl mx-auto">
          <HeroBookingWidget primaryColor={primaryColor || '#3B82F6'} />
        </div>
      ) : showCta && content.cta_text && content.cta_url ? (
        <Link
          href={content.cta_url}
          className="inline-block mt-4 px-8 py-3 rounded-lg text-white font-semibold transition-transform hover:scale-105"
          style={{ backgroundColor: primaryColor || '#8B6914' }}
        >
          {content.cta_text}
        </Link>
      ) : null}
    </div>
  )
}
