import type { Json } from '@/types/database'
import { buildSectionStyle } from '@/lib/sectionStyle'

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
  sectionType?: string
  sectionId?: string
  children: React.ReactNode
}

// Anchos máximos por container_width del contrato de estilo
const CONTAINER_MAX: Record<string, string> = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-7xl',
  xl: 'max-w-[1400px]',
  full: 'max-w-none',
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

export function SectionWrapper({ settings, content, primaryColor, sectionType, sectionId, children }: SectionWrapperProps) {
  const paddingTop = content?.padding_top || 'lg'
  const paddingBottom = content?.padding_bottom || 'lg'
  const paddingX = content?.padding_x || 'md'
  const marginTop = content?.margin_top || 'none'
  const marginBottom = content?.margin_bottom || 'none'

  // full_bleed: default true solo para hero, false para el resto
  const isHero = sectionType === 'hero'
  const isFullBleed = content?.full_bleed === true
    || (content?.full_bleed === undefined && content?.container_width === undefined && isHero)
    || content?.container_width === 'full'

  // overlap_header: solo aplica a hero; default true para hero, false para el resto
  const overlapHeader = isHero && content?.overlap_header !== false

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

  // Cuando overlap_header es true, el hero sube debajo del header transparente.
  // El padding-top se maneja via --header-h en el componente del hero (no aquí),
  // pero respetamos el padding_bottom y margin_bottom del editor.
  // Si el usuario configura explícitamente padding_top o margin_top, lo respetamos
  // incluso con overlap (sobreescribe el comportamiento automático).
  const pt = overlapHeader
    ? (content?.padding_top && content?.padding_top !== 'lg' ? (ptMap[paddingTop] || '') : '')
    : (ptMap[paddingTop] || ptMap.lg)
  const pb = pbMap[paddingBottom] || pbMap.lg
  const px = PADDING_X_MAP[paddingX] || PADDING_X_MAP.md
  const mt = overlapHeader
    ? (content?.margin_top && content?.margin_top !== 'none' ? (mtMap[marginTop] || '') : '')
    : (mtMap[marginTop] || '')
  const mb = mbMap[marginBottom] || ''

  // ---- Contrato de estilo (F2.1) ----
  // buildSectionStyle traduce content + settings a clases estáticas + CSS vars.
  // Devuelve clases de fondo/texto/radio/sombra/borde + layout (w-full, mx-auto, max-w-*).
  // El layout se descarta aquí porque el <div> interno ya lo maneja (con px).
  const { className: contractClassName, style: contractStyle } = buildSectionStyle(
    content,
    settings,
    sectionType,
  )

  // Filtrar clases de layout que maneja el div interno (w-full, mx-auto, max-w-*)
  const visualClasses = contractClassName
    .split(' ')
    .filter((cls) => cls && !['w-full', 'mx-auto'].includes(cls) && !cls.startsWith('max-w-'))
    .join(' ')

  // Merge: el estilo del contrato (bg image, gradient, border, CSS vars) + fallback viejo
  const style: React.CSSProperties = { ...contractStyle }
  const hasContractBg = '--sec-bg' in (contractStyle as any)
  const hasContractText = '--sec-text' in (contractStyle as any)

  // Fallback: si el contrato no aplicó bg/text (bg_type ausente), usar formato viejo de settings
  if (!hasContractBg && settings.bg_color) (style as any)['--section-bg'] = settings.bg_color
  if (!hasContractText && settings.text_color) (style as any)['--section-text'] = settings.text_color

  const bgClass = !hasContractBg && settings.bg_color
    ? 'bg-[var(--section-bg)] dark:bg-gray-900/40'
    : ''
  const textClass = !hasContractText && settings.text_color
    ? 'text-[var(--section-text)] dark:text-gray-100'
    : ''

  // Contenedor interno: full-bleed (w-full) o ancho explícito con max-w + mx-auto
  // Para hero full-bleed NO añadimos padding (el hero gestiona su propio padding interno).
  // Para secciones no-hero full-bleed sí añadimos padding horizontal para que el contenido
  // no quede pegado a los bordes.
  const containerWidth = content?.container_width || 'lg'
  const innerClass = isFullBleed
    ? (isHero ? 'w-full' : `w-full ${px}`)
    : `w-full mx-auto ${CONTAINER_MAX[containerWidth] || CONTAINER_MAX.lg} ${px}`

  return (
    <section
      className={`w-full ${pt} ${pb} ${mt} ${mb} ${bgClass} ${textClass} ${visualClasses}`}
      style={style}
      data-section-id={sectionId}
    >
      <div className={innerClass}>
        {children}
      </div>
    </section>
  )
}
