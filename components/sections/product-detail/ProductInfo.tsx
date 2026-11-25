'use client'

import { Fragment } from 'react'
import { ReviewSummaryBadge } from '@/components/site/reviews/ReviewSummaryBadge'
import { AhorroFicha, DisponibilidadFicha, PrecioFicha } from '@/components/site/PrecioFicha'
import { FilaEtiquetasFicha } from '@/components/site/etiquetas/EtiquetasFicha'
import { textoPlano } from '@/lib/texto/textoPlano'
import {
  CLAVES_INFO_FICHA_NUEVAS,
  descripcionCortaFicha,
  normalizarInfoFicha,
  type ParteInfoFicha,
} from '@/lib/website/v2/contrato/seccionesTienda'

export const CONTENT_KEYS = ['blocks', 'show_countdown', ...CLAVES_INFO_FICHA_NUEVAS] as const

interface ProductInfoProps {
  content: {
    /**
     * Partes y orden (`[{ id, visible }]`). Sin lista, las 4 de siempre (SKU, título, estrellas y
     * precio). Ver `normalizarInfoFicha` (Figma «16 Sitio web», bloque 4).
     */
    blocks?: Array<{ id: string; visible?: boolean }>
    /**
     * `false` = sin aviso de stock ni contador tras la información. Lo aplica
     * `ProductDetailRenderer` (la urgencia no se pinta dentro de este bloque).
     */
    show_countdown?: boolean
    /** «SKU:» por defecto; el comercio puede poner «Ref.». */
    sku_label?: string
    stock_text?: string
    out_of_stock_text?: string
  }
  primaryColor?: string
  data?: {
    product?: any
    variants?: any[]
    isParent?: boolean
    price?: number
    tienePrecio?: boolean
    comparePrice?: number | null
    reviewsConfig?: any
    productStats?: { rating_avg?: number | null; reviews_count?: number | null } | null
  }
}

/**
 * Información del producto: SKU, nombre, resumen de reseñas y precio (`PrecioFicha`, que sigue a
 * la variante elegida), y si el editor las enciende: ahorro, descripción corta y disponibilidad.
 * Sin configurar, el mismo marcado que pintaba el layout monolítico de la ficha, salvo que un
 * producto sin SKU ya no dice «SKU: N/A» (la línea no sale). La descripción completa y la urgencia
 * son bloques aparte.
 */
export function ProductInfo({ content, primaryColor = '#3B82F6', data }: ProductInfoProps) {
  const product = data?.product
  if (!product) return null

  const info = normalizarInfoFicha(content as Record<string, unknown>)
  const variantes = data?.isParent ? (data?.variants || []) : []
  const sku = typeof product.sku === 'string' ? product.sku.trim() : ''

  const parte = (id: ParteInfoFicha) => {
    switch (id) {
      case 'sku':
        return sku ? <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{info.textoSku} {sku}</p> : null
      case 'title':
        return <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{product.name}</h1>
      case 'rating':
        return (
          <ReviewSummaryBadge
            primaryColor={primaryColor}
            productId={product.id}
            reviewsConfig={data?.reviewsConfig}
            productStats={data?.productStats}
          />
        )
      case 'price':
        return data?.tienePrecio ? (
          <PrecioFicha price={data?.price ?? 0} comparePrice={data?.comparePrice ?? null} variants={variantes} primaryColor={primaryColor} />
        ) : null
      case 'savings':
        return data?.tienePrecio ? <AhorroFicha price={data?.price ?? 0} comparePrice={data?.comparePrice ?? null} variants={variantes} /> : null
      case 'short_description': {
        const corta = descripcionCortaFicha(textoPlano(product.description))
        return corta ? <p className="mt-3 text-base text-gray-700 dark:text-gray-300" data-descripcion-corta="">{corta}</p> : null
      }
      case 'stock':
        return <DisponibilidadFicha product={product} variants={variantes} textoDisponible={info.textoDisponible} textoAgotado={info.textoAgotado} />
    }
  }

  return (
    <div>
      {info.partes.map((id) => (
        <Fragment key={id}>
          {/* Etiquetas junto al título (B, Figma 3038:78227). Sin `labels_show`, no pinta nada. */}
          {id === 'title' && <FilaEtiquetasFicha />}
          {parte(id)}
        </Fragment>
      ))}
      {/* Sin título, las etiquetas siguen saliendo (donde estaban: después del SKU). */}
      {!info.partes.includes('title') && <FilaEtiquetasFicha />}
    </div>
  )
}
