import type { Json } from '@/types/database'

interface SectionSettings {
  bg_color?: string | null
  text_color?: string | null
  padding?: 'small' | 'medium' | 'large' | 'none'
  max_width?: string
  [key: string]: Json | undefined
}

interface SectionWrapperProps {
  settings: SectionSettings
  primaryColor?: string
  children: React.ReactNode
}

const PADDING_MAP = {
  none: 'py-0',
  small: 'py-8',
  medium: 'py-12 md:py-16',
  large: 'py-16 md:py-24',
}

export function SectionWrapper({ settings, primaryColor, children }: SectionWrapperProps) {
  const padding = PADDING_MAP[settings.padding || 'large']

  const style: React.CSSProperties = {}
  if (settings.bg_color) style.backgroundColor = settings.bg_color
  if (settings.text_color) style.color = settings.text_color

  return (
    <section className={`w-full ${padding}`} style={style}>
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        {children}
      </div>
    </section>
  )
}
