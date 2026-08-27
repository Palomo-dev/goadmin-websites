'use client'

import { useState } from 'react'

/** Claves de content que este componente lee (F0.6 — manifiesto editor ↔ sitio). */
export const CONTENT_KEYS = ['title', 'images'] as const

interface GalleryFullscreenProps {
  content: Record<string, any>
  primaryColor?: string
}

export function GalleryFullscreen({ content, primaryColor = '#3B82F6' }: GalleryFullscreenProps) {
  const title = content.title
  // F2.2: fallback content.items para secciones guardadas antes de la migración
  const images = content.images ?? content.items ?? []
  const [selected, setSelected] = useState(0)

  if (images.length === 0) return null

  return (
    <section className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        {title && <h2 className="text-3xl font-bold text-center mb-10 text-gray-900 dark:text-white">{title}</h2>}
        <div className="rounded-xl overflow-hidden aspect-[16/9] bg-gray-100 dark:bg-gray-700 mb-4">
          <img src={images[selected]?.url} alt={images[selected]?.alt || ''} className="w-full h-full object-cover" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((img: any, i: number) => (
            <button key={i} onClick={() => setSelected(i)} className="w-20 h-14 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all" style={{ borderColor: i === selected ? primaryColor : 'transparent' }}>
              <img src={img.url} alt={img.alt || ''} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
