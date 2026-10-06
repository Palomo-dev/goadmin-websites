/**
 * Imagen de contenido de las secciones de restaurante.
 *
 * Las imágenes subidas desde el editor viven en Supabase Storage y pasan por
 * next/image (remotePatterns de next.config.js). Una URL externa pegada a
 * mano no está permitida por next/image: se pinta con <img> perezosa en vez
 * de romper la sección.
 */

import Image from 'next/image'
import { ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isOptimizableImage } from '@/lib/restaurant/secciones'

interface SiteImageProps {
  src: string | null
  alt: string
  /** `sizes` de next/image: cuánto ocupa la imagen en el layout. */
  sizes: string
  className?: string
  priority?: boolean
}

/** Rellena su contenedor (que debe ser `relative` y tener alto). */
export function SiteImage({ src, alt, sizes, className, priority = false }: SiteImageProps) {
  if (!src) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-muted" aria-hidden={alt ? undefined : true}>
        <ImageIcon className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
        {alt && <span className="sr-only">{alt}</span>}
      </div>
    )
  }
  if (isOptimizableImage(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={cn('object-cover', className)}
      />
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- URL externa: next/image no la admite
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={cn('absolute inset-0 h-full w-full object-cover', className)}
    />
  )
}
