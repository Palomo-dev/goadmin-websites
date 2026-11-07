/**
 * Sección `features_grid · photo_columns` («Columnas con foto», Roble; PLANO §3).
 *
 * Hasta 6 columnas con foto, número, título y texto del dueño («Cinco materiales. Nada más.»).
 * Sin columnas con contenido no se pinta. Una columna sin foto pinta solo su texto (sin caja
 * vacía de relleno). Título y subtítulo: `title` / `subtitle` de la sección, como el resto de
 * `features_grid`; con el encabezado nuevo del editor, ese los reemplaza (`titulo-legado`).
 *
 * Sin 'use client': el manifiesto lee `RasgosConFoto.CONTENT_KEYS`.
 */

import { CLAVES_SECCION_TIENDA, normalizarColumnasFoto } from '@/lib/website/v2/contrato/seccionesTienda'
import { EditorHint } from '../restaurant/EditorHint'
import { motivoSeccionTiendaVacia, type DatosPaginaTienda } from './datosTienda'

export const CONTENT_KEYS = ['title', 'subtitle', ...CLAVES_SECCION_TIENDA['features_grid.photo_columns']] as const

interface RasgosConFotoProps {
  content: Record<string, unknown>
  data?: DatosPaginaTienda
}

const COLUMNAS_LG: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export function RasgosConFoto({ content, data }: RasgosConFotoProps) {
  const { items } = normalizarColumnasFoto(content)
  if (items.length === 0) {
    const vacia = motivoSeccionTiendaVacia('features_grid', 'photo_columns', content, data)
    return vacia ? <EditorHint title={vacia.titulo}>{vacia.texto}</EditorHint> : null
  }
  const titulo = texto(content.title)
  const subtitulo = texto(content.subtitle)

  return (
    <div>
      {(titulo || subtitulo) && (
        <div className="mb-8 grid gap-4 md:mb-10 md:grid-cols-[1fr_minmax(0,22rem)] md:items-end md:gap-10">
          {titulo ? (
            <h2 className="titulo-legado whitespace-pre-line text-3xl leading-tight md:text-5xl" style={{ fontFamily: 'var(--font-heading, inherit)' }}>
              {titulo}
            </h2>
          ) : (
            <span />
          )}
          {subtitulo && <p className="titulo-legado text-sm leading-relaxed opacity-75">{subtitulo}</p>}
        </div>
      )}
      <ul className={`grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 ${COLUMNAS_LG[Math.min(items.length, 6)]}`}>
        {items.map((item, i) => (
          <li key={i} className="flex flex-col">
            {item.imageUrl && (
              <div className="mb-3 aspect-[5/6] overflow-hidden bg-black/5" style={{ borderRadius: 'var(--radio-sitio, 0px)' }}>
                <img src={item.imageUrl} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
              </div>
            )}
            {item.title && (
              <h3 className="flex items-baseline gap-2 text-base">
                <span className="text-xs tabular-nums opacity-60" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{item.title}</span>
              </h3>
            )}
            {item.text && <p className="mt-2 text-sm leading-relaxed opacity-75">{item.text}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}

RasgosConFoto.CONTENT_KEYS = CONTENT_KEYS
