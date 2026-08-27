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

import { useState, type CSSProperties, type MouseEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Plus, Check, Package, Layers, ShoppingBag, Heart, Eye, Share2,
  MessageCircle, Star, TrendingUp, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Price } from '@/components/site/CurrencyProvider'
import { isOutOfStock } from '@/lib/stock'
import {
  buildCardStyle,
  resolveImageFitClass,
  resolveImageRatioClass,
  resolveTitleLinesClass,
  resolveBadgeClasses,
  resolveBadgeStyle,
  type BadgeConfig,
} from '@/lib/sectionStyle'

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

// ---------------------------------------------------------------------------
// Helpers de producto (compartidos, antes duplicados en cada componente)
// ---------------------------------------------------------------------------

export function getProductImageUrl(product: any): string | null {
  if (!product.product_images || product.product_images.length === 0) return null
  const primary = product.product_images.find((img: any) => img.is_primary)
  const image = primary || product.product_images[0]
  const path = image.storage_path || image.shared_images?.storage_path
  if (!path) return null
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`
}

export function getProductPrice(product: any): number | null {
  if (product.product_prices && product.product_prices.length > 0) {
    return Number(product.product_prices[0].price)
  }
  return null
}

export function getProductComparePrice(product: any): number | null {
  const cp = product.product_prices?.[0]?.compare_price
  return cp ? Number(cp) : null
}

/** Descuento porcentual (0-100) o null si no hay oferta. */
export function getProductDiscount(product: any): number | null {
  const price = getProductPrice(product)
  const compare = getProductComparePrice(product)
  if (!price || !compare || compare <= price) return null
  return Math.round((1 - price / compare) * 100)
}

// ---------------------------------------------------------------------------
// Defaults que reproducen el aspecto legacy
// ---------------------------------------------------------------------------

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
    label: '⚡ {value} vendidos',
    bg_color: 'rgba(0,0,0,0.6)',
    text_color: '#FFFFFF',
    position: 'bottom-left',
    shape: 'pill',
    size: 'sm',
  },
]

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type ProductCardVariant = 'grid' | 'list' | 'compact' | 'overlay'

export interface CardButtonConfig {
  action: string
  label?: string
  url?: string
  variant?: string
  size?: string
  icon?: string
  icon_position?: string
  bg_color?: string
  text_color?: string
  radius?: number
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
}

// ---------------------------------------------------------------------------
// Render de un badge
// ---------------------------------------------------------------------------

function BadgeRenderer({
  badge,
  product,
  primaryColor,
  discount,
}: {
  badge: BadgeConfig
  product: any
  primaryColor: string
  discount: number | null
}) {
  const variantCount = product.variant_count || 0
  const salesCount = product.sales_count || 0
  const outOfStock = isOutOfStock(product)
  const isParent = product.is_parent && variantCount > 0

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
    case 'rating':
      shouldShow = false // F10
      break
    case 'custom':
      shouldShow = true
      break
    default:
      shouldShow = false
  }

  if (!shouldShow) return null

  // Reemplazar {value} en el label
  const label = (badge.label ?? '')
    .replace('{value}', value !== null ? String(value) : '')

  const classes = resolveBadgeClasses(badge)
  const fallbackBg =
    badge.type === 'variants' ? primaryColor :
    badge.type === 'discount' ? '#EF4444' :
    badge.type === 'out_of_stock' ? '#1F2937' :
    badge.type === 'sales_count' ? 'rgba(0,0,0,0.6)' : ''
  const fallbackText = '#FFFFFF'
  const style = resolveBadgeStyle(badge, fallbackBg, fallbackText)

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
}) {
  const router = useRouter()
  const price = getProductPrice(product)
  const outOfStock = isOutOfStock(product)
  const variantCount = product.variant_count || 0
  const isParent = product.is_parent && variantCount > 0

  const variant = button.variant || 'solid'
  const size = button.size || 'sm'
  const bg = button.bg_color || primaryColor
  const textColor = button.text_color || '#FFFFFF'

  const baseStyle: CSSProperties = {}
  if (variant === 'solid') { baseStyle.backgroundColor = bg; baseStyle.color = textColor }
  if (variant === 'outline') { baseStyle.borderColor = bg; baseStyle.color = bg }

  const iconNode = (action: string) => {
    switch (action) {
      case 'add_to_cart': return isAdded ? <Check className="h-3 w-3 sm:h-4 sm:w-4" /> : <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
      case 'buy_now': return <ShoppingBag className="h-3 w-3 sm:h-4 sm:w-4" />
      case 'wishlist': return <Heart className="h-3 w-3 sm:h-4 sm:w-4" />
      case 'quick_view': return <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
      case 'whatsapp': return <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4" />
      case 'share': return <Share2 className="h-3 w-3 sm:h-4 sm:w-4" />
      case 'view_detail': return <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
      default: return null
    }
  }

  const defaultLabel = (action: string) => {
    switch (action) {
      case 'add_to_cart': return isAdded ? 'Listo' : 'Agregar'
      case 'buy_now': return 'Comprar ahora'
      case 'wishlist': return 'Favorito'
      case 'quick_view': return 'Vista rápida'
      case 'whatsapp': return 'WhatsApp'
      case 'share': return 'Compartir'
      case 'view_detail': return 'Ver detalle'
      default: return button.label || ''
    }
  }

  const handleClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    switch (button.action) {
      case 'add_to_cart':
        if (!isParent && !outOfStock) onAddToCart?.()
        break
      case 'buy_now':
        onBuyNow?.()
        break
      case 'wishlist':
        // toggle favorito — se maneja fuera en F10; aquí no-op por defecto
        break
      case 'quick_view':
        router.push(`/productos/${product.uuid}`)
        break
      case 'view_detail':
        router.push(`/productos/${product.uuid}`)
        break
      case 'whatsapp': {
        const msg = encodeURIComponent(`Hola, me interesa el producto "${product.name}" — ${typeof window !== 'undefined' ? window.location.origin : ''}/productos/${product.uuid}`)
        const num = whatsappNumber?.replace(/[^0-9]/g, '') || ''
        window.open(`https://wa.me/${num}?text=${msg}`, '_blank')
        break
      }
      case 'share': {
        if (typeof navigator !== 'undefined' && navigator.share) {
          navigator.share({ title: product.name, url: `${window.location.origin}/productos/${product.uuid}` })
        }
        break
      }
      case 'custom':
      default:
        if (button.url) router.push(button.url)
        break
    }
  }

  // Para padres con variantes, el botón add_to_cart se convierte en "Elegir"
  if (button.action === 'add_to_cart' && isParent) {
    return (
      <Link href={`/productos/${product.uuid}`} className="w-full">
        <Button size={size as any} variant={variant as any} className="w-full text-xs sm:text-sm" style={baseStyle}>
          <Layers className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> {iconOnly ? '' : 'Elegir'}
        </Button>
      </Link>
    )
  }

  const disabled = (button.action === 'add_to_cart' || button.action === 'buy_now') && (price === null || outOfStock)

  return (
    <Button
      size={size as any}
      variant={variant as any}
      onClick={handleClick}
      disabled={disabled}
      className={`w-full text-xs sm:text-sm transition-all ${isAdded && button.action === 'add_to_cart' ? 'bg-green-500 hover:bg-green-600' : ''}`}
      style={isAdded && button.action === 'add_to_cart' ? {} : baseStyle}
    >
      {iconNode(button.action)}
      {!iconOnly && iconNode(button.action) && <span className="ml-1">{button.label || defaultLabel(button.action)}</span>}
      {!iconOnly && !iconNode(button.action) && (button.label || defaultLabel(button.action))}
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
}: ProductCardProps) {
  const router = useRouter()
  const [internalAdded, setInternalAdded] = useState(false)
  const added = isAdded || internalAdded

  const price = getProductPrice(product)
  const comparePrice = getProductComparePrice(product)
  const discount = getProductDiscount(product)
  const imgUrl = imageUrl || getProductImageUrl(product)
  const outOfStock = isOutOfStock(product)
  const variantCount = product.variant_count || 0
  const isParent = product.is_parent && variantCount > 0

  // Carrito interno (fallback cuando no se pasa onAddToCart)
  const internalAddToCart = (p: any) => {
    const pr = getProductPrice(p)
    if (pr === null) return
    const host = typeof window !== 'undefined' ? window.location.hostname : ''
    const sub = organizationSubdomain || host.split('.')[0]
    const cartKey = `cart_${sub}`
    const cart = JSON.parse(localStorage.getItem(cartKey) || '[]')
    const idx = cart.findIndex((item: any) => item.id === p.id)
    if (idx >= 0) {
      cart[idx].quantity += 1
    } else {
      const img = getProductImageUrl(p)
      const cp = getProductComparePrice(p)
      cart.push({ id: p.id, name: p.name, price: pr, quantity: 1, ...(img && { imageUrl: img }), ...(cp && { comparePrice: cp }) })
    }
    localStorage.setItem(cartKey, JSON.stringify(cart))
    window.dispatchEvent(new CustomEvent('cart-updated'))
    setInternalAdded(true)
    setTimeout(() => setInternalAdded(false), 1500)
  }

  const internalBuyNow = (p: any) => {
    internalAddToCart(p)
    router.push('/checkout')
  }

  const handleAdd = onAddToCart ? () => onAddToCart(product) : () => internalAddToCart(product)
  const handleBuy = onBuyNow ? () => onBuyNow(product) : () => internalBuyNow(product)

  // Merge cardStyle con defaults
  const mergedCardStyle: Record<string, any> = { ...DEFAULT_CARD_STYLE, ...(cardStyle || {}) }
  const showDesc = showDescription ?? mergedCardStyle.show_description === true

  // Badges efectivos
  const effectiveBadges = badges === undefined ? DEFAULT_BADGES : badges

  // Botones efectivos
  const effectiveButtons: CardButtonConfig[] = cardButtons === undefined
    ? [
        { action: 'add_to_cart', variant: 'solid', size: 'sm' },
        ...(showBuyNow ? [{ action: 'buy_now', variant: 'outline', size: 'sm' }] : []),
      ]
    : cardButtons

  const { className: cardClassName, style: cardStyleObj } = buildCardStyle(mergedCardStyle)
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
  if (variant === 'compact') {
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
            {showDesc && product.description && (
              <p className="text-xs text-gray-500 line-clamp-1">{product.description}</p>
            )}
            {price != null && (
              <p className="text-sm font-bold mt-1" style={{ color: primaryColor }}>
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
  if (variant === 'list') {
    return (
      <div
        className={`flex gap-4 p-4 bg-white dark:bg-gray-800/50 rounded-xl border dark:border-gray-700 hover:shadow-md transition-shadow ${className}`}
      >
        <Link href={`/productos/${product.uuid}`} className="shrink-0">
          <div className={`w-28 h-28 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 relative ${imageFitClass}`}>
            {effectiveBadges.map((b, i) => (
              <BadgeRenderer key={i} badge={b} product={product} primaryColor={primaryColor} discount={discount} />
            ))}
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
            <Link href={`/productos/${product.uuid}`}>
              <h3 className="font-semibold text-gray-900 dark:text-white hover:underline line-clamp-1">
                {product.name}
              </h3>
            </Link>
            {showDesc && product.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{product.description}</p>
            )}
            {(product.sales_count ?? 0) > 0 && (
              <p className="text-xs text-gray-400 mt-1">⚡ {product.sales_count} vendidos</p>
            )}
          </div>
          <div className="flex items-center justify-between mt-3">
            {price != null && (
              <div className="flex items-center gap-2">
                {comparePrice && comparePrice > (price ?? 0) && mergedCardStyle.show_compare_price !== false && (
                  <span className="text-sm text-gray-400 line-through">
                    <Price value={comparePrice} />
                  </span>
                )}
                <span className="text-lg font-bold" style={{ color: primaryColor }}>
                  <Price value={price} />
                </span>
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
  const isOverlay = variant === 'overlay'

  return (
    <div
      className={`group ${cardClassName} ${legacyDarkClasses.join(' ')} ${className}`}
      style={cardStyleObj}
    >
      <Link href={`/productos/${product.uuid}`}>
        <div className={`${imageRatioClass} bg-gray-100 dark:bg-gray-700 overflow-hidden relative`}>
          {effectiveBadges.map((b, i) => (
            <BadgeRenderer key={i} badge={b} product={product} primaryColor={primaryColor} discount={discount} />
          ))}
          {imgUrl ? (
            <Image
              src={imgUrl}
              alt={product.name}
              fill
              className={`${imageFitClass} group-hover:scale-105 transition-transform duration-300`}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-16 w-16 text-gray-300 dark:text-gray-500" />
            </div>
          )}
          {isOverlay && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-4">
              <h3 className={`font-semibold text-white ${titleLinesClass}`}>{product.name}</h3>
              {price != null && <span className="font-bold text-white"><Price value={price} /></span>}
            </div>
          )}
        </div>
      </Link>
      {!isOverlay && (
        <div className="p-2.5 sm:p-4">
          <Link href={`/productos/${product.uuid}`}>
            <h3 className={`font-semibold text-xs sm:text-sm text-gray-900 dark:text-white mb-1 ${titleLinesClass} group-hover:underline`}>
              {product.name}
            </h3>
          </Link>
          {showDesc && product.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-1">{product.description}</p>
          )}
          <div className="flex flex-col gap-2 mt-1">
            <div className={`flex items-center gap-1 sm:gap-2 flex-wrap ${mergedCardStyle.price_style === 'stacked' ? 'flex-col' : ''}`}>
              {comparePrice && price !== null && comparePrice > price && mergedCardStyle.show_compare_price !== false && (
                <Price value={comparePrice} className="text-xs sm:text-sm text-gray-400 line-through" />
              )}
              {price !== null && (
                <Price value={price} className="font-bold text-sm sm:text-lg" style={{ color: primaryColor }} />
              )}
            </div>
            {outOfStock && !isParent ? (
              <span className="text-xs text-red-500 font-medium">Sin stock</span>
            ) : (
              <div className={`flex ${buttonsLayout === 'row' ? 'flex-row gap-2' : 'flex-col gap-1.5'}`}>
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
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductCard
