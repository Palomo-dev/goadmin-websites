'use client'

import { Search } from 'lucide-react'
import { ProductSearch } from '../ProductSearch'
import { SearchBarInput } from '../SearchBarInput'
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { urlResultadosBusqueda } from '@/lib/products/urlBusqueda'
import { buscadorEnBarra, leerConstructor, type ContenedorIconos, type CromoBuscador } from '@/lib/website/constructorEncabezado'
import type { ColoresCaja } from './ContenedorIcono'

/** La barra de hoy si no hay cromo nuevo. El overlay no ocupa la barra. */
export function barraSiCromo(
  settings: unknown,
  actual: ReactNode,
  props: {
    primaryColor: string
    organizationId?: number
    className?: string
    /** Categorías del menú: el «Buscador grande» (mega) las lista en su desplegable. */
    categorias?: { id: number; name: string; slug?: string }[]
  },
): ReactNode {
  const cromo = leerConstructor(settings)?.buscador
  if (!cromo || !buscadorEnBarra(cromo.tipo)) return actual
  const categorias = cromo.tipo === 'mega'
    ? (props.categorias ?? []).map((c) => ({ id: c.id, name: c.name, slug: c.slug }))
    : undefined
  return <BuscadorCromo presentacion={cromo} primaryColor={props.primaryColor} organizationId={props.organizationId} className={props.className} categorias={categorias} />
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
  lupaEnCampo = false,
}: {
  presentacion: CromoBuscador
  /** El celular conserva la lupa dentro del campo aunque haya botón (se ve como hasta hoy). */
  lupaEnCampo?: boolean
  primaryColor: string
  organizationId?: number
  className?: string
  categorias?: { id: number; name: string; slug?: string }[]
  contenedor?: ContenedorIconos | null
  colores?: ColoresCaja
}) {
  const Icono = Search
  const { ruta } = useRutaSitio()
  const [categoria, setCategoria] = useState('')
  const [texto, setTexto] = useState('')
  const elegida = presentacion.tipo === 'mega' ? categorias.find((c) => String(c.id) === categoria) : undefined
  const buscar = () => {
    const q = texto.trim()
    if (q) window.location.href = ruta(urlResultadosBusqueda(q, elegida?.slug))
    else if (elegida?.slug) window.location.href = ruta(`/categorias/${elegida.slug}`)
  }
  // Elegir la categoría solo la selecciona; navegar es cosa del botón o de Enter.
  const cambiarCategoria = (valor: string) => setCategoria(valor)
  const desdeUrl = useBusquedaDeUrl(presentacion.tipo === 'mega' ? categorias : [])
  useEffect(() => {
    if (desdeUrl.categoriaId) setCategoria(desdeUrl.categoriaId)
    if (desdeUrl.q) setTexto(desdeUrl.q)
  }, [desdeUrl.categoriaId, desdeUrl.q])
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
        <select aria-label="Categoría" value={categoria} onChange={(e) => cambiarCategoria(e.target.value)} className="h-11 shrink-0 rounded-l-md border border-gray-200 bg-white px-2 text-sm">
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
            // Con botón de buscar no se repite la lupa dentro del campo (escritorio).
            sinIcono: presentacion.button !== 'none' && !lupaEnCampo,
          }}
          {...(presentacion.placeholder ? { placeholder: presentacion.placeholder } : {})}
          {...(elegida ? { filtroCategoria: elegida.name, categoriaSlug: elegida.slug } : {})}
          onQueryChange={setTexto}
          {...(presentacion.tipo === 'mega' && desdeUrl.q ? { valorInicial: desdeUrl.q } : {})}
        />
      </div>
      {presentacion.button !== 'none' && (
        <button
          type="button"
          onClick={buscar}
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
 * Buscador compacto del celular con el desplegable de categorías (`mobile_search_same_as_desktop`).
 * Desplegable angosto + campo + botón, cabe en 360px. El desplegable limita las sugerencias a
 * esa categoría; «Buscar» sin texto lleva a la categoría elegida y con texto a /search.
 */
export function BuscadorCromoCompacto({
  primaryColor,
  categorias,
  icon,
  placeholder,
  className = '',
  settings,
}: {
  primaryColor: string
  categorias: { id: number; name: string; slug?: string }[]
  /** Ajustes del sitio: con cromo de buscador, la misma forma, borde y fondo que en computador. */
  settings?: unknown
  icon?: any
  placeholder?: string
  className?: string
}) {
  const { ruta } = useRutaSitio()
  // Misma presentación que BuscadorCromo en computador; sin cromo, cuadrada con puntas redondeadas.
  const cromo = leerConstructor(settings)?.buscador
  const radio = cromo && cromo.radius !== 'pill' && cromo.radius !== 'circle' ? cromo.radius : 'rounded'
  const [categoria, setCategoria] = useState('')
  const [texto, setTexto] = useState('')
  const elegida = categorias.find((c) => String(c.id) === categoria)
  const desdeUrl = useBusquedaDeUrl(categorias)
  useEffect(() => {
    if (desdeUrl.categoriaId) setCategoria(desdeUrl.categoriaId)
    if (desdeUrl.q) setTexto(desdeUrl.q)
  }, [desdeUrl.categoriaId, desdeUrl.q])
  const buscar = () => {
    const q = texto.trim()
    if (q) window.location.href = ruta(urlResultadosBusqueda(q, elegida?.slug))
    else if (elegida?.slug) window.location.href = ruta(`/categorias/${elegida.slug}`)
  }
  return (
    <div className={`flex min-w-0 items-center gap-1.5 ${className}`} data-buscador="movil-categorias">
      <select
        aria-label="Categoría"
        value={categoria}
        onChange={(e) => setCategoria(e.target.value)}
        className={`h-10 w-[5.5rem] shrink-0 truncate border border-gray-200 bg-white px-1.5 text-xs text-gray-900 ${RADIO[radio]}`}
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
          cromo={{
            radius: radio,
            border: cromo?.border,
            borderColor: cromo?.borderColor,
            background: cromo?.background,
            iconSide: cromo?.iconSide,
            iconColor: cromo?.iconColor,
            iconBackground: cromo?.iconBackground,
          }}
          filtroCategoria={elegida?.name}
          categoriaSlug={elegida?.slug}
          onQueryChange={setTexto}
          {...(desdeUrl.q ? { valorInicial: desdeUrl.q } : {})}
          {...(placeholder ? { placeholder } : {})}
        />
      </div>
      <button
        type="button"
        onClick={buscar}
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center text-white ${RADIO[radio]}`}
        style={{ backgroundColor: primaryColor }}
        aria-label="Buscar"
      >
        <Search className="h-4 w-4" />
      </button>
    </div>
  )
}

/**
 * En /search, el texto (`q`) y la categoría (`categoria`=slug → id del desplegable) que trae la
 * URL, para que el buscador del encabezado los conserve. Fuera de /search: vacío. Se lee después
 * de montar (sin desajuste de hidratación).
 */
export function leerBusquedaDeUrl(
  pathname: string,
  search: string,
  categorias: { id: number; slug?: string }[],
): { q: string; categoriaId: string } {
  if (!/\/search\/?$/.test(pathname)) return { q: '', categoriaId: '' }
  const params = new URLSearchParams(search)
  const q = (params.get('q') ?? '').trim()
  const slug = params.get('categoria') ?? ''
  const cat = slug ? categorias.find((c) => c.slug === slug) : undefined
  return { q, categoriaId: cat ? String(cat.id) : '' }
}

function useBusquedaDeUrl(categorias: { id: number; slug?: string }[]) {
  const [valor, setValor] = useState({ q: '', categoriaId: '' })
  const claves = categorias.map((c) => c.slug ?? '').join('|')
  useEffect(() => {
    setValor(leerBusquedaDeUrl(window.location.pathname, window.location.search, categorias))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claves])
  return valor
}

/** Hay cromo de barra (mini, grande, píldora o barra con estilo) que el celular puede copiar. */
export function hayCromoEnBarra(settings: unknown): boolean {
  const cromo = leerConstructor(settings)?.buscador
  return !!cromo && buscadorEnBarra(cromo.tipo)
}

/**
 * Buscador del celular igual al de escritorio (`mobile_search_same_as_desktop`).
 * «Buscador grande» → BuscadorCromoCompacto (mismas puntas, «Todas» y botón primario en 360px);
 * mini, píldora y barra con estilo → el mismo BuscadorCromo a todo el ancho.
 */
export function BuscadorMovilComoEscritorio(props: {
  settings: unknown
  primaryColor: string
  categorias?: { id: number; name: string; slug?: string }[]
  icon?: ComponentProps<typeof BuscadorCromoCompacto>['icon']
  className?: string
  placeholder?: string
}) {
  const cromo = leerConstructor(props.settings)?.buscador
  if (cromo?.tipo === 'mega') return <BuscadorCromoCompacto {...props} categorias={props.categorias ?? []} />
  if (!cromo) return null
  return <BuscadorCromo presentacion={{ ...cromo, width: undefined, ...(props.placeholder && !cromo.placeholder ? { placeholder: props.placeholder } : {}) }} primaryColor={props.primaryColor} className={`w-full ${props.className ?? ''}`} lupaEnCampo />
}
