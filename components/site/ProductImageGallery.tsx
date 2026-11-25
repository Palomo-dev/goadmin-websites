'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { escucharVariante } from '@/lib/products/varianteSeleccionada'
import type { GaleriaFicha } from '@/lib/website/v2/contrato/seccionesTienda'
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

/**
 * Opciones de la galería del bloque «Galería» de la ficha (`normalizarGaleriaFicha`). Ausente (ficha
 * legacy con `page_settings`) = la galería de siempre.
 */
export type OpcionesFotoFicha = GaleriaFicha & {
  /** Primera foto de cada variante, para «Cambiar la foto al elegir talla o color». */
  fotosVariante?: Record<number, string>
}

/** Clases literales (Tailwind las necesita escritas tal cual). `auto` = la proporción de la foto. */
const CLASE_PROPORCION: Record<GaleriaFicha['proporcion'], string> = {
  square: 'aspect-square',
  '4/5': 'aspect-[4/5]',
  '3/4': 'aspect-[3/4]',
  '4/3': 'aspect-[4/3]',
  '16/9': 'aspect-video',
  auto: '',
}

interface ProductImageGalleryProps {
  images: string[]
  productName: string
  primaryColor: string
  settings?: GallerySettings
  /** Bloque «Galería» de la ficha V2. Ausente = la de siempre. */
  opciones?: OpcionesFotoFicha | null
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
function GaleriaFotos({ images, productName, primaryColor, settings = {}, opciones = null, superposicion = null }: ProductImageGalleryProps & { superposicion?: ReactNode }) {
  const [selected, setSelected] = useState(0)
  // «Cambiar la foto al elegir talla o color»: foto de la opción que no está entre las del producto.
  const [fotoOpcion, setFotoOpcion] = useState<string | null>(null)
  const [ampliada, setAmpliada] = useState(false)
  const ORIGEN = useId()
  const sigueVariante = opciones?.sigueVariante === true
  const fotosVariante = opciones?.fotosVariante
  useEffect(() => {
    if (!sigueVariante || !fotosVariante) return
    return escucharVariante(ORIGEN, (id) => {
      const url = fotosVariante[id]
      if (!url) return
      const i = images.indexOf(url)
      if (i >= 0) {
        setFotoOpcion(null)
        setSelected(i)
      } else {
        setFotoOpcion(url)
      }
    })
  }, [sigueVariante, fotosVariante, images, ORIGEN])
  const claseProporcion = CLASE_PROPORCION[opciones?.proporcion ?? 'square']
  const zoom = opciones?.zoom ?? 'none'
  const ladoMiniatura = opciones?.miniatura ?? 64
  // Modo scroll: fotos de escritorio (para saltar desde las miniaturas y saber cuál se ve) y el
  // carrusel del celular (para los puntos).
  const fotosRef = useRef<Array<HTMLElement | null>>([])
  const carruselRef = useRef<HTMLDivElement | null>(null)

  const layout = settings.gallery_layout || 'carousel'
  const thumbsPos = settings.thumbnails_position ?? 'bottom'
  const showArrows = settings.gallery_arrows !== false
  const showDots = opciones ? opciones.puntos : settings.gallery_dots !== false
  const gridCols = opciones ? opciones.columnas : settings.gallery_grid_columns ?? 3
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
            className={`${claseProporcion} rounded-lg overflow-hidden cursor-pointer${i === 0 && superposicion ? ' relative' : ''}`}
            onClick={() => setSelected(i)}
          >
            {i === 0 && superposicion}
            <img
              src={url}
              alt={`${productName} - imagen ${i + 1}`}
              className={`w-full ${claseProporcion ? 'h-full object-cover' : 'h-auto object-contain'} hover:scale-105 transition-transform`}
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
            className={`${claseProporcion} rounded-xl overflow-hidden${i === 0 && superposicion ? ' relative' : ''}`}
            style={{ background: `linear-gradient(135deg, ${primaryColor}10 0%, ${primaryColor}05 100%)` }}
          >
            {i === 0 && superposicion}
            <img
              src={url}
              alt={`${productName} - imagen ${i + 1}`}
              className={`w-full ${claseProporcion ? 'h-full object-cover' : 'h-auto object-contain'}`}
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
            <div
              className="sticky top-[calc(var(--header-h,72px)+1rem)] flex w-14 shrink-0 flex-col gap-2 self-start"
              style={opciones ? { width: ladoMiniatura } : undefined}
            >
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
  const fotoGrande = fotoOpcion ?? images[selected]
  const mainImage = (
    <div
      className={`${claseProporcion} rounded-2xl overflow-hidden relative`}
      style={{ background: `linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}05 100%)` }}
    >
      <FotoConZoom
        src={fotoGrande}
        alt={`${productName} - imagen ${selected + 1}`}
        zoom={zoom}
        ajustada={Boolean(claseProporcion)}
        alAmpliar={() => setAmpliada(true)}
      />
      {superposicion}
      {/* Flechas de navegación */}
      {images.length > 1 && showArrows && (
        <>
          <button
            onClick={() => {
              setFotoOpcion(null)
              prev()
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 active:scale-95 transition-all"
            aria-label="Imagen anterior"
          >
            <ChevronLeft className="h-6 w-6 text-gray-800 dark:text-white" />
          </button>
          <button
            onClick={() => {
              setFotoOpcion(null)
              next()
            }}
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
              onClick={() => {
                setFotoOpcion(null)
                setSelected(i)
              }}
              aria-label={`Ver imagen ${i + 1}`}
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
          onClick={() => {
            setFotoOpcion(null)
            setSelected(i)
          }}
          className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
            i === selected && !fotoOpcion ? 'ring-2 ring-offset-1' : 'border-transparent opacity-70 hover:opacity-100'
          }`}
          style={{
            ...(i === selected && !fotoOpcion ? { borderColor: primaryColor } : {}),
            ...(opciones ? { width: ladoMiniatura, height: ladoMiniatura } : {}),
          }}
        >
          <img src={url} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
        </button>
      ))}
    </div>
  )

  // «Ampliar» (zoom `lightbox`): la foto a pantalla completa, con flechas y Esc.
  const visor = ampliada ? (
    <VisorFoto
      images={images}
      inicial={fotoOpcion ? -1 : selected}
      fotoOpcion={fotoOpcion}
      productName={productName}
      alCerrar={() => setAmpliada(false)}
    />
  ) : null

  // Layout según posición de thumbnails
  if (thumbsPos === 'left') {
    return (
      <div className="flex gap-3">
        <div className="flex-shrink-0">{thumbnails}</div>
        <div className="flex-1 space-y-3">{mainImage}</div>
        {visor}
      </div>
    )
  }

  if (thumbsPos === 'right') {
    return (
      <div className="flex gap-3">
        <div className="flex-1 space-y-3">{mainImage}</div>
        <div className="flex-shrink-0">{thumbnails}</div>
        {visor}
      </div>
    )
  }

  // bottom (default) o none
  return (
    <div className="space-y-3">
      {mainImage}
      {thumbnails}
      {visor}
    </div>
  )
}

/**
 * Foto grande del carrusel con el zoom del bloque «Galería»:
 * - `none`: la foto de siempre (sin envoltorio extra de comportamiento).
 * - `hover` («Al pasar»): con el ratón encima, la foto se agranda 2× siguiendo el puntero.
 * - `click` («Al tocar»): un toque agranda en ese punto; otro toque vuelve.
 * - `lightbox` («Ampliar»): un toque abre la foto a pantalla completa.
 * Con «reducir movimiento» del sistema, el agrandado es instantáneo (sin transición).
 */
function FotoConZoom({
  src,
  alt,
  zoom,
  ajustada,
  alAmpliar,
}: {
  src: string
  alt: string
  zoom: GaleriaFicha['zoom']
  ajustada: boolean
  alAmpliar: () => void
}) {
  const [origen, setOrigen] = useState('50% 50%')
  const [activo, setActivo] = useState(false)
  const clases = `w-full ${ajustada ? 'h-full object-cover' : 'h-auto object-contain'}`
  if (zoom === 'none') return <img src={src} alt={alt} className={clases} />
  if (zoom === 'lightbox') {
    return (
      <button type="button" onClick={alAmpliar} className="block h-full w-full cursor-zoom-in" aria-label="Ampliar foto" data-zoom-galeria="lightbox">
        <img src={src} alt={alt} className={clases} />
      </button>
    )
  }
  const mover = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setOrigen(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`)
  }
  const estilo = { transformOrigin: origen, transform: activo ? 'scale(2)' : 'scale(1)' }
  if (zoom === 'hover') {
    return (
      <div
        className="h-full w-full overflow-hidden"
        data-zoom-galeria="hover"
        onMouseEnter={() => setActivo(true)}
        onMouseLeave={() => setActivo(false)}
        onMouseMove={mover}
      >
        <img src={src} alt={alt} className={`${clases} transition-transform duration-200 motion-reduce:transition-none`} style={estilo} />
      </div>
    )
  }
  return (
    <button
      type="button"
      className={`block h-full w-full overflow-hidden ${activo ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
      aria-label={activo ? 'Alejar foto' : 'Acercar foto'}
      aria-pressed={activo}
      data-zoom-galeria="click"
      onClick={(e) => {
        mover(e)
        setActivo((a) => !a)
      }}
      onMouseMove={activo ? mover : undefined}
    >
      <img src={src} alt={alt} className={`${clases} transition-transform duration-200 motion-reduce:transition-none`} style={estilo} />
    </button>
  )
}

/** «Ampliar»: foto a pantalla completa. Esc o la X cierran; flechas (y ← →) cambian de foto. */
function VisorFoto({
  images,
  inicial,
  fotoOpcion,
  productName,
  alCerrar,
}: {
  images: string[]
  /** -1 = se abrió sobre la foto de la opción elegida (`fotoOpcion`). */
  inicial: number
  fotoOpcion: string | null
  productName: string
  alCerrar: () => void
}) {
  const fotos = inicial < 0 && fotoOpcion ? [fotoOpcion, ...images] : images
  const [i, setI] = useState(Math.max(0, inicial))
  const cerrarRef = useRef<HTMLButtonElement | null>(null)
  const anterior = () => setI((x) => (x === 0 ? fotos.length - 1 : x - 1))
  const siguiente = () => setI((x) => (x === fotos.length - 1 ? 0 : x + 1))
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null
    cerrarRef.current?.focus()
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar()
      else if (e.key === 'ArrowLeft') anterior()
      else if (e.key === 'ArrowRight') siguiente()
    }
    window.addEventListener('keydown', alTeclado)
    const desborde = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', alTeclado)
      document.body.style.overflow = desborde
      previo?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Fotos de ${productName}`}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4"
      onClick={alCerrar}
      data-visor-galeria=""
    >
      <img
        src={fotos[i]}
        alt={`${productName} - imagen ${i + 1}`}
        className="max-h-full max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        ref={cerrarRef}
        type="button"
        onClick={alCerrar}
        aria-label="Cerrar"
        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
      >
        <X className="h-6 w-6" aria-hidden="true" />
      </button>
      {fotos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              anterior()
            }}
            aria-label="Imagen anterior"
            className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              siguiente()
            }}
            aria-label="Imagen siguiente"
            className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <ChevronRight className="h-6 w-6" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  )
}
