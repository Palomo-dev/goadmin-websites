'use client'

import { useState } from 'react'

interface GalleryFullscreenProps {
  content: Record<string, any>
  primaryColor?: string
}

export function GalleryFullscreen({ content, primaryColor = '#3B82F6' }: GalleryFullscreenProps) {
  const title = content.title
  const images = content.images || []
  const [selected, setSelected] = useState(0)

  if (images.length === 0) return null

  return (
    <section className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        {title && <h2 className="text-3xl font-bold text-center mb-10">{title}</h2>}
        <div className="rounded-xl overflow-hidden aspect-[16/9] bg-gray-100 mb-4">
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
