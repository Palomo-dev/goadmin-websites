'use client'

import { useState } from 'react'
import Image from 'next/image'

interface GalleryImage {
  url: string
  alt?: string
  caption?: string
}

interface GallerySectionProps {
  images: GalleryImage[]
  primaryColor: string
}

export function GallerySection({ images, primaryColor }: GallerySectionProps) {
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null)
  
  if (!images || images.length === 0) {
    return null
  }
  
  return (
    <section id="galeria" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Galería
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Descubre nuestras instalaciones y ambiente
          </p>
        </div>
        
        {/* Grid de imágenes */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.slice(0, 8).map((image, index) => (
            <div
              key={index}
              className="aspect-square relative rounded-xl overflow-hidden cursor-pointer group"
              onClick={() => setSelectedImage(image)}
            >
              <Image
                src={image.url}
                alt={image.alt || `Imagen ${index + 1}`}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            </div>
          ))}
        </div>
        
        {/* Modal de imagen */}
        {selectedImage && (
          <div 
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <div className="relative max-w-4xl w-full aspect-video">
              <Image
                src={selectedImage.url}
                alt={selectedImage.alt || 'Imagen'}
                fill
                className="object-contain"
              />
              {selectedImage.caption && (
                <p className="absolute bottom-4 left-0 right-0 text-center text-white">
                  {selectedImage.caption}
                </p>
              )}
            </div>
            <button
              className="absolute top-4 right-4 text-white text-4xl"
              onClick={() => setSelectedImage(null)}
            >
              ×
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
