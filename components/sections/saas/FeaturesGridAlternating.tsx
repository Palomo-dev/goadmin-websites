import { DynamicLucideIcon } from '@/components/sections/products/DynamicLucideIcon'
import { clasesGridCaracteristicas } from '@/lib/website/presentacionTienda'
import { claseTarjetaBeneficio, estiloTarjetaBeneficio, iconoBeneficio, type ContenidoBeneficio } from '@/lib/website/tarjetaBeneficio'

interface ItemBeneficio {
  icon?: string
  label?: string
  title?: string
  description?: string
  image_url?: string
}

interface FeaturesGridAlternatingProps {
  content: {
    title?: string
    subtitle?: string
    /** `imagen` (por defecto), `icono` o `texto`. La variante `icons` equivale a ícono. */
    presentacion?: string
    /** Número, o `{ desktop, tablet, mobile }` si el editor guardó columnas por dispositivo. */
    columns?: unknown
    items?: ItemBeneficio[]
    card_preset?: string
    card_radius?: number
    card_shadow?: string
    card_bg?: string
    card_padding?: number
    card_border_width?: number
    card_border_color?: string
    icon_style?: string
    icon_color?: string
    icon_size?: string
    icon_shape?: string
  }
  primaryColor?: string
  sectionVariant?: string
}

/** Hueco del ícono solo cuando hay uno. Sin ícono no se reserva el cuadrado. */
function IconoBeneficio({ name, color, contenido }: { name?: string; color: string; contenido: ContenidoBeneficio }) {
  const limpio = (name ?? '').trim()
  if (!limpio) return null
  const esLucide = /^[A-Z][A-Za-z0-9]+$/.test(limpio)
  const icono = iconoBeneficio(contenido, color)
  const grande = contenido.icon_size === 'lg'
  return (
    <span className={icono.clase} style={icono.estilo}>
      {esLucide ? <DynamicLucideIcon name={limpio} className={grande ? 'h-8 w-8' : 'h-6 w-6'} fallback="Sparkles" /> : limpio || null}
    </span>
  )
}

export function FeaturesGridAlternating({ content, primaryColor = '#3B82F6' }: FeaturesGridAlternatingProps) {
  const items = content.items || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-12">{content.subtitle}</p>
      )}
      <div className={clasesGridCaracteristicas(content.columns)}>
        {items.map((item, i) => {
          const titulo = item.title || item.label || ''
          return (
            <div key={i} className={claseTarjetaBeneficio(content)} style={estiloTarjetaBeneficio(content)}>
              <IconoBeneficio name={item.icon} color={primaryColor} contenido={content} />
              {item.image_url ? (
                <img src={item.image_url} alt={titulo} className="mb-4 w-full max-h-48 rounded-xl object-cover" loading="lazy" />
              ) : null}
              {titulo ? <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">{titulo}</h3> : null}
              {item.description ? (
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{item.description}</p>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
