'use client'

/**
 * CategoryCard — tarjeta de categoría unificada (FASE 4.3).
 *
 * Antes había 3 implementaciones inline duplicadas en
 * `CategoriesGrid`, `CategoriesHorizontal` y `CategoriesIcons`. Esta card
 * unifica la presentación y se gobierna con `CARD_FIELDS` (definidos en el ERP
 * en `sectionFieldGroups.ts`) más un grupo de campos específicos de categoría
 * (`text_position`, `title_size`, `show_count`, `show_description`,
 * `show_icon`, `show_image`, `show_color`, `shape`, `badge`).
 *
 * Regla de compatibilidad: cuando `cardStyle` no se pasa (o sus campos están
 * vacíos), la card reproduce exactamente el aspecto que tenía la implementación
 * inline original de `CategoriesGrid` (overlay con gradiente, imagen con zoom
 * al hover, fallback 🏷️, etc.), de modo que ningún sitio existente cambie.
 */

import Link from 'next/link'
import { DynamicLucideIcon } from './DynamicLucideIcon'

export interface CategoryCardStyle {
  /** Forma del contenedor. `round` es alias de `circle` (compat hacia atrás). */
  shape?: 'square' | 'rounded' | 'circle' | 'card' | 'round'
  card_radius?: number
  card_shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  card_border_width?: number
  card_border_color?: string
  card_bg?: string
  card_padding?: number
  card_hover?: 'none' | 'zoom' | 'lift' | 'glow'
  image_fit?: 'cover' | 'contain' | 'fill'
  text_align?: 'left' | 'center' | 'right'
  /** Dónde va el texto respecto a la imagen. */
  text_position?: 'below' | 'inside' | 'overlay' | 'on_hover'
  title_size?: 'sm' | 'md' | 'lg'
  show_count?: boolean
  show_description?: boolean
  show_icon?: boolean
  show_image?: boolean
  show_color?: boolean
  badge?: string
  /**
   * Origen del medio. `auto` (default): imagen → icono → color → inicial.
   * `image`/`icon`/`color`/`initial` fuerzan un único origen.
   */
  media_source?: 'auto' | 'image' | 'icon' | 'color' | 'initial'
  /** Ancho máximo del medio (ej: '180px') — reproduce Horizontal/Icons. */
  media_max_width?: string
  /**
   * Fallback cuando `media_source='auto'` y no hay imagen/icon/color.
   * `emoji` (default, 🏷️ — reproduce CategoriesGrid) · `initial` (inicial
   * sobre el acento — reproduce CategoriesIcons).
   */
  fallback_media?: 'emoji' | 'initial'
}

interface CategoryCardProps {
  cat: any
  cardStyle?: CategoryCardStyle
  primaryColor?: string
  /** Ancho fijo cuando se usa dentro de un carrusel (ej: '160px'). */
  itemWidth?: string
}

// --- Mapeos de clases para no romper el tree-shaking de Tailwind ---

const SHADOW_CLASS: Record<string, string> = {
  none: '',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
}

const SHADOW_HOVER_CLASS: Record<string, string> = {
  none: '',
  sm: 'hover:shadow-sm',
  md: 'hover:shadow-md',
  lg: 'hover:shadow-lg',
  xl: 'hover:shadow-xl',
}

const HOVER_EFFECT_CLASS: Record<string, string> = {
  none: '',
  zoom: '', // se aplica a la imagen, no al contenedor
  lift: 'transition-transform hover:-translate-y-1',
  glow: 'transition-shadow hover:shadow-xl',
}

const TITLE_SIZE_CLASS: Record<string, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
}

const TEXT_ALIGN_CLASS: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

const IMAGE_FIT_CLASS: Record<string, string> = {
  cover: 'object-cover',
  contain: 'object-contain',
  fill: 'object-fill',
}

function radiusStyle(radius?: number): number | undefined {
  if (radius == null) return undefined
  if (radius <= 0) return 0
  return radius
}

/**
 * Devuelve las clases de forma (aspect + radius) según `shape`.
 * Reproduce el comportamiento original:
 * - `square`/undefined → `rounded-xl aspect-[4/3]`
 * - `round`/`circle` → `rounded-full aspect-square`
 * - `rounded` → `rounded-2xl aspect-[4/3]`
 * - `card` → `rounded-xl` sin aspect fijo (la altura la da el contenido)
 */
function shapeClasses(shape?: string): { aspect: string; radius: string } {
  switch (shape) {
    case 'circle':
    case 'round':
      return { aspect: 'aspect-square', radius: 'rounded-full' }
    case 'rounded':
      return { aspect: 'aspect-[4/3]', radius: 'rounded-2xl' }
    case 'card':
      return { aspect: '', radius: 'rounded-xl' }
    case 'square':
    default:
      return { aspect: 'aspect-[4/3]', radius: 'rounded-xl' }
  }
}

export function CategoryCard({ cat, cardStyle = {}, primaryColor, itemWidth }: CategoryCardProps) {
  const {
    shape,
    card_radius,
    card_shadow,
    card_border_width,
    card_border_color,
    card_bg,
    card_padding,
    card_hover,
    image_fit,
    text_align,
    text_position = 'overlay',
    title_size = 'lg',
    show_count,
    show_description,
    show_icon,
    show_image = true,
    show_color,
    badge,
    media_source = 'auto',
    media_max_width,
    fallback_media = 'emoji',
  } = cardStyle

  const isRound = shape === 'circle' || shape === 'round'
  const { aspect, radius } = shapeClasses(shape)
  const accent = show_color && cat.color ? cat.color : primaryColor || '#8B6914'

  // --- Estilo inline (sobreescribe clases cuando hay valor explícito) ---
  const containerStyle: React.CSSProperties = {
    ...(card_radius != null ? { borderRadius: radiusStyle(card_radius) } : {}),
    ...(card_border_width ? { border: `${card_border_width}px solid ${card_border_color || '#e5e7eb'}` } : {}),
    ...(card_bg ? { backgroundColor: card_bg } : {}),
  }

  const paddingPx = card_padding != null ? card_padding : isRound ? 8 : 16

  // --- Media (imagen / icono / color / inicial) según media_source ---
  const wantImage = media_source === 'image' || (media_source === 'auto' && show_image)
  const wantIcon = media_source === 'icon' || (media_source === 'auto' && show_icon)
  const wantColor = media_source === 'color' || (media_source === 'auto' && show_color)

  const hasImage = wantImage && cat.image_url
  const hasIcon = wantIcon && cat.icon
  const hasColorBlock = wantColor && (cat.color || primaryColor)
  // `initial` explícito, o fallback `initial` en auto cuando no hay medio.
  const hasInitial =
    media_source === 'initial' ||
    (media_source === 'auto' && fallback_media === 'initial' && !hasImage && !hasIcon && !hasColorBlock)

  const mediaStyle: React.CSSProperties = {
    ...(card_bg ? { backgroundColor: card_bg } : {}),
    ...(media_max_width ? { maxWidth: media_max_width, marginLeft: 'auto', marginRight: 'auto' } : {}),
  }

  const media = (
    <div className={`relative w-full ${aspect} ${radius} overflow-hidden`} style={mediaStyle}>
      {hasImage ? (
        <img
          src={cat.image_url}
          alt={cat.name}
          className={`w-full h-full ${IMAGE_FIT_CLASS[image_fit || 'cover']} ${
            card_hover === 'zoom' ? 'group-hover:scale-105 transition-transform duration-300' : ''
          }`}
          loading="lazy"
        />
      ) : hasIcon ? (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ backgroundColor: cat.color ? `${cat.color}20` : `${accent}15` }}
        >
          <DynamicLucideIcon
            name={cat.icon}
            fallback="Tag"
            className={isRound ? 'w-7 h-7' : 'w-10 h-10'}
            style={{ color: cat.color || accent }}
          />
        </div>
      ) : hasColorBlock ? (
        <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: cat.color || accent }}>
          <span className="text-white text-3xl font-bold">{cat.name?.charAt(0) || '?'}</span>
        </div>
      ) : hasInitial ? (
        <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: accent }}>
          <span className="text-white text-xl font-bold">{cat.name?.charAt(0) || '?'}</span>
        </div>
      ) : (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ backgroundColor: `${accent}15` }}
        >
          <span className={isRound ? 'text-2xl' : 'text-4xl'}>🏷️</span>
        </div>
      )}
    </div>
  )

  // --- Bloque de texto ---
  const titleClass = `font-semibold ${TITLE_SIZE_CLASS[title_size]} ${
    text_position === 'below' ? 'text-gray-900 dark:text-white' : 'text-white'
  }`
  const alignClass = TEXT_ALIGN_CLASS[text_align || (isRound ? 'center' : 'left')]

  const textBlock = (
    <div className={alignClass}>
      <h3 className={titleClass}>{cat.name}</h3>
      {show_description && cat.description && (
        <p className={`text-sm ${text_position === 'below' ? 'text-gray-500 dark:text-gray-400' : 'text-white/80'} line-clamp-2`}>
          {cat.description}
        </p>
      )}
      {show_count && cat.product_count != null && (
        <span className={`text-sm ${text_position === 'below' ? 'text-gray-500 dark:text-gray-400' : 'text-white/80'}`}>
          {cat.product_count} productos
        </span>
      )}
    </div>
  )

  // --- Composición según text_position ---
  const hoverClass = card_hover ? HOVER_EFFECT_CLASS[card_hover] : 'hover:shadow-lg transition-shadow'
  const shadowClass = card_shadow ? SHADOW_CLASS[card_shadow] : ''
  const shadowHover = card_shadow ? SHADOW_HOVER_CLASS[card_shadow] : 'hover:shadow-lg'

  const linkClass = [
    'block group relative overflow-hidden bg-gray-100 dark:bg-gray-800',
    radius,
    aspect || '',
    shadowClass,
    card_hover === 'lift' ? hoverClass : `${shadowHover} transition-shadow`,
    itemWidth ? '' : '',
  ].filter(Boolean).join(' ')

  const widthStyle: React.CSSProperties = itemWidth ? { width: itemWidth } : {}

  if (text_position === 'below') {
    // En modo "below" el contenedor no recorta el texto: el radius lo lleva
    // el medio (que ya tiene overflow-hidden). El contenedor usa un radius
    // suave (rounded-xl) salvo que se haya configurado card_radius.
    const belowRadius = card_radius != null ? '' : 'rounded-xl'
    return (
      <Link
        href={`/categorias/${cat.slug}`}
        className={`block group ${belowRadius} ${shadowClass} ${shadowHover} transition-shadow bg-gray-100 dark:bg-gray-800`}
        style={{ ...containerStyle, ...widthStyle }}
      >
        {media}
        <div className={alignClass} style={{ padding: paddingPx }}>
          {textBlock}
          {badge && (
            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${accent}20`, color: accent }}>
              {badge}
            </span>
          )}
        </div>
      </Link>
    )
  }

  // overlay / inside / on_hover
  const overlayBg =
    text_position === 'overlay'
      ? 'absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end'
      : text_position === 'inside'
        ? 'absolute inset-0 flex items-end'
        : 'absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end'

  return (
    <Link
      href={`/categorias/${cat.slug}`}
      className={linkClass}
      style={{ ...containerStyle, ...widthStyle }}
    >
      {media}
      <div className={`${overlayBg} ${alignClass}`} style={{ padding: paddingPx }}>
        {textBlock}
        {badge && (
          <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${accent}30`, color: '#fff' }}>
            {badge}
          </span>
        )}
      </div>
    </Link>
  )
}

export default CategoryCard
