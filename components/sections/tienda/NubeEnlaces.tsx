/**
 * Sección `link_cloud · pills` («Nube de enlaces», Panorama; PLANO §3).
 *
 * Píldoras de enlaces: las categorías reales de la tienda (`source: 'categories'`, de
 * `data.categories`) o los enlaces que escribe el dueño (`source: 'manual'`). Con menos de 3
 * enlaces no se pinta nada (`nubeEnlacesVisible`): en la vista previa del editor, un aviso.
 *
 * Sin 'use client': el manifiesto lee `NubeEnlaces.CONTENT_KEYS`. Sin estado ni efectos.
 */

import { conPrefijo } from '@/lib/outlet/rutaSitio'
import { CLAVES_SECCION_TIENDA, normalizarNubeEnlaces, nubeEnlacesVisible } from '@/lib/website/v2/contrato/seccionesTienda'
import { EditorHint } from '../restaurant/EditorHint'
import { enlacesNube, motivoSeccionTiendaVacia, type DatosPaginaTienda } from './datosTienda'

export const CONTENT_KEYS = CLAVES_SECCION_TIENDA['link_cloud.pills']

interface NubeEnlacesProps {
  content: Record<string, unknown>
  data?: DatosPaginaTienda
}

const BORDE = 'color-mix(in srgb, currentColor 18%, transparent)'

export function NubeEnlaces({ content, data }: NubeEnlacesProps) {
  const n = normalizarNubeEnlaces(content)
  const enlaces = enlacesNube(content, data)
  if (!nubeEnlacesVisible(enlaces.length)) {
    const vacia = motivoSeccionTiendaVacia('link_cloud', 'pills', content, data)
    return vacia ? <EditorHint title={vacia.titulo}>{vacia.texto}</EditorHint> : null
  }
  const prefijo = typeof data?.prefijoSede === 'string' ? data.prefijoSede : ''

  return (
    <nav aria-label={n.title || 'Enlaces'}>
      {n.title && (
        <h2 className="titulo-legado mb-5 text-xl font-semibold md:text-2xl" style={{ fontFamily: 'var(--font-heading, inherit)' }}>
          {n.title}
        </h2>
      )}
      <ul className="flex flex-wrap gap-2">
        {enlaces.map((e) => (
          <li key={`${e.url}|${e.label}`}>
            <a
              href={conPrefijo(e.url, prefijo)}
              className="inline-flex min-h-[36px] items-center rounded-full border px-4 py-1.5 text-sm transition-colors hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:hover:bg-white/10"
              style={{ borderColor: BORDE }}
            >
              {e.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

NubeEnlaces.CONTENT_KEYS = CONTENT_KEYS
