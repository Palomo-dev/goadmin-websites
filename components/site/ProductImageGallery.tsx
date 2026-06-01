'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface ProductImageGalleryProps {
  images: string[]
  productName: string
  primaryColor: string
}

export function ProductImageGallery({ images, productName, primaryColor }: ProductImageGalleryProps) {
  const [selected, setSelected] = useState(0)

  if (images.length === 0) {
    return (
      <div 
        className="aspect-square rounded-2xl flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}05 100%)` }}
      >
        <span className="text-8xl">📦</span>
      </div>
    )
  }

  const prev = () => setSelected((s) => (s === 0 ? images.length - 1 : s - 1))
  const next = () => setSelected((s) => (s === images.length - 1 ? 0 : s + 1))

  return (
    <div className="space-y-3 sticky top-4">
      {/* Imagen principal */}
      <div 
        className="aspect-square rounded-2xl overflow-hidden relative group"
        style={{ background: `linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}05 100%)` }}
      >
        <img
          src={images[selected]}
          alt={`${productName} - imagen ${selected + 1}`}
          className="w-full h-full object-cover"
        />
        {/* Flechas de navegación */}
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
              aria-label="Imagen anterior"
            >
              <ChevronLeft className="h-6 w-6 text-gray-700" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
              aria-label="Imagen siguiente"
            >
              <ChevronRight className="h-6 w-6 text-gray-700" />
            </button>
            {/* Indicador de posición */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === selected ? 'w-6 bg-white' : 'bg-white/60'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((url, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                i === selected ? 'ring-2 ring-offset-1' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
              style={i === selected ? { borderColor: primaryColor } : {}}
            >
              <img src={url} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
