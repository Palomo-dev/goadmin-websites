'use client'

interface GalleryGridProps {
  content: Record<string, any>
  primaryColor?: string
}

export function GalleryGrid({ content, primaryColor = '#3B82F6' }: GalleryGridProps) {
  const title = content.title
  const images = content.images || []

  return (
    <section className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        {title && <h2 className="text-3xl font-bold text-center mb-10">{title}</h2>}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((img: any, i: number) => (
            <div key={i} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
              <img src={img.url} alt={img.alt || ''} className="w-full h-full object-cover hover:scale-105 transition-transform" loading="lazy" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
