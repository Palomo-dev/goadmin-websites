'use client'

/** Claves de content que este componente lee (F0.6 — manifiesto editor ↔ sitio). */
export const CONTENT_KEYS = ['title', 'images'] as const

interface GalleryGridProps {
  content: Record<string, any>
  primaryColor?: string
}

export function GalleryGrid({ content, primaryColor = '#3B82F6' }: GalleryGridProps) {
  const title = content.title
  // F2.2: fallback content.items para secciones guardadas antes de la migración
  const images = content.images ?? content.items ?? []

  return (
    <section className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        {title && <h2 className="text-3xl font-bold text-center mb-10 text-gray-900 dark:text-white">{title}</h2>}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((img: any, i: number) => (
            <div key={i} className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
              <img src={img.url} alt={img.alt || ''} className="w-full h-full object-cover hover:scale-105 transition-transform" loading="lazy" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
