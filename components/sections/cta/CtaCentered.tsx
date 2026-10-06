import Link from 'next/link'
import { BOTON_PRIMARIO } from '@/lib/website/botonSitio'

interface CtaCenteredProps {
  content: {
    title?: string
    subtitle?: string
    cta_text?: string
    cta_url?: string
  }
  primaryColor?: string
}

export function CtaCentered({ content, primaryColor }: CtaCenteredProps) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold mb-4 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-lg opacity-90 mb-8">{content.subtitle}</p>
      )}
      {content.cta_text && (
        <Link
          href={content.cta_url || '#'}
          {...BOTON_PRIMARIO}
          className="inline-block px-8 py-3 rounded-lg text-lg font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: primaryColor || '#8B6914' }}
        >
          {content.cta_text}
        </Link>
      )}
    </div>
  )
}
