'use client'

import { CountdownBanner } from '@/components/site/CountdownBanner'
import { ContadoresDe } from '@/components/site/ContadorPublico'
import { avisoStock, contadoresEn, type ConversionSitio } from '@/lib/website/conversion'
import { personasEstables, textoConNumero } from '@/lib/website/urgenciaSeccion'

interface ContenidoUrgencia {
  show_countdown?: boolean
  show_stock?: boolean
  show_viewers?: boolean
  title?: string
  stock_text?: string
  stock_threshold?: number
  viewer_text?: string
  accent?: string
  shape?: 'pill' | 'rounded' | 'square'
}

/**
 * Contador, stock y aviso de interés. Los tres interruptores nacen apagados:
 * una sección recién agregada no pinta nada.
 */
export function UrgenciaSeccion({
  content,
  organization,
  primaryColor = '#3B82F6',
  sectionVariant,
  sectionId,
  data,
}: {
  content: ContenidoUrgencia
  organization?: { website_settings?: { conversion?: ConversionSitio; countdown_timezone?: string } | null }
  primaryColor?: string
  sectionVariant?: string
  sectionId?: string
  data?: { product?: { id?: number | string; track_stock?: boolean | null; stock_levels?: { qty_on_hand?: number | null }[] | null } }
}) {
  const cuenta = content.show_countdown === true
  const stock = content.show_stock === true
  const viendo = content.show_viewers === true
  if (!cuenta && !stock && !viendo) return null

  const conversion = organization?.website_settings?.conversion
  const delDocumento = cuenta ? contadoresEn(conversion, 'seccion') : null
  const color = typeof content.accent === 'string' && content.accent ? content.accent : primaryColor
  const forma = content.shape === 'square' ? 'rounded-md' : content.shape === 'pill' ? 'rounded-full' : 'rounded-xl'
  const producto = data?.product
  const unidades = stockReal(producto)
  const umbral = Number(content.stock_threshold) || conversion?.urgencia.stockBajo.umbral || 5
  const aviso = stock
    ? avisoStock(unidades, umbral, content.stock_text || conversion?.urgencia.stockBajo.plantilla || 'Quedan {n} unidades')
    : null
  const semilla = String(producto?.id ?? sectionId ?? 'seccion')

  return (
    <div
      className={`flex flex-col gap-2 px-4 py-3 text-sm ${forma} ${sectionVariant === 'banner' ? 'text-center' : ''}`}
      data-urgencia=""
      style={{ background: `${color}14`, color }}
    >
      {cuenta && delDocumento && delDocumento.length > 0 && (
        <ContadoresDe settings={organization?.website_settings} ubicacion="seccion" primaryColor={color} variante={sectionVariant === 'banner' ? 'banner' : 'inline'} />
      )}
      {cuenta && (!delDocumento || delDocumento.length === 0) && (
        <CountdownBanner
          config={{
            countdown_enabled: true,
            countdown_title: content.title || 'La oferta termina en',
            countdown_mode: 'daily_reset',
            countdown_reset_hour: 0,
            countdown_timezone: organization?.website_settings?.countdown_timezone || 'America/Bogota',
          }}
          primaryColor={color}
          variant={sectionVariant === 'banner' ? 'banner' : 'inline'}
        />
      )}
      {aviso && <p data-urgencia-stock="">{aviso}</p>}
      {viendo && <p data-urgencia-viendo="">{textoConNumero(content.viewer_text || '{n} personas viendo', personasEstables(semilla))}</p>}
    </div>
  )
}

function stockReal(product: { track_stock?: boolean | null; stock_levels?: { qty_on_hand?: number | null }[] | null } | undefined): number | null {
  if (!product?.track_stock || !Array.isArray(product.stock_levels)) return null
  return product.stock_levels.reduce((suma, nivel) => suma + Number(nivel?.qty_on_hand || 0), 0)
}
