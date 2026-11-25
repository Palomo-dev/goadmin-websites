'use client'

import { ProductDetailActions } from '@/app/productos/[id]/ProductDetailActions'
import { CLAVES_SELECTOR_FICHA, normalizarAjustesAccionesFicha, normalizarSelectorFicha } from '@/lib/website/v2/contrato/seccionesTienda'
import { leerAccionesFicha } from '@/lib/website/v2/accionesFicha'

// `button_hint` (la «Pista antes de elegir variante» de antes) ya no se lee: la reemplaza
// `initial_variant` (`customer` = el botón dice qué falta). Lo guardado se conserva y se ignora.
export const CONTENT_KEYS = ['sticky_mobile', 'buttons_layout', 'show_price_in_button', 'actions', 'preset', 'sticky', ...CLAVES_SELECTOR_FICHA] as const

interface ProductActionsProps {
  content: {
    sticky_mobile?: boolean
    /** `page_settings.buttons_layout` de la ficha. Ausente = 'stacked', como siempre. */
    buttons_layout?: 'stacked' | 'inline' | 'split'
    /** Plantillas de tienda: «Agregar al carrito · $ X». Ausente = lo de hoy. */
    show_price_in_button?: boolean
    /** Antes: «Pista antes de elegir variante». Ya no se lee (ver `initial_variant`). */
    button_hint?: 'none' | 'auto'
    /** Talla al abrir, cabecera, recuadro y textos: `normalizarSelectorFicha` (contrato). */
    [clave: string]: unknown
    /** Botones configurables (Figma 2779:65038): lista ordenada; ver lib/website/v2/accionesFicha.ts. */
    actions?: unknown
    /** Distribución lista que coincide con `actions` (la escribe el editor). */
    preset?: string
    /** Barra fija al bajar (celular y computador, Figma 2836:69391): la lee la página de la ficha con lib/website/v2/barraFija.ts. */
    sticky?: unknown
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
    /** Número de WhatsApp del sitio (Configuración › Contacto), del servidor. */
    whatsapp?: string | null
  }
}

export function ProductActions({ content, primaryColor = '#3B82F6', data }: ProductActionsProps) {
  const product = data?.product
  if (!product) return null
  // Claves nuevas de las plantillas de tienda; ausentes = `false` / `'none'` = lo de hoy.
  const ajustes = normalizarAjustesAccionesFicha(content as Record<string, unknown>)
  // Sin `actions` ni `preset`: «Clásica» (o «Dos a la mitad» con buttons_layout inline).
  const { acciones } = leerAccionesFicha(content as Record<string, unknown>)

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
        acciones={acciones}
        whatsapp={data?.whatsapp ?? null}
        branchId={data?.branchId ?? null}
        restaurante={data?.restaurante ?? null}
        puedePedir={data?.puedePedir ?? true}
        ordenAtributos={data?.ordenAtributos ?? null}
        precioEnBoton={ajustes.showPriceInButton}
        selector={normalizarSelectorFicha(content as Record<string, unknown>)}
      />
    </div>
  )
}
