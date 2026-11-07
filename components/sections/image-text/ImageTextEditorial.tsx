/**
 * `image_text · editorial` («Editorial», plantilla Contraste; PLANO §3).
 *
 * Título grande con un enlace («Nuestra historia →»), y debajo dos columnas: a la izquierda el
 * texto y una foto pequeña con su pie; a la derecha una etiqueta sobre la foto grande.
 * Cada pieza se pinta solo si tiene contenido. Sin título, texto ni fotos no se pinta nada (en la
 * vista previa, un aviso).
 *
 * `body` es texto plano (≤1200, lo recorta el contrato): se pinta como texto, nunca como HTML.
 *
 * Sin 'use client': el manifiesto lee `ImageTextEditorial.CONTENT_KEYS`.
 */
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { CLAVES_SECCION_TIENDA, normalizarImagenTextoEditorial } from '@/lib/website/v2/contrato/seccionesTienda'
import { EditorHint } from '../restaurant/EditorHint'
import { rutaSede } from '../tienda/comunPortada'

export const CONTENT_KEYS = CLAVES_SECCION_TIENDA['image_text.editorial']

export function ImageTextEditorial({ content, data }: { content: Record<string, unknown>; data?: Record<string, unknown> }) {
  const e = normalizarImagenTextoEditorial(content)
  if (!e.title && !e.body && !e.imageUrl && !e.imageSmallUrl) {
    return <EditorHint title="Sección sin contenido">Agrega un título, un texto o una foto.</EditorHint>
  }
  const izquierda = e.body || e.imageSmallUrl
  return (
    <div data-imagen-texto="editorial">
      {(e.title || (e.linkText && e.linkUrl)) && (
        <div className="mb-10 max-w-3xl md:mb-14">
          {e.title && (
            <h2 className="text-3xl leading-tight md:text-5xl" style={{ fontFamily: 'var(--font-heading)' }}>{e.title}</h2>
          )}
          {e.linkText && e.linkUrl && (
            <Link href={rutaSede(e.linkUrl, data)} className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] hover:underline">
              {e.linkText}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}
      <div className={izquierda && e.imageUrl ? 'grid items-end gap-10 md:grid-cols-2 md:gap-12' : 'grid gap-10'}>
        {izquierda && (
          <div className="flex flex-col gap-10">
            {e.body && <p className="max-w-md whitespace-pre-line text-sm leading-relaxed opacity-80 md:text-base">{e.body}</p>}
            {e.imageSmallUrl && (
              <figure className="flex items-end gap-5">
                <div className="aspect-square w-1/2 max-w-[220px] shrink-0 overflow-hidden bg-black/5">
                  <img src={e.imageSmallUrl} alt={e.imageSmallCaption} className="h-full w-full object-cover" loading="lazy" />
                </div>
                {e.imageSmallCaption && <figcaption className="max-w-[12rem] text-sm">{e.imageSmallCaption}</figcaption>}
              </figure>
            )}
          </div>
        )}
        {e.imageUrl && (
          <div>
            {e.imageTag && <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em]">{e.imageTag}</p>}
            <div className="aspect-[4/3] overflow-hidden bg-black/5">
              <img src={e.imageUrl} alt={e.imageTag || e.title} className="h-full w-full object-cover" loading="lazy" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

ImageTextEditorial.CONTENT_KEYS = CONTENT_KEYS
