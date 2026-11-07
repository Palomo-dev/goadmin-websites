/**
 * Sección `service_cards · over_image` («Tarjetas sobre imagen», Radiante; PLANO §3).
 *
 * Una foto ancha con hasta 2 tarjetas encima (izquierda y derecha): título, enlaces a páginas
 * reales del sitio y beneficios escritos por el dueño. Sin tarjetas con contenido no se pinta.
 * La lámina trae además una calificación y un mini banner: no están en el contrato (serían cifras
 * inventadas), así que no se pintan.
 *
 * Sin 'use client': el manifiesto lee `TarjetasServicio.CONTENT_KEYS`.
 */

import { ArrowUpRight, Check } from 'lucide-react'
import { conPrefijo } from '@/lib/outlet/rutaSitio'
import { CLAVES_SECCION_TIENDA, normalizarTarjetasServicio, type TarjetaServicio } from '@/lib/website/v2/contrato/seccionesTienda'
import { EditorHint } from '../restaurant/EditorHint'
import { motivoSeccionTiendaVacia, type DatosPaginaTienda } from './datosTienda'

export const CONTENT_KEYS = CLAVES_SECCION_TIENDA['service_cards.over_image']

interface TarjetasServicioProps {
  content: Record<string, unknown>
  data?: DatosPaginaTienda
}

export function TarjetasServicio({ content, data }: TarjetasServicioProps) {
  const n = normalizarTarjetasServicio(content)
  if (n.cards.length === 0) {
    const vacia = motivoSeccionTiendaVacia('service_cards', 'over_image', content, data)
    return vacia ? <EditorHint title={vacia.titulo}>{vacia.texto}</EditorHint> : null
  }
  const prefijo = typeof data?.prefijoSede === 'string' ? data.prefijoSede : ''

  return (
    <div
      className="relative overflow-hidden bg-gray-100 p-4 sm:p-6 md:min-h-[520px] dark:bg-gray-800"
      style={{ borderRadius: 'var(--radio-sitio, 16px)' }}
    >
      {n.imageUrl && (
        <img src={n.imageUrl} alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className={`relative flex flex-col gap-4 md:flex-row md:items-start ${n.cards.length > 1 ? 'md:justify-between' : 'md:justify-start'}`}>
        {n.cards.map((card, i) => (
          <Tarjeta key={i} card={card} prefijo={prefijo} />
        ))}
      </div>
    </div>
  )
}

function Tarjeta({ card, prefijo }: { card: TarjetaServicio; prefijo: string }) {
  return (
    <div
      className="w-full bg-white p-6 text-gray-900 shadow-sm md:max-w-[22rem] dark:bg-gray-900 dark:text-white"
      style={{ borderRadius: 'min(var(--radio-sitio, 16px), 24px)' }}
    >
      {card.title && (
        <h3 className="mb-4 text-xl leading-tight md:text-2xl" style={{ fontFamily: 'var(--font-heading, inherit)' }}>
          {card.title}
        </h3>
      )}
      {card.links.length > 0 && (
        <ul className="divide-y divide-gray-200 border-b border-gray-200 dark:divide-gray-700 dark:border-gray-700">
          {card.links.map((l) => (
            <li key={`${l.url}|${l.label}`}>
              <a
                href={conPrefijo(l.url, prefijo)}
                className="flex min-h-[44px] items-center justify-between gap-3 py-2 text-sm hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              >
                <span>{l.label}</span>
                <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {card.benefits.length > 0 && (
        <ul className={`space-y-2 text-sm ${card.links.length > 0 ? 'mt-4' : ''}`}>
          {card.benefits.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

TarjetasServicio.CONTENT_KEYS = CONTENT_KEYS
