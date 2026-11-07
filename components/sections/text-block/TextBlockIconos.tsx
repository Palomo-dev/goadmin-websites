/**
 * `text_block · inline_icons` («Texto con íconos», plantilla Contraste; PLANO §3).
 *
 * Una frase grande y centrada, armada por trozos (`segments[]`, máx. 12): texto o un ícono de
 * lucide dentro de un círculo, en línea con el texto. Un nombre de ícono que no existe se omite.
 * `title` (la clave de siempre de `text_block`) va como etiqueta pequeña encima: pedido a P0
 * sumarla a `CLAVES_SECCION_TIENDA['text_block.inline_icons']`.
 * Sin trozos no se pinta nada (en la vista previa, un aviso).
 *
 * Sin 'use client': el manifiesto lee `TextBlockIconos.CONTENT_KEYS`.
 */
import * as Iconos from 'lucide-react'
import { CLAVES_SECCION_TIENDA, normalizarTextoConIconos } from '@/lib/website/v2/contrato/seccionesTienda'
import { EditorHint } from '../restaurant/EditorHint'

export const CONTENT_KEYS = [...CLAVES_SECCION_TIENDA['text_block.inline_icons'], 'title'] as const

type Icono = React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>

function icono(nombre: string): Icono | null {
  const c = (Iconos as unknown as Record<string, unknown>)[nombre]
  return typeof c === 'function' || (typeof c === 'object' && c !== null && '$$typeof' in c) ? (c as Icono) : null
}

export function TextBlockIconos({ content }: { content: Record<string, unknown> }) {
  const { segments } = normalizarTextoConIconos(content)
  const etiqueta = typeof content.title === 'string' ? content.title.trim() : ''
  if (segments.length === 0) {
    return <EditorHint title="Texto sin contenido">Arma la frase con trozos de texto e íconos.</EditorHint>
  }
  return (
    <div className="mx-auto max-w-4xl text-center" data-texto-iconos="">
      {etiqueta && (
        <p className="mb-6 inline-block border border-black/15 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] dark:border-white/25">{etiqueta}</p>
      )}
      <p className="text-2xl leading-[1.6] md:text-4xl md:leading-[1.55]" style={{ fontFamily: 'var(--font-heading)' }}>
        {segments.map((s, i) => {
          if ('text' in s) return <span key={i}>{`${s.text} `}</span>
          const Icon = icono(s.icon)
          if (!Icon) return null
          return (
            <span key={i} className="mx-[0.25em] inline-flex h-[1.3em] w-[1.3em] items-center justify-center rounded-full border border-current align-middle">
              <Icon className="h-[0.55em] w-[0.55em]" aria-hidden="true" />
            </span>
          )
        })}
      </p>
    </div>
  )
}

TextBlockIconos.CONTENT_KEYS = CONTENT_KEYS
