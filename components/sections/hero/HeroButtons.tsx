'use client'

import Link from 'next/link'
import * as LucideIcons from 'lucide-react'

// ============================================================
// HeroButtons — renderiza botones del repeater `buttons` (F3.2)
//
// Compatible con el botón único heredado (cta_text/cta_url):
// si `buttons` está vacío o no existe, cae al botón único.
// ============================================================

/** Tipo laxo para un icono Lucide resuelto por nombre. */
type IconComponent = React.ComponentType<{ size?: number; className?: string }>

export interface HeroButtonItem {
  label?: string
  url?: string
  variant?: 'solid' | 'outline' | 'ghost' | 'link'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  icon?: string
  icon_position?: 'left' | 'right'
  bg_color?: string
  text_color?: string
  radius?: number
  full_width_mobile?: boolean
  open_new_tab?: boolean
}

interface HeroButtonsProps {
  /** Items del repeater `buttons`. */
  buttons?: HeroButtonItem[]
  /** Botón único heredado (fallback). */
  ctaText?: string
  ctaUrl?: string
  /** Color primario de la organización (fallback para bg/texto). */
  primaryColor: string
  /** Si false, no se renderiza nada. */
  showCta?: boolean
  /** Layout de los botones. */
  layout?: 'row' | 'column'
  /** Clase extra del contenedor. */
  className?: string
}

const SIZE_CLASSES: Record<string, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-3 text-lg',
  xl: 'px-10 py-4 text-xl',
}

const ICON_SIZE: Record<string, number> = {
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
}

/** Resuelve un icono Lucide por nombre. Devuelve null si no existe. */
function resolveIcon(name?: string): IconComponent | null {
  if (!name) return null
  const icons = LucideIcons as unknown as Record<string, IconComponent>
  const Icon = icons[name]
  return Icon || null
}

/** Estilos inline de un botón según su variante y colores. */
function buttonStyle(
  variant: HeroButtonItem['variant'],
  primaryColor: string,
  bgColor?: string,
  textColor?: string,
): React.CSSProperties {
  const style: React.CSSProperties = {}
  if (variant === 'solid') {
    style.backgroundColor = bgColor || primaryColor
    style.color = textColor || '#FFFFFF'
  } else if (variant === 'outline') {
    style.borderColor = bgColor || primaryColor
    style.color = textColor || primaryColor
    style.borderWidth = 2
    style.borderStyle = 'solid'
  } else if (variant === 'ghost') {
    style.color = textColor || '#FFFFFF'
  } else if (variant === 'link') {
    style.color = textColor || primaryColor
  }
  return style
}

function HeroButton({
  btn,
  primaryColor,
}: {
  btn: HeroButtonItem
  primaryColor: string
}) {
  const label = btn.label || ''
  const url = btn.url || '#'
  if (!label) return null

  const variant = btn.variant || 'solid'
  const size = btn.size || 'md'
  const radius = btn.radius ?? 8
  const Icon = resolveIcon(btn.icon)
  const iconPos = btn.icon_position || 'left'
  const iconSize = ICON_SIZE[size] || 18

  const baseClass = [
    'inline-flex items-center justify-center gap-2 font-semibold transition-transform hover:scale-105',
    SIZE_CLASSES[size] || SIZE_CLASSES.md,
    variant === 'outline' ? 'border-2 bg-transparent hover:bg-black/5' : '',
    variant === 'ghost' ? 'bg-white/10 backdrop-blur hover:bg-white/20' : '',
    variant === 'link' ? 'underline-offset-4 hover:underline' : '',
    btn.full_width_mobile !== false ? 'w-full sm:w-auto' : '',
  ].join(' ')

  const style: React.CSSProperties = {
    borderRadius: `${radius}px`,
    ...buttonStyle(variant, primaryColor, btn.bg_color, btn.text_color),
  }

  const content = (
    <>
      {Icon && iconPos === 'left' && <Icon size={iconSize} />}
      {label}
      {Icon && iconPos === 'right' && <Icon size={iconSize} />}
    </>
  )

  if (btn.open_new_tab) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={baseClass}
        style={style}
      >
        {content}
      </a>
    )
  }

  return (
    <Link href={url} className={baseClass} style={style}>
      {content}
    </Link>
  )
}

export function HeroButtons({
  buttons,
  ctaText,
  ctaUrl,
  primaryColor,
  showCta = true,
  layout = 'row',
  className = '',
}: HeroButtonsProps) {
  if (!showCta) return null

  // Repetear de botones (F3.2)
  if (buttons && buttons.length > 0) {
    const containerClass =
      layout === 'column'
        ? `flex flex-col gap-3 ${className}`
        : `flex flex-wrap gap-4 ${className}`
    return (
      <div className={containerClass}>
        {buttons.map((btn, i) => (
          <HeroButton key={i} btn={btn} primaryColor={primaryColor} />
        ))}
      </div>
    )
  }

  // Fallback: botón único heredado
  if (!ctaText || !ctaUrl) return null
  return (
    <div className={className}>
      <HeroButton
        btn={{ label: ctaText, url: ctaUrl, variant: 'solid', size: 'lg' }}
        primaryColor={primaryColor}
      />
    </div>
  )
}
