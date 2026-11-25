/**
 * `product_anchor_nav · tabs` («Pestañas de la ficha», plantillas de tienda): pestañas de verdad
 * debajo de las dos columnas (Figma «Ficha — pestañas reales» 3255-99475, aprobado 2026-11-25).
 *
 * ProductDetailRenderer arma los paneles (`data.pestanasFicha`): saca de su sitio los bloques
 * Descripción, Características, Envío y devoluciones, Reseñas y Preguntas que tienen pestaña y
 * los pinta aquí, cada uno en su panel, con PestanasFicha (la misma pieza del estilo «Pestañas»
 * de la descripción). Sin paneles (ficha sin bloques con pestaña), no pinta nada.
 */

import { CLAVES_SECCION_TIENDA, normalizarPestanasAncla } from '@/lib/website/v2/contrato/seccionesTienda'
import { PestanasFicha, type PestanaFicha, type ResenasPestana } from './PestanasFicha'

export const CONTENT_KEYS = CLAVES_SECCION_TIENDA['product_anchor_nav.tabs']

/** Lo que arma ProductDetailRenderer para este bloque. */
export interface DatosPestanasFicha {
  items: PestanaFicha[]
  resenas: ResenasPestana | null
}

interface NavAnclasProps {
  content: Record<string, any>
  primaryColor?: string
  data?: { pestanasFicha?: DatosPestanasFicha | null }
}

export function NavAnclas({ content, primaryColor = '#111827', data }: NavAnclasProps) {
  const datos = data?.pestanasFicha
  if (!datos || datos.items.length === 0) return null
  const { sticky, celular } = normalizarPestanasAncla(content)
  return (
    <PestanasFicha
      items={datos.items}
      colorActivo={primaryColor}
      celular={celular}
      variasAbiertas
      medir
      sticky={sticky}
      escuchar
      etiqueta="Información del producto"
      titulos="bloque"
      resenas={datos.resenas}
      marca="data-pestanas-ancla"
    />
  )
}
NavAnclas.CONTENT_KEYS = CONTENT_KEYS
