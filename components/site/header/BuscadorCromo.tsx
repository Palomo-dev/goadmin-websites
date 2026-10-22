'use client'

import { Search } from 'lucide-react'
import { ProductSearch } from '../ProductSearch'
import { SearchBarInput } from '../SearchBarInput'
import type { ReactNode } from 'react'
import { buscadorEnBarra, leerConstructor, type CromoBuscador } from '@/lib/website/constructorEncabezado'

/** La barra de hoy si no hay cromo nuevo. El overlay no ocupa la barra. */
export function barraSiCromo(
  settings: unknown,
  actual: ReactNode,
  props: { primaryColor: string; organizationId?: number; className?: string },
): ReactNode {
  const cromo = leerConstructor(settings)?.buscador
  if (!cromo || !buscadorEnBarra(cromo.tipo)) return actual
  return <BuscadorCromo presentacion={cromo} primaryColor={props.primaryColor} organizationId={props.organizationId} className={props.className} />
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
}: {
  presentacion: CromoBuscador
  primaryColor: string
  organizationId?: number
  className?: string
  categorias?: { id: number; name: string }[]
}) {
  const Icono = Search
  if (presentacion.tipo === 'icon_overlay') {
    return (
      <ProductSearch
        primaryColor={primaryColor}
        icon={Icono}
        pantallaCompleta={presentacion.mobile === 'fullscreen'}
      />
    )
  }
  const ancho = presentacion.tipo === 'mini' ? 'max-w-[9rem] focus-within:max-w-md transition-all' : ''
  const sombra = presentacion.shadow ? 'shadow-lg' : ''
  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${ancho} ${sombra} ${RADIO[presentacion.radius]} ${className}`}
      style={{ maxWidth: presentacion.width }}
      data-buscador={presentacion.tipo}
    >
      {presentacion.tipo === 'mega' && (
        <select aria-label="Categoría" className="h-11 shrink-0 rounded-l-md border border-gray-200 bg-white px-2 text-sm">
          <option value="">Todas</option>
          {categorias.slice(0, 12).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      <div className="min-w-0 flex-1">
        <SearchBarInput
          primaryColor={primaryColor}
          className="w-full"
          size={presentacion.tipo === 'mini' ? 'sm' : 'lg'}
          icon={Icono}
          cromo={{
            radius: presentacion.radius,
            border: presentacion.border,
            borderColor: presentacion.borderColor,
            background: presentacion.background,
            iconSide: presentacion.iconSide,
            iconColor: presentacion.iconColor,
            iconBackground: presentacion.iconBackground,
          }}
          {...(presentacion.placeholder ? { placeholder: presentacion.placeholder } : {})}
        />
      </div>
      {presentacion.button !== 'none' && (
        <button
          type="button"
          className="inline-flex h-11 shrink-0 items-center gap-1 px-3 text-sm font-medium text-white"
          style={{ backgroundColor: primaryColor, borderRadius: presentacion.radius === 'pill' ? 999 : 8 }}
          aria-label="Buscar"
        >
          {presentacion.button === 'icon' ? <Search className="h-4 w-4" /> : 'Buscar'}
        </button>
      )}
    </div>
  )
}
