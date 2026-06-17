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
  content?: Record<string, any>
  primaryColor?: string
  children: React.ReactNode
}

const PADDING_Y_MAP: Record<string, string> = {
  none: '',
  xs: 'py-2',
  sm: 'py-4 md:py-6',
  md: 'py-8 md:py-12',
  lg: 'py-12 md:py-16',
  xl: 'py-16 md:py-24',
}

const PADDING_X_MAP: Record<string, string> = {
  none: 'px-0',
  sm: 'px-2 md:px-4',
  md: 'px-4 md:px-6 lg:px-8',
  lg: 'px-6 md:px-10 lg:px-16',
  xl: 'px-8 md:px-16 lg:px-24',
}

const MARGIN_MAP: Record<string, string> = {
  none: '',
  xs: '2',
  sm: '4',
  md: '8',
  lg: '12',
  xl: '16',
}

export function SectionWrapper({ settings, content, primaryColor, children }: SectionWrapperProps) {
  const paddingTop = content?.padding_top || 'lg'
  const paddingBottom = content?.padding_bottom || 'lg'
  const paddingX = content?.padding_x || 'md'
  const marginTop = content?.margin_top || 'none'
  const marginBottom = content?.margin_bottom || 'none'

  // Construir clases de padding vertical individuales
  const ptMap: Record<string, string> = {
    none: '', xs: 'pt-2', sm: 'pt-4 md:pt-6', md: 'pt-8 md:pt-12', lg: 'pt-12 md:pt-16', xl: 'pt-16 md:pt-24',
  }
  const pbMap: Record<string, string> = {
    none: '', xs: 'pb-2', sm: 'pb-4 md:pb-6', md: 'pb-8 md:pb-12', lg: 'pb-12 md:pb-16', xl: 'pb-16 md:pb-24',
  }
  const mtMap: Record<string, string> = {
    none: '', xs: 'mt-2', sm: 'mt-4', md: 'mt-8', lg: 'mt-12', xl: 'mt-16',
  }
  const mbMap: Record<string, string> = {
    none: '', xs: 'mb-2', sm: 'mb-4', md: 'mb-8', lg: 'mb-12', xl: 'mb-16',
  }

  const pt = ptMap[paddingTop] || ptMap.lg
  const pb = pbMap[paddingBottom] || pbMap.lg
  const px = PADDING_X_MAP[paddingX] || PADDING_X_MAP.md
  const mt = mtMap[marginTop] || ''
  const mb = mbMap[marginBottom] || ''

  const style: React.CSSProperties = {}
  if (settings.bg_color) style.backgroundColor = settings.bg_color
  if (settings.text_color) style.color = settings.text_color

  return (
    <section className={`w-full ${pt} ${pb} ${mt} ${mb}`} style={style}>
      <div className={`container mx-auto ${px}`}>
        {children}
      </div>
    </section>
  )
}
