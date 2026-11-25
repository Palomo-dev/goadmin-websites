'use client'

import { useMemo } from 'react'
import { ProductImageGallery, type GallerySettings, type OpcionesFotoFicha } from '@/components/site/ProductImageGallery'
import { getVariantImageUrl } from '@/components/site/VariantSelector'
import { CLAVES_GALERIA_FICHA_NUEVAS, normalizarGaleriaFicha } from '@/lib/website/v2/contrato/seccionesTienda'

// `page_layout` (plantillas de tienda): lo lee ProductDetailRenderer, no la galería.
// `layout` y `show_video` ya no se ofrecen en el editor (repetía «Disposición» / el producto no
// tiene dónde guardar un video): lo guardado se conserva y se ignora.
export const CONTENT_KEYS = [
  'gallery_layout',
  'thumbnails_position',
  'gallery_arrows',
  'show_badges',
  'page_layout',
  ...CLAVES_GALERIA_FICHA_NUEVAS,
] as const

interface ProductGalleryProps {
  content: {
    show_badges?: boolean
    /** Opciones de la galería con los nombres de `page_settings` (ver CLAVES_GALERIA_FICHA). */
    gallery_layout?: GallerySettings['gallery_layout']
    thumbnails_position?: GallerySettings['thumbnails_position']
    gallery_arrows?: boolean
    gallery_scroll_height?: number
    /** Proporción, zoom, miniaturas, puntos, columnas y foto de la opción: `normalizarGaleriaFicha`. */
    [clave: string]: unknown
  }
  primaryColor?: string
  data?: { product?: any; imageUrls?: string[]; variants?: { id: number; product_images?: any[] }[] }
}

export function ProductGallery({ content, primaryColor = '#3B82F6', data }: ProductGalleryProps) {
  const images = data?.imageUrls || []
  const productName = data?.product?.name || 'Producto'
  const variants = data?.variants

  // Mismas claves que `page_settings` (el layout monolítico las pasaba así a la galería).
  const settings: GallerySettings = {
    gallery_layout: content.gallery_layout,
    thumbnails_position: content.thumbnails_position,
    gallery_arrows: content.gallery_arrows,
    gallery_scroll_height: content.gallery_scroll_height,
  }
  const galeria = normalizarGaleriaFicha(content as Record<string, unknown>)
  const sigue = galeria.sigueVariante
  const opciones = useMemo<OpcionesFotoFicha>(() => {
    if (!sigue || !variants?.length) return galeria
    const fotosVariante: Record<number, string> = {}
    for (const v of variants) {
      const url = getVariantImageUrl(v as Parameters<typeof getVariantImageUrl>[0])
      if (url) fotosVariante[Number(v.id)] = url
    }
    return { ...galeria, fotosVariante }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(galeria), variants, sigue])

  return (
    <ProductImageGallery
      images={images}
      productName={productName}
      primaryColor={primaryColor}
      settings={settings}
      opciones={opciones}
    />
  )
}
