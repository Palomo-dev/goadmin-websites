'use client'

import { Search } from 'lucide-react'
import { ProductSearch } from '../ProductSearch'
import { SearchBarInput } from '../SearchBarInput'
import { useState, type ReactNode } from 'react'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { buscadorEnBarra, leerConstructor, type ContenedorIconos, type CromoBuscador } from '@/lib/website/constructorEncabezado'
import type { ColoresCaja } from './ContenedorIcono'

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
  const Icono = Search
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

/**
 * Buscador compacto del celular con el desplegable de categorías (`mobile_search_bar_categories`).
 * Desplegable angosto + campo + botón, cabe en 360px. El desplegable limita las sugerencias a
 * esa categoría; «Buscar» sin texto lleva a la categoría elegida y con texto a /search.
 */
export function BuscadorCromoCompacto({
  primaryColor,
  categorias,
  icon,
  placeholder,
  className = '',
}: {
  primaryColor: string
  categorias: { id: number; name: string; slug?: string }[]
  icon?: any
  placeholder?: string
  className?: string
}) {
  const { ruta } = useRutaSitio()
  const [categoria, setCategoria] = useState('')
  const [texto, setTexto] = useState('')
  const elegida = categorias.find((c) => String(c.id) === categoria)
  const buscar = () => {
    const q = texto.trim()
    if (q) window.location.href = `/search?q=${encodeURIComponent(q)}`
    else if (elegida?.slug) window.location.href = ruta(`/categorias/${elegida.slug}`)
  }
  return (
    <div className={`flex min-w-0 items-center gap-1.5 ${className}`} data-buscador="movil-categorias">
      <select
        aria-label="Categoría"
        value={categoria}
        onChange={(e) => setCategoria(e.target.value)}
        className="h-10 w-[5.5rem] shrink-0 truncate rounded-l-md border border-gray-200 bg-white px-1.5 text-xs text-gray-900"
      >
        <option value="">Todas</option>
        {categorias.slice(0, 12).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div className="min-w-0 flex-1">
        <SearchBarInput
          primaryColor={primaryColor}
          className="w-full"
          size="sm"
          icon={icon ?? Search}
          filtroCategoria={elegida?.name}
          onQueryChange={setTexto}
          {...(placeholder ? { placeholder } : {})}
        />
      </div>
      <button
        type="button"
        onClick={buscar}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
        style={{ backgroundColor: primaryColor }}
        aria-label="Buscar"
      >
        <Search className="h-4 w-4" />
      </button>
    </div>
  )
}
