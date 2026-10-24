'use client'

import { UrgenciaDe } from '@/components/site/UrgenciaDe'
import { conversionDesdeColumnas, type UbicacionStock } from '@/lib/website/conversion'
import type { StockTrackable } from '@/lib/stock'

export function UrgenciaSection({ content, primaryColor = '#3B82F6', organization, data }: {
  content: Record<string, unknown>
  primaryColor?: string
  organization?: { subdomain?: string | null; timezone?: string | null }
  data?: { product?: StockTrackable; branchId?: number | null; ubicacion?: UbicacionStock; prefijoSede?: string }
}) {
  const ubicacion = data?.ubicacion ?? 'producto'
  const ubicaciones = Array.isArray(content.locations) ? content.locations as UbicacionStock[] : [ubicacion]
  if (!ubicaciones.includes(ubicacion)) return null
  const conversion = conversionDesdeColumnas({
    countdown_enabled: (content.kind ?? 'countdown') === 'countdown',
    countdown_title: content.title ?? 'La oferta termina en',
    countdown_mode: content.mode === 'custom' ? 'custom' : 'daily_reset',
    countdown_end_date: content.end_date,
    countdown_timezone: organization?.timezone || 'America/Bogota',
    countdown_reset_hour: Number(content.reset_hour) || 0,
    countdown_show_in_product: true,
    countdown_show_in_cart: true,
    checkout_show_countdown: true,
    checkout_show_stock_warning: content.kind === 'stock',
    checkout_stock_warning_threshold: Number(content.threshold) || 5,
  }) ?? { contadores: [], urgencia: { stockBajo: { activo: false, umbral: 5, plantilla: 'Quedan {n} unidades', ubicaciones: [] }, reservaCarrito: { activo: false }, personasViendo: { activo: false } } }
  conversion.urgencia.stockBajo.ubicaciones = ubicaciones
  conversion.urgencia.stockBajo.plantilla = String(content.message ?? 'Quedan {n} unidades')
  conversion.urgencia.personasViendo = { activo: content.kind === 'viewers', plantilla: String(content.message ?? '{n} personas viendo'), ubicaciones }
  conversion.contadores = conversion.contadores.map((contador) => ({
    ...contador,
    textoDespues: String(content.text_after || ''),
    estilo: {
      ...contador.estilo,
      fondo: typeof content.counter_background === 'string' ? content.counter_background : undefined,
      texto: typeof content.counter_color === 'string' ? content.counter_color : undefined,
      borde: typeof content.counter_border === 'string' ? content.counter_border : undefined,
      sombra: content.counter_shadow === true,
      forma: content.counter_shape === 'cuadrado' || content.counter_shape === 'redondo' ? content.counter_shape : 'pastilla',
      tamano: content.counter_size === 'lg' || content.counter_size === 'md' ? content.counter_size : 'sm',
      cajas: content.counter_boxes === 'digito' ? 'digito' : 'linea',
    },
  }))
  return <UrgenciaDe usarAjustesVivos={false} settings={{ conversion }} ubicacion={ubicacion} primaryColor={primaryColor} product={data?.product} organizationSubdomain={organization?.subdomain || ''} branchId={data?.branchId} prefijoSede={data?.prefijoSede} />
}
