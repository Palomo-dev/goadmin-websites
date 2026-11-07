'use client'

import { ProductDetailActions } from '@/app/productos/[id]/ProductDetailActions'
import { normalizarAjustesAccionesFicha } from '@/lib/website/v2/contrato/seccionesTienda'

export const CONTENT_KEYS = ['sticky_mobile', 'buttons_layout', 'show_price_in_button', 'button_hint'] as const

interface ProductActionsProps {
  content: {
    sticky_mobile?: boolean
    /** `page_settings.buttons_layout` de la ficha. Ausente = 'stacked', como siempre. */
    buttons_layout?: 'stacked' | 'inline' | 'split'
    /** Plantillas de tienda: «Agregar al carrito · $ X». Ausente = lo de hoy. */
    show_price_in_button?: boolean
    /** Plantillas de tienda: `auto` = «Elige tu talla» hasta elegir variante. Ausente = lo de hoy. */
    button_hint?: 'none' | 'auto'
  }
  primaryColor?: string
  data?: {
    product?: any
    variants?: any[]
    price?: number
    comparePrice?: number | null
    imageUrl?: string | null
    isParent?: boolean
    organizationSubdomain?: string
    modifierGroups?: any[]
    trackStock?: boolean
    stockLevels?: any[]
    branchId?: number | null
    restaurante?: { textoAgotado: string | null } | null
    puedePedir?: boolean
    ordenAtributos?: Record<string, Record<string, number>> | null
  }
}

export function ProductActions({ content, primaryColor = '#3B82F6', data }: ProductActionsProps) {
  const product = data?.product
  if (!product) return null
  // Claves nuevas de las plantillas de tienda; ausentes = `false` / `'none'` = lo de hoy.
  const ajustes = normalizarAjustesAccionesFicha(content as Record<string, unknown>)

  return (
    <div id="product-actions">
      <ProductDetailActions
        product={product}
        variants={data?.variants || []}
        price={data?.price || 0}
        comparePrice={data?.comparePrice ?? null}
        imageUrl={data?.imageUrl ?? null}
        primaryColor={primaryColor}
        isParent={data?.isParent ?? false}
        organizationSubdomain={data?.organizationSubdomain || ''}
        modifierGroups={data?.modifierGroups || []}
        trackStock={data?.trackStock}
        stockLevels={data?.stockLevels}
        buttonsLayout={content.buttons_layout || 'stacked'}
        branchId={data?.branchId ?? null}
        restaurante={data?.restaurante ?? null}
        puedePedir={data?.puedePedir ?? true}
        ordenAtributos={data?.ordenAtributos ?? null}
        precioEnBoton={ajustes.showPriceInButton}
        ayudaVariante={ajustes.buttonHint === 'auto'}
      />
    </div>
  )
}
