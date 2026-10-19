import { DynamicLucideIcon } from '@/components/sections/products/DynamicLucideIcon'

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
    items?: ItemBeneficio[]
  }
  primaryColor?: string
  sectionVariant?: string
}

function IconoBeneficio({ name, color }: { name: string; color: string }) {
  const esLucide = /^[A-Z][A-Za-z0-9]+$/.test(name)
  return (
    <span
      className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl text-xl"
      style={{ backgroundColor: `${color}15`, color }}
    >
      {esLucide ? <DynamicLucideIcon name={name} className="h-6 w-6" fallback="Sparkles" /> : name}
    </span>
  )
}

export function FeaturesGridAlternating({ content, primaryColor = '#3B82F6', sectionVariant }: FeaturesGridAlternatingProps) {
  const items = content.items || []
  const modo = content.presentacion === 'icono' || content.presentacion === 'texto' || content.presentacion === 'imagen'
    ? content.presentacion
    : sectionVariant === 'icons'
      ? 'icono'
      : 'imagen'

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-12">{content.subtitle}</p>
      )}
      <div className="space-y-16 max-w-5xl mx-auto">
        {items.map((item, i) => {
          const titulo = item.title || item.label || ''
          const mostrarImagen = modo === 'imagen' && !!item.image_url
          const mostrarIcono = modo === 'icono' || (modo === 'imagen' && !item.image_url && !!item.icon)
          return (
            <div key={i} className={`flex flex-col items-center gap-8 ${mostrarImagen ? `md:flex-row ${i % 2 === 1 ? 'md:flex-row-reverse' : ''}` : ''}`}>
              <div className="flex-1">
                {mostrarIcono && item.icon && <IconoBeneficio name={item.icon} color={primaryColor} />}
                {titulo && <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">{titulo}</h3>}
                {item.description && (
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{item.description}</p>
                )}
              </div>
              {mostrarImagen && (
                <div className="flex-1 w-full">
                  <img src={item.image_url} alt={titulo} className="w-full rounded-xl shadow-lg" loading="lazy" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
