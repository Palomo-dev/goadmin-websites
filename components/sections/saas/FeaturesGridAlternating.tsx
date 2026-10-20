import { DynamicLucideIcon } from '@/components/sections/products/DynamicLucideIcon'
import { clasesGridCaracteristicas } from '@/lib/website/presentacionTienda'

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
  }
  primaryColor?: string
  sectionVariant?: string
}

/** Hueco fijo del ícono. Vacío se queda en blanco para que la rejilla no salte. */
function IconoBeneficio({ name, color }: { name?: string; color: string }) {
  const limpio = (name ?? '').trim()
  const esLucide = /^[A-Z][A-Za-z0-9]+$/.test(limpio)
  return (
    <span
      className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl text-xl"
      style={{ backgroundColor: `${color}15`, color }}
    >
      {esLucide ? <DynamicLucideIcon name={limpio} className="h-6 w-6" fallback="Sparkles" /> : limpio || null}
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
            <div key={i} className="flex flex-col items-center text-center">
              <IconoBeneficio name={item.icon} color={primaryColor} />
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
