'use client'

import { Paginacion } from '@/components/site/Paginacion'
import { useEsMovilLista, useListaCarrusel } from '@/components/site/listaCarrusel'
import { resolverPaginacion, type EstiloPaginacion } from '@/lib/website/v2/paginacionCarrusel'

/** Adapta las claves históricas del listado al único renderizador de paginación del sitio. */
export function PaginacionListado({ recorte, pagina, onPagina, content, color }: {
  recorte: { paginas: number; universo: number; hasta: number }; pagina: number; onPagina: (p: number) => void; content: Record<string, unknown>; color: string; legadoGrid?: boolean
}) {
  const global = useListaCarrusel()
  const movil = useEsMovilLista()
  const estilos: Record<string, EstiloPaginacion> = { pages: 'numerada', load_more: 'cargar_mas', infinite: 'infinito' }
  const estilo = estilos[String(content.pagination)]
  const cantidad = Number(content.per_page)
  const seccion = content.paginacion ?? (estilo || cantidad > 0 ? { usar_global: false, ...(estilo ? { estilo } : {}), ...(cantidad > 0 ? { porPaginaEscritorio: cantidad, porPaginaMovil: cantidad } : {}) } : null)
  const resuelta = resolverPaginacion({ legado: 'grilla', porPagina: 12 }, global.paginacion, seccion, movil)
  if (recorte.paginas <= 1) return null
  return <Paginacion pagina={Math.min(pagina, recorte.paginas)} totalPaginas={recorte.paginas} totalItems={recorte.universo} porPagina={resuelta.porPagina} resuelta={resuelta} color={color} pathname="" search="" onIr={onPagina} />
}
