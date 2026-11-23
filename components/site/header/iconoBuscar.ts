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

/** El dibujo de Buscar de este sitio; un nombre desconocido (o sin ajustes) pinta la lupa de hoy. */
export function iconoBuscar(settings: unknown): LucideIcon {
  const ajustes = settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : null
  const nombre = resolverIconoEncabezado('search', ajustes).nombre
  return Object.prototype.hasOwnProperty.call(ICONOS_BUSCAR_LUCIDE, nombre) ? ICONOS_BUSCAR_LUCIDE[nombre] : Search
}
