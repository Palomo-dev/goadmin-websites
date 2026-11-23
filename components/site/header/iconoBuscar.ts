/**
 * Dibujo del buscador elegido en el editor (vista «Íconos» › Buscar). Un solo punto: todos los
 * buscadores de la tienda (ícono suelto, el que abre encima, botón y lupa de las barras visible,
 * compacta, grande y píldora flotante, y los del celular) leen el mismo `resolverIconoEncabezado`.
 * Antes la barra pintaba siempre la lupa normal y algunos encabezados solo leían `search_icon`.
 *
 * Va aparte de HeaderShared para que BuscadorCromo lo use sin importar el encabezado entero.
 */
import { Binoculars, ScanSearch, Search, SearchCheck, TextSearch, ZoomIn, type LucideIcon } from 'lucide-react'
import { resolverIconoEncabezado } from '@/lib/website/v2/iconosEncabezado'
import { iconoCabecera } from '@/components/site/iconos/iconoCabecera'
import { glifosCabecera, type RefGlifo } from '@/lib/website/v2/glifosTienda'

/** Nombre guardado → componente. Las mismas opciones que ofrece el editor (`ICONOS_BUSCAR`). */
export const ICONOS_BUSCAR_LUCIDE: Readonly<Record<string, LucideIcon>> = {
  search: Search,
  'search-lg': Search,
  'scan-search': ScanSearch,
  'text-search': TextSearch,
  'search-check': SearchCheck,
  'zoom-in': ZoomIn,
  binoculars: Binoculars,
}

/**
 * El dibujo de Buscar de este sitio; un nombre desconocido (o sin ajustes) pinta la lupa de hoy.
 * Con un dibujo del catálogo nuevo o «Estilo de los íconos» (Figma 2852:70951), el mismo ícono con
 * ese dibujo y ese estilo en TODOS los buscadores.
 */
export function iconoBuscar(settings: unknown): LucideIcon {
  const { base, nombre } = dibujoBuscar(settings)
  return iconoCabecera(base, 'buscar', nombre, settings)
}

/**
 * Las piezas del dibujo de Buscar sin el estilo de la cabecera: el de Lucide de hoy, su nombre y
 * el dibujo del catálogo nuevo si lo hay. El menú inferior las usa con SU «Estilo de los íconos».
 */
export function dibujoBuscar(settings: unknown): { base: LucideIcon; nombre: string; glifo: RefGlifo | null } {
  const ajustes = settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : null
  const nombre = resolverIconoEncabezado('search', ajustes).nombre
  const base = Object.prototype.hasOwnProperty.call(ICONOS_BUSCAR_LUCIDE, nombre) ? ICONOS_BUSCAR_LUCIDE[nombre] : Search
  return { base, nombre, glifo: glifosCabecera(ajustes).buscar ?? null }
}
