/**
 * Sección `gallery_bento` — galería en rejilla de tamaños mixtos (Figma
 * GalleryBento 148:7593). Complementa `gallery`, no la reemplaza.
 *
 * Las imágenes son las del contenido de la sección (mismo item que
 * `gallery`: `url`, `alt`, más `caption`). Cada bloque de 4 fotos repite el
 * patrón del diseño.
 *
 * Sin 'use client': el manifiesto lee `GalleryBento.CONTENT_KEYS`.
 */

import { cardVisual, items, safeHref, str, strOr, type Content } from '@/lib/restaurant/secciones'
import { GalleryBentoView, type BentoImage } from './GalleryBentoView'
import { EditorHint } from './EditorHint'

export const CONTENT_KEYS = ['eyebrow', 'title', 'subtitle', 'images', 'instagram_handle', 'instagram_url'] as const

interface GalleryBentoProps {
  content: Content
}

export function GalleryBento({ content }: GalleryBentoProps) {
  const images: BentoImage[] = items(content.images)
    .map((img) => ({ url: str(img.url), alt: str(img.alt) ?? '', caption: str(img.caption) }))
    .filter((img): img is BentoImage => img.url !== null)

  if (images.length === 0) {
    return <EditorHint title="Galería sin fotos">Agrega fotos en «Imágenes». Se acomodan en bloques de cuatro.</EditorHint>
  }

  const handle = str(content.instagram_handle)
  return (
    <GalleryBentoView
      eyebrow={strOr(content, 'eyebrow', 'El lugar')}
      title={strOr(content, 'title', 'Galería')}
      subtitle={str(content.subtitle)}
      images={images}
      mediaStyle={cardVisual(content).media}
      instagramHandle={handle ? (handle.startsWith('@') ? handle : `@${handle}`) : null}
      instagramUrl={safeHref(content.instagram_url) ?? (handle ? `https://www.instagram.com/${handle.replace(/^@/, '')}/` : null)}
    />
  )
}

GalleryBento.CONTENT_KEYS = CONTENT_KEYS
