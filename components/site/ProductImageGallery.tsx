'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface GallerySettings {
  /** 'carousel' (flechas + dots), 'scroll' (scroll vertical/horizontal), 'grid' (grilla), 'show_all' (todas visibles en columna) */
  gallery_layout?: 'carousel' | 'scroll' | 'grid' | 'show_all'
  /** 'bottom' | 'left' | 'right' | 'none' */
  thumbnails_position?: 'bottom' | 'left' | 'right' | 'none'
  /** Mostrar flechas de navegación en carousel */
  gallery_arrows?: boolean
  /** Mostrar dots/indicadores de posición en carousel */
  gallery_dots?: boolean
  /** Número de columnas en modo grid */
  gallery_grid_columns?: number
  /** Altura máxima en modo scroll (px) */
  gallery_scroll_height?: number
}

interface ProductImageGalleryProps {
  images: string[]
  productName: string
  primaryColor: string
  settings?: GallerySettings
}

export function ProductImageGallery({ images, productName, primaryColor, settings = {} }: ProductImageGalleryProps) {
  const [selected, setSelected] = useState(0)

  const layout = settings.gallery_layout || 'carousel'
  const thumbsPos = settings.thumbnails_position ?? 'bottom'
  const showArrows = settings.gallery_arrows !== false
  const showDots = settings.gallery_dots !== false
  const gridCols = settings.gallery_grid_columns ?? 3
  const scrollHeight = settings.gallery_scroll_height ?? 500

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

  // ---- Modo grid: todas las imágenes en grilla ----
  if (layout === 'grid') {
    return (
      <div className={`grid gap-2 ${gridCols === 2 ? 'grid-cols-2' : gridCols === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {images.map((url, i) => (
          <div
            key={i}
            className="aspect-square rounded-lg overflow-hidden cursor-pointer"
            onClick={() => setSelected(i)}
          >
            <img
              src={url}
              alt={`${productName} - imagen ${i + 1}`}
              className="w-full h-full object-cover hover:scale-105 transition-transform"
            />
          </div>
        ))}
      </div>
    )
  }

  // ---- Modo show_all: todas las imágenes en columna vertical ----
  if (layout === 'show_all') {
    return (
      <div className="space-y-3">
        {images.map((url, i) => (
          <div
            key={i}
            className="aspect-square rounded-xl overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${primaryColor}10 0%, ${primaryColor}05 100%)` }}
          >
            <img
              src={url}
              alt={`${productName} - imagen ${i + 1}`}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    )
  }

  // ---- Modo scroll: galería con scroll vertical ----
  if (layout === 'scroll') {
    return (
      <div
        className="rounded-2xl overflow-y-auto space-y-2 pr-1"
        style={{ maxHeight: `${scrollHeight}px` }}
      >
        {images.map((url, i) => (
          <div
            key={i}
            className={`aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
              i === selected ? '' : 'border-transparent opacity-80 hover:opacity-100'
            }`}
            style={i === selected ? { borderColor: primaryColor } : {}}
            onClick={() => setSelected(i)}
          >
            <img
              src={url}
              alt={`${productName} - imagen ${i + 1}`}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    )
  }

  // ---- Modo carousel (default) ----
  const mainImage = (
    <div
      className="aspect-square rounded-2xl overflow-hidden relative"
      style={{ background: `linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}05 100%)` }}
    >
      <img
        src={images[selected]}
        alt={`${productName} - imagen ${selected + 1}`}
        className="w-full h-full object-cover"
      />
      {/* Flechas de navegación */}
      {images.length > 1 && showArrows && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 active:scale-95 transition-all"
            aria-label="Imagen anterior"
          >
            <ChevronLeft className="h-6 w-6 text-gray-800 dark:text-white" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 active:scale-95 transition-all"
            aria-label="Imagen siguiente"
          >
            <ChevronRight className="h-6 w-6 text-gray-800 dark:text-white" />
          </button>
        </>
      )}
      {/* Indicador de posición (dots) */}
      {images.length > 1 && showDots && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`h-2 rounded-full transition-all ${
                i === selected ? 'w-6 bg-white shadow' : 'w-2 bg-white/60'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )

  const thumbnails = images.length > 1 && thumbsPos !== 'none' && (
    <div
      className={`flex gap-2 overflow-x-auto pb-1 ${
        thumbsPos === 'left' || thumbsPos === 'right' ? 'flex-col max-h-[400px] overflow-y-auto' : ''
      }`}
    >
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
  )

  // Layout según posición de thumbnails
  if (thumbsPos === 'left') {
    return (
      <div className="flex gap-3">
        <div className="flex-shrink-0">{thumbnails}</div>
        <div className="flex-1 space-y-3">{mainImage}</div>
      </div>
    )
  }

  if (thumbsPos === 'right') {
    return (
      <div className="flex gap-3">
        <div className="flex-1 space-y-3">{mainImage}</div>
        <div className="flex-shrink-0">{thumbnails}</div>
      </div>
    )
  }

  // bottom (default) o none
  return (
    <div className="space-y-3">
      {mainImage}
      {thumbnails}
    </div>
  )
}
