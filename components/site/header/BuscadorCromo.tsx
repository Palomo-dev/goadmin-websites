'use client'

import { Search, ScanSearch } from 'lucide-react'
import { ProductSearch } from '../ProductSearch'
import { SearchBarInput } from '../SearchBarInput'
import type { ReactNode } from 'react'
import { colorDeToken, buscadorEnBarra, leerConstructor, type ContenedorIconos, type CromoBuscador } from '@/lib/website/constructorEncabezado'
import type { ColoresCaja } from './ContenedorIcono'

/** La barra de hoy si no hay cromo nuevo. El overlay no ocupa la barra. */
export function barraSiCromo(
  settings: unknown,
  actual: ReactNode,
  props: { primaryColor: string; organizationId?: number; className?: string },
): ReactNode {
  const cromo = leerConstructor(settings)?.buscador
  if (!cromo || !buscadorEnBarra(cromo.tipo)) return actual
  const ajuste = settings as { accent_color?: string; secondary_color?: string } | null
  return <BuscadorCromo presentacion={cromo} primaryColor={props.primaryColor} organizationId={props.organizationId} className={props.className} colores={{ primary: props.primaryColor, accent: ajuste?.accent_color || props.primaryColor, secondary: ajuste?.secondary_color || props.primaryColor }} />
}

const RADIO: Record<CromoBuscador['radius'], string> = {
  square: 'rounded-none',
  rounded: 'rounded-md',
  semi: 'rounded-lg',
  pill: 'rounded-full',
  circle: 'rounded-full',
}

/**
 * Apariencia del buscador. El campo y los resultados son `SearchBarInput` o `ProductSearch`.
 * Solo se monta cuando `leerConstructor` trae un cromo nuevo.
 */
export function BuscadorCromo({
  presentacion,
  primaryColor,
  className = '',
  categorias = [],
  contenedor = null,
  colores,
}: {
  presentacion: CromoBuscador
  primaryColor: string
  organizationId?: number
  className?: string
  categorias?: { id: number; name: string }[]
  contenedor?: ContenedorIconos | null
  colores?: ColoresCaja
}) {
  const Icono = presentacion.icon === 'scan-search' ? ScanSearch : Search
  const paleta = colores ?? { primary: primaryColor, accent: primaryColor, secondary: primaryColor }
  const color = (v: string | undefined) => colorDeToken(v, paleta)
  if (presentacion.tipo === 'icon_overlay') {
    return (
      <ProductSearch
        primaryColor={primaryColor}
        icon={Icono}
        pantallaCompleta={presentacion.mobile === 'fullscreen'}
        contenedor={contenedor}
        colores={colores}
      />
    )
  }
  const ancho = presentacion.tipo === 'mini' ? 'max-w-[9rem] focus-within:max-w-md transition-all' : ''
  const sombra = presentacion.shadow ? 'shadow-lg' : ''
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        const query = e.currentTarget.querySelector('input')?.value.trim()
        if (query) window.location.href = `/search?q=${encodeURIComponent(query)}`
      }}
      className={`flex min-w-0 items-center gap-2 ${ancho} ${sombra} ${RADIO[presentacion.radius]} ${presentacion.tipo === 'mega' ? 'w-full min-w-[16rem]' : ''} ${className}`}
      style={{ maxWidth: presentacion.width, ...(presentacion.tipo === 'underline' ? { borderBottom: `2px solid ${color(presentacion.borderColor) || primaryColor}`, borderRadius: 0 } : {}) }}
      data-buscador={presentacion.tipo}
    >
      <div className="min-w-0 flex-1">
        <SearchBarInput
          primaryColor={primaryColor}
          className="w-full"
          size={presentacion.tipo === 'mini' ? 'sm' : 'lg'}
          icon={Icono}
          cromo={{
            radius: presentacion.radius,
            border: presentacion.border,
            borderColor: color(presentacion.borderColor),
            background: color(presentacion.background),
            iconSide: presentacion.iconSide,
            iconColor: color(presentacion.iconColor),
            iconBackground: color(presentacion.iconBackground),
          }}
          {...(presentacion.placeholder ? { placeholder: presentacion.placeholder } : {})}
        />
      </div>
      {presentacion.button !== 'none' && (
        <button
          type="submit"
          className="inline-flex h-11 shrink-0 items-center gap-1 px-3 text-sm font-medium text-white"
          style={{ backgroundColor: primaryColor, borderRadius: presentacion.radius === 'pill' ? 999 : 8 }}
          aria-label="Buscar"
        >
          {presentacion.button === 'icon' ? <Search className="h-4 w-4" /> : 'Buscar'}
        </button>
      )}
    </form>
  )
}
