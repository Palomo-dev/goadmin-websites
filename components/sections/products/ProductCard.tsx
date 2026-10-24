'use client'

/**
 * ProductCard unificado (FASE 5).
 *
 * Sustituye a las 4 implementaciones duplicadas:
 *  - `ProductCardGrid` (CategoryPageClient)
 *  - `ProductCardList` (CategoryPageClient)
 *  - card de `RelatedProducts`
 *  - `FavoriteProductCard`
 *
 * Variantes:
 *  - `grid`:    card vertical con imagen arriba (ProductsGrid, FeaturedProducts, OffersGrid).
 *  - `list`:    card horizontal con imagen pequeña a la izquierda (CategoryPageClient list).
 *  - `compact`: card horizontal pequeña (FavoriteProductCard).
 *  - `overlay`: card con texto sobre imagen (futuro).
 *
 * Recibe `cardStyle` (los campos de `CARD_FIELDS`) y lo traduce vía
 * `buildCardStyle()` de `lib/sectionStyle.ts`. Los defaults reproducen
 * el aspecto actual de las cards legacy para que el refactor no cambie
 * nada visualmente.
 *
 * Badges declarativos (F5.3): si no se pasa `badges`, se usan los 4
 * badges por defecto que reproducen el comportamiento hardcodeado actual
 * (descuento, agotado, variantes, vendidos).
 *
 * Botones declarativos (F5.4): si no se pasa `cardButtons`, se usan los
 * botones por defecto (Agregar + Comprar ahora si `showBuyNow`).
 */

import { useState, useEffect, type CSSProperties, type MouseEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Plus, Check, Package, Layers, ShoppingBag, ShoppingCart, Heart, Eye, Share2,
  MessageCircle, Star, TrendingUp, Zap, ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Price } from '@/components/site/CurrencyProvider'
import { isOutOfStock } from '@/lib/stock'
import { getReviewStats, getSessionSeed } from '@/lib/review-utils'
import { useFavorites } from '@/lib/hooks/useFavorites'
import { useAuthCustomer } from '@/lib/hooks/useAuthCustomer'
import { ProductQuickView } from '@/components/site/ProductQuickView'
import { ShareDialog } from '@/components/site/ShareDialog'
import { addProductToCart } from '@/lib/cart'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import {
  buildCardStyle,
  resolveImageFitClass,
  resolveImageRatioClass,
  resolveTitleLinesClass,
  resolveBadgeClasses,
  resolveBadgeStyle,
  BADGE_CORNER_CLASS,
  type BadgeConfig,
} from '@/lib/sectionStyle'
import { textoPlano } from '@/lib/texto/textoPlano'
import { coloresEtiqueta, colorPrecioAnterior, estiloPrecio, textoGuardado } from '@/lib/website/presentacionTienda'
import {
  CLASE_BOTON_HOVER_MOVIL,
  CLASE_PESO_TITULO,
  CLASE_TAMANO_PRECIO,
  CLASE_TAMANO_TITULO,
  etiquetasDeEstilo,
  fondoTarjeta,
  posicionBotonInterna,
  radioForma,
  separacionTarjetas,
  type EstiloBotonTarjeta,
  type EstiloTarjetaProducto,
} from '@/lib/website/tarjetaProducto'
import { useEstiloTarjeta } from '@/components/site/TarjetaProductoContext'
import {
  getProductComparePrice,
  getProductDiscount,
  getProductImageUrl,
  getProductPrice,
  isParentProduct,
  requiereElegir,
} from '@/lib/products/datosTarjeta'

export {
  getProductComparePrice,
  getProductDiscount,
  getProductImageUrl,
  getProductPrice,
  isParentProduct,
  requiereElegir,
}

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

// Esquinas de badge compartidas entre variantes (evita superposición agrupando)
const BADGE_CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const
const CORNER_TO_OVERLAY_POS: Record<string, string> = {
  'top-left': 'overlay_top_left',
  'top-right': 'overlay_top_right',
  'bottom-left': 'overlay_bottom_left',
  'bottom-right': 'overlay_bottom_right',
}

// ---------------------------------------------------------------------------
// Helpers de producto (compartidos, antes duplicados en cada componente)
// ---------------------------------------------------------------------------

function segundaImagenProducto(product: any): string | null {
  const imgs = product?.product_images
  if (!Array.isArray(imgs) || imgs.length < 2) return null
  const primary = imgs.find((img: any) => img.is_primary) || imgs[0]
  const otra = imgs.find((img: any) => img !== primary)
  const path = otra?.storage_path || otra?.shared_images?.storage_path
  if (!path) return null
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`
}

function marcaProducto(product: any): string {
  return product?.brand || product?.brands?.name || product?.brand_name || ''
}

function categoriaProducto(product: any): string {
  return product?.categories?.name || product?.category_name || ''
}

/** La cuadrícula 3×3 guarda `top-left` … `bottom-right`. Izquierda/centro/derecha solas no entran. */
function partesAlineacion(valor: unknown): { h: 'left' | 'center' | 'right'; v: 'top' | 'middle' | 'bottom' } | null {
  if (typeof valor !== 'string' || !valor.includes('-')) return null
  const [vertical, horizontal] = valor.split('-')
  const vOk = vertical === 'top' || vertical === 'middle' || vertical === 'bottom'
  const hOk = horizontal === 'left' || horizontal === 'center' || horizontal === 'right'
  if (!vOk || !hOk) return null
  return { h: horizontal, v: vertical }
}

// ---------------------------------------------------------------------------
// Defaults que reproducen el aspecto legacy
// ---------------------------------------------------------------------------

function pintarEstiloTarjeta(merged: Record<string, any>, estilo: EstiloTarjetaProducto) {
  if (estilo.card_radius != null) merged.card_radius = estilo.card_radius
  if (estilo.card_shadow === 'none') {
    merged.card_shadow = 'none'
    merged.card_shadow_hover = 'none'
  } else if (estilo.card_shadow === 'hover') {
    merged.card_shadow = 'none'
    merged.card_shadow_hover = 'lg'
  } else if (estilo.card_shadow) {
    merged.card_shadow = estilo.card_shadow
  }
  if (estilo.card_border_width != null) merged.card_border_width = estilo.card_border_width
  if (estilo.card_border_color) merged.card_border_color = estilo.card_border_color
  if (estilo.card_bg) merged.card_bg = estilo.card_bg === 'transparent' ? 'transparent' : estilo.card_bg
  if (estilo.text_align) merged.text_align = estilo.text_align
  if (estilo.title_lines) merged.title_lines = estilo.title_lines
  if (estilo.image_fit) merged.image_fit = estilo.image_fit
  if (estilo.image_ratio) merged.image_ratio = estilo.image_ratio
  if (estilo.show_compare_price != null) merged.show_compare_price = estilo.show_compare_price
  if (estilo.card_layout) merged.card_layout = estilo.card_layout
  if (estilo.price_color) merged.price_color = estilo.price_color
  if (estilo.show_reviews === true) merged.show_rating = true
  if (estilo.show_reviews === false) merged.show_rating = false
  if (estilo.reviews_position) merged.rating_position = estilo.reviews_position
  if (estilo.reviews_style === 'stars') merged.rating_style = 'stars'
  if (estilo.reviews_style === 'number_star') merged.rating_style = 'compact'
}

function aplicarBotonTarjeta(btn: CardButtonConfig, cfg: EstiloBotonTarjeta | undefined): CardButtonConfig | null {
  if (!cfg) return btn
  if (cfg.show === false) return null
  const soloIcono = cfg.button_style === 'icon_only'
  const forma = cfg.button_shape
  const radio = radioForma(forma, soloIcono)
  const pos = posicionBotonInterna(cfg.button_position)
  return {
    ...btn,
    ...(cfg.button_style ? { variant: soloIcono ? 'solid' : cfg.button_style, icon_only: soloIcono } : {}),
    ...(cfg.button_size ? { size: cfg.button_size } : {}),
    ...(cfg.button_width ? { full_width: cfg.button_width === 'full' } : {}),
    ...(radio != null ? { radius: radio } : {}),
    ...(pos ? { position: pos } : {}),
    ...(cfg.bg ? { bg_color: cfg.bg } : {}),
    ...(cfg.gradient_1 ? { bg_color: cfg.gradient_1 } : {}),
    ...(cfg.gradient_2 ? { bg_color_end: cfg.gradient_2 } : {}),
    ...(cfg.gradient_angle != null ? { gradient_angle: cfg.gradient_angle } : {}),
    ...(cfg.text ? { text_color: cfg.text } : {}),
    ...(cfg.border ? { border_color: cfg.border } : {}),
    ...(cfg.hover ? { hover_bg: cfg.hover } : {}),
    ...(cfg.icon != null ? { icon: cfg.icon } : {}),
    ...(cfg.icon_side ? { icon_position: cfg.icon_side } : {}),
    ...(cfg.button_visibility === 'hover' ? { hover_reveal: true } : {}),
  }
}

function cfgBoton(estilo: EstiloTarjetaProducto, accion: string, esPadre: boolean): EstiloBotonTarjeta | undefined {
  if (esPadre && (accion === 'add_to_cart' || accion === 'buy_now')) return estilo.choose ?? estilo.add
  if (accion === 'add_to_cart') return estilo.add
  if (accion === 'buy_now') return estilo.buy
  return undefined
}

const DEFAULT_CARD_STYLE = {
  card_radius: 12, // rounded-xl
  card_shadow: 'sm',
  card_shadow_hover: 'lg',
  card_border_width: 1,
  card_layout: 'vertical',
  image_fit: 'cover',
  image_ratio: '1:1',
  text_align: 'left',
  title_lines: 2,
  show_compare_price: true,
  price_style: 'inline',
  currency_position: 'prefix',
}

/** Badges por defecto: reproducen los 4 badges hardcodeados actuales. */
const DEFAULT_BADGES: BadgeConfig[] = [
  {
    type: 'discount',
    label: '-{value}%',
    bg_color: '#EF4444',
    text_color: '#FFFFFF',
    position: 'top-left',
    shape: 'pill',
    size: 'sm',
  },
  {
    type: 'out_of_stock',
    label: 'Agotado',
    bg_color: '#1F2937',
    text_color: '#FFFFFF',
    position: 'top-left',
    shape: 'pill',
    size: 'sm',
  },
  {
    type: 'variants',
    label: '{value}',
    position: 'top-right',
    shape: 'pill',
    size: 'sm',
    icon: 'Layers',
  },
  {
    type: 'sales_count',
    label: '{value} vendidos',
    bg_color: 'rgba(0,0,0,0.6)',
    text_color: '#FFFFFF',
    position: 'bottom-left',
    shape: 'pill',
    size: 'sm',
    icon: 'TrendingUp',
  },
]

// ---------------------------------------------------------------------------
// RatingStars — render de estrellas de valoración (F10)
// ---------------------------------------------------------------------------

function RatingStars({
  rating,
  count,
  style = 'stars_count',
  primaryColor,
}: {
  rating: number
  count?: number
  style?: 'stars' | 'compact' | 'stars_count' | 'stars_rating' | 'rating_count'
  primaryColor?: string
}) {
  if (!rating || rating <= 0) return null
  const rounded = Math.round(rating * 2) / 2 // redondea a 0.5
  const fullStars = Math.floor(rounded)
  const hasHalf = rounded % 1 !== 0
  const color = primaryColor || '#F59E0B'
  const ratingStr = rating.toFixed(1)
  const countStr = count != null && count > 0 ? count.toLocaleString('es-CO') : null

  if (style === 'compact') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        <Star className="h-3 w-3" style={{ color, fill: color }} />
        {ratingStr}{countStr ? ` (${countStr})` : ''}
      </span>
    )
  }

  // rating_count: solo número + cantidad, sin estrellas
  if (style === 'rating_count') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
        <span className="font-medium" style={{ color }}>{ratingStr}/5</span>
        {countStr && <span className="text-gray-500 dark:text-gray-400">· {countStr}</span>}
      </span>
    )
  }

  // stars, stars_count, stars_rating: todos renderizan estrellas
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex">
        {Array.from({ length: 5 }).map((_, i) => {
          const isFull = i < fullStars
          const isHalf = i === fullStars && hasHalf
          return (
            <Star
              key={i}
              className="h-3.5 w-3.5"
              style={{
                color,
                fill: isFull ? color : 'transparent',
                ...(isHalf ? { fill: 'url(#half-star)' } : {}),
              }}
            />
          )
        })}
      </span>
      {style === 'stars_count' && (
        <>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 ml-0.5">{ratingStr}/5</span>
          {countStr && <span className="text-xs text-gray-500 dark:text-gray-400">· {countStr}</span>}
        </>
      )}
      {style === 'stars_rating' && (
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 ml-0.5">{ratingStr}/5</span>
      )}
      {style === 'stars' && countStr && (
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">({countStr})</span>
      )}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type ProductCardVariant = 'grid' | 'list' | 'compact' | 'overlay'

/** El editor guarda «Sin icono» como cadena vacía. Ausente sigue siendo el ícono de la acción. */
export function iconoVacio(icon: string | null | undefined): boolean {
  return typeof icon === 'string' && icon.trim() === ''
}

export interface CardButtonConfig {
  action: string
  label?: string
  /** Texto alternativo cuando el producto tiene variantes (padre) */
  label_when_parent?: string
  /** Posición individual del botón en la tarjeta */
  position?: string
  url?: string
  variant?: string
  size?: string
  icon?: string
  icon_position?: string
  icon_only?: boolean
  bg_color?: string
  bg_color_end?: string
  text_color?: string
  border_color?: string
  hover_bg?: string
  gradient_angle?: number
  /** Solo el estilo nuevo: en celular el botón se ve; en escritorio, al pasar el mouse. */
  hover_reveal?: boolean
  radius?: number
  full_width?: boolean
  full_width_mobile?: boolean
  open_new_tab?: boolean
}

export interface ProductCardProps {
  product: any
  primaryColor: string
  variant?: ProductCardVariant
  cardStyle?: Record<string, any>
  badges?: BadgeConfig[]
  cardButtons?: CardButtonConfig[]
  buttonsPosition?: string
  buttonsLayout?: string
  buttonsFullWidth?: boolean
  iconOnly?: boolean
  showBuyNow?: boolean
  /** Si llega, se usa para añadir al carrito; si no, ProductCard lo gestiona. */
  onAddToCart?: (product: any) => void
  onBuyNow?: (product: any) => void
  isAdded?: boolean
  /** Para la variante compact (favoritos): callback para quitar de favoritos. */
  onRemoveFavorite?: () => void
  removing?: boolean
  /** Subdominio de la organización (para carrito y whatsapp). */
  organizationSubdomain?: string
  /** WhatsApp de la organización (para botón whatsapp). */
  whatsappNumber?: string
  /** Clases extra del contenedor (p.ej. ancho del item en un carrusel). */
  className?: string
  /** Mostrar descripción (sobreescribe cardStyle.show_description). */
  showDescription?: boolean
  /** URL de imagen directa (opcional; sobreescribe getProductImageUrl). */
  imageUrl?: string
  /** ID del cliente autenticado (para favoritos). */
  customerId?: string | null
  /** ID de la organización (para favoritos). */
  organizationId?: number | null
  /** ID de la sucursal/outlet activo (para separar carrito por outlet). */
  branchId?: number | null
}

// ---------------------------------------------------------------------------
// Render de un badge
// ---------------------------------------------------------------------------

function BadgeRenderer({
  badge,
  product,
  primaryColor,
  discount,
  cardStyle,
}: {
  badge: BadgeConfig
  product: any
  primaryColor: string
  discount: number | null
  cardStyle?: Record<string, unknown>
}) {
  const variantCount = product.variant_count || 0
  const salesCount = product.sales_count || 0
  const outOfStock = isOutOfStock(product)
  const isParent = isParentProduct(product)

  // Resolver el valor dinámico según el tipo
  let value: number | string | null = null
  let shouldShow = true

  switch (badge.type) {
    case 'discount':
      value = discount
      shouldShow = discount !== null && discount > 0
      break
    case 'out_of_stock':
      shouldShow = outOfStock && !isParent && (discount === null || discount <= 0)
      break
    case 'variants':
      value = variantCount
      shouldShow = variantCount > 0
      break
    case 'sales_count':
      value = salesCount
      shouldShow = salesCount > 0
      break
    case 'new': {
      // condition_value = días máximos desde created_at (default 30)
      const maxDays = badge.condition_value ?? 30
      const created = product.created_at ? new Date(product.created_at) : null
      if (!created) { shouldShow = true; break }
      const daysSince = (Date.now() - created.getTime()) / 86400000
      shouldShow = daysSince <= maxDays
      break
    }
    case 'bestseller':
      value = salesCount
      shouldShow = salesCount > 0
      break
    case 'low_stock': {
      // Muestra si el stock total es > 0 pero <= condition_value (default 5)
      const threshold = badge.condition_value ?? 5
      const totalStock = product.stock ?? product.total_stock ?? 0
      shouldShow = !outOfStock && totalStock > 0 && totalStock <= threshold
      break
    }
    case 'free_shipping':
      shouldShow = true
      break
    case 'rating': {
      const ratingAvg = Number(product.rating_avg) || 0
      const ratingCount = product.reviews_count || 0
      value = ratingAvg.toFixed(1)
      shouldShow = ratingAvg > 0 && ratingCount > 0
      break
    }
    case 'custom':
      shouldShow = true
      break
    case 'category': {
      // Muestra el nombre de la categoría del producto
      const catName = product.categories?.name || product.category_name || ''
      value = catName
      shouldShow = catName.length > 0
      break
    }
    default:
      shouldShow = false
  }

  if (!shouldShow) return null

  // Un texto vacío no es «sin etiqueta»: `??` dejaba el descuento en blanco.
  // Sin texto, el descuento usa «-{value}%» (el mismo default del editor).
  const plantilla = badge.type === 'discount'
    ? (badge.label?.trim() || '-{value}%')
    : (badge.label ?? '')
  const label = plantilla.replace('{value}', value !== null ? String(value) : '')

  const classes = resolveBadgeClasses(badge)
  // Fallbacks de color por tipo: garantizan que el badge SIEMPRE tenga
  // fondo + texto contrastante, incluso si el editor no configuró bg_color.
  const fallbackBg =
    badge.type === 'variants' ? primaryColor :
    badge.type === 'discount' ? '#EF4444' :
    badge.type === 'out_of_stock' ? '#1F2937' :
    badge.type === 'sales_count' ? 'rgba(0,0,0,0.6)' :
    badge.type === 'new' ? '#10B981' :        // verde
    badge.type === 'bestseller' ? '#F59E0B' :  // ámbar
    badge.type === 'low_stock' ? '#F97316' :   // naranja
    badge.type === 'free_shipping' ? '#3B82F6' : // azul
    badge.type === 'rating' ? '#F59E0B' :      // ámbar
    badge.type === 'category' ? primaryColor : // color de marca
    badge.type === 'custom' ? primaryColor :   // color de marca
    primaryColor                                // fallback genérico
  const colores = coloresEtiqueta(badge.type, badge, cardStyle, fallbackBg, '#FFFFFF')
  const style = {
    ...resolveBadgeStyle(
      { ...badge, bg_color: colores.bg, text_color: colores.text },
      colores.bg,
      colores.text,
    ),
    ...(badge.extra_style ?? {}),
  }

  const Icon = badge.icon === 'Layers' ? Layers :
    badge.icon === 'TrendingUp' ? TrendingUp :
    badge.icon === 'Zap' ? Zap :
    badge.icon === 'Star' ? Star : null

  return (
    <span className={classes} style={style}>
      {Icon && <Icon className="h-3 w-3 inline mr-0.5" />}
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Render de un botón de la card
// ---------------------------------------------------------------------------

function CardButtonRenderer({
  button,
  product,
  primaryColor,
  isAdded,
  onAddToCart,
  onBuyNow,
  onRemoveFavorite,
  whatsappNumber,
  iconOnly,
  cardStyle,
  isFavorite = false,
  onToggleFavorite,
  onQuickView,
  onShare,
}: {
  button: CardButtonConfig
  product: any
  primaryColor: string
  isAdded: boolean
  onAddToCart?: () => void
  onBuyNow?: () => void
  onRemoveFavorite?: () => void
  whatsappNumber?: string
  iconOnly?: boolean
  cardStyle?: Record<string, any>
  isFavorite?: boolean
  onToggleFavorite?: (productId: number) => void
  onQuickView?: () => void
  onShare?: () => void
}) {
  const router = useRouter()
  const { ruta } = useRutaSitio()
  const price = getProductPrice(product)
  const outOfStock = isOutOfStock(product)
  // Padre con variantes o grupo obligatorio: «Elegir» → detalle.
  const isParent = requiereElegir(product)

  const variant = button.variant || 'solid'
  const size = button.size || 'md'
  const bg = button.bg_color || primaryColor
  const bgEnd = button.bg_color_end || ''
  const btnIconOnly = button.icon_only === true
  // El texto por defecto depende de la variante: blanco cuando hay fondo
  // (solid/gradient), o el color del botón cuando no lo hay (outline/ghost/link)
  // para que siempre sea visible sobre fondos claros.
  const hasBackground = variant === 'solid' || variant === 'gradient'
  const textColor = button.text_color || (hasBackground ? '#FFFFFF' : bg)
  // Icon-only nunca ocupa ancho completo: es un botón cuadrado fijo.
  // Las posiciones angostas (izquierda, derecha, junto al precio, esquinas) no
  // se estiran salvo que el editor pida ancho completo: si no, se ven centradas.
  const posBoton = button.position || 'below'
  const angosta = posBoton === 'below_left' || posBoton === 'below_right' || posBoton === 'beside_price'
    || posBoton === 'overlay_top_left' || posBoton === 'overlay_top_right'
    || posBoton === 'overlay_bottom_left' || posBoton === 'overlay_bottom_right' || posBoton === 'overlay_hover'
  const btnFullWidth = btnIconOnly ? false : button.full_width === true ? true : button.full_width === false ? false : !angosta
  // «Ancho completo en celular» (`full_width_mobile`): solo cuenta si el botón no ocupa ya todo el
  // ancho. Ausente = como antes (no hacía nada).
  const anchoClase = btnFullWidth ? 'w-full' : (!btnIconOnly && button.full_width_mobile === true ? 'w-full sm:w-auto' : '')
  // «Abrir en pestaña nueva» (`open_new_tab`): solo para los botones que navegan (enlace propio
  // y «Ver detalle»). Ausente = misma pestaña, como antes.
  const nuevaPestana = button.open_new_tab === true
  const navegar = (url: string) => {
    if (nuevaPestana) window.open(url, '_blank', 'noopener,noreferrer')
    else router.push(url)
  }

  const baseStyle: CSSProperties = {}
  if (variant === 'solid') { baseStyle.backgroundColor = bg; baseStyle.color = textColor }
  if (variant === 'outline') {
    baseStyle.borderColor = button.border_color || bg
    baseStyle.color = textColor
    // El outline de shadcn trae bg-background (blanco); lo sobreescribimos a
    // transparente para que solo se vea el borde + texto del color configurado.
    baseStyle.background = 'transparent'
  }
  if (variant === 'ghost') { baseStyle.color = textColor }
  if (variant === 'link') { baseStyle.color = textColor; baseStyle.textDecoration = 'underline' }
  if (variant === 'gradient' && bgEnd) {
    const angulo = typeof button.gradient_angle === 'number' ? button.gradient_angle : 135
    baseStyle.backgroundImage = `linear-gradient(${angulo}deg, ${bg}, ${bgEnd})`
    baseStyle.color = textColor
    baseStyle.border = 'none'
  } else if (variant === 'gradient') {
    baseStyle.backgroundColor = bg; baseStyle.color = textColor
  }
  if (button.radius != null) { baseStyle.borderRadius = `${button.radius}px` }

  // Icon-only: fuerza botón cuadrado sin padding → círculo perfecto con
  // border-radius alto (ej: 48px en un botón de 40px = círculo).
  if (btnIconOnly) {
    const iconPx = size === 'sm' ? 36 : size === 'md' ? 40 : size === 'lg' ? 44 : 48
    baseStyle.width = `${iconPx}px`
    baseStyle.height = `${iconPx}px`
    baseStyle.minWidth = `${iconPx}px`
    baseStyle.padding = '0'
    // Si el radio configurado es >= la mitad del tamaño, ya es círculo.
    // Si no se configuró radio, forzar círculo para icon-only.
    if (button.radius == null) { baseStyle.borderRadius = '9999px' }
  }

  // Mapa de iconos Lucide por nombre (para soportar button.icon personalizado)
  const ICON_MAP: Record<string, any> = {
    Plus, Check, ShoppingBag, ShoppingCart, Heart, Eye, Share2, MessageCircle,
    Layers, Package, Star, TrendingUp, Zap, ArrowRight,
  }

  // Tamaño de iconos según el size configurado en el ERP
  const iconSizeClass = size === 'xl' || size === 'lg' ? 'h-5 w-5' : size === 'md' ? 'h-4 w-4' : 'h-3 w-3 sm:h-4 sm:w-4'
  // Tamaño de texto según el size configurado en el ERP
  const sizeTextClass = size === 'xl' ? 'text-base' : size === 'lg' ? 'text-sm sm:text-base' : size === 'md' ? 'text-sm' : 'text-xs sm:text-sm'

  const iconNode = (action: string) => {
    // Estado "agregado": add_to_cart siempre muestra Check sin importar el
    // icono personalizado configurado (feedback visual de éxito).
    if (isAdded && action === 'add_to_cart') {
      return <Check className={iconSizeClass} />
    }
    // «Sin icono» guarda ''. Un vacío no es «sin configurar»: no pinta el ícono por defecto.
    if (iconoVacio(button.icon)) return null
    // Si el botón tiene un icono personalizado configurado, usarlo
    if (button.icon && ICON_MAP[button.icon]) {
      const Icon = ICON_MAP[button.icon]
      return <Icon className={iconSizeClass} />
    }
    // Fallback al icono por defecto según la acción
    switch (action) {
      case 'add_to_cart': return isAdded ? <Check className={iconSizeClass} /> : <Plus className={iconSizeClass} />
      case 'buy_now': return <ShoppingBag className={iconSizeClass} />
      case 'wishlist': return <Heart className={`${iconSizeClass} ${isFavorite ? 'fill-current' : ''}`} />
      case 'quick_view': return <Eye className={iconSizeClass} />
      case 'whatsapp': return <MessageCircle className={iconSizeClass} />
      case 'share': return <Share2 className={iconSizeClass} />
      case 'view_detail': return <Eye className={iconSizeClass} />
      case 'choose': return <Layers className={iconSizeClass} />
      default: return null
    }
  }

  const defaultLabel = (action: string) => {
    switch (action) {
      case 'add_to_cart': return isAdded ? 'Listo' : 'Agregar'
      case 'buy_now': return 'Comprar ahora'
      case 'wishlist': return isFavorite ? 'Favorito' : 'Favorito'
      case 'quick_view': return 'Vista rápida'
      case 'whatsapp': return 'WhatsApp'
      case 'share': return 'Compartir'
      case 'view_detail': return 'Ver detalle'
      case 'choose': return 'Elegir'
      default: return button.label || ''
    }
  }

  const handleClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    switch (button.action) {
      case 'add_to_cart':
        // Meta Pixel / GA4 AddToCart: los dispara CartEventTracker al escribirse
        // el carrito, para todos los caminos por igual.
        if (!isParent && !outOfStock) {
          onAddToCart?.()
        }
        break
      case 'buy_now':
        onBuyNow?.()
        break
      case 'wishlist':
        if (onToggleFavorite) onToggleFavorite(Number(product.id))
        break
      case 'quick_view':
      case 'choose':
        if (onQuickView) onQuickView()
        else router.push(ruta(`/productos/${product.uuid}`))
        break
      case 'view_detail':
        navegar(ruta(`/productos/${product.uuid}`))
        break
      case 'whatsapp': {
        const msg = encodeURIComponent(`Hola, me interesa el producto "${product.name}" — ${typeof window !== 'undefined' ? window.location.origin : ''}${ruta(`/productos/${product.uuid}`)}`)
        const num = whatsappNumber?.replace(/[^0-9]/g, '') || ''
        window.open(`https://wa.me/${num}?text=${msg}`, '_blank')
        break
      }
      case 'share': {
        if (onShare) {
          onShare()
        } else if (typeof navigator !== 'undefined' && navigator.share) {
          navigator.share({ title: product.name, url: `${window.location.origin}${ruta(`/productos/${product.uuid}`)}` })
        }
        break
      }
      case 'custom':
      default:
        if (button.url) navegar(button.url)
        break
    }
  }

  // Para padres con variantes, los botones add_to_cart y buy_now se convierten
  // en "Elegir" (link al detalle para elegir variante).
  // NO usar button.label ni button.icon como fallback: son el label/icono del
  // botón normal (sin variantes). Si se usan, un card_buttons configurado con
  // label:"Agregar" icon:"Plus" sobreescribe el default "Elegir"/Layers y el
  // padre se agrega al carrito sin elegir variante.
  const ladoIcono = button.icon_position === 'right' ? 'right' : 'left'
  const alPasar = button.hover_bg
    ? (e: MouseEvent<HTMLButtonElement>, entra: boolean) => {
        e.currentTarget.style.backgroundColor = entra ? (button.hover_bg as string) : (baseStyle.backgroundColor as string) || ''
      }
    : undefined

  if ((button.action === 'add_to_cart' || button.action === 'buy_now') && isParent) {
    const chooseLabel = textoGuardado(cardStyle?.choose_button_label) || button.label_when_parent || 'Elegir'
    // El ícono del botón normal (Plus, etc.) no se reutiliza: «Elegir» lleva Layers.
    // La excepción es «Sin icono» (`''`): tampoco lleva Layers.
    const sinIcono = iconoVacio(button.icon)
    const ChooseIcon = ICON_MAP.Layers || Layers
    return (
      <Link href={ruta(`/productos/${product.uuid}`)} className={anchoClase}>
        <Button
          size={size as any}
          variant={variant === 'gradient' ? 'solid' : variant as any}
          className={`${anchoClase} ${sizeTextClass}`}
          style={baseStyle}
          onMouseEnter={alPasar ? (e) => alPasar(e, true) : undefined}
          onMouseLeave={alPasar ? (e) => alPasar(e, false) : undefined}
        >
          {ladoIcono === 'left' && !sinIcono && <ChooseIcon className={iconSizeClass} />}
          {!btnIconOnly && <span className={sinIcono ? undefined : ladoIcono === 'right' ? 'mr-1' : 'ml-1'}>{chooseLabel}</span>}
          {ladoIcono === 'right' && !sinIcono && <ChooseIcon className={iconSizeClass} />}
        </Button>
      </Link>
    )
  }

  const disabled = (button.action === 'add_to_cart' || button.action === 'buy_now') && (price === null || outOfStock)

  // Estado "agregado": el botón add_to_cart se pone verde con Check + "Listo".
  // Se construye un estilo limpio para evitar que baseStyle (backgroundImage
  // de gradient, background:transparent de outline, etc.) interfiera con el
  // color verde.
  const isAddedState = isAdded && button.action === 'add_to_cart'
  const addedStyle: CSSProperties = {
    backgroundColor: '#22C55E',
    color: '#FFFFFF',
    border: 'none',
    ...(btnIconOnly && { width: baseStyle.width, height: baseStyle.height, minWidth: baseStyle.minWidth, padding: '0', borderRadius: baseStyle.borderRadius }),
  }
  const effectiveStyle = isAddedState ? addedStyle : baseStyle
  // Label efectivo: cuando isAdded, forzar "Listo" sin importar button.label
  const etiquetaSeccion = button.action === 'add_to_cart' ? textoGuardado(cardStyle?.add_button_label) : ''
  const effectiveLabel = isAddedState ? 'Listo' : (etiquetaSeccion || button.label || defaultLabel(button.action))

  return (
    <Button
      size={size as any}
      variant={variant === 'gradient' ? 'solid' : variant as any}
      onClick={handleClick}
      data-nueva-pestana={nuevaPestana && (button.action === 'view_detail' || button.action === 'custom') ? '' : undefined}
      disabled={disabled}
      className={`${anchoClase} ${sizeTextClass} transition-all ${isAddedState ? 'bg-green-500 hover:bg-green-600' : ''}`}
      style={effectiveStyle}
      onMouseEnter={!isAddedState && alPasar ? (e) => alPasar(e, true) : undefined}
      onMouseLeave={!isAddedState && alPasar ? (e) => alPasar(e, false) : undefined}
    >
      {ladoIcono === 'left' && iconNode(button.action)}
      {!btnIconOnly && iconNode(button.action) && <span className={ladoIcono === 'right' ? 'mr-1' : 'ml-1'}>{effectiveLabel}</span>}
      {!btnIconOnly && !iconNode(button.action) && effectiveLabel}
      {ladoIcono === 'right' && iconNode(button.action)}
    </Button>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function ProductCard({
  product,
  primaryColor,
  variant = 'grid',
  cardStyle,
  badges,
  cardButtons,
  buttonsPosition = 'below',
  buttonsLayout = 'stacked',
  buttonsFullWidth = true,
  iconOnly = false,
  showBuyNow = true,
  onAddToCart,
  onBuyNow,
  isAdded = false,
  onRemoveFavorite,
  removing = false,
  organizationSubdomain,
  whatsappNumber,
  className = '',
  showDescription,
  imageUrl,
  customerId,
  organizationId,
  branchId,
}: ProductCardProps) {
  const estiloTarjeta = useEstiloTarjeta(cardStyle?.product_card_style)
  const router = useRouter()
  const { ruta } = useRutaSitio()
  const [internalAdded, setInternalAdded] = useState(false)
  const [quickViewOpen, setQuickViewOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const added = isAdded || internalAdded

  // Auto-detectar cliente autenticado si no se pasan props explícitos
  const effectiveOrgId = organizationId ?? product.organization_id ?? null
  const { customer: autoCustomer } = useAuthCustomer(effectiveOrgId)
  const effectiveCustomerId = customerId ?? autoCustomer?.id ?? null

  // Favoritos
  const { isFavorite, toggleFavorite } = useFavorites({ customerId: effectiveCustomerId, organizationId: effectiveOrgId })
  const fav = isFavorite(Number(product.id))

  const price = getProductPrice(product)
  const comparePrice = getProductComparePrice(product)
  const discount = getProductDiscount(product)
  const imgUrl = imageUrl || getProductImageUrl(product)
  const outOfStock = isOutOfStock(product)
  // Padre con variantes o grupo obligatorio: «Elegir» → detalle.
  const isParent = requiereElegir(product)

  // Carrito interno (fallback cuando no se pasa onAddToCart)
  const internalAddToCart = (p: any) => {
    const pr = getProductPrice(p)
    if (pr === null) return
    const host = typeof window !== 'undefined' ? window.location.hostname : ''
    const sub = organizationSubdomain || host.split('.')[0]
    // Misma línea, clave y evento de siempre: la escritura vive en lib/cart.ts
    // para que la carta completa (menu_full) no la duplique.
    addProductToCart(sub, branchId, {
      id: p.id,
      name: p.name,
      price: pr,
      sku: p.sku,
      imageUrl: getProductImageUrl(p),
      comparePrice: getProductComparePrice(p),
    })
    setInternalAdded(true)
    setTimeout(() => setInternalAdded(false), 1500)
  }

  const internalBuyNow = (p: any) => {
    internalAddToCart(p)
    router.push(ruta('/checkout'))
  }

  const handleAdd = onAddToCart ? () => onAddToCart(product) : () => internalAddToCart(product)
  const handleBuy = onBuyNow ? () => onBuyNow(product) : () => internalBuyNow(product)

  // Merge cardStyle con defaults. El estilo nuevo solo pisa las claves que trae.
  const mergedCardStyle: Record<string, any> = { ...DEFAULT_CARD_STYLE, ...(cardStyle || {}) }
  if (estiloTarjeta) pintarEstiloTarjeta(mergedCardStyle, estiloTarjeta)
  if (estiloTarjeta && variant === 'list') mergedCardStyle.card_layout = 'horizontal'
  const showDesc = showDescription ?? mergedCardStyle.show_description === true

  // Rating (estrellas de valoración)
  const showRating = mergedCardStyle.show_rating === true
  const reviewsSource = mergedCardStyle.reviews_source || 'generated'
  const realRatingAvg = Number(product.rating_avg) || 0
  const realRatingCount = product.reviews_count || 0
  const hideIfNoReviews = mergedCardStyle.hide_if_no_reviews !== false

  // Cuando la fuente es 'generated' (default) o no hay rating real,
  // usar el rating generado automáticamente (seededRandom).
  // Cuando es 'real' o 'mixed', usar el real si existe.
  // El seed generado usa Date.now() que difiere entre server y client,
  // por lo que se calcula solo después del mount para evitar hydration mismatch.
  const [generatedRating, setGeneratedRating] = useState<{ avg: number; count: number } | null>(null)
  useEffect(() => {
    if (reviewsSource === 'generated' || (reviewsSource !== 'real' && realRatingAvg === 0)) {
      const sessionSeed = getSessionSeed(Number(product.id) || 0)
      const stats = getReviewStats(Number(product.id) || 0, sessionSeed)
      setGeneratedRating({ avg: stats.avgRating, count: stats.totalReviews })
    }
  }, [product.id, reviewsSource, realRatingAvg])

  let ratingAvg = realRatingAvg
  let ratingCount = realRatingCount
  if (reviewsSource === 'generated' || (reviewsSource !== 'real' && realRatingAvg === 0)) {
    if (generatedRating) {
      ratingAvg = generatedRating.avg
      ratingCount = generatedRating.count
    } else {
      // En el primer render (server/SSR) no mostrar rating generado aún
      ratingAvg = 0
      ratingCount = 0
    }
  }

  const ratingStyleType = mergedCardStyle.rating_style || 'stars_count'
  const ratingPosition = mergedCardStyle.rating_position || 'below_title'
  const showRatingBlock = showRating && ratingAvg > 0 && (!hideIfNoReviews || ratingCount > 0)

  // Badges efectivos — defaults si no hay badges configurados
  let effectiveBadges = (!badges || badges.length === 0) ? DEFAULT_BADGES : badges

  // Botones efectivos — si no hay botones configurados (undefined o array vacío),
  // se usan los defaults: Agregar al carrito + Comprar ahora (si showBuyNow)
  let effectiveButtons: CardButtonConfig[] = (!cardButtons || cardButtons.length === 0)
    ? [
        { action: 'add_to_cart', variant: 'solid', size: 'sm' },
        ...(showBuyNow ? [{ action: 'buy_now', variant: 'outline', size: 'sm' }] : []),
      ]
    : cardButtons

  // Para productos padre con variantes, add_to_cart y buy_now ambos se convierten
  // en "Elegir" (link al detalle). Evitar duplicados: si ambos están presentes,
  // mostrar solo el primero (add_to_cart tiene prioridad por ser sólido).
  if (isParent) {
    const hasChoose = effectiveButtons.some(b => b.action === 'add_to_cart' || b.action === 'buy_now')
    if (hasChoose) {
      // Filtrar add_to_cart y buy_now, dejar solo el primero que aparezca
      let foundChoose = false
      effectiveButtons = effectiveButtons.filter(b => {
        if (b.action === 'add_to_cart' || b.action === 'buy_now') {
          if (foundChoose) return false
          foundChoose = true
          return true
        }
        return true
      })
    }
  }

  if (estiloTarjeta) {
    effectiveButtons = effectiveButtons
      .map((btn) => aplicarBotonTarjeta(btn, cfgBoton(estiloTarjeta, btn.action, isParent)))
      .filter((btn): btn is CardButtonConfig => btn != null)
    const etiquetas = etiquetasDeEstilo(estiloTarjeta)
    if (etiquetas) {
      const propias = etiquetas.map((e) => ({ ...e }))
      const extras = effectiveBadges.filter((b) => b.type === 'variants' || b.type === 'sales_count')
      effectiveBadges = [...propias, ...extras]
    }
  }

  const precio = estiloPrecio(mergedCardStyle, primaryColor)
  const colorAnterior = colorPrecioAnterior(mergedCardStyle)
  const claseAnterior = colorAnterior ? 'line-through' : 'text-gray-400 line-through'
  const estiloAnterior = colorAnterior ? { color: colorAnterior } : undefined
  const { className: cardClassName, style: cardStyleObj } = buildCardStyle(mergedCardStyle)
  const fondo = fondoTarjeta(estiloTarjeta)
  if (fondo) Object.assign(cardStyleObj, fondo)
  const imageFitClass = resolveImageFitClass(mergedCardStyle.image_fit)
  const imageRatioClass = resolveImageRatioClass(mergedCardStyle.image_ratio)
  const titleLinesClass = resolveTitleLinesClass(mergedCardStyle.title_lines)

  // Clases legacy de dark mode que buildCardStyle no cubre (preservan el
  // aspecto actual: bg-white dark:bg-gray-800, dark:border-gray-700).
  // Sólo se aplican cuando el editor no sobreescribe bg/border_color.
  const legacyDarkClasses: string[] = []
  if (!mergedCardStyle.card_bg) legacyDarkClasses.push('bg-white', 'dark:bg-gray-800')
  if (mergedCardStyle.card_border_width && !mergedCardStyle.card_border_color) {
    legacyDarkClasses.push('dark:border-gray-700')
  }

  // --- Variante compact (favoritos) ---
  if (variant === 'compact' && !estiloTarjeta) {
    return (
      <div
        className={`bg-white rounded-xl border overflow-hidden flex transition-opacity ${className}`}
        style={{ opacity: removing ? 0.5 : 1 }}
      >
        {imgUrl && (
          <div className="w-24 h-24 flex-shrink-0 bg-gray-100">
            <img src={imgUrl} alt={product.name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
          <div>
            <h3 className="font-semibold text-sm truncate">{product.name}</h3>
            {showDesc && textoPlano(product.description) && (
              <p className="text-xs text-gray-500 line-clamp-1">{textoPlano(product.description)}</p>
            )}
            {price != null && (
              <p className="text-sm mt-1" style={precio}>
                <Price value={price} />
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleAdd}
              className="text-xs font-medium px-3 py-1 rounded-lg text-white"
              style={{ backgroundColor: primaryColor }}
            >
              + Carrito
            </button>
            {onRemoveFavorite && (
              <button
                onClick={onRemoveFavorite}
                disabled={removing}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                Quitar ❤️
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // --- Variante list (horizontal) ---
  if (variant === 'list' && !estiloTarjeta) {
    return (
      <div
        className={`flex gap-4 p-4 bg-white dark:bg-gray-800/50 rounded-xl border dark:border-gray-700 hover:shadow-md transition-shadow ${className}`}
      >
        <Link href={ruta(`/productos/${product.uuid}`)} className="shrink-0">
          <div className={`w-28 h-28 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 relative ${imageFitClass}`}>
            {BADGE_CORNERS.map((corner) => {
              const cornerBadges = effectiveBadges.filter((b) => (b.position ?? 'top-left') === corner)
              if (cornerBadges.length === 0) return null
              return (
                <div key={corner} className={`absolute ${BADGE_CORNER_CLASS[corner]} z-10 flex flex-col gap-0.5`}>
                  {cornerBadges.map((b, i) => (
                    <BadgeRenderer key={i} badge={b} product={product} primaryColor={primaryColor} discount={discount} cardStyle={mergedCardStyle} />
                  ))}
                </div>
              )
            })}
            {imgUrl ? (
              <Image src={imgUrl} alt={product.name} fill className={imageFitClass} sizes="112px" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="h-8 w-8 opacity-30" style={{ color: primaryColor }} />
              </div>
            )}
          </div>
        </Link>
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            {showRatingBlock && ratingPosition === 'above_title' && (
              <div className="mb-1">
                <RatingStars rating={ratingAvg} count={ratingCount} style={ratingStyleType as any} primaryColor={primaryColor} />
              </div>
            )}
            <Link href={ruta(`/productos/${product.uuid}`)}>
              <h3 className="font-semibold text-gray-900 dark:text-white hover:underline line-clamp-1">
                {product.name}
              </h3>
            </Link>
            {showRatingBlock && ratingPosition === 'below_title' && (
              <div className="mt-1">
                <RatingStars rating={ratingAvg} count={ratingCount} style={ratingStyleType as any} primaryColor={primaryColor} />
              </div>
            )}
            {showDesc && textoPlano(product.description) && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{textoPlano(product.description)}</p>
            )}
            {(product.sales_count ?? 0) > 0 && (
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> {product.sales_count} vendidos
              </p>
            )}
          </div>
          <div className="flex items-center justify-between mt-3">
            {price != null && (
              <div className="flex items-center gap-2">
                {comparePrice && comparePrice > (price ?? 0) && mergedCardStyle.show_compare_price !== false && (
                  <span className={`text-sm ${claseAnterior}`} style={estiloAnterior}>
                    <Price value={comparePrice} />
                  </span>
                )}
                <span className="text-lg" style={precio}>
                  <Price value={price} />
                </span>
              </div>
            )}
            {showRatingBlock && ratingPosition === 'below_price' && (
              <div className="mt-1">
                <RatingStars rating={ratingAvg} count={ratingCount} style={ratingStyleType as any} primaryColor={primaryColor} />
              </div>
            )}
            {outOfStock ? (
              <span className="text-xs text-red-500 font-medium">Sin stock</span>
            ) : (
              <div className={`flex items-center gap-2 ${buttonsLayout === 'row' ? 'flex-row' : 'flex-col'}`}>
                {effectiveButtons.map((btn, i) => (
                  <CardButtonRenderer
                    key={i}
                    button={btn}
                    product={product}
                    primaryColor={primaryColor}
                    isAdded={added}
                    onAddToCart={handleAdd}
                    onBuyNow={handleBuy}
                    onRemoveFavorite={onRemoveFavorite}
                    whatsappNumber={whatsappNumber}
                    iconOnly={iconOnly}
                    cardStyle={mergedCardStyle}
                    isFavorite={fav}
                    onToggleFavorite={toggleFavorite}
                    onQuickView={() => setQuickViewOpen(true)}
                    onShare={() => setShareOpen(true)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // --- Variante grid (por defecto) y overlay ---
  const alineacionCelda = partesAlineacion(estiloTarjeta?.text_align)
  const isOverlay = variant === 'overlay' || mergedCardStyle.card_layout === 'overlay' || estiloTarjeta?.card_preset === 'overlay'
  const horizontal = mergedCardStyle.card_layout === 'horizontal'
  const ampliarImagen = !estiloTarjeta || estiloTarjeta.hover_image == null || estiloTarjeta.hover_image === 'zoom'
  const claseImagen = ampliarImagen
    ? `${imageFitClass} group-hover:scale-105 transition-transform duration-300`
    : `${imageFitClass} transition-transform duration-300`
  const estiloImagen: CSSProperties | undefined = estiloTarjeta && (estiloTarjeta.image_bg || estiloTarjeta.image_padding != null || estiloTarjeta.image_radius != null)
    ? {
        ...(estiloTarjeta.image_bg ? { backgroundColor: estiloTarjeta.image_bg } : {}),
        ...(estiloTarjeta.image_padding != null ? { padding: estiloTarjeta.image_padding } : {}),
        ...(estiloTarjeta.image_radius != null ? { borderRadius: estiloTarjeta.image_radius } : {}),
      }
    : undefined
  const segundaUrl = estiloTarjeta?.hover_image === 'second' ? segundaImagenProducto(product) : null
  const posPrecio = estiloTarjeta?.price_position
  const precioAbajo = !posPrecio || posPrecio === 'below_title'
  const claseTitulo = estiloTarjeta?.title_weight || estiloTarjeta?.title_size
    ? `${CLASE_PESO_TITULO[estiloTarjeta.title_weight ?? 'semibold']} ${CLASE_TAMANO_TITULO[estiloTarjeta.title_size ?? 'sm']} text-gray-900 dark:text-white mb-1`
    : 'font-semibold text-xs sm:text-sm text-gray-900 dark:text-white mb-1'
  const clasePrecio = estiloTarjeta?.price_size ? CLASE_TAMANO_PRECIO[estiloTarjeta.price_size] : 'text-sm sm:text-lg'
  const claseCuerpo = estiloTarjeta?.card_padding != null ? '' : 'p-2.5 sm:p-4'
  const padCuerpo = estiloTarjeta?.card_padding != null ? { padding: estiloTarjeta.card_padding } : undefined
  const revela = (pos: string) =>
    effectiveButtons.some((b) => (b.position || 'below') === pos && b.hover_reveal) ? ` ${CLASE_BOTON_HOVER_MOVIL}` : ''
  const alinearBotones = alineacionCelda
    ? (alineacionCelda.h === 'left' ? 'justify-start' : alineacionCelda.h === 'right' ? 'justify-end' : 'justify-center')
    : estiloTarjeta?.text_align === 'left' ? 'justify-start' : estiloTarjeta?.text_align === 'right' ? 'justify-end' : 'justify-center'
  const claseAlineacionTexto = alineacionCelda?.h === 'center' ? ' text-center' : alineacionCelda?.h === 'right' ? ' text-right' : alineacionCelda ? ' text-left' : ''
  const claseAlineacionVertical = alineacionCelda?.v === 'middle' ? ' justify-center' : alineacionCelda?.v === 'bottom' ? ' justify-end' : ''
  const marcas = [
    estiloTarjeta?.show_brand ? marcaProducto(product) : '',
    estiloTarjeta?.show_category ? categoriaProducto(product) : '',
  ].filter(Boolean)
  const etiquetasTitulo = effectiveBadges.filter((b) => b.position === 'over_title')

  // Render de botones reutilizable — permite filtrar por posición individual
  const buttonsContainerClass = `flex ${buttonsLayout === 'row' ? 'flex-row gap-2' : 'flex-col gap-1.5'} ${buttonsFullWidth ? 'w-full' : ''}`
  const renderButtons = (extraClass = '', positionFilter?: string) => (
    <div className={`${buttonsContainerClass} ${extraClass}`}>
      {effectiveButtons
        .filter((btn) => !positionFilter || (btn.position || 'below') === positionFilter)
        .map((btn, i) => (
          <CardButtonRenderer
            key={i}
            button={btn}
            product={product}
            primaryColor={primaryColor}
            isAdded={added}
            onAddToCart={handleAdd}
            onBuyNow={handleBuy}
            onRemoveFavorite={onRemoveFavorite}
            whatsappNumber={whatsappNumber}
            iconOnly={iconOnly}
            cardStyle={mergedCardStyle}
            isFavorite={fav}
            onToggleFavorite={toggleFavorite}
            onQuickView={() => setQuickViewOpen(true)}
            onShare={() => setShareOpen(true)}
          />
        ))}
    </div>
  )

  // Agrupar botones por posición individual
  const buttonsByPosition = (pos: string) => effectiveButtons.filter((btn) => (btn.position || 'below') === pos)
  const hasButtonsAt = (pos: string) => buttonsByPosition(pos).length > 0

  // Clases para posiciones overlay (sobre la imagen)
  const overlayPositionClass: Record<string, string> = {
    overlay_bottom: 'absolute bottom-0 left-0 right-0 p-2 flex justify-center',
    overlay_top_left: 'absolute top-2 left-2',
    overlay_top_right: 'absolute top-2 right-2',
    overlay_bottom_left: 'absolute bottom-2 left-2',
    overlay_bottom_right: 'absolute bottom-2 right-2',
    overlay_hover: 'absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 p-2',
  }
  // Posiciones overlay que NO son esquinas (se renderizan separadas)
  const nonCornerOverlayPositions = ['overlay_bottom', 'overlay_hover']
  const overlayPositions = ['overlay_bottom', 'overlay_top_left', 'overlay_top_right', 'overlay_bottom_left', 'overlay_bottom_right', 'overlay_hover']
  const hasOverlayButtons = overlayPositions.some((p) => hasButtonsAt(p))

  return (
    <div
      className={`group ${cardClassName} ${legacyDarkClasses.join(' ')} ${className}`}
      style={cardStyleObj}
    >
      <Link href={ruta(`/productos/${product.uuid}`)} className={horizontal ? 'relative w-28 shrink-0 self-stretch sm:w-40' : undefined}>
        <div
          className={`${horizontal ? 'h-full min-h-[7rem]' : imageRatioClass} bg-gray-100 dark:bg-gray-700 overflow-hidden relative`}
          style={estiloImagen}
        >
          {/* Badges agrupados por esquina + botones overlay de esquina (evita superposición) */}
          {BADGE_CORNERS.map((corner) => {
            const cornerBadges = effectiveBadges.filter((b) => (b.position ?? 'top-left') === corner)
            const overlayPos = CORNER_TO_OVERLAY_POS[corner]
            const hasCornerButtons = !outOfStock && hasButtonsAt(overlayPos)
            if (cornerBadges.length === 0 && !hasCornerButtons) return null
            return (
              <div key={corner} className={`absolute ${BADGE_CORNER_CLASS[corner]} z-10 flex flex-col gap-1`}>
                {cornerBadges.map((b, i) => (
                  <BadgeRenderer key={i} badge={b} product={product} primaryColor={primaryColor} discount={discount} cardStyle={mergedCardStyle} />
                ))}
                {hasCornerButtons && (
                  renderButtons(`rounded-lg p-1${revela(overlayPos)}`, overlayPos)
                )}
              </div>
            )
          })}
          {imgUrl ? (
            <Image
              src={imgUrl}
              alt={product.name}
              fill
              className={claseImagen}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-16 w-16 text-gray-300 dark:text-gray-500" />
            </div>
          )}
          {segundaUrl && (
            <Image
              src={segundaUrl}
              alt=""
              fill
              className={`${imageFitClass} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          )}
          {posPrecio === 'over_image' && price !== null && (
            <div className="absolute bottom-2 left-2 z-10 rounded bg-white/90 px-1.5 py-0.5">
              <Price value={price} className={clasePrecio} style={precio} />
            </div>
          )}
          {showRatingBlock && estiloTarjeta?.reviews_position === 'over_image' && (
            <div className="absolute bottom-2 right-2 z-10 rounded bg-white/90 px-1.5 py-0.5">
              <RatingStars rating={ratingAvg} count={ratingCount} style={ratingStyleType as any} primaryColor={primaryColor} />
            </div>
          )}
          {isOverlay && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent flex flex-col justify-end gap-1 p-4">
              <h3 className={`font-semibold text-white ${titleLinesClass}`}>{product.name}</h3>
              {price != null && (
                <span style={textoGuardado(mergedCardStyle.price_color) ? precio : { color: '#ffffff', fontWeight: precio.fontWeight }}>
                  <Price value={price} />
                </span>
              )}
              {!outOfStock && hasButtonsAt('below') && (
                <div className="mt-1">{renderButtons('', 'below')}</div>
              )}
            </div>
          )}
          {/* Botones overlay no-esquina (overlay_bottom, overlay_hover) — sin conflicto con badges */}
          {!outOfStock && nonCornerOverlayPositions.map((pos) =>
            hasButtonsAt(pos) ? (
              <div key={pos} className={`${overlayPositionClass[pos] || ''}${revela(pos)}`}>
                {renderButtons(pos === 'overlay_hover' ? 'rounded-lg p-1.5' : 'rounded-lg p-1', pos)}
              </div>
            ) : null
          )}
        </div>
      </Link>
      {!isOverlay && (
        <div className={`${claseCuerpo}${horizontal ? ' flex min-w-0 flex-1 flex-col justify-center' : alineacionCelda ? ` flex flex-col flex-1${claseAlineacionVertical}` : ''}${claseAlineacionTexto}`} style={padCuerpo}>
          {marcas.length > 0 && (
            <p className="mb-0.5 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{marcas.join(' · ')}</p>
          )}
          {etiquetasTitulo.length > 0 && (
            <div className="mb-1 flex flex-wrap gap-1">
              {etiquetasTitulo.map((b, i) => (
                <BadgeRenderer key={i} badge={b} product={product} primaryColor={primaryColor} discount={discount} cardStyle={mergedCardStyle} />
              ))}
            </div>
          )}
          {posPrecio === 'above_title' && price !== null && (
            <div className="mb-1">
              <Price value={price} className={clasePrecio} style={precio} />
            </div>
          )}
          {showRatingBlock && ratingPosition === 'above_title' && (
            <div className="mb-1">
              <RatingStars rating={ratingAvg} count={ratingCount} style={ratingStyleType as any} primaryColor={primaryColor} />
            </div>
          )}
          <Link href={ruta(`/productos/${product.uuid}`)}>
            <h3 className={`${claseTitulo} ${titleLinesClass} group-hover:underline`}>
              {product.name}
            </h3>
          </Link>
          {showRatingBlock && ratingPosition === 'below_title' && (
            <div className="mb-1">
              <RatingStars rating={ratingAvg} count={ratingCount} style={ratingStyleType as any} primaryColor={primaryColor} />
            </div>
          )}
          {showDesc && textoPlano(product.description) && (
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-1">{textoPlano(product.description)}</p>
          )}
          <div className="flex flex-col gap-2 mt-1">
            {(precioAbajo || (posPrecio === 'beside_button' && !hasButtonsAt('beside_price'))) && !hasButtonsAt('beside_price') && (
            <div className={`flex items-center gap-1 sm:gap-2 flex-wrap ${mergedCardStyle.price_style === 'stacked' ? 'flex-col' : ''}${alineacionCelda?.h === 'center' || estiloTarjeta?.text_align === 'center' ? ' justify-center' : alineacionCelda?.h === 'right' || estiloTarjeta?.text_align === 'right' ? ' justify-end' : ''}`}>
              {comparePrice && price !== null && comparePrice > price && mergedCardStyle.show_compare_price !== false && (
                <Price value={comparePrice} className={`text-xs sm:text-sm ${claseAnterior}`} style={estiloAnterior} />
              )}
              {price !== null && (
                <Price value={price} className={clasePrecio} style={precio} />
              )}
            </div>
            )}
            {showRatingBlock && ratingPosition === 'below_price' && (
              <div className={`mb-1 flex${alinearBotones === 'justify-end' ? ' justify-end' : alinearBotones === 'justify-center' ? ' justify-center' : ''}`}>
                <RatingStars rating={ratingAvg} count={ratingCount} style={ratingStyleType as any} primaryColor={primaryColor} />
              </div>
            )}
            {outOfStock && !isParentProduct(product) ? (
              <span className="text-xs text-red-500 font-medium">Sin stock</span>
            ) : (
              <>
                {/* Botones "below" centrados (default) */}
                {hasButtonsAt('below') && (
                  <div className={`flex ${alinearBotones}${revela('below')}`}>{renderButtons('', 'below')}</div>
                )}
                {/* Botones "below_left" */}
                {hasButtonsAt('below_left') && (
                  <div className="flex justify-start">{renderButtons('', 'below_left')}</div>
                )}
                {/* Botones "below_right" */}
                {hasButtonsAt('below_right') && (
                  <div className="flex justify-end">{renderButtons('', 'below_right')}</div>
                )}
                {/* Botones "beside_price" */}
                {hasButtonsAt('beside_price') && (
                  <div className={`flex items-center justify-between gap-2${revela('beside_price')}`}>
                    {price !== null && (
                      <span className="flex items-center gap-1">
                        {comparePrice && comparePrice > price && mergedCardStyle.show_compare_price !== false && (
                          <Price value={comparePrice} className={`text-xs sm:text-sm ${claseAnterior}`} style={estiloAnterior} />
                        )}
                        <Price value={price} className={clasePrecio} style={precio} />
                      </span>
                    )}
                    {renderButtons('w-auto shrink-0', 'beside_price')}
                  </div>
                )}
                {/* Botones "bottom_bar" */}
                {hasButtonsAt('bottom_bar') && (
                  <div className="-mx-2 mt-1 flex border-t border-gray-200 px-2 pt-2 dark:border-gray-700">{renderButtons('w-full', 'bottom_bar')}</div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Vista rápida modal */}
      <ProductQuickView
        product={product}
        open={quickViewOpen}
        onClose={() => setQuickViewOpen(false)}
        primaryColor={primaryColor}
        onAddToCart={handleAdd}
        isFavorite={fav}
        onToggleFavorite={toggleFavorite}
        onShare={() => { setQuickViewOpen(false); setShareOpen(true) }}
      />

      {/* Share dialog */}
      <ShareDialog
        product={product}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </div>
  )
}

export default ProductCard
