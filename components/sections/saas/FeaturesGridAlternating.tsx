import { DynamicLucideIcon } from '@/components/sections/products/DynamicLucideIcon'
import { clasesImagenBeneficio, estiloMarcoImagen } from '@/lib/website/marcoImagen'
import { clasesGridCaracteristicas } from '@/lib/website/presentacionTienda'
import { estiloTarjetaBeneficio as estiloPresetBeneficio, iconoBeneficio, type ContenidoBeneficio } from '@/lib/website/tarjetaBeneficio'
import {
  alineacionTexto,
  claseSombraBeneficio,
  clasesRejillaBeneficios,
  colorIconoBeneficio,
  disposicionBeneficio,
  estiloTarjetaBeneficio,
  formaIconoBeneficio,
  hayTarjetaBeneficio,
  tamanoIconoBeneficio,
  type DisposicionBeneficio,
} from '@/lib/website/filaBeneficio'

interface ItemBeneficio {
  icon?: string
  icon_source?: string
  icon_name?: string
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
    image_fit?: string
    image_ratio?: string
    image_max_size?: number
    image_padding?: number
    image_bg?: string
    /** Número, o `{ desktop, tablet, mobile }` si el editor guardó columnas por dispositivo. */
    columns?: unknown
    items?: ItemBeneficio[]
    item_layout?: string
    icon_size?: string | number
    icon_color?: string
    icon_shape?: string
    icon_bg?: boolean
    icon_background?: string
    icon_style?: string
    card_preset?: string
    text_align?: string
    card_radius?: number
    card_shadow?: string
    card_bg?: string
    card_padding?: number
    card_border_width?: number
    card_border_color?: string
  }
  primaryColor?: string
  sectionVariant?: string
}

/** Hueco del ícono solo cuando hay uno. Sin ícono no se reserva el cuadrado. */
function IconoBeneficio({ name, color, content = {} }: { name?: string; color: string; content?: ContenidoBeneficio }) {
  const limpio = (name ?? '').trim()
  if (!limpio) return null
  const esLucide = /^[A-Z][A-Za-z0-9]+$/.test(limpio)
  const icono = iconoBeneficio(content, color)
  return (
    <span
      className={icono.clase}
      style={icono.estilo}
    >
      {esLucide ? <DynamicLucideIcon name={limpio} style={{ width: content.icon_size === 'lg' ? 32 : content.icon_size === 'sm' ? 16 : 24, height: content.icon_size === 'lg' ? 32 : content.icon_size === 'sm' ? 16 : 24 }} fallback="Sparkles" /> : limpio || null}
    </span>
  )
}

function nombreLucide(item: ItemBeneficio): string {
  const pedido = (item.icon_name || '').trim()
  if (pedido) return pedido
  const legado = (item.icon || '').trim()
  return /^[A-Z][A-Za-z0-9]+$/.test(legado) ? legado : ''
}

/** Ícono o foto pequeña. La foto no usa `object-cover` ni `w-full`. */
function MedioChico({
  item,
  color,
  caja,
  icono,
  forma,
  fondo,
  fondoColor,
}: {
  item: ItemBeneficio
  color: string
  caja: number
  icono: number
  forma: string
  fondo: boolean
  fondoColor?: string
}) {
  const lucide = item.icon_source === 'icon' ? nombreLucide(item) : ''
  const foto = item.icon_source === 'icon' ? '' : (item.image_url || '').trim()
  const emoji = !lucide && !foto ? (item.icon || '').trim() : ''
  if (!lucide && !foto && !emoji) return null
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${forma}`}
      style={{
        width: caja,
        height: caja,
        color,
        backgroundColor: fondo ? fondoColor || `color-mix(in srgb, ${color} 12%, transparent)` : 'transparent',
      }}
    >
      {lucide ? (
        <DynamicLucideIcon name={lucide} fallback="Sparkles" style={{ width: icono, height: icono }} />
      ) : foto ? (
        <img src={foto} alt="" className="object-contain" style={{ width: icono, height: icono }} />
      ) : (
        <span className="text-xl leading-none">{emoji}</span>
      )}
    </span>
  )
}

function textos(alineacion: 'left' | 'center' | 'right'): string {
  if (alineacion === 'right') return 'text-right'
  if (alineacion === 'center') return 'text-center'
  return 'text-left'
}

function FotoBeneficio({ src, alt, content }: { src: string; alt: string; content: FeaturesGridAlternatingProps['content'] }) {
  return (
    <img
      src={src}
      alt={alt}
      className={clasesImagenBeneficio(content)}
      style={estiloMarcoImagen(content)}
      loading="lazy"
    />
  )
}

export function FeaturesGridAlternating({ content, primaryColor = '#3B82F6', sectionVariant }: FeaturesGridAlternatingProps) {
  const items = content.items || []
  const presentacion = content.presentacion || (sectionVariant === 'icons' ? 'icono' : 'imagen')
  const layout = disposicionBeneficio(content.item_layout)
  const apilado = layout === 'stacked'
  const sombraFila = claseSombraBeneficio(content)
  const estiloFila = estiloTarjetaBeneficio(content)
  const preset = content.card_preset === 'tarjetas' && !hayTarjetaBeneficio(content)
  const sombra = sombraFila || (preset ? 'shadow-sm' : '')
  const estiloTarjeta = preset ? { ...estiloPresetBeneficio(content), ...estiloFila } : estiloFila
  const alineacion = alineacionTexto(content.text_align, layout)
  const medidas = tamanoIconoBeneficio(content.icon_size, layout)
  const color = colorIconoBeneficio(content.icon_color, primaryColor, 'var(--accent-color)')
  const forma = formaIconoBeneficio(content.icon_shape)

  return (
    <div>
      {content.title && (
        <h2 className="titulo-legado text-2xl md:text-3xl font-bold text-center mb-3 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-12">{content.subtitle}</p>
      )}
      <div className={apilado ? clasesGridCaracteristicas(content.columns) : clasesRejillaBeneficios(content.columns, layout)}>
        {items.map((item, i) => {
          const titulo = item.title || item.label || ''
          const colorDeMarca = content.icon_color == null || content.icon_color === '' || content.icon_color === 'primary'
          if (apilado && !content.icon_style && !content.icon_size && !content.icon_shape && !content.icon_background && !sombra && Object.keys(estiloTarjeta).length === 0 && !content.text_align && colorDeMarca) {
            return (
              <div key={i} className="flex flex-col items-center text-center">
                {presentacion !== 'texto' && <IconoBeneficio name={item.icon_source === 'icon' ? item.icon_name : item.icon} color={primaryColor} content={content} />}
                {presentacion === 'imagen' && item.icon_source !== 'icon' && item.image_url ? (
                  <FotoBeneficio src={item.image_url} alt={titulo} content={content} />
                ) : null}
                {titulo ? <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">{titulo}</h3> : null}
                {item.description ? (
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{item.description}</p>
                ) : null}
              </div>
            )
          }
          if (apilado) {
            const claseTexto = textos(alineacion)
            return (
              <div key={i} className={`flex flex-col ${alineacion === 'left' ? 'items-start' : alineacion === 'right' ? 'items-end' : 'items-center'} ${claseTexto} ${sombra}`} style={estiloTarjeta}>
                {presentacion !== 'texto' && <IconoBeneficio name={item.icon_source === 'icon' ? item.icon_name : item.icon} color={color} content={content} />}
                {presentacion === 'imagen' && item.icon_source !== 'icon' && item.image_url ? (
                  <FotoBeneficio src={item.image_url} alt={titulo} content={content} />
                ) : null}
                {titulo ? <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">{titulo}</h3> : null}
                {item.description ? (
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{item.description}</p>
                ) : null}
              </div>
            )
          }
          const medio = presentacion === 'texto' ? null : (
            <MedioChico
              item={presentacion === 'icono' ? { ...item, image_url: undefined } : item}
              color={color}
              caja={medidas.caja}
              icono={medidas.icono}
              forma={forma}
              fondo={content.icon_bg === true || !!content.icon_background}
              fondoColor={content.icon_background}
            />
          )
          const bloque = (
            <div className={`min-w-0 ${textos(alineacion)}`}>
              {titulo ? <h3 className="text-lg font-bold mb-1 text-gray-900 dark:text-white">{titulo}</h3> : null}
              {item.description ? (
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{item.description}</p>
              ) : null}
            </div>
          )
          if (layout === 'icon_left') {
            return (
              <div key={i} className={`flex items-start gap-4 ${sombra}`} style={estiloTarjeta}>
                {medio}
                {bloque}
              </div>
            )
          }
          return (
            <div
              key={i}
              className={`flex flex-col gap-3 ${alineacion === 'left' ? 'items-start' : alineacion === 'right' ? 'items-end' : 'items-center'} ${sombra}`}
              style={estiloTarjeta}
            >
              {medio}
              {bloque}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export type { DisposicionBeneficio }
