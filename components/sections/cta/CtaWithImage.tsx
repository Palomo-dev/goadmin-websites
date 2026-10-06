'use client'

import { BOTON_PRIMARIO } from '@/lib/website/botonSitio'

interface CtaWithImageProps {
  content: Record<string, any>
  primaryColor?: string
}

export function CtaWithImage({ content, primaryColor = '#3B82F6' }: CtaWithImageProps) {
  const { title, subtitle, cta_text, cta_url, image_url } = content

  return (
    <section className="relative py-24 px-4 overflow-hidden">
      {image_url && (
        <img src={image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative max-w-3xl mx-auto text-center text-white">
        {title && <h2 className="text-3xl md:text-4xl font-bold mb-4">{title}</h2>}
        {subtitle && <p className="text-lg mb-8 opacity-90">{subtitle}</p>}
        {cta_text && cta_url && (
          <a href={cta_url} {...BOTON_PRIMARIO} className="inline-block px-8 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: primaryColor }}>
            {cta_text}
          </a>
        )}
      </div>
    </section>
  )
}
