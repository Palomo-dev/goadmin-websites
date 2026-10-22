'use client'

import HeaderClassic from './HeaderClassic'
import type { HeaderVariantProps } from './HeaderShared'

/**
 * Encabezado de comercio: el clásico con el buscador en barra.
 * Solo se usa cuando la tienda elige `header_layout = comercio`.
 */
export default function HeaderCommerce(props: HeaderVariantProps) {
  const estilo = props.settings?.search_style
  const settings = {
    ...props.settings,
    search_style: estilo === 'hidden' ? 'hidden' : 'bar',
  } as HeaderVariantProps['settings']
  return <HeaderClassic {...props} settings={settings} />
}
