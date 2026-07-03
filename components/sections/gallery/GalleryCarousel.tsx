'use client'

import { useState } from 'react'

interface GalleryCarouselProps {
  content: Record<string, any>
  primaryColor?: string
}

export function GalleryCarousel({ content, primaryColor = '#3B82F6' }: GalleryCarouselProps) {
  const title = content.title
  const images = content.images || []
  const [current, setCurrent] = useState(0)

  if (images.length === 0) return null

  return (
    <section className="py-16 px-4">
      <div className="max-w-4xl mx-auto">
        {title && <h2 className="text-3xl font-bold text-center mb-10 text-gray-900 dark:text-white">{title}</h2>}
        <div className="relative rounded-xl overflow-hidden aspect-video bg-gray-100 dark:bg-gray-700">
          <img src={images[current]?.url} alt={images[current]?.alt || ''} className="w-full h-full object-cover" />
          {images[current]?.caption && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white p-3 text-sm">{images[current].caption}</div>
          )}
          {images.length > 1 && (
            <>
              <button onClick={() => setCurrent((current - 1 + images.length) % images.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 dark:bg-gray-800/80 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 text-gray-800 dark:text-white">‹</button>
              <button onClick={() => setCurrent((current + 1) % images.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 dark:bg-gray-800/80 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 text-gray-800 dark:text-white">›</button>
            </>
          )}
        </div>
        {images.length > 1 && (
          <div className="flex gap-2 justify-center mt-4">
            {images.map((_: any, i: number) => (
              <button key={i} onClick={() => setCurrent(i)} className="w-16 h-12 rounded overflow-hidden border-2 transition-all" style={{ borderColor: i === current ? primaryColor : 'transparent' }}>
                <img src={images[i]?.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
