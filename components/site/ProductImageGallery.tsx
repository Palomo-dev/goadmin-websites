'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { celdasMosaico } from '@/components/sections/product-detail/fichaTienda'
import { useVolumenFicha } from '@/components/site/volumen/EscalonesTiendaContext'
import { InsigniaVolumenFoto } from '@/components/site/volumen/PrecioVolumenFicha'
import { EtiquetasSobreFoto, useFichaConEtiquetas } from '@/components/site/etiquetas/EtiquetasFicha'

export interface GallerySettings {
  /**
   * 'carousel' (flechas + dots), 'scroll' (scroll vertical/horizontal), 'grid' (grilla), 'show_all' (todas visibles en columna),
   * 'mosaic' (plantillas de tienda: 1 grande · 2 medianas · 1 grande, `GALERIA_MOSAICO` del contrato).
   */
  gallery_layout?: 'carousel' | 'scroll' | 'grid' | 'show_all' | 'mosaic'
  /** 'bottom' | 'left' | 'right' | 'none' */
  thumbnails_position?: 'bottom' | 'left' | 'right' | 'none'
  /** Mostrar flechas de navegación en carousel */
  gallery_arrows?: boolean
  /** Mostrar dots/indicadores de posición en carousel */
  gallery_dots?: boolean
  /** Número de columnas en modo grid */
  gallery_grid_columns?: number
  /**
   * Altura máxima en modo scroll (px). YA NO SE USA: era el alto de una caja con barra propia que
   * cortaba la primera foto. El modo scroll ahora baja con la página; se conserva el tipo porque
   * lo guardan sitios existentes.
   */
  gallery_scroll_height?: number
}

interface ProductImageGalleryProps {
  images: string[]
  productName: string
  primaryColor: string
  settings?: GallerySettings
}

/**
 * Galería de la ficha. Con precio por volumen (solo dentro de la ficha, `useVolumenFicha`), la
 * insignia «Compra más, paga menos» va sobre la foto (Figma «16 Sitio web» S1/S2); sin él, la
 * galería de siempre, sin envoltorio.
 */
export function ProductImageGallery(props: ProductImageGalleryProps) {
  const volumen = useVolumenFicha()
  // Etiquetas de la ficha encendidas (Información del producto › Etiquetas, Figma 3036:78040): ellas
  // pintan las esquinas de la foto (A), también «Desde 3: −10 %», en lugar de la insignia de volumen.
  if (useFichaConEtiquetas()) return <GaleriaFotos {...props} superposicion={<EtiquetasSobreFoto />} />
  if (!volumen || volumen.escalones.length === 0) return <GaleriaFotos {...props} />
  return (
    <div className="relative">
      <GaleriaFotos {...props} />
      <InsigniaVolumenFoto primaryColor={props.primaryColor} />
    </div>
  )
}

/** `superposicion`: lo que va sobre la foto principal (etiquetas A). Ausente = la galería de siempre. */
function GaleriaFotos({ images, productName, primaryColor, settings = {}, superposicion = null }: ProductImageGalleryProps & { superposicion?: ReactNode }) {
  const [selected, setSelected] = useState(0)
  // Modo scroll: fotos de escritorio (para saltar desde las miniaturas y saber cuál se ve) y el
  // carrusel del celular (para los puntos).
  const fotosRef = useRef<Array<HTMLElement | null>>([])
  const carruselRef = useRef<HTMLDivElement | null>(null)

  const layout = settings.gallery_layout || 'carousel'
  const thumbsPos = settings.thumbnails_position ?? 'bottom'
  const showArrows = settings.gallery_arrows !== false
  const showDots = settings.gallery_dots !== false
  const gridCols = settings.gallery_grid_columns ?? 3
  const modoScroll = layout === 'scroll' && images.length > 0

  // Escritorio, modo scroll: la miniatura activa es la foto que más se ve.
  useEffect(() => {
    if (!modoScroll || typeof IntersectionObserver === 'undefined') return
    const fotos = fotosRef.current.filter((f): f is HTMLElement => !!f)
    if (fotos.length < 2) return
    const visibles = new Map<number, number>()
    const observer = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) visibles.set(Number((e.target as HTMLElement).dataset.indice), e.intersectionRatio)
        let mejor = -1
        let max = 0
        visibles.forEach((ratio, i) => {
          if (ratio > max) {
            max = ratio
            mejor = i
          }
        })
        if (mejor >= 0) setSelected(mejor)
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    )
    fotos.forEach((f) => observer.observe(f))
    return () => observer.disconnect()
  }, [modoScroll, images.length])

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
            className={`aspect-square rounded-lg overflow-hidden cursor-pointer${i === 0 && superposicion ? ' relative' : ''}`}
            onClick={() => setSelected(i)}
          >
            {i === 0 && superposicion}
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

  // ---- Modo mosaic (plantillas de tienda): 1 grande · 2 medianas · 1 grande, y se repite ----
  if (layout === 'mosaic') {
    const celdas = celdasMosaico(images.length)
    return (
      <div className="grid grid-cols-2 gap-2" data-galeria-mosaico="">
        {images.map((url, i) => (
          <div
            key={i}
            className={`overflow-hidden rounded-[var(--radio-sitio,0.75rem)] ${celdas[i] === 'grande' ? 'col-span-2 aspect-[5/6]' : 'aspect-[3/4]'}${i === 0 && superposicion ? ' relative' : ''}`}
            style={{ background: `linear-gradient(135deg, ${primaryColor}10 0%, ${primaryColor}05 100%)` }}
          >
            {i === 0 && superposicion}
            <img
              src={url}
              alt={`${productName} - imagen ${i + 1}`}
              className="h-full w-full object-cover"
              loading={i === 0 ? undefined : 'lazy'}
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
            className={`aspect-square rounded-xl overflow-hidden${i === 0 && superposicion ? ' relative' : ''}`}
            style={{ background: `linear-gradient(135deg, ${primaryColor}10 0%, ${primaryColor}05 100%)` }}
          >
            {i === 0 && superposicion}
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

  // ---- Modo scroll («Desplazamiento») ----
  // Escritorio: fotos apiladas a todo el ancho que bajan con la página (sin caja con barra propia);
  // la columna de información queda fija al lado. Ninguna foto se recorta: proporción real y
  // object-contain sobre un fondo neutro. Celular: carrusel deslizable con puntos.
  if (layout === 'scroll') {
    const conMiniaturas = images.length > 1 && thumbsPos !== 'none'
    const irAFoto = (i: number) => {
      setSelected(i)
      fotosRef.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    const irAlSlide = (i: number) => {
      const c = carruselRef.current
      if (c) c.scrollTo({ left: i * c.clientWidth, behavior: 'smooth' })
    }
    const alDeslizar = () => {
      const c = carruselRef.current
      if (c && c.clientWidth > 0) setSelected(Math.round(c.scrollLeft / c.clientWidth))
    }

    return (
      <div data-galeria-scroll="">
        {/* Celular: carrusel deslizable, foto a todo el ancho, sin scroll vertical interno */}
        <div className="md:hidden">
          <div className={superposicion ? 'relative' : undefined}>
          {superposicion}
          <div
            ref={carruselRef}
            onScroll={alDeslizar}
            className="flex snap-x snap-mandatory overflow-x-auto rounded-lg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {images.map((url, i) => (
              <div key={i} className="flex aspect-square w-full shrink-0 snap-center items-center justify-center bg-neutral-50">
                <img
                  src={url}
                  alt={`${productName} - imagen ${i + 1}`}
                  className="h-full w-full object-contain"
                  loading={i === 0 ? undefined : 'lazy'}
                  decoding="async"
                />
              </div>
            ))}
          </div>
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => irAlSlide(i)}
                  aria-label={`Ver imagen ${i + 1}`}
                  aria-current={i === selected ? 'true' : undefined}
                  className={`h-1.5 rounded-full transition-all ${i === selected ? 'w-5 bg-neutral-800' : 'w-1.5 bg-neutral-300'}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Escritorio: columna de fotos que baja con la página */}
        <div className="hidden gap-4 md:flex">
          {conMiniaturas && (
            <div className="sticky top-[calc(var(--header-h,72px)+1rem)] flex w-14 shrink-0 flex-col gap-2 self-start">
              {images.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => irAFoto(i)}
                  aria-label={`Ver imagen ${i + 1}`}
                  aria-current={i === selected ? 'true' : undefined}
                  className={`aspect-square overflow-hidden rounded-md bg-neutral-50 transition-opacity ${
                    i === selected ? 'opacity-100 ring-1 ring-neutral-400' : 'opacity-50 hover:opacity-100'
                  }`}
                >
                  <img src={url} alt="" className="h-full w-full object-contain" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-3 lg:gap-4">
            {images.map((url, i) => (
              <figure
                key={i}
                ref={(el) => {
                  fotosRef.current[i] = el
                }}
                data-indice={i}
                className={`m-0 scroll-mt-[calc(var(--header-h,72px)+1rem)] overflow-hidden rounded-lg bg-neutral-50${i === 0 && superposicion ? ' relative' : ''}`}
              >
                {i === 0 && superposicion}
                <img
                  src={url}
                  alt={`${productName} - imagen ${i + 1}`}
                  className="block h-auto w-full object-contain"
                  loading={i === 0 ? undefined : 'lazy'}
                  decoding="async"
                />
              </figure>
            ))}
          </div>
        </div>
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
      {superposicion}
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
