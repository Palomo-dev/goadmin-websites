import { DynamicLucideIcon } from '@/components/sections/products/DynamicLucideIcon'

export interface EstiloIconoBeneficio {
  icon_size?: number
  icon_color?: string
  icon_background?: string
  icon_shape?: 'circle' | 'square' | 'rounded' | 'none'
}

export function BeneficioIcono({ name, color, content, className = '' }: {
  name?: string
  color: string
  content: EstiloIconoBeneficio
  className?: string
}) {
  const limpio = (name ?? '').trim()
  if (!limpio) return null
  const size = Math.max(12, Math.min(64, Number(content.icon_size) || 24))
  const shape = content.icon_shape ?? 'rounded'
  const iconColor = content.icon_color || color
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${className}`} style={{
      width: size + (shape === 'none' ? 0 : 24),
      height: size + (shape === 'none' ? 0 : 24),
      fontSize: size,
      color: iconColor,
      backgroundColor: shape === 'none' ? 'transparent' : content.icon_background || `${color}15`,
      borderRadius: shape === 'circle' ? 9999 : shape === 'rounded' ? 12 : 0,
    }}>
      {/^[A-Z][A-Za-z0-9]+$/.test(limpio)
        ? <DynamicLucideIcon name={limpio} style={{ width: size, height: size }} fallback="Sparkles" />
        : limpio}
    </span>
  )
}
