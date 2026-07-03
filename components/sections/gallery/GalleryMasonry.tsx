interface GalleryMasonryProps {
  content: {
    title?: string
    subtitle?: string
    images?: { url: string; alt?: string }[]
  }
  organization: any
}

export function GalleryMasonry({ content, organization }: GalleryMasonryProps) {
  const images = content.images || []
  const galleryImages = organization.website_settings?.gallery_images || []
  const allImages = images.length > 0 ? images : galleryImages

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-10">{content.subtitle}</p>
      )}
      {allImages.length > 0 ? (
        <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
          {allImages.map((img: any, i: number) => (
            <div key={i} className="break-inside-avoid rounded-lg overflow-hidden">
              <img
                src={typeof img === 'string' ? img : img.url}
                alt={typeof img === 'string' ? `Imagen ${i + 1}` : img.alt || `Imagen ${i + 1}`}
                className="w-full h-auto object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p>No hay imágenes en la galería aún</p>
        </div>
      )}
    </div>
  )
}
